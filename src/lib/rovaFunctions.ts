import { supabase } from './supabase';
import { formatCurrency } from './format';

export interface RecordSaleParams {
  userId: string;
  amount: number;
  description: string;
  clientName?: string;
  date?: string;
  accountId?: string;
  itemId?: string;
  itemName?: string;
  quantity?: number;
}

export interface CreateInvoiceParams {
  userId: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  dueDate?: string;
  taxRate?: number;
  paymentStatus?: 'unpaid' | 'paid_in_full' | 'part_payment';
  amountPaid?: number;
  notes?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    inventoryItemId?: string;
  }>;
}

export interface RecordExpenseParams {
  userId: string;
  amount: number;
  description: string;
  categoryName?: string;
  merchant?: string;
  accountId?: string;
  date?: string;
}

export interface QueryPeriodParams {
  userId: string;
  period?: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'all';
  startDate?: string;
  endDate?: string;
  categoryName?: string;
}

export interface QueryInventoryParams {
  userId: string;
  search?: string;
  status?: 'active' | 'inactive' | 'all';
}

export interface CalculateTaxParams {
  userId: string;
  period?: 'this_month' | 'this_year' | 'quarter';
  taxType?: 'VAT' | 'CIT' | 'PIT' | 'all';
}

// ── Helper: Resolve Date Range for Queries ──────────────────────────────────────
function getDateRange(period: string = 'this_month', startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    return { start: new Date(startDate), end: new Date(endDate) };
  }
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'this_week') {
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'this_month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'last_month') {
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setDate(0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'this_year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    // default all time
    start.setFullYear(2000, 0, 1);
  }
  return { start, end };
}

/**
 * 1. recordSale — Record a sales income transaction in Supabase
 */
export async function recordSale(params: RecordSaleParams, customSupabaseClient?: any) {
  const client = customSupabaseClient || supabase;
  const { userId, amount, description, clientName, date, accountId, itemId, itemName, quantity } = params;

  const saleDate = date || new Date().toISOString().split('T')[0];
  const desc = clientName ? `${description} (${clientName})` : description;

  // Insert Income Transaction
  const { data: transaction, error: txError } = await client
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: accountId || null,
      amount: Math.abs(amount),
      type: 'income',
      description: desc,
      date: saleDate,
      reference: `SALE-${Date.now().toString().slice(-6)}`,
      ai_category: 'Business Revenue',
      is_verified: true,
    })
    .select()
    .single();

  if (txError) throw new Error(`Failed to record sale transaction: ${txError.message}`);

  // Handle Inventory deduction if item specified
  let stockUpdated = false;
  let targetItemId = itemId;

  if (!targetItemId && itemName) {
    const { data: match } = await client
      .from('inventory_items')
      .select('id, current_stock')
      .eq('user_id', userId)
      .ilike('name', `%${itemName}%`)
      .maybeSingle();

    if (match) targetItemId = match.id;
  }

  if (targetItemId && quantity && quantity > 0) {
    const { data: item } = await client
      .from('inventory_items')
      .select('id, current_stock, cost_price')
      .eq('id', targetItemId)
      .single();

    if (item) {
      const newStock = Math.max(0, item.current_stock - quantity);
      await client
        .from('inventory_items')
        .update({ current_stock: newStock })
        .eq('id', item.id);

      await client.from('inventory_transactions').insert({
        user_id: userId,
        item_id: item.id,
        transaction_id: transaction.id,
        type: 'sale',
        quantity: quantity,
        unit_cost: item.cost_price,
        total_cost: quantity * item.cost_price,
        date: saleDate,
        notes: `Recorded sale via ROVA: ${desc}`,
      });
      stockUpdated = true;
    }
  }

  // Calculate Today's Total Sales
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: todayTxs } = await client
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'income')
    .gte('date', todayStr);

  const todayTotal = (todayTxs || []).reduce((sum: number, t: any) => sum + t.amount, 0);

  const formattedMsg = `✅ **Sale Recorded**: ${formatCurrency(amount)} for "${desc}".\n📊 Today's Total Sales: ${formatCurrency(todayTotal)}${stockUpdated ? ` (Stock updated for ${quantity} unit(s))` : ''}.`;

  return {
    success: true,
    transaction,
    todayTotal,
    formattedSummary: formattedMsg,
  };
}

/**
 * 2. createInvoice — Create an invoice and optional payment record in Supabase
 */
export async function createInvoice(params: CreateInvoiceParams, customSupabaseClient?: any) {
  const client = customSupabaseClient || supabase;
  const {
    userId,
    clientName,
    clientEmail = '',
    clientAddress = '',
    dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    taxRate = 7.5,
    paymentStatus = 'unpaid',
    amountPaid = 0,
    notes = '',
    items,
  } = params;

  if (!items || items.length === 0) {
    throw new Error('Invoice must contain at least one line item.');
  }

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  let computedPaid = 0;
  if (paymentStatus === 'paid_in_full') computedPaid = total;
  else if (paymentStatus === 'part_payment') computedPaid = amountPaid;
  else computedPaid = 0;

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const status = computedPaid >= total ? 'paid' : computedPaid > 0 ? 'partially_paid' : 'sent';

  // 1. Insert Invoice
  const { data: invoice, error: invError } = await client
    .from('invoices')
    .insert({
      user_id: userId,
      invoice_number: invoiceNumber,
      client_name: clientName,
      client_email: clientEmail,
      client_address: clientAddress,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: dueDate,
      status: status,
      subtotal: subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total: total,
      amount_paid: computedPaid,
      currency: 'NGN',
      notes: notes || 'Generated by ROVA AI Assistant',
    })
    .select()
    .single();

  if (invError) throw new Error(`Failed to create invoice: ${invError.message}`);

  // 2. Insert Invoice Items
  const invoiceItemsToInsert = items.map((item) => ({
    invoice_id: invoice.id,
    description: item.description,
    inventory_item_id: item.inventoryItemId || null,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    amount: item.quantity * item.unitPrice,
  }));

  const { error: itemsError } = await client
    .from('invoice_items')
    .insert(invoiceItemsToInsert);

  if (itemsError) throw new Error(`Failed to save invoice line items: ${itemsError.message}`);

  // 3. If paid, create revenue transaction
  if (computedPaid > 0) {
    await client.from('transactions').insert({
      user_id: userId,
      amount: computedPaid,
      type: 'income',
      description: `Payment for Invoice #${invoiceNumber} (${clientName})`,
      date: new Date().toISOString().split('T')[0],
      reference: invoiceNumber,
      ai_category: 'Business Revenue',
      is_verified: true,
    });
  }

  const formattedMsg = `📄 **Invoice Created Successfully**!\n` +
    `• Invoice #: **${invoiceNumber}**\n` +
    `• Client: **${clientName}**\n` +
    `• Total Amount: **${formatCurrency(total)}** (Incl. ${taxRate}% Tax: ${formatCurrency(taxAmount)})\n` +
    `• Status: **${status.toUpperCase()}** (${formatCurrency(computedPaid)} Paid)\n` +
    `• Due Date: **${dueDate}**`;

  return {
    success: true,
    invoice: { ...invoice, items: invoiceItemsToInsert },
    formattedSummary: formattedMsg,
  };
}

/**
 * 3. recordExpense — Record an expense transaction in Supabase
 */
export async function recordExpense(params: RecordExpenseParams, customSupabaseClient?: any) {
  const client = customSupabaseClient || supabase;
  const { userId, amount, description, categoryName = 'Operating Expense', merchant, accountId, date } = params;

  const expenseDate = date || new Date().toISOString().split('T')[0];
  const fullDesc = merchant ? `${description} (${merchant})` : description;

  // Insert Expense Transaction
  const { data: transaction, error: txError } = await client
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: accountId || null,
      amount: Math.abs(amount),
      type: 'expense',
      description: fullDesc,
      date: expenseDate,
      reference: `EXP-${Date.now().toString().slice(-6)}`,
      ai_category: categoryName,
      is_verified: true,
    })
    .select()
    .single();

  if (txError) throw new Error(`Failed to record expense: ${txError.message}`);

  // Insert detailed Expense record in expenses table if vendor present
  if (merchant) {
    await client.from('expenses').insert({
      user_id: userId,
      expense_number: `EXP-${Date.now().toString().slice(-6)}`,
      date: expenseDate,
      vendor: merchant,
      amount: Math.abs(amount),
      description: description,
      transaction_id: transaction.id,
    });
  }

  // Calculate This Month's Total Expenses
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const { data: monthTxs } = await client
    .from('transactions')
    .select('amount')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', startOfMonth);

  const monthTotal = (monthTxs || []).reduce((sum: number, t: any) => sum + t.amount, 0);

  const formattedMsg = `💸 **Expense Recorded**: ${formatCurrency(amount)} for "${fullDesc}".\n` +
    `🏷️ Category: ${categoryName}\n` +
    `📊 Total Expenses This Month: ${formatCurrency(monthTotal)}`;

  return {
    success: true,
    transaction,
    monthTotal,
    formattedSummary: formattedMsg,
  };
}

/**
 * 4. getSales — Query sales revenue transactions
 */
export async function getSales(params: QueryPeriodParams, customSupabaseClient?: any) {
  const client = customSupabaseClient || supabase;
  const { userId, period = 'this_month', startDate, endDate } = params;

  const { start, end } = getDateRange(period, startDate, endDate);

  const { data: txs, error } = await client
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'income')
    .gte('date', start.toISOString().split('T')[0])
    .lte('date', end.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (error) throw new Error(`Failed to query sales: ${error.message}`);

  const salesList = txs || [];
  const totalAmount = salesList.reduce((sum: number, t: any) => sum + t.amount, 0);
  const count = salesList.length;
  const periodLabel = period.replace('_', ' ');

  const recentLines = salesList
    .slice(0, 5)
    .map((t: any) => `• ${t.date?.slice(0, 10)}: ${formatCurrency(t.amount)} - ${t.description}`)
    .join('\n');

  const formattedMsg = `📈 **Sales Overview (${periodLabel.toUpperCase()})**\n` +
    `• Total Revenue: **${formatCurrency(totalAmount)}**\n` +
    `• Total Transactions: **${count}**\n` +
    (count > 0 ? `\n**Recent Sales:**\n${recentLines}` : '\nNo sales recorded for this period.');

  return {
    success: true,
    period,
    totalAmount,
    count,
    sales: salesList,
    formattedSummary: formattedMsg,
  };
}

/**
 * 5. getExpenses — Query expense transactions
 */
export async function getExpenses(params: QueryPeriodParams, customSupabaseClient?: any) {
  const client = customSupabaseClient || supabase;
  const { userId, period = 'this_month', categoryName, startDate, endDate } = params;

  const { start, end } = getDateRange(period, startDate, endDate);

  let query = client
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', start.toISOString().split('T')[0])
    .lte('date', end.toISOString().split('T')[0])
    .order('date', { ascending: false });

  if (categoryName) {
    query = query.ilike('ai_category', `%${categoryName}%`);
  }

  const { data: txs, error } = await query;
  if (error) throw new Error(`Failed to query expenses: ${error.message}`);

  const expenseList = txs || [];
  const totalAmount = expenseList.reduce((sum: number, t: any) => sum + t.amount, 0);
  const count = expenseList.length;
  const periodLabel = period.replace('_', ' ');

  // Category breakdown
  const catMap = new Map<string, number>();
  expenseList.forEach((t: any) => {
    const cat = t.ai_category || 'General Expense';
    catMap.set(cat, (catMap.get(cat) || 0) + t.amount);
  });

  const catBreakdown = Array.from(catMap.entries())
    .map(([cat, amt]) => `• ${cat}: ${formatCurrency(amt)}`)
    .slice(0, 5)
    .join('\n');

  const formattedMsg = `📉 **Expense Breakdown (${periodLabel.toUpperCase()})**\n` +
    `• Total Expenses: **${formatCurrency(totalAmount)}**\n` +
    `• Total Transactions: **${count}**\n` +
    (catMap.size > 0 ? `\n**Top Categories:**\n${catBreakdown}` : '\nNo expenses recorded for this period.');

  return {
    success: true,
    period,
    totalAmount,
    count,
    expenses: expenseList,
    categoryBreakdown: Array.from(catMap.entries()).map(([cat, amt]) => ({ category: cat, amount: amt })),
    formattedSummary: formattedMsg,
  };
}

/**
 * 6. getInventory — Query stock levels and low stock warnings
 */
export async function getInventory(params: QueryInventoryParams, customSupabaseClient?: any) {
  const client = customSupabaseClient || supabase;
  const { userId, search, status = 'active' } = params;

  let query = client
    .from('inventory_items')
    .select('*')
    .eq('user_id', userId);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data: items, error } = await query.order('name', { ascending: true });
  if (error) throw new Error(`Failed to fetch inventory: ${error.message}`);

  const inventoryList = items || [];
  const totalValuation = inventoryList.reduce(
    (sum: number, item: any) => sum + (item.current_stock || 0) * (item.cost_price || 0),
    0
  );

  const lowStockItems = inventoryList.filter(
    (item: any) => (item.current_stock || 0) <= (item.reorder_level || 5)
  );

  const itemSummaryLines = inventoryList
    .slice(0, 8)
    .map(
      (i: any) =>
        `• **${i.name}**: ${i.current_stock} ${i.unit || 'units'} in stock (Selling: ${formatCurrency(i.selling_price || 0)})`
    )
    .join('\n');

  const formattedMsg = `📦 **Inventory Status**\n` +
    `• Total Stock Items: **${inventoryList.length}**\n` +
    `• Inventory Valuation (Cost): **${formatCurrency(totalValuation)}**\n` +
    `• Low Stock Alerts: **${lowStockItems.length}** item(s)\n` +
    (inventoryList.length > 0 ? `\n**Current Stock Items:**\n${itemSummaryLines}` : '\nNo inventory items found.');

  return {
    success: true,
    items: inventoryList,
    lowStockCount: lowStockItems.length,
    totalValuation,
    formattedSummary: formattedMsg,
  };
}

/**
 * 7. getOutstandingInvoices — Query unpaid invoices and receivables
 */
export async function getOutstandingInvoices(params: { userId: string }, customSupabaseClient?: any) {
  const client = customSupabaseClient || supabase;
  const { userId } = params;

  const { data: invoices, error } = await client
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'paid')
    .order('due_date', { ascending: true });

  if (error) throw new Error(`Failed to query outstanding invoices: ${error.message}`);

  const unpaidList = invoices || [];
  const totalOutstanding = unpaidList.reduce(
    (sum: number, inv: any) => sum + ((inv.total || 0) - (inv.amount_paid || 0)),
    0
  );

  const debtorLines = unpaidList
    .map(
      (inv: any) =>
        `• **${inv.client_name}** — Invoice #${inv.invoice_number}: Owed **${formatCurrency((inv.total || 0) - (inv.amount_paid || 0))}** (Due: ${inv.due_date || 'N/A'})`
    )
    .join('\n');

  const formattedMsg = `📋 **Outstanding Invoices / Receivables**\n` +
    `• Total Amount Owed to You: **${formatCurrency(totalOutstanding)}**\n` +
    `• Outstanding Invoices Count: **${unpaidList.length}**\n` +
    (unpaidList.length > 0 ? `\n**Unpaid Client Breakdown:**\n${debtorLines}` : '\n🎉 All invoices have been paid! No outstanding receivables.');

  return {
    success: true,
    invoices: unpaidList,
    totalOutstanding,
    formattedSummary: formattedMsg,
  };
}

/**
 * 8. calculateTax — Calculate VAT and estimated Nigerian Corporate Tax (CIT/PIT)
 */
export async function calculateTax(params: CalculateTaxParams, customSupabaseClient?: any) {
  const client = customSupabaseClient || supabase;
  const { userId, period = 'this_year' } = params;

  const { start, end } = getDateRange(period);

  const { data: txs, error } = await client
    .from('transactions')
    .select('amount, type')
    .eq('user_id', userId)
    .gte('date', start.toISOString().split('T')[0])
    .lte('date', end.toISOString().split('T')[0]);

  if (error) throw new Error(`Failed to calculate tax records: ${error.message}`);

  const allTxs = txs || [];
  const grossIncome = allTxs.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + t.amount, 0);
  const allowableExpenses = allTxs.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + t.amount, 0);
  const netProfit = Math.max(0, grossIncome - allowableExpenses);

  // VAT in Nigeria: 7.5% standard rate on gross sales
  const vatLiability = grossIncome * 0.075;

  // Nigerian Companies Income Tax (CIT) for SMEs:
  // Small business (< ₦25M turnover): 0% CIT rate under Nigeria Tax Act
  // Medium business (₦25M - ₦100M turnover): 20%
  // Large business (> ₦100M turnover): 30%
  let citRate = 0;
  if (grossIncome > 100000000) citRate = 0.30;
  else if (grossIncome >= 25000000) citRate = 0.20;
  else citRate = 0.0; // Small business tax exemption

  const estimatedCIT = netProfit * citRate;
  const totalTaxEstimate = vatLiability + estimatedCIT;

  const formattedMsg = `🏛️ **Tax Estimation & Computation (${period.replace('_', ' ').toUpperCase()})**\n` +
    `• Gross Business Revenue: **${formatCurrency(grossIncome)}**\n` +
    `• Allowable Deductible Expenses: **${formatCurrency(allowableExpenses)}**\n` +
    `• Net Taxable Profit: **${formatCurrency(netProfit)}**\n\n` +
    `📊 **Tax Breakdown:**\n` +
    `• VAT Liability (7.5%): **${formatCurrency(vatLiability)}**\n` +
    `• Estimated Companies Income Tax (${(citRate * 100).toFixed(0)}% SME tier): **${formatCurrency(estimatedCIT)}**\n` +
    `• **Total Estimated Tax Liability**: **${formatCurrency(totalTaxEstimate)}**\n` +
    (grossIncome < 25000000 ? `\n💡 *Note: Your business turnover is under ₦25M, qualifying for 0% Companies Income Tax exemption under Nigerian Tax laws.*` : '');

  return {
    success: true,
    grossIncome,
    allowableExpenses,
    netProfit,
    vatLiability,
    estimatedCIT,
    totalTaxEstimate,
    formattedSummary: formattedMsg,
  };
}
