import { supabase } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClassifyResult = {
  category: string;
  type: 'income' | 'expense' | 'transfer';
  intent:
    | 'salary_payment'
    | 'inventory_purchase'
    | 'invoice_payment'
    | 'general_expense'
    | 'general_income'
    | 'transfer'
    | 'unknown';
  employee_name: string | null;
  inventory_item: string | null;
  quantity: number | null;
  unit_price: number | null;
  client_name: string | null;
  clarification_needed: boolean;
  ai_question: string | null;
  confidence: number;
};

export type TransactionInput = {
  id?: string;
  description: string;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
  date?: string;
};

export type PendingClarification = {
  id: string;
  user_id: string;
  transaction_id: string | null;
  original_description: string;
  suggested_intent: string;
  suggested_employee: string | null;
  suggested_item: string | null;
  suggested_quantity: number | null;
  suggested_amount: number | null;
  ai_question: string;
  status: 'pending' | 'resolved' | 'dismissed';
  notification_id: string | null;
  resolved_at: string | null;
  created_at: string;
};

// ── Classify a transaction via the edge function ──────────────────────────────

export async function classifyTransaction(
  transaction: TransactionInput,
  userId: string,
  mode: 'preview' | 'full' = 'full'
): Promise<ClassifyResult> {
  const { data, error } = await supabase.functions.invoke('ai-classify', {
    body: { transaction, userId, mode },
  });

  if (error) throw new Error(error.message);
  if (!data?.result) throw new Error('No classification result returned');

  return data.result as ClassifyResult;
}

// ── Chat with DeepSeek via edge function ──────────────────────────────────────

export type ChatPayload = {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  context: {
    transactions: any[];
    accounts: any[];
    userId: string;
    isStaff?: boolean;
  };
};

export type ChatResponse = {
  reply: string;
  actions?: ChatAction[];
};

export type ChatAction = {
  type: 'create_invoice' | 'add_inventory' | 'record_payroll' | 'clarify_transaction' | 'view_report' | 'view_invoice';
  label: string;
  payload?: Record<string, any>;
};

export async function chatWithAssistant(payload: ChatPayload): Promise<ChatResponse> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: payload,
  });

  if (error) throw new Error(error.message);
  return data as ChatResponse;
}

// ── Fetch pending clarifications for the current user ────────────────────────

export async function fetchPendingClarifications(userId: string): Promise<PendingClarification[]> {
  const { data, error } = await supabase
    .from('ai_pending_clarifications')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as PendingClarification[];
}

// ── Resolve a clarification (user answered) ───────────────────────────────────

export async function resolveClarification(
  clarificationId: string,
  notificationId: string | null
): Promise<void> {
  // Mark clarification as resolved
  await supabase
    .from('ai_pending_clarifications')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', clarificationId);

  // Dismiss the associated notification (so it doesn't show in the notifications page)
  if (notificationId) {
    await supabase
      .from('notifications')
      .update({ is_dismissed: true, is_read: true })
      .eq('id', notificationId);
  }
}

// ── Dismiss a clarification without answering ────────────────────────────────

export async function dismissClarification(
  clarificationId: string,
  notificationId: string | null
): Promise<void> {
  await supabase
    .from('ai_pending_clarifications')
    .update({ status: 'dismissed' })
    .eq('id', clarificationId);

  if (notificationId) {
    await supabase
      .from('notifications')
      .update({ is_dismissed: true })
      .eq('id', notificationId);
  }
}

// ── Apply inventory intent: add stock ─────────────────────────────────────────

export async function applyInventoryIntent(params: {
  userId: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  transactionId?: string;
  date: string;
}): Promise<{ success: boolean; itemId?: string; error?: string }> {
  // Try to find an existing inventory item matching the name
  const { data: existing } = await supabase
    .from('inventory_items')
    .select('id, current_stock')
    .eq('user_id', params.userId)
    .ilike('name', `%${params.itemName}%`)
    .maybeSingle();

  let itemId: string;

  if (existing) {
    // Update stock
    const { error } = await supabase
      .from('inventory_items')
      .update({ current_stock: existing.current_stock + params.quantity })
      .eq('id', existing.id);
    if (error) return { success: false, error: error.message };
    itemId = existing.id;
  } else {
    // Create new item
    const { data: newItem, error } = await supabase
      .from('inventory_items')
      .insert({
        user_id: params.userId,
        name: params.itemName,
        sku: `SKU-${Date.now()}`,
        unit: 'unit',
        cost_price: params.unitCost,
        selling_price: params.unitCost,
        current_stock: params.quantity,
        reorder_level: 5,
        status: 'active',
      })
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    itemId = newItem.id;
  }

  // Record inventory transaction
  await supabase.from('inventory_transactions').insert({
    user_id: params.userId,
    item_id: itemId,
    transaction_id: params.transactionId ?? null,
    type: 'purchase',
    quantity: params.quantity,
    unit_cost: params.unitCost,
    total_cost: params.quantity * params.unitCost,
    date: params.date,
    notes: 'Auto-recorded by ROVA AI',
  });

  return { success: true, itemId };
}

// ── Apply payroll intent: link to existing employee or flag for creation ──────

export async function findEmployeeByName(userId: string, name: string): Promise<any | null> {
  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', userId)
    .ilike('full_name', `%${name}%`)
    .maybeSingle();
  return data ?? null;
}

export async function applyPayrollIntent(params: {
  userId: string;
  employeeName: string;
  amount: number;
  transactionId: string;
  date: string;
}): Promise<{ success: boolean; payslipId?: string; error?: string }> {
  // 1. Find employee
  const employee = await findEmployeeByName(params.userId, params.employeeName);
  if (!employee) {
    return { success: false, error: `Employee "${params.employeeName}" not found.` };
  }

  // 2. Determine period dates and label from date
  const txDate = new Date(params.date);
  const year = txDate.getFullYear();
  const month = txDate.getMonth(); // 0-indexed
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthLabel = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const periodStart = firstDay.toISOString().split('T')[0];
  const periodEnd = lastDay.toISOString().split('T')[0];

  // Calculate deductions
  const paye = params.amount * ((employee.paye_rate || 7.5) / 100);
  const pension = params.amount * ((employee.pension_rate || 8.0) / 100);
  const net = params.amount - paye - pension;

  // 3. Find or create payroll run for this period
  let runId: string;
  const { data: existingRun } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('user_id', params.userId)
    .eq('period_label', monthLabel)
    .maybeSingle();

  if (existingRun) {
    runId = existingRun.id;
    // Update existing run totals
    await supabase
      .from('payroll_runs')
      .update({
        total_gross: (existingRun.total_gross || 0) + params.amount,
        total_paye: (existingRun.total_paye || 0) + paye,
        total_pension: (existingRun.total_pension || 0) + pension,
        total_net: (existingRun.total_net || 0) + net,
        employee_count: (existingRun.employee_count || 0) + 1,
      })
      .eq('id', runId);
  } else {
    // Create new payroll run
    const { data: newRun, error: runErr } = await supabase
      .from('payroll_runs')
      .insert({
        user_id: params.userId,
        period_label: monthLabel,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'processed',
        total_gross: params.amount,
        total_paye: paye,
        total_pension: pension,
        total_net: net,
        employee_count: 1,
        notes: 'Automatically generated by ROVA AI linking',
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (runErr) return { success: false, error: runErr.message };
    runId = newRun.id;
  }

  // 4. Create payslip
  const { data: payslip, error: slipErr } = await supabase
    .from('payslips')
    .insert({
      payroll_run_id: runId,
      employee_id: employee.id,
      user_id: params.userId,
      gross_salary: params.amount,
      paye_deduction: paye,
      pension_deduction: pension,
      other_deductions: 0,
      net_pay: net,
      transaction_id: params.transactionId,
      notes: 'Auto-linked by ROVA AI',
    })
    .select()
    .single();

  if (slipErr) return { success: false, error: slipErr.message };

  // 5. Update transaction category to "Payroll" if a match is found
  const { data: payrollCat } = await supabase
    .from('categories')
    .select('id')
    .eq('name', 'Payroll')
    .maybeSingle();

  if (payrollCat) {
    await supabase
      .from('transactions')
      .update({ category_id: payrollCat.id })
      .eq('id', params.transactionId);
  }

  return { success: true, payslipId: payslip.id };
}
