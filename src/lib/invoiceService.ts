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
  allow_partial_payments?: boolean;
  partial_payment_type?: 'any' | 'minimum' | 'fixed_deposit';
  minimum_partial_amount?: number | null;
  fixed_deposit_amount?: number | null;
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
  // Sequential chronological invoice number per user (INV-001, INV-002, ...)
  let invoiceNumber = 'INV-001';
  try {
    const { data: existingInvs } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('user_id', input.userId);

    let maxInvNum = 0;
    if (existingInvs && existingInvs.length > 0) {
      for (const inv of existingInvs) {
        if (!inv.invoice_number) continue;
        const match = inv.invoice_number.match(/INV-(\d+)/i);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > maxInvNum) maxInvNum = n;
        }
      }
      if (maxInvNum === 0) maxInvNum = existingInvs.length;
    }
    invoiceNumber = `INV-${String(maxInvNum + 1).padStart(3, '0')}`;
  } catch (err) {
    const { count: invCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', input.userId);
    const nextInvNum = ((invCount ?? 0) + 1).toString().padStart(3, '0');
    invoiceNumber = `INV-${nextInvNum}`;
  }

  let initialAmountPaid = 0;
  let status: 'draft' | 'sent' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' = 'sent';

  if (input.payment_status === 'paid_in_full') {
    initialAmountPaid = total;
    status = 'paid';
  } else if (input.payment_status === 'part_payment') {
    initialAmountPaid = input.amount_paid ?? 0;
    if (initialAmountPaid >= total) {
      status = 'paid';
    } else if (initialAmountPaid > 0) {
      status = 'partially_paid';
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
    allow_partial_payments: Boolean(input.allow_partial_payments),
    partial_payment_type: input.partial_payment_type || 'any',
    minimum_partial_amount: input.minimum_partial_amount || null,
    fixed_deposit_amount: input.fixed_deposit_amount || null,
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

  // Insert payment transactions and invoice_payment entry if paid immediately or part payment
  if (initialAmountPaid > 0) {
    const paymentRef = `INIT-${invoiceNumber}-${Date.now().toString().slice(-4)}`;
    const { data: tx } = await supabase.from('transactions').insert({
      user_id: input.userId,
      amount: initialAmountPaid,
      type: 'income',
      description: `Payment for ${invoiceNumber}`,
      reference: paymentRef,
      date: new Date().toISOString().split('T')[0],
      is_verified: true,
      ai_category: 'Sales Revenue',
      notes: input.payment_status === 'paid_in_full' 
        ? `Full immediate payment from ${input.client_name}` 
        : `Initial part payment from ${input.client_name}`,
    }).select('id').maybeSingle();

    await supabase.from('invoice_payments').insert({
      user_id: input.userId,
      invoice_id: inv.id,
      amount: initialAmountPaid,
      currency: 'NGN',
      payment_method: 'Direct/Immediate',
      payment_reference: paymentRef,
      payment_date: new Date().toISOString(),
      status: 'verified',
      transaction_id: tx?.id || null,
      payer_name: input.client_name,
      payer_email: input.client_email || null,
      notes: input.payment_status === 'paid_in_full' ? 'Initial payment in full' : 'Initial deposit / partial payment',
    });
  }

  return inv;
}

/**
 * Fetches all payment instalments recorded for an invoice
 */
export async function getInvoicePayments(invoiceId: string) {
  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('payment_date', { ascending: false });

  if (error) {
    console.warn('Error fetching invoice payments:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Executes atomic invoice payment recording
 */
export async function recordInvoicePayment(params: {
  invoiceId: string;
  amount: number;
  paymentReference: string;
  paymentMethod?: string;
  payerName?: string;
  payerEmail?: string;
  notes?: string;
  rawPayload?: any;
}) {
  const { data, error } = await supabase.rpc('record_invoice_payment_atomic', {
    p_invoice_id: params.invoiceId,
    p_amount: params.amount,
    p_payment_reference: params.paymentReference,
    p_payment_method: params.paymentMethod || 'Paystack',
    p_payer_name: params.payerName || null,
    p_payer_email: params.payerEmail || null,
    p_notes: params.notes || null,
    p_raw_payload: params.rawPayload || {},
  });

  if (error) throw error;
  if (!data?.success) {
    throw new Error(data?.error || 'Failed to record invoice payment');
  }
  return data;
}

export type PublicInvoiceResponse = Awaited<ReturnType<typeof getPublicInvoice>>;

/**
 * Fetches invoice and its line items for public or authenticated payment checkout
 */
export async function getPublicInvoice(idOrSlug: string) {
  // Support lookup by UUID or invoice_number
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  let invQuery = supabase.from('invoices').select('*');
  if (isUUID) {
    invQuery = invQuery.eq('id', idOrSlug);
  } else {
    invQuery = invQuery.ilike('invoice_number', idOrSlug);
  }

  const { data: inv, error: invError } = await invQuery.maybeSingle();
  if (invError || !inv) {
    throw new Error('Invoice not found.');
  }

  const [itemsRes, paymentsRes, profileRes] = await Promise.all([
    supabase.from('invoice_items').select('*').eq('invoice_id', inv.id),
    supabase.from('invoice_payments').select('*').eq('invoice_id', inv.id).order('payment_date', { ascending: false }),
    supabase.from('profiles').select('business_name, full_name, phone').eq('id', inv.user_id).maybeSingle(),
  ]);

  return {
    ...inv,
    items: itemsRes.data || [],
    payments: paymentsRes.data || [],
    merchant_name: profileRes.data?.business_name || profileRes.data?.full_name || 'ROVA Business Merchant',
    merchant_phone: profileRes.data?.phone || '',
  };
}
