/**
 * RovaFlow SME Budgeting Engine
 *
 * Strictly adheres to SME accounting rules:
 * - Budgets NEVER create journal entries or alter financial statements.
 * - Actuals are automatically derived from recorded accounting records (transactions, and bills/invoices on accrual basis).
 * - Uses final accounting classification (`getCategoryRule` + `CATEGORY_ID_TO_COA_CODE`).
 * - Excludes internal transfers between the business's own accounts.
 * - Avoids double-counting (e.g., excludes unpaid bills on cash basis, excludes invoice/bill settlements on accrual basis).
 * - Handles reversals and refunds cleanly.
 */

import { supabase, type Transaction } from './supabase';
import { getCategoryRule } from './accountingRules';
import { CATEGORY_ID_TO_COA_CODE, STANDARD_NIGERIA_COA } from './standardCoa';

export type BudgetPeriodType = 'monthly' | 'annual';
export type BudgetType = 'expense' | 'revenue';
export type BudgetAccountingBasis = 'cash' | 'accrual';

export interface BudgetRecord {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  period: BudgetPeriodType;
  start_date: string;
  end_date: string;
  budget_type: BudgetType;
  category_name: string | null;
  coa_account_code: string | null;
  accounting_basis: BudgetAccountingBasis;
  alerts_enabled: boolean;
  alert_75_sent_at: string | null;
  alert_90_sent_at: string | null;
  alert_100_sent_at: string | null;
  alert_over_sent_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface BudgetCategoryOption {
  label: string;
  budgetType: BudgetType;
  coaCode: string;
  keywords: string[];
  defaultMonthlyAmount?: number;
}

export const SME_BUDGET_CATEGORY_OPTIONS: BudgetCategoryOption[] = [
  // Expense categories (plain-English SME labels mapped to Standard Nigeria COA)
  { label: 'Rent', budgetType: 'expense', coaCode: '6030', keywords: ['rent', 'lease', 'premises', 'office rent'], defaultMonthlyAmount: 150000 },
  { label: 'Transportation & Logistics', budgetType: 'expense', coaCode: '6090', keywords: ['transport', 'travel', 'logistics', 'delivery', 'uber', 'bolt', 'fuel', 'haulage', 'dispatch'], defaultMonthlyAmount: 60000 },
  { label: 'Electricity & Utilities', budgetType: 'expense', coaCode: '6040', keywords: ['electricity', 'power', 'nepa', 'phcn', 'ekedc', 'ikedc', 'diesel', 'fuel', 'generator', 'utility', 'utilities', 'water'], defaultMonthlyAmount: 50000 },
  { label: 'Salaries & Wages', budgetType: 'expense', coaCode: '6010', keywords: ['salary', 'salaries', 'wages', 'payroll', 'staff pay', 'stipend'], defaultMonthlyAmount: 300000 },
  { label: 'Marketing & Advertising', budgetType: 'expense', coaCode: '6060', keywords: ['marketing', 'advert', 'ads', 'facebook', 'instagram', 'meta', 'google ads', 'promo', 'branding', 'commission'], defaultMonthlyAmount: 50000 },
  { label: 'Inventory Purchases', budgetType: 'expense', coaCode: '5010', keywords: ['inventory', 'stock', 'goods for resale', 'merchandise', 'raw material', 'purchases', 'direct cost', 'cogs'], defaultMonthlyAmount: 250000 },
  { label: 'Internet & Subscriptions', budgetType: 'expense', coaCode: '6080', keywords: ['internet', 'data', 'wifi', 'airtime', 'telecom', 'software', 'subscription', 'saas', 'hosting', 'domain'], defaultMonthlyAmount: 35000 },
  { label: 'Repairs & Maintenance', budgetType: 'expense', coaCode: '6050', keywords: ['repair', 'maintenance', 'servicing', 'plumber', 'electrician', 'fix'], defaultMonthlyAmount: 30000 },
  { label: 'Office Supplies & Stationery', budgetType: 'expense', coaCode: '6110', keywords: ['stationery', 'supplies', 'printing', 'paper', 'office supply'], defaultMonthlyAmount: 20000 },
  { label: 'Professional & Legal Fees', budgetType: 'expense', coaCode: '6070', keywords: ['legal', 'audit', 'accounting', 'consultant', 'advisory', 'licence', 'license', 'permit'], defaultMonthlyAmount: 40000 },
  { label: 'Insurance', budgetType: 'expense', coaCode: '6100', keywords: ['insurance', 'policy', 'premium'], defaultMonthlyAmount: 25000 },
  { label: 'Staff Welfare & Training', budgetType: 'expense', coaCode: '6020', keywords: ['welfare', 'hmo', 'pension', 'training', 'lunch', 'staff benefit'], defaultMonthlyAmount: 30000 },
  { label: 'Bank Charges & Fees', budgetType: 'expense', coaCode: '6120', keywords: ['bank charge', 'transfer fee', 'sms alert', 'stamp duty', 'pos charge', 'paystack fee'], defaultMonthlyAmount: 15000 },
  { label: 'Other Business Expenses', budgetType: 'expense', coaCode: '6110', keywords: ['misc', 'other expense', 'general expense', 'petty cash'], defaultMonthlyAmount: 40000 },

  // Revenue categories
  { label: 'Sales / Service Revenue', budgetType: 'revenue', coaCode: '4010', keywords: ['sales', 'revenue', 'product sale', 'service', 'pos sales', 'store sales'], defaultMonthlyAmount: 1200000 },
  { label: 'Technical & Logistics Services', budgetType: 'revenue', coaCode: '4020', keywords: ['consulting', 'technical', 'retainer', 'project fee', 'logistics service'], defaultMonthlyAmount: 400000 },
  { label: 'Other Operating Income', budgetType: 'revenue', coaCode: '4090', keywords: ['other income', 'grant', 'commission received', 'misc income'], defaultMonthlyAmount: 100000 },
];

export type BudgetHealthStatus = 'healthy' | 'warning_75' | 'warning_90' | 'reached_100' | 'exceeded';

export interface BudgetPerformance {
  budget: BudgetRecord;
  budgetAmount: number;
  actualAmount: number;
  remainingAmount: number;      // budgetAmount - actualAmount (can be negative when overspent)
  overBudgetAmount: number;     // max(0, actualAmount - budgetAmount) for expense; 0 for revenue
  utilizationPct: number;       // (actualAmount / budgetAmount) * 100
  status: BudgetHealthStatus;
  matchedCount: number;
}

export interface BudgetSummaryMetrics {
  totalExpenseBudget: number;
  totalExpenseActual: number;
  totalExpenseRemaining: number;
  totalExpenseOverBudget: number;
  expenseUtilizationPct: number;

  totalRevenueBudget: number;
  totalRevenueActual: number;
  revenueAchievementPct: number;

  projectedNet: number;
  actualNet: number;

  approachingCategories: BudgetPerformance[]; // 75% <= pct < 100% (expense)
  exceedingCategories: BudgetPerformance[];   // pct >= 100% (expense)
}

export function computePeriodEndDate(startDate: string, period: BudgetPeriodType): string {
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) return startDate;
  if (period === 'annual') {
    const end = new Date(Date.UTC(y + 1, m - 1, d - 1));
    return end.toISOString().slice(0, 10);
  }
  // Monthly: last day of the month of startDate (if starts on 1st) or same day next month - 1
  if (d === 1) {
    const end = new Date(Date.UTC(y, m, 0));
    return end.toISOString().slice(0, 10);
  }
  const end = new Date(Date.UTC(y, m, d - 1));
  return end.toISOString().slice(0, 10);
}

export function getNextPeriodDates(startDate: string, period: BudgetPeriodType): { start_date: string; end_date: string } {
  const [y, m, d] = startDate.split('-').map(Number);
  if (!y || !m || !d) {
    const now = new Date();
    const s = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
    return { start_date: s, end_date: computePeriodEndDate(s, period) };
  }
  const nextStart = period === 'annual'
    ? new Date(Date.UTC(y + 1, m - 1, d))
    : new Date(Date.UTC(y, m, d));
  const startStr = nextStart.toISOString().slice(0, 10);
  return {
    start_date: startStr,
    end_date: computePeriodEndDate(startStr, period),
  };
}

function normalizeStr(v?: string | null): string {
  return (v || '').toLowerCase().trim();
}

/**
 * Determines whether a transaction matches a given budget using final accounting classification.
 * - Never includes transfers between own accounts.
 * - Avoids double-counting settlements on accrual basis.
 * - Respects reversals/refunds by returning a signed contribution (+ or -).
 */
export function getTransactionBudgetContribution(
  tx: Transaction & { category?: { id?: string; name?: string } | null; classification_type?: string | null },
  budget: BudgetRecord
): number {
  const txDate = (tx.date || '').slice(0, 10);
  const start = (budget.start_date || '').slice(0, 10);
  const end = (budget.end_date || computePeriodEndDate(start, budget.period)).slice(0, 10);
  if (!txDate || txDate < start || txDate > end) return 0;

  // Exclude internal transfers strictly
  if (tx.type === 'transfer' || tx.classification_type === 'transfer') return 0;

  const txCatName = (tx.category as any)?.name || '';
  const rule = getCategoryRule(txCatName, tx.type, tx.description);

  // Exclude internal transfers detected by accounting rules
  if (rule.id === 'cat_in_transfer' || rule.id === 'cat_out_transfer') return 0;

  // Exclude capital asset purchases and owner drawings/capital from operating budgets
  if (
    tx.classification_type === 'asset_purchase' ||
    tx.classification_type === 'owner_drawings' ||
    tx.classification_type === 'owner_capital' ||
    tx.classification_type === 'loan' ||
    rule.id === 'cat_out_ppe' ||
    rule.id === 'cat_out_dividends' ||
    rule.id === 'cat_out_director_withdrawal' ||
    rule.id === 'cat_in_owner_capital' ||
    rule.id === 'cat_in_loan_received' ||
    rule.id === 'cat_in_director_loan' ||
    rule.id === 'cat_out_loan_principal'
  ) {
    return 0;
  }

  // On accrual basis, skip invoice/bill settlement cash movements so they aren't double-counted with invoices/bills
  if (budget.accounting_basis === 'accrual') {
    if (rule.id === 'cat_in_customer_payment' || rule.id === 'cat_out_supplier_payment') {
      return 0;
    }
  }

  const txCoaCode = CATEGORY_ID_TO_COA_CODE[rule.id] || '';
  const amount = Number(tx.amount || 0);
  if (!Number.isFinite(amount) || amount === 0) return 0;

  const isInventoryBudget =
    budget.coa_account_code === '5010' ||
    budget.coa_account_code === '1210' ||
    normalizeStr(budget.category_name).includes('inventory');

  // Determine signed contribution based on budget type
  let signedAmount = 0;
  if (budget.budget_type === 'revenue') {
    if (tx.type === 'income' && (rule.affectsPL || rule.id === 'cat_in_customer_payment')) {
      signedAmount = amount;
    } else if (rule.id === 'cat_out_customer_refund') {
      // Customer refund reduces actual revenue
      signedAmount = -Math.abs(amount);
    } else {
      return 0;
    }
  } else {
    // Expense budget
    if (tx.type === 'expense') {
      if (rule.affectsPL || (isInventoryBudget && (rule.id === 'cat_out_inventory' || rule.id === 'cat_out_direct_costs'))) {
        signedAmount = amount;
      } else if (budget.accounting_basis === 'cash' && rule.id === 'cat_out_supplier_payment') {
        signedAmount = amount;
      } else {
        return 0;
      }
    } else if (tx.type === 'income' && rule.id === 'cat_in_supplier_refund') {
      // Supplier refund reduces actual expense for that category
      signedAmount = -Math.abs(amount);
    } else {
      return 0;
    }
  }

  // Match category: 1) direct category_id, 2) COA account code, 3) category name / preset keywords
  if (budget.category_id && tx.category_id && budget.category_id === tx.category_id) {
    return signedAmount;
  }

  const budgetCatNorm = normalizeStr(budget.category_name || budget.name);
  const txCatNorm = normalizeStr(txCatName);
  const txDescNorm = normalizeStr(tx.description);

  // Broad "All Sales / Revenue" or "Sales / Service Revenue" match
  if (budget.budget_type === 'revenue') {
    if (budget.coa_account_code && txCoaCode && budget.coa_account_code === txCoaCode) {
      return signedAmount;
    }
    if (
      budget.coa_account_code === '4010' &&
      (rule.id === 'cat_in_sales' || rule.id === 'cat_in_customer_payment' || rule.id === 'cat_out_customer_refund')
    ) {
      return signedAmount;
    }
    if (budgetCatNorm && txCatNorm && (txCatNorm.includes(budgetCatNorm) || budgetCatNorm.includes(txCatNorm))) {
      return signedAmount;
    }
    return 0;
  }

  // Expense matching:
  // If inventory budget, match both 5010 (COGS) and 1210 (Inventory purchases)
  if (isInventoryBudget && (txCoaCode === '5010' || txCoaCode === '1210')) {
    return signedAmount;
  }

  // Exact COA code match (avoid matching generic 6110/6070 across unrelated categories unless preset matches)
  if (budget.coa_account_code && txCoaCode && budget.coa_account_code === txCoaCode) {
    // Disambiguate shared COA codes (e.g. 6040 is Electricity & Fuel; 6110 is Supplies & Misc)
    if (budget.coa_account_code !== '6110' && budget.coa_account_code !== '6070') {
      return signedAmount;
    }
  }

  // Direct category name overlap
  if (budgetCatNorm && txCatNorm && (txCatNorm === budgetCatNorm || txCatNorm.includes(budgetCatNorm) || budgetCatNorm.includes(txCatNorm))) {
    return signedAmount;
  }

  // Preset keyword matching
  const preset = SME_BUDGET_CATEGORY_OPTIONS.find(
    (opt) => opt.budgetType === budget.budget_type && normalizeStr(opt.label) === budgetCatNorm
  );
  if (preset) {
    const haystack = `${txCatNorm} ${txDescNorm} ${normalizeStr(rule.name)}`;
    if (preset.keywords.some((kw) => haystack.includes(kw))) {
      return signedAmount;
    }
  }

  return 0;
}

/**
 * Computes actual vs budget performance for a list of budgets using live accounting records.
 */
export function computeBudgetPerformance(
  budgets: BudgetRecord[],
  transactions: (Transaction & { category?: { id?: string; name?: string } | null; classification_type?: string | null })[],
  bills: any[] = [],
  invoices: any[] = []
): { items: BudgetPerformance[]; summary: BudgetSummaryMetrics } {
  const items: BudgetPerformance[] = budgets.map((budget) => {
    const budgetAmount = Math.max(0, Number(budget.amount || 0));
    const start = (budget.start_date || '').slice(0, 10);
    const end = (budget.end_date || computePeriodEndDate(start, budget.period)).slice(0, 10);

    let actualAmount = 0;
    let matchedCount = 0;

    // 1. Transactions (always included; accrual mode skips customer/supplier settlements to prevent double-counting)
    for (const tx of transactions) {
      const contrib = getTransactionBudgetContribution(tx, budget);
      if (contrib !== 0) {
        actualAmount += contrib;
        matchedCount += 1;
      }
    }

    // 2. Accrual-only additions: unpaid/issued bills (expense) & issued invoices (revenue)
    if (budget.accounting_basis === 'accrual') {
      if (budget.budget_type === 'expense') {
        for (const bill of bills) {
          if (bill.status === 'cancelled' || bill.status === 'void' || bill.status === 'draft') continue;
          const bDate = (bill.bill_date || bill.due_date || '').slice(0, 10);
          if (!bDate || bDate < start || bDate > end) continue;
          const bCatName = bill.category?.name || bill.description || '';
          const syntheticTx: any = {
            date: bDate,
            type: 'expense',
            amount: Number(bill.amount || 0),
            category_id: bill.category_id || null,
            category: bill.category || { name: bCatName },
            description: `${bill.vendor || ''} ${bill.description || ''}`,
          };
          const contrib = getTransactionBudgetContribution(syntheticTx, { ...budget, accounting_basis: 'cash' });
          if (contrib !== 0) {
            actualAmount += contrib;
            matchedCount += 1;
          }
        }
      } else if (budget.budget_type === 'revenue') {
        for (const inv of invoices) {
          if (inv.status === 'cancelled' || inv.status === 'void' || inv.status === 'draft') continue;
          const iDate = (inv.issue_date || inv.created_at || '').slice(0, 10);
          if (!iDate || iDate < start || iDate > end) continue;
          if (budget.coa_account_code === '4010' || normalizeStr(budget.category_name).includes('sales')) {
            actualAmount += Number(inv.total || inv.amount || 0);
            matchedCount += 1;
          }
        }
      }
    }

    actualAmount = Math.max(0, Math.round(actualAmount * 100) / 100);
    const remainingAmount = Math.round((budgetAmount - actualAmount) * 100) / 100;
    const overBudgetAmount = budget.budget_type === 'expense' ? Math.max(0, Math.round((actualAmount - budgetAmount) * 100) / 100) : 0;
    const utilizationPct = budgetAmount > 0 ? Math.round((actualAmount / budgetAmount) * 1000) / 10 : 0;

    let status: BudgetHealthStatus = 'healthy';
    if (budget.budget_type === 'expense') {
      if (utilizationPct > 100) status = 'exceeded';
      else if (utilizationPct >= 100) status = 'reached_100';
      else if (utilizationPct >= 90) status = 'warning_90';
      else if (utilizationPct >= 75) status = 'warning_75';
    } else {
      // Revenue: reaching/exceeding target is positive!
      if (utilizationPct >= 100) status = 'healthy';
      else if (utilizationPct >= 75) status = 'warning_75';
      else status = 'warning_90';
    }

    return {
      budget,
      budgetAmount,
      actualAmount,
      remainingAmount,
      overBudgetAmount,
      utilizationPct,
      status,
      matchedCount,
    };
  });

  const expenseItems = items.filter((i) => i.budget.budget_type === 'expense');
  const revenueItems = items.filter((i) => i.budget.budget_type === 'revenue');

  const totalExpenseBudget = expenseItems.reduce((s, i) => s + i.budgetAmount, 0);
  const totalExpenseActual = expenseItems.reduce((s, i) => s + i.actualAmount, 0);
  const totalExpenseRemaining = totalExpenseBudget - totalExpenseActual;
  const totalExpenseOverBudget = Math.max(0, totalExpenseActual - totalExpenseBudget);
  const expenseUtilizationPct = totalExpenseBudget > 0 ? Math.round((totalExpenseActual / totalExpenseBudget) * 1000) / 10 : 0;

  const totalRevenueBudget = revenueItems.reduce((s, i) => s + i.budgetAmount, 0);
  const totalRevenueActual = revenueItems.reduce((s, i) => s + i.actualAmount, 0);
  const revenueAchievementPct = totalRevenueBudget > 0 ? Math.round((totalRevenueActual / totalRevenueBudget) * 1000) / 10 : 0;

  const approachingCategories = expenseItems
    .filter((i) => i.utilizationPct >= 75 && i.utilizationPct < 100)
    .sort((a, b) => b.utilizationPct - a.utilizationPct);

  const exceedingCategories = expenseItems
    .filter((i) => i.utilizationPct >= 100)
    .sort((a, b) => b.utilizationPct - a.utilizationPct);

  return {
    items,
    summary: {
      totalExpenseBudget,
      totalExpenseActual,
      totalExpenseRemaining,
      totalExpenseOverBudget,
      expenseUtilizationPct,
      totalRevenueBudget,
      totalRevenueActual,
      revenueAchievementPct,
      projectedNet: totalRevenueBudget - totalExpenseBudget,
      actualNet: totalRevenueActual - totalExpenseActual,
      approachingCategories,
      exceedingCategories,
    },
  };
}

/**
 * Evaluates active expense budgets and sends threshold notifications (75%, 90%, 100%, Exceeded)
 * using RovaFlow's existing `notifications` table, preventing duplicate alerts per threshold.
 */
export async function evaluateAndDispatchBudgetAlerts(
  userId: string,
  performances?: BudgetPerformance[]
): Promise<number> {
  try {
    let perfList = performances;
    if (!perfList) {
      const [budgetsRes, txRes, billsRes, invRes] = await Promise.all([
        supabase.from('budgets').select('*').eq('user_id', userId).eq('is_active', true),
        supabase.from('transactions').select('*, category:categories(*)').eq('user_id', userId),
        supabase.from('bills').select('*, category:categories(*)').eq('user_id', userId),
        supabase.from('invoices').select('*').eq('user_id', userId),
      ]);
      const budgets = (budgetsRes.data || []) as BudgetRecord[];
      if (budgets.length === 0) return 0;
      perfList = computeBudgetPerformance(budgets, txRes.data || [], billsRes.data || [], invRes.data || []).items;
    }

    let sentCount = 0;
    const nowIso = new Date().toISOString();

    for (const perf of perfList) {
      const b = perf.budget;
      if (!b.alerts_enabled || b.budget_type !== 'expense' || perf.budgetAmount <= 0) continue;

      const label = b.category_name || b.name;
      const pct = perf.utilizationPct;
      const updates: Record<string, string> = {};
      let title = '';
      let message = '';

      if (pct > 100 && !b.alert_over_sent_at) {
        title = `Budget Exceeded: ${label}`;
        message = `You have spent ₦${perf.actualAmount.toLocaleString()} against your ₦${perf.budgetAmount.toLocaleString()} budget (${pct.toFixed(0)}%) — over by ₦${perf.overBudgetAmount.toLocaleString()}.`;
        updates.alert_over_sent_at = nowIso;
        if (!b.alert_100_sent_at) updates.alert_100_sent_at = nowIso;
        if (!b.alert_90_sent_at) updates.alert_90_sent_at = nowIso;
        if (!b.alert_75_sent_at) updates.alert_75_sent_at = nowIso;
      } else if (pct >= 100 && pct <= 100 && !b.alert_100_sent_at) {
        title = `Budget Reached (100%): ${label}`;
        message = `Your ${label} budget of ₦${perf.budgetAmount.toLocaleString()} has been fully used (100%).`;
        updates.alert_100_sent_at = nowIso;
        if (!b.alert_90_sent_at) updates.alert_90_sent_at = nowIso;
        if (!b.alert_75_sent_at) updates.alert_75_sent_at = nowIso;
      } else if (pct >= 90 && pct < 100 && !b.alert_90_sent_at) {
        title = `Budget Alert (90%): ${label}`;
        message = `You have used ${pct.toFixed(0)}% of your ${label} budget (₦${perf.actualAmount.toLocaleString()} of ₦${perf.budgetAmount.toLocaleString()}). ₦${perf.remainingAmount.toLocaleString()} remaining.`;
        updates.alert_90_sent_at = nowIso;
        if (!b.alert_75_sent_at) updates.alert_75_sent_at = nowIso;
      } else if (pct >= 75 && pct < 90 && !b.alert_75_sent_at) {
        title = `Budget Notice (75%): ${label}`;
        message = `You have used ${pct.toFixed(0)}% of your ${label} budget (₦${perf.actualAmount.toLocaleString()} of ₦${perf.budgetAmount.toLocaleString()}).`;
        updates.alert_75_sent_at = nowIso;
      }

      if (title && Object.keys(updates).length > 0) {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'alert',
          title,
          message,
          is_read: false,
          action_url: '/app/budgets',
        });
        await supabase.from('budgets').update(updates).eq('id', b.id);
        sentCount += 1;
      }
    }

    if (sentCount > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('unread-notifications-updated'));
    }
    return sentCount;
  } catch (err) {
    console.warn('[BudgetAlerts] Failed to evaluate alerts:', err);
    return 0;
  }
}

/**
 * Finds categories that consistently overspend across multiple budget periods.
 */
export function findConsistentlyOverspendingCategories(
  performances: BudgetPerformance[]
): Array<{ category: string; overspentCount: number; totalPeriods: number; totalOverAmount: number; avgUtilizationPct: number }> {
  const map = new Map<string, { overspentCount: number; totalPeriods: number; totalOverAmount: number; pctSum: number }>();

  for (const p of performances) {
    if (p.budget.budget_type !== 'expense') continue;
    const key = p.budget.category_name || p.budget.name;
    const entry = map.get(key) || { overspentCount: 0, totalPeriods: 0, totalOverAmount: 0, pctSum: 0 };
    entry.totalPeriods += 1;
    entry.pctSum += p.utilizationPct;
    if (p.utilizationPct > 100) {
      entry.overspentCount += 1;
      entry.totalOverAmount += p.overBudgetAmount;
    }
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .filter(([, v]) => v.overspentCount > 0)
    .map(([category, v]) => ({
      category,
      overspentCount: v.overspentCount,
      totalPeriods: v.totalPeriods,
      totalOverAmount: Math.round(v.totalOverAmount * 100) / 100,
      avgUtilizationPct: Math.round((v.pctSum / v.totalPeriods) * 10) / 10,
    }))
    .sort((a, b) => b.overspentCount - a.overspentCount || b.totalOverAmount - a.totalOverAmount);
}

/**
 * Returns standard CoA expense & income accounts for advanced selection.
 */
export function getBudgetableCoaAccounts(budgetType: BudgetType) {
  return STANDARD_NIGERIA_COA.filter((a) =>
    budgetType === 'revenue'
      ? a.accountType === 'income'
      : a.accountType === 'expense' || a.code === '1210'
  );
}
