import { supabase } from './supabase';

export interface CreateInvoiceInput {
  userId: string;
  client_name: string;
  client_email?: string;
  client_address?: string;
  due_date: string;
  tax_rate?: number;
  discount_rate?: number;
  notes?: string;
  payment_status: 'unpaid' | 'paid_in_full' | 'part_payment';
  amount_paid?: number;
  items: {
    description: string;
    quantity: number;
    unit_price: number;
    inventory_item_id?: string | null;
  }[];
}

export async function createInvoice(input: CreateInvoiceInput) {
  const discountRate = input.discount_rate ?? 0;
  const taxRate = input.tax_rate ?? 0;
  const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discountAmount = subtotal * (discountRate / 100);
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
  const total = subtotal - discountAmount + taxAmount;
  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

  let initialAmountPaid = 0;
  let status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' = 'sent';

  if (input.payment_status === 'paid_in_full') {
    initialAmountPaid = total;
    status = 'paid';
  } else if (input.payment_status === 'part_payment') {
    initialAmountPaid = input.amount_paid ?? 0;
    if (initialAmountPaid >= total) {
      status = 'paid';
    }
  }

  // Insert invoice
  const { data: inv, error: invError } = await supabase.from('invoices').insert({
    user_id: input.userId,
    invoice_number: invoiceNumber,
    client_name: input.client_name,
    client_email: input.client_email || null,
    client_address: input.client_address || null,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: input.payment_status === 'paid_in_full' ? new Date().toISOString().split('T')[0] : input.due_date,
    discount_rate: discountRate,
    discount_amount: discountAmount,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    subtotal,
    total,
    amount_paid: initialAmountPaid,
    notes: input.notes || null,
    status,
  }).select().maybeSingle();

  if (invError) throw invError;
  if (!inv) throw new Error('Failed to insert invoice');

  // Insert items
  const validItems = input.items.filter(item => item.description && item.unit_price > 0);
  if (validItems.length > 0) {
    const { error: itemsError } = await supabase.from('invoice_items').insert(
      validItems.map(item => ({
        invoice_id: inv.id,
        description: item.description,
        inventory_item_id: item.inventory_item_id || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
      }))
    );
    if (itemsError) throw itemsError;

    // Fetch details of inventory items to perform stock updates
    const linkedItemIds = validItems
      .map(item => item.inventory_item_id)
      .filter((id): id is string => !!id);

    if (linkedItemIds.length > 0) {
      const { data: inventoryItems } = await supabase
        .from('inventory_items')
        .select('*')
        .in('id', linkedItemIds);

      if (inventoryItems) {
        for (const item of validItems) {
          if (item.inventory_item_id) {
            const invItem = inventoryItems.find(x => x.id === item.inventory_item_id);
            if (invItem) {
              // Update stock
              await supabase.from('inventory_items').update({
                current_stock: invItem.current_stock - item.quantity
              }).eq('id', item.inventory_item_id);

              // Record stock transaction
              await supabase.from('inventory_transactions').insert({
                user_id: input.userId,
                item_id: item.inventory_item_id,
                type: 'sale',
                quantity: item.quantity,
                unit_cost: invItem.cost_price,
                total_cost: item.quantity * invItem.cost_price,
                reference: invoiceNumber,
                notes: `Sold to ${input.client_name}`,
                date: new Date().toISOString().split('T')[0],
              });

              // Record COGS Expense transaction
              if (invItem.cost_price > 0) {
                await supabase.from('transactions').insert({
                  user_id: input.userId,
                  amount: item.quantity * invItem.cost_price,
                  type: 'expense',
                  description: `COGS — ${invItem.name}`,
                  date: new Date().toISOString().split('T')[0],
                  notes: `Cost of goods sold for ${invoiceNumber}`,
                });
              }
            }
          }
        }
      }
    }
  }

  // Insert payment transactions if paid immediately or part payment
  if (initialAmountPaid > 0) {
    await supabase.from('transactions').insert({
      user_id: input.userId,
      amount: initialAmountPaid,
      type: 'income',
      description: `Payment for ${invoiceNumber}`,
      reference: invoiceNumber,
      date: new Date().toISOString().split('T')[0],
      notes: input.payment_status === 'paid_in_full' 
        ? `Full immediate payment from ${input.client_name}` 
        : `Initial part payment from ${input.client_name}`,
    });
  }

  return inv;
}
