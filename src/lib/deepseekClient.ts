import { supabase } from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClassifyResult = {
  category: string;
  type: 'income' | 'expense' | 'transfer';
  intent:
    | 'inventory_purchase'
    | 'operating_expense'
    | 'fixed_asset_purchase'
    | 'loan_repayment'
    | 'owner_withdrawal'
    | 'owner_capital'
    | 'payroll'
    | 'tax'
    | 'customer_refund'
    | 'ar_collection'
    | 'ap_payment'
    | 'salary_payment'
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
  merchant?: string | null;
  product_service?: string | null;
  journal_entry?: {
    debit: string;
    credit: string;
  };
  accounting_treatment?: string;
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

// ── Chat Types ────────────────────────────────────────────────────────────────

export type ChatPayload = {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  context: {
    transactions: any[];
    accounts: any[];
    userId: string;
    isStaff?: boolean;
    inventoryItems?: any[];
    expenses?: any[];
    bills?: any[];
    externalWorkers?: any[];
    serviceAgreements?: any[];
    documentUrl?: string;
    documentFileName?: string;
  };
  confirmed?: boolean;
  cancelled?: boolean;
  pendingToolCall?: { name: string; parameters: Record<string, any> } | null;
};

export type ChatResponse = {
  reply: string;
  actions?: ChatAction[];
  requiresConfirmation?: boolean;
  confirmationSummary?: string;
  pendingToolCall?: { name: string; parameters: Record<string, any> } | null;
  toolExecuted?: boolean;
};

export type ChatAction = {
  type:
    | 'create_invoice'
    | 'add_inventory'
    | 'add_employee'
    | 'record_payroll'
    | 'clarify_transaction'
    | 'view_report'
    | 'view_invoice'
    | 'update_transaction'
    | 'delete_transaction'
    | 'edit_inventory'
    | 'delete_inventory'
    | 'confirm_inventory_allocation'
    | 'skip_inventory_allocation'
    | 'open_whatsapp_bot'
    | 'create_customer'
    | 'view_customer'
    | 'send_invoice'
    | 'select_inventory_item'
    | 'confirm_action'
    | 'cancel_action';
  label: string;
  payload?: Record<string, any>;
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

// ── Chat with ROVA AI via edge function ───────────────────────────────────────

export async function chatWithAssistant(payload: ChatPayload): Promise<ChatResponse> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: { ...payload, source: 'web' },
  });

  if (error) throw new Error(error.message);
  return data as ChatResponse;
}

// ── Confirm a pending AI action ───────────────────────────────────────────────

export async function confirmPendingAction(
  payload: ChatPayload,
  pendingToolCall: { name: string; parameters: Record<string, any> }
): Promise<ChatResponse> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      ...payload,
      source: 'web',
      confirmed: true,
      // Re-pass the pending tool call so the edge function knows what to execute
      tool_call: pendingToolCall,
    },
  });

  if (error) throw new Error(error.message);
  return data as ChatResponse;
}

// ── Cancel a pending AI action ────────────────────────────────────────────────

export async function cancelPendingAction(
  payload: ChatPayload,
  toolName: string
): Promise<ChatResponse> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      ...payload,
      source: 'web',
      cancelled: true,
      tool_call: { name: toolName, parameters: {} },
    },
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
  await supabase
    .from('ai_pending_clarifications')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', clarificationId);

  if (notificationId) {
    await supabase
      .from('notifications')
      .update({ is_dismissed: true, is_read: true })
      .eq('id', notificationId);
  }
}

// ── Dismiss a clarification without answering ─────────────────────────────────

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
  const { data: existing } = await supabase
    .from('inventory_items')
    .select('id, current_stock')
    .eq('user_id', params.userId)
    .ilike('name', `%${params.itemName}%`)
    .maybeSingle();

  let itemId: string;

  if (existing) {
    const { error } = await supabase
      .from('inventory_items')
      .update({ current_stock: existing.current_stock + params.quantity })
      .eq('id', existing.id);
    if (error) return { success: false, error: error.message };
    itemId = existing.id;
  } else {
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

// ── Apply payroll intent ──────────────────────────────────────────────────────

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
  const employee = await findEmployeeByName(params.userId, params.employeeName);
  if (!employee) {
    return { success: false, error: `Employee "${params.employeeName}" not found.` };
  }

  const txDate = new Date(params.date);
  const year = txDate.getFullYear();
  const month = txDate.getMonth();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthLabel = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const periodStart = firstDay.toISOString().split('T')[0];
  const periodEnd = lastDay.toISOString().split('T')[0];

  const paye = params.amount * ((employee.paye_rate || 7.5) / 100);
  const pension = params.amount * ((employee.pension_rate || 8.0) / 100);
  const net = params.amount - paye - pension;

  let runId: string;
  const { data: existingRun } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('user_id', params.userId)
    .eq('period_label', monthLabel)
    .maybeSingle();

  if (existingRun) {
    runId = existingRun.id;
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
