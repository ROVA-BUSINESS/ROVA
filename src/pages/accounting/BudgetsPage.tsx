import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Target, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Bell, BellOff, Download, Edit2, Trash2, Copy, Sparkles, Calendar,
  BarChart3, Layers, X, ArrowRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { supabase, type Category, type Transaction } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/format';
import { downloadCSV } from '../../lib/export';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import {
  SME_BUDGET_CATEGORY_OPTIONS,
  computeBudgetPerformance,
  computePeriodEndDate,
  evaluateAndDispatchBudgetAlerts,
  findConsistentlyOverspendingCategories,
  getBudgetableCoaAccounts,
  getNextPeriodDates,
  type BudgetAccountingBasis,
  type BudgetPeriodType,
  type BudgetPerformance,
  type BudgetRecord,
  type BudgetType,
} from '../../lib/budgetService';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthStartStr(date: Date = new Date()): string {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1)).toISOString().slice(0, 10);
}

function getYearStartStr(date: Date = new Date()): string {
  return new Date(Date.UTC(date.getFullYear(), 0, 1)).toISOString().slice(0, 10);
}

function formatMonthLabel(dateStr: string): string {
  const [y, m] = dateStr.split('-').map(Number);
  if (!y || !m) return dateStr;
  return `${MONTHS[m - 1]} ${y}`;
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'overview' | 'plan' | 'reports'>('overview');
  const [periodFilter, setPeriodFilter] = useState<'current_month' | 'current_year' | 'all'>('current_month');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getMonthStartStr().slice(0, 7)); // YYYY-MM

  // Comparison state (Reports tab)
  const [compareMonthA, setCompareMonthA] = useState<string>(() => getMonthStartStr().slice(0, 7));
  const [compareMonthB, setCompareMonthB] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return getMonthStartStr(d).slice(0, 7);
  });

  // Create / Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingStarter, setCreatingStarter] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<BudgetType>('expense');
  const [formPeriod, setFormPeriod] = useState<BudgetPeriodType>('monthly');
  const [formStartDate, setFormStartDate] = useState(() => getMonthStartStr());
  const [formEndDate, setFormEndDate] = useState(() => computePeriodEndDate(getMonthStartStr(), 'monthly'));
  const [formCategoryName, setFormCategoryName] = useState('Rent');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formCoaCode, setFormCoaCode] = useState<string>('6030');
  const [formAmount, setFormAmount] = useState('');
  const [formBasis, setFormBasis] = useState<BudgetAccountingBasis>('cash');
  const [formAlertsEnabled, setFormAlertsEnabled] = useState(true);
  const [formNotes, setFormNotes] = useState('');

  function showToastMsg(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function loadAll(checkAlerts = false) {
    if (!user?.id) return;
    try {
      const [budgetsRes, txRes, billsRes, invRes, catRes] = await Promise.all([
        supabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('start_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('*, category:categories(*)')
          .eq('user_id', user.id)
          .order('date', { ascending: false }),
        supabase
          .from('bills')
          .select('*, category:categories(*)')
          .eq('user_id', user.id),
        supabase
          .from('invoices')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .order('name', { ascending: true }),
      ]);

      const loadedBudgets = ((budgetsRes.data || []) as any[]).map((b) => ({
        ...b,
        amount: Number(b.amount || 0),
        period: (b.period === 'annual' ? 'annual' : 'monthly') as BudgetPeriodType,
        budget_type: (b.budget_type === 'revenue' ? 'revenue' : 'expense') as BudgetType,
        accounting_basis: (b.accounting_basis === 'accrual' ? 'accrual' : 'cash') as BudgetAccountingBasis,
        end_date: b.end_date || computePeriodEndDate(b.start_date, b.period === 'annual' ? 'annual' : 'monthly'),
        alerts_enabled: b.alerts_enabled !== false,
      })) as BudgetRecord[];

      const loadedTxs = (txRes.data || []) as Transaction[];
      const loadedBills = billsRes.data || [];
      const loadedInvs = invRes.data || [];

      setBudgets(loadedBudgets);
      setTransactions(loadedTxs);
      setBills(loadedBills);
      setInvoices(loadedInvs);
      setCategories((catRes.data || []) as Category[]);

      if (checkAlerts && loadedBudgets.length > 0) {
        const { items } = computeBudgetPerformance(loadedBudgets, loadedTxs, loadedBills, loadedInvs);
        await evaluateAndDispatchBudgetAlerts(user.id, items);
      }
    } catch (err) {
      console.error('[BudgetsPage] Failed to load budget data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    loadAll(true);

    // Realtime automatic sync whenever transactions, bills, invoices, or budgets change
    const channel = supabase
      .channel(`budgets-realtime-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => loadAll(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `user_id=eq.${user.id}` }, () => loadAll(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `user_id=eq.${user.id}` }, () => loadAll(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${user.id}` }, () => loadAll(false))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // All budgets performance (for reports & consistent overspending)
  const allPerf = useMemo(
    () => computeBudgetPerformance(budgets, transactions, bills, invoices),
    [budgets, transactions, bills, invoices]
  );

  // Filtered budgets for Overview & Plan tabs
  const filteredBudgets = useMemo(() => {
    const nowYear = new Date().getFullYear().toString();
    if (periodFilter === 'all') return budgets;
    if (periodFilter === 'current_year') {
      return budgets.filter((b) => b.start_date.startsWith(nowYear) || b.end_date.startsWith(nowYear));
    }
    // current_month (or selectedMonth YYYY-MM)
    const monthStart = `${selectedMonth}-01`;
    const monthEnd = computePeriodEndDate(monthStart, 'monthly');
    return budgets.filter((b) => b.start_date <= monthEnd && b.end_date >= monthStart);
  }, [budgets, periodFilter, selectedMonth]);

  const activePerf = useMemo(
    () => computeBudgetPerformance(filteredBudgets, transactions, bills, invoices),
    [filteredBudgets, transactions, bills, invoices]
  );

  const expenseItems = useMemo(
    () => activePerf.items.filter((i) => i.budget.budget_type === 'expense'),
    [activePerf.items]
  );
  const revenueItems = useMemo(
    () => activePerf.items.filter((i) => i.budget.budget_type === 'revenue'),
    [activePerf.items]
  );

  // Chart data for Overview (Budget vs Actual by category)
  const categoryChartData = useMemo(() => {
    return expenseItems.slice(0, 10).map((item) => ({
      name: (item.budget.category_name || item.budget.name).slice(0, 18),
      Budget: item.budgetAmount,
      Actual: item.actualAmount,
    }));
  }, [expenseItems]);

  // Monthly Trend Data (Reports tab — 12 months of current year)
  const monthlyReportData = useMemo(() => {
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, idx) => {
      const mStart = new Date(Date.UTC(year, idx, 1)).toISOString().slice(0, 10);
      const mEnd = computePeriodEndDate(mStart, 'monthly');
      const monthBudgets = budgets.filter(
        (b) => b.budget_type === 'expense' && b.period === 'monthly' && b.start_date <= mEnd && b.end_date >= mStart
      );
      const perf = computeBudgetPerformance(monthBudgets, transactions, bills, invoices);
      return {
        month: MONTHS[idx],
        Budget: perf.summary.totalExpenseBudget,
        Actual: perf.summary.totalExpenseActual,
      };
    });
  }, [budgets, transactions, bills, invoices]);

  // Period Comparison Data (Month A vs Month B)
  const periodComparison = useMemo(() => {
    const getMonthMetrics = (ym: string) => {
      const mStart = `${ym}-01`;
      const mEnd = computePeriodEndDate(mStart, 'monthly');
      const list = budgets.filter((b) => b.start_date <= mEnd && b.end_date >= mStart);
      return computeBudgetPerformance(list, transactions, bills, invoices).summary;
    };
    return {
      a: getMonthMetrics(compareMonthA),
      b: getMonthMetrics(compareMonthB),
    };
  }, [budgets, transactions, bills, invoices, compareMonthA, compareMonthB]);

  const consistentlyOverspending = useMemo(
    () => findConsistentlyOverspendingCategories(allPerf.items),
    [allPerf.items]
  );

  // Open Create Modal
  function openCreateModal(defaultType: BudgetType = 'expense') {
    setEditingBudget(null);
    setFormType(defaultType);
    setFormPeriod('monthly');
    const start = `${selectedMonth}-01`;
    setFormStartDate(start);
    setFormEndDate(computePeriodEndDate(start, 'monthly'));
    const firstOpt = SME_BUDGET_CATEGORY_OPTIONS.find((o) => o.budgetType === defaultType)!;
    setFormCategoryName(firstOpt.label);
    setFormCoaCode(firstOpt.coaCode);
    setFormCategoryId('');
    setFormName(`${firstOpt.label} (${formatMonthLabel(start)})`);
    setFormAmount(firstOpt.defaultMonthlyAmount ? String(firstOpt.defaultMonthlyAmount) : '');
    setFormBasis('cash');
    setFormAlertsEnabled(true);
    setFormNotes('');
    setShowModal(true);
  }

  function openEditModal(b: BudgetRecord) {
    setEditingBudget(b);
    setFormName(b.name);
    setFormType(b.budget_type);
    setFormPeriod(b.period);
    setFormStartDate(b.start_date);
    setFormEndDate(b.end_date);
    setFormCategoryName(b.category_name || b.name);
    setFormCategoryId(b.category_id || '');
    setFormCoaCode(b.coa_account_code || '');
    setFormAmount(String(b.amount));
    setFormBasis(b.accounting_basis);
    setFormAlertsEnabled(b.alerts_enabled);
    setFormNotes(b.notes || '');
    setShowModal(true);
  }

  function handleCategorySelect(label: string) {
    setFormCategoryName(label);
    const preset = SME_BUDGET_CATEGORY_OPTIONS.find((o) => o.label === label && o.budgetType === formType);
    if (preset) {
      setFormCoaCode(preset.coaCode);
      setFormCategoryId('');
      if (!editingBudget) {
        setFormName(`${preset.label} (${formPeriod === 'annual' ? formStartDate.slice(0, 4) : formatMonthLabel(formStartDate)})`);
        if (!formAmount && preset.defaultMonthlyAmount) {
          setFormAmount(String(formPeriod === 'annual' ? preset.defaultMonthlyAmount * 12 : preset.defaultMonthlyAmount));
        }
      }
      return;
    }
    const userCat = categories.find((c) => c.name === label);
    if (userCat) {
      setFormCategoryId(userCat.id);
    }
    const coaMatch = getBudgetableCoaAccounts(formType).find((a) => `${a.code} — ${a.name}` === label);
    if (coaMatch) {
      setFormCategoryName(coaMatch.name);
      setFormCoaCode(coaMatch.code);
    }
  }

  function handlePeriodChange(nextPeriod: BudgetPeriodType) {
    setFormPeriod(nextPeriod);
    const nextStart = nextPeriod === 'annual' ? getYearStartStr() : `${selectedMonth}-01`;
    setFormStartDate(nextStart);
    setFormEndDate(computePeriodEndDate(nextStart, nextPeriod));
    if (!editingBudget && formCategoryName) {
      setFormName(`${formCategoryName} (${nextPeriod === 'annual' ? nextStart.slice(0, 4) : formatMonthLabel(nextStart)})`);
    }
  }

  function handleStartDateChange(val: string) {
    setFormStartDate(val);
    setFormEndDate(computePeriodEndDate(val, formPeriod));
  }

  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) return;
    const numericAmount = Number(formAmount);
    if (!formName.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      showToastMsg('Please enter a valid budget name and expected amount.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: formName.trim(),
        budget_type: formType,
        period: formPeriod,
        start_date: formStartDate,
        end_date: formEndDate || computePeriodEndDate(formStartDate, formPeriod),
        category_id: formCategoryId || null,
        category_name: formCategoryName || formName.trim(),
        coa_account_code: formCoaCode || null,
        amount: numericAmount,
        accounting_basis: formBasis,
        alerts_enabled: formAlertsEnabled,
        notes: formNotes.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (editingBudget) {
        const { error } = await supabase.from('budgets').update(payload).eq('id', editingBudget.id);
        if (error) throw error;
        showToastMsg('Budget updated.');
      } else {
        const { error } = await supabase.from('budgets').insert(payload);
        if (error) throw error;
        showToastMsg('Budget created.');
      }

      setShowModal(false);
      await loadAll(true);
    } catch (err: any) {
      console.error(err);
      showToastMsg(err?.message || 'Failed to save budget.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBudget(b: BudgetRecord) {
    if (!window.confirm(`Delete budget "${b.name}"? This will not affect any of your recorded transactions.`)) return;
    const { error } = await supabase.from('budgets').delete().eq('id', b.id);
    if (!error) {
      showToastMsg('Budget deleted.');
      loadAll(false);
    }
  }

  async function handleToggleAlerts(b: BudgetRecord) {
    const next = !b.alerts_enabled;
    const { error } = await supabase.from('budgets').update({ alerts_enabled: next }).eq('id', b.id);
    if (!error) {
      setBudgets((prev) => prev.map((item) => (item.id === b.id ? { ...item, alerts_enabled: next } : item)));
      showToastMsg(next ? `Alerts enabled for ${b.category_name || b.name}` : `Alerts muted for ${b.category_name || b.name}`);
    }
  }

  async function handleDuplicateNextPeriod(b: BudgetRecord) {
    if (!user?.id) return;
    const nextDates = getNextPeriodDates(b.start_date, b.period);
    const label = b.category_name || b.name;
    const nextName = `${label} (${b.period === 'annual' ? nextDates.start_date.slice(0, 4) : formatMonthLabel(nextDates.start_date)})`;

    const { error } = await supabase.from('budgets').insert({
      user_id: user.id,
      name: nextName,
      budget_type: b.budget_type,
      period: b.period,
      start_date: nextDates.start_date,
      end_date: nextDates.end_date,
      category_id: b.category_id,
      category_name: b.category_name,
      coa_account_code: b.coa_account_code,
      amount: b.amount,
      accounting_basis: b.accounting_basis,
      alerts_enabled: b.alerts_enabled,
      notes: b.notes,
      is_active: true,
    });

    if (!error) {
      showToastMsg(`Created next-period budget: ${nextName}`);
      loadAll(false);
    }
  }

  async function handleCreateStarterBudgets() {
    if (!user?.id) return;
    setCreatingStarter(true);
    try {
      const start = `${selectedMonth}-01`;
      const end = computePeriodEndDate(start, 'monthly');
      const monthLabel = formatMonthLabel(start);

      const starterKeys = [
        'Sales / Service Revenue',
        'Rent',
        'Transportation & Logistics',
        'Electricity & Utilities',
        'Salaries & Wages',
        'Marketing & Advertising',
        'Internet & Subscriptions',
      ];

      const rows = starterKeys
        .map((key) => SME_BUDGET_CATEGORY_OPTIONS.find((o) => o.label === key))
        .filter(Boolean)
        .map((opt) => ({
          user_id: user.id,
          name: `${opt!.label} (${monthLabel})`,
          budget_type: opt!.budgetType,
          period: 'monthly',
          start_date: start,
          end_date: end,
          category_name: opt!.label,
          coa_account_code: opt!.coaCode,
          amount: opt!.defaultMonthlyAmount || 50000,
          accounting_basis: 'cash',
          alerts_enabled: true,
          is_active: true,
        }));

      const { error } = await supabase.from('budgets').insert(rows);
      if (error) throw error;
      showToastMsg(`Starter budget created for ${monthLabel}! Click Edit on any row to adjust amounts.`);
      await loadAll(true);
    } catch (err: any) {
      showToastMsg(err?.message || 'Could not create starter budgets.');
    } finally {
      setCreatingStarter(false);
    }
  }

  function handleExportBudgetCSV() {
    const rows = activePerf.items.map((i) => [
      i.budget.name,
      i.budget.budget_type === 'revenue' ? 'Revenue' : 'Expense',
      i.budget.category_name || '—',
      i.budget.coa_account_code || '—',
      i.budget.period,
      i.budget.start_date,
      i.budget.end_date,
      i.budget.accounting_basis,
      i.budgetAmount,
      i.actualAmount,
      i.remainingAmount,
      i.overBudgetAmount,
      `${i.utilizationPct.toFixed(1)}%`,
    ]);
    downloadCSV(
      `rovaflow-budget-report-${selectedMonth}.csv`,
      ['Budget Name', 'Type', 'Category', 'CoA Code', 'Period', 'Start Date', 'End Date', 'Basis', 'Budget (NGN)', 'Actual (NGN)', 'Remaining (NGN)', 'Over Budget (NGN)', 'Utilisation %'],
      rows
    );
    showToastMsg('Budget report exported as CSV.');
  }

  function getProgressColor(perf: BudgetPerformance): string {
    if (perf.budget.budget_type === 'revenue') {
      if (perf.utilizationPct >= 100) return '#22c55e';
      if (perf.utilizationPct >= 75) return '#3b82f6';
      return '#f59e0b';
    }
    if (perf.utilizationPct > 100) return '#ef4444';
    if (perf.utilizationPct >= 90) return '#f97316';
    if (perf.utilizationPct >= 75) return '#eab308';
    return '#22c55e';
  }

  function getStatusBadge(perf: BudgetPerformance) {
    if (perf.budget.budget_type === 'revenue') {
      if (perf.utilizationPct >= 100) return { label: 'Target Met', bg: 'rgba(34,197,94,0.14)', color: '#22c55e' };
      if (perf.utilizationPct >= 75) return { label: 'On Track', bg: 'rgba(59,130,246,0.14)', color: '#3b82f6' };
      return { label: 'Below Target', bg: 'rgba(245,158,11,0.14)', color: '#f59e0b' };
    }
    if (perf.utilizationPct > 100) return { label: 'Over Budget', bg: 'rgba(239,68,68,0.14)', color: '#ef4444' };
    if (perf.utilizationPct >= 100) return { label: '100% Used', bg: 'rgba(239,68,68,0.14)', color: '#ef4444' };
    if (perf.utilizationPct >= 90) return { label: '90%+ Used', bg: 'rgba(249,115,22,0.14)', color: '#f97316' };
    if (perf.utilizationPct >= 75) return { label: '75%+ Used', bg: 'rgba(234,179,8,0.14)', color: '#eab308' };
    return { label: 'On Track', bg: 'rgba(34,197,94,0.14)', color: '#22c55e' };
  }

  const { summary } = activePerf;

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1180, animation: 'fadeIn 0.3s ease' }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: 'var(--bg-surface)',
            border: '1px solid var(--accent-primary)',
            color: 'var(--text-primary)',
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div
        className="mobile-col mobile-gap-4"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800 }}>Budgets</h1>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--accent-dim)', color: 'var(--accent-light)' }}>
              Auto-Synced
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Plan expected revenue and expenses, track actual performance automatically, and catch overspending early.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={handleExportBudgetCSV} disabled={activePerf.items.length === 0}>
            <Download size={14} /> Export CSV
          </Button>
          <Button variant="primary" size="sm" onClick={() => openCreateModal('expense')}>
            <Plus size={15} /> Create Budget
          </Button>
        </div>
      </div>

      {/* Period Filter & Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-surface)', padding: 4, borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
          {([
            { id: 'overview', label: 'Overview & Tracking', icon: Target },
            { id: 'plan', label: 'Revenue vs Expenses', icon: Layers },
            { id: 'reports', label: 'Reports & Trends', icon: BarChart3 },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12.5,
                fontWeight: 600,
                background: activeTab === tab.id ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {(['current_month', 'current_year', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodFilter(p)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontWeight: 600,
                background: periodFilter === p ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                color: periodFilter === p ? 'var(--accent-light)' : 'var(--text-secondary)',
                border: `1px solid ${periodFilter === p ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                cursor: 'pointer',
              }}
            >
              {p === 'current_month' ? 'Monthly View' : p === 'current_year' ? 'This Year' : 'All Periods'}
            </button>
          ))}

          {periodFilter === 'current_month' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-sm)', padding: '4px 10px' }}>
              <Calendar size={13} color="var(--text-muted)" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="mobile-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 104 }} />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        /* Empty state with 1-click starter setup */
        <Card style={{ textAlign: 'center', padding: '48px 24px', maxWidth: 640, margin: '24px auto' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Target size={28} color="var(--accent-primary)" />
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>Set up your first business budget in 1 minute</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            Plan your expected revenue and spending for Rent, Transport, Electricity, Salaries, Marketing, and more.
            RovaFlow automatically pulls actuals from your recorded transactions — no manual re-entry and zero impact on your financial statements.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={handleCreateStarterBudgets} disabled={creatingStarter}>
              <Sparkles size={15} /> {creatingStarter ? 'Creating Starter Budget...' : `Create Starter Budget (${formatMonthLabel(`${selectedMonth}-01`)})`}
            </Button>
            <Button variant="secondary" onClick={() => openCreateModal('expense')}>
              <Plus size={15} /> Create Custom Budget
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Top 4 KPI Cards */}
          <div className="mobile-grid-2 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Expense Budget</span>
                <Target size={16} color="var(--accent-primary)" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>
                {formatCurrency(summary.totalExpenseBudget)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {expenseItems.length} {expenseItems.length === 1 ? 'category' : 'categories'} budgeted
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actual Expenditure</span>
                <TrendingDown size={16} color={summary.expenseUtilizationPct > 100 ? '#ef4444' : 'var(--accent-light)'} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: summary.expenseUtilizationPct > 100 ? '#ef4444' : 'var(--text-primary)' }}>
                {formatCurrency(summary.totalExpenseActual)}
              </div>
              <div style={{ fontSize: 12, color: summary.expenseUtilizationPct > 100 ? '#ef4444' : 'var(--text-muted)', marginTop: 4 }}>
                {summary.expenseUtilizationPct.toFixed(1)}% of budget used
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {summary.totalExpenseRemaining >= 0 ? 'Remaining Budget' : 'Over Budget'}
                </span>
                {summary.totalExpenseRemaining >= 0 ? (
                  <CheckCircle2 size={16} color="#22c55e" />
                ) : (
                  <AlertTriangle size={16} color="#ef4444" />
                )}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  fontFamily: 'Space Grotesk, sans-serif',
                  color: summary.totalExpenseRemaining >= 0 ? '#22c55e' : '#ef4444',
                }}
              >
                {summary.totalExpenseRemaining >= 0
                  ? formatCurrency(summary.totalExpenseRemaining)
                  : `-${formatCurrency(Math.abs(summary.totalExpenseRemaining))}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {summary.exceedingCategories.length} exceeded · {summary.approachingCategories.length} approaching
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Revenue Target vs Actual</span>
                <TrendingUp size={16} color="#22c55e" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: '#22c55e' }}>
                {formatCurrency(summary.totalRevenueActual)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {summary.totalRevenueBudget > 0
                  ? `of ${formatCurrency(summary.totalRevenueBudget)} (${summary.revenueAchievementPct.toFixed(0)}%)`
                  : 'No revenue target set yet'}
              </div>
            </Card>
          </div>

          {/* Alert Strip for Approaching & Exceeding Categories */}
          {(summary.exceedingCategories.length > 0 || summary.approachingCategories.length > 0) && activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 20 }}>
              {summary.exceedingCategories.length > 0 && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.28)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <AlertTriangle size={18} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 3 }}>
                      {summary.exceedingCategories.length} {summary.exceedingCategories.length === 1 ? 'Category' : 'Categories'} at or Over Limit
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {summary.exceedingCategories
                        .map((c) => `${c.budget.category_name || c.budget.name} (${c.utilizationPct.toFixed(0)}%)`)
                        .join(' · ')}
                    </div>
                  </div>
                </div>
              )}

              {summary.approachingCategories.length > 0 && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(234, 179, 8, 0.08)',
                    border: '1px solid rgba(234, 179, 8, 0.28)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <Bell size={18} color="#eab308" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#eab308', marginBottom: 3 }}>
                      {summary.approachingCategories.length} {summary.approachingCategories.length === 1 ? 'Category' : 'Categories'} Approaching Limit (75%–99%)
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {summary.approachingCategories
                        .map((c) => `${c.budget.category_name || c.budget.name} (${c.utilizationPct.toFixed(0)}%)`)
                        .join(' · ')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: OVERVIEW & TRACKING */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Bar Chart */}
              {categoryChartData.length > 0 && (
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 700 }}>Budget vs Actual Spend by Category</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live figures pulled directly from your categorised transactions</p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={categoryChartData} margin={{ top: 4, right: 12, bottom: 4, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                      <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => formatCurrency(Number(v))}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Bar dataKey="Budget" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Actual" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Expense Budgets Table */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>Expense Budgets — Actual vs Planned</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Transfers, asset purchases, and owner drawings are automatically excluded to prevent distortion.
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => openCreateModal('expense')}>
                    <Plus size={14} /> Add Expense Budget
                  </Button>
                </div>

                {expenseItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                    No expense budgets for this period yet.{' '}
                    <button
                      onClick={handleCreateStarterBudgets}
                      style={{ color: 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      Generate starter budgets for {formatMonthLabel(`${selectedMonth}-01`)}
                    </button>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--bg-border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                          <th style={{ padding: '10px 8px' }}>Category</th>
                          <th style={{ padding: '10px 8px' }}>Budget</th>
                          <th style={{ padding: '10px 8px' }}>Actual</th>
                          <th style={{ padding: '10px 8px' }}>Remaining</th>
                          <th style={{ padding: '10px 8px', minWidth: 160 }}>Utilisation</th>
                          <th style={{ padding: '10px 8px' }}>Status</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseItems.map((perf) => {
                          const badge = getStatusBadge(perf);
                          const barColor = getProgressColor(perf);
                          return (
                            <tr key={perf.budget.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                              <td style={{ padding: '12px 8px' }}>
                                <div style={{ fontWeight: 600 }}>{perf.budget.category_name || perf.budget.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {perf.budget.start_date} → {perf.budget.end_date} · {perf.budget.accounting_basis === 'accrual' ? 'Accrual' : 'Cash'}
                                  {perf.budget.coa_account_code ? ` · CoA ${perf.budget.coa_account_code}` : ''}
                                </div>
                              </td>
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>{formatCurrency(perf.budgetAmount)}</td>
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>{formatCurrency(perf.actualAmount)}</td>
                              <td
                                style={{
                                  padding: '12px 8px',
                                  fontWeight: 700,
                                  color: perf.remainingAmount < 0 ? '#ef4444' : '#22c55e',
                                }}
                              >
                                {perf.remainingAmount < 0
                                  ? `-${formatCurrency(Math.abs(perf.remainingAmount))}`
                                  : formatCurrency(perf.remainingAmount)}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, height: 8, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${Math.min(100, perf.utilizationPct)}%`,
                                        height: '100%',
                                        background: barColor,
                                        borderRadius: 999,
                                        transition: 'width 0.3s ease',
                                      }}
                                    />
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 44, textAlign: 'right', color: barColor }}>
                                    {perf.utilizationPct.toFixed(0)}%
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 8px',
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: badge.bg,
                                    color: badge.color,
                                  }}
                                >
                                  {badge.label}
                                </span>
                              </td>
                              <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: 4 }}>
                                  <button
                                    title={perf.budget.alerts_enabled ? 'Alerts On (75%, 90%, 100%, Over) — Click to mute' : 'Alerts Muted — Click to enable'}
                                    onClick={() => handleToggleAlerts(perf.budget)}
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 6, padding: 6, cursor: 'pointer', color: perf.budget.alerts_enabled ? 'var(--accent-light)' : 'var(--text-muted)' }}
                                  >
                                    {perf.budget.alerts_enabled ? <Bell size={13} /> : <BellOff size={13} />}
                                  </button>
                                  <button
                                    title="Copy to next period"
                                    onClick={() => handleDuplicateNextPeriod(perf.budget)}
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
                                  >
                                    <Copy size={13} />
                                  </button>
                                  <button
                                    title="Edit budget"
                                    onClick={() => openEditModal(perf.budget)}
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    title="Delete budget"
                                    onClick={() => handleDeleteBudget(perf.budget)}
                                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#ef4444' }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Revenue Budgets Table */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>Revenue Budgets — Target vs Actual</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Track sales & operating income against your revenue goals</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => openCreateModal('revenue')}>
                    <Plus size={14} /> Add Revenue Budget
                  </Button>
                </div>

                {revenueItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
                    No revenue budgets for this period yet. Click <strong>Add Revenue Budget</strong> to set a sales target.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--bg-border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                          <th style={{ padding: '10px 8px' }}>Revenue Stream</th>
                          <th style={{ padding: '10px 8px' }}>Target</th>
                          <th style={{ padding: '10px 8px' }}>Actual Revenue</th>
                          <th style={{ padding: '10px 8px' }}>Variance</th>
                          <th style={{ padding: '10px 8px', minWidth: 160 }}>Progress</th>
                          <th style={{ padding: '10px 8px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueItems.map((perf) => {
                          const variance = perf.actualAmount - perf.budgetAmount;
                          const barColor = getProgressColor(perf);
                          return (
                            <tr key={perf.budget.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                              <td style={{ padding: '12px 8px' }}>
                                <div style={{ fontWeight: 600 }}>{perf.budget.category_name || perf.budget.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  {perf.budget.start_date} → {perf.budget.end_date} · {perf.budget.accounting_basis === 'accrual' ? 'Accrual' : 'Cash'}
                                </div>
                              </td>
                              <td style={{ padding: '12px 8px', fontWeight: 600 }}>{formatCurrency(perf.budgetAmount)}</td>
                              <td style={{ padding: '12px 8px', fontWeight: 700, color: '#22c55e' }}>{formatCurrency(perf.actualAmount)}</td>
                              <td style={{ padding: '12px 8px', fontWeight: 700, color: variance >= 0 ? '#22c55e' : '#f59e0b' }}>
                                {variance >= 0 ? `+${formatCurrency(variance)}` : `-${formatCurrency(Math.abs(variance))}`}
                              </td>
                              <td style={{ padding: '12px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, height: 8, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min(100, perf.utilizationPct)}%`, height: '100%', background: barColor, borderRadius: 999 }} />
                                  </div>
                                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 44, textAlign: 'right', color: barColor }}>
                                    {perf.utilizationPct.toFixed(0)}%
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: 4 }}>
                                  <button title="Copy to next period" onClick={() => handleDuplicateNextPeriod(perf.budget)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                    <Copy size={13} />
                                  </button>
                                  <button title="Edit budget" onClick={() => openEditModal(perf.budget)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 6, padding: 6, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                    <Edit2 size={13} />
                                  </button>
                                  <button title="Delete budget" onClick={() => handleDeleteBudget(perf.budget)} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 6, padding: 6, cursor: 'pointer', color: '#ef4444' }}>
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* TAB 2: REVENUE VS EXPENSE PLAN */}
          {activeTab === 'plan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Card>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Planned Budget Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Planned Revenue</span>
                      <strong style={{ color: '#22c55e' }}>{formatCurrency(summary.totalRevenueBudget)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Planned Expenses</span>
                      <strong style={{ color: '#ef4444' }}>{formatCurrency(summary.totalExpenseBudget)}</strong>
                    </div>
                    <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                      <span style={{ fontWeight: 700 }}>Projected Net Profit / Surplus</span>
                      <strong style={{ color: summary.projectedNet >= 0 ? '#22c55e' : '#ef4444' }}>
                        {summary.projectedNet >= 0 ? formatCurrency(summary.projectedNet) : `-${formatCurrency(Math.abs(summary.projectedNet))}`}
                      </strong>
                    </div>
                  </div>
                </Card>

                <Card>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Actual Performance (From Accounting Records)</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Actual Revenue</span>
                      <strong style={{ color: '#22c55e' }}>{formatCurrency(summary.totalRevenueActual)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Actual Expenses</span>
                      <strong style={{ color: '#ef4444' }}>{formatCurrency(summary.totalExpenseActual)}</strong>
                    </div>
                    <div style={{ borderTop: '1px solid var(--bg-border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                      <span style={{ fontWeight: 700 }}>Actual Net Surplus / Deficit</span>
                      <strong style={{ color: summary.actualNet >= 0 ? '#22c55e' : '#ef4444' }}>
                        {summary.actualNet >= 0 ? formatCurrency(summary.actualNet) : `-${formatCurrency(Math.abs(summary.actualNet))}`}
                      </strong>
                    </div>
                  </div>
                </Card>
              </div>

              <Card style={{ background: 'var(--bg-elevated)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Accounting Integrity Guarantee</div>
                <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Budgets in RovaFlow are strictly planning targets. Creating, editing, or deleting a budget never posts journal entries and never modifies your Profit &amp; Loss, Balance Sheet, Trial Balance, or General Ledger balances. All actuals are computed directly from your verified accounting transactions.
                </p>
              </Card>
            </div>
          )}

          {/* TAB 3: REPORTS & TRENDS */}
          {activeTab === 'reports' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Monthly Trend Chart */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>Monthly Budget Performance ({new Date().getFullYear()})</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Compare planned monthly expense budgets against actual spending across the year</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleExportBudgetCSV}>
                    <Download size={14} /> Export Budget Report
                  </Button>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyReportData} margin={{ top: 4, right: 12, bottom: 4, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                    <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v) => formatCurrency(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="Budget" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Actual" fill="#f97316" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Period Comparison */}
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>Compare Budget Periods</h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Side-by-side comparison of any two months</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="month"
                      value={compareMonthB}
                      onChange={(e) => setCompareMonthB(e.target.value)}
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 6, padding: '5px 10px', color: 'var(--text-primary)', fontSize: 12 }}
                    />
                    <ArrowRight size={14} color="var(--text-muted)" />
                    <input
                      type="month"
                      value={compareMonthA}
                      onChange={(e) => setCompareMonthA(e.target.value)}
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 6, padding: '5px 10px', color: 'var(--text-primary)', fontSize: 12 }}
                    />
                  </div>
                </div>

                <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {[
                    { label: formatMonthLabel(`${compareMonthB}-01`), data: periodComparison.b },
                    { label: formatMonthLabel(`${compareMonthA}-01`), data: periodComparison.a },
                  ].map((col) => (
                    <div key={col.label} style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{col.label}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Expense Budget</span>
                          <strong>{formatCurrency(col.data.totalExpenseBudget)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Actual Spend</span>
                          <strong>{formatCurrency(col.data.totalExpenseActual)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Utilisation</span>
                          <strong style={{ color: col.data.expenseUtilizationPct > 100 ? '#ef4444' : '#22c55e' }}>
                            {col.data.expenseUtilizationPct.toFixed(1)}%
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Revenue Actual / Target</span>
                          <strong style={{ color: '#22c55e' }}>
                            {formatCurrency(col.data.totalRevenueActual)} / {formatCurrency(col.data.totalRevenueBudget)}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Consistently Overspending Categories */}
              <Card>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Consistently Overspending Categories</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Categories where actual spending exceeded the allocated budget across your budget history
                </p>

                {consistentlyOverspending.length === 0 ? (
                  <div style={{ padding: '20px 12px', textAlign: 'center', color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
                    Great discipline — none of your budgeted categories have overspent!
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--bg-border)', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                          <th style={{ padding: '8px' }}>Category</th>
                          <th style={{ padding: '8px' }}>Periods Overspent</th>
                          <th style={{ padding: '8px' }}>Avg Utilisation</th>
                          <th style={{ padding: '8px', textAlign: 'right' }}>Total Over Budget</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consistentlyOverspending.map((row) => (
                          <tr key={row.category} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                            <td style={{ padding: '10px 8px', fontWeight: 600 }}>{row.category}</td>
                            <td style={{ padding: '10px 8px' }}>
                              {row.overspentCount} of {row.totalPeriods} {row.totalPeriods === 1 ? 'period' : 'periods'}
                            </td>
                            <td style={{ padding: '10px 8px', color: '#ef4444', fontWeight: 700 }}>{row.avgUtilizationPct.toFixed(1)}%</td>
                            <td style={{ padding: '10px 8px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>
                              +{formatCurrency(row.totalOverAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      {/* CREATE / EDIT BUDGET MODAL */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '92vh',
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              padding: 22,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800 }}>{editingBudget ? 'Edit Budget' : 'Create New Budget'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Budget Type */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Budget Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['expense', 'revenue'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setFormType(t);
                        const first = SME_BUDGET_CATEGORY_OPTIONS.find((o) => o.budgetType === t)!;
                        setFormCategoryName(first.label);
                        setFormCoaCode(first.coaCode);
                        if (!editingBudget) {
                          setFormName(`${first.label} (${formPeriod === 'annual' ? formStartDate.slice(0, 4) : formatMonthLabel(formStartDate)})`);
                        }
                      }}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: formType === t ? (t === 'expense' ? 'rgba(239,68,68,0.14)' : 'rgba(34,197,94,0.14)') : 'var(--bg-elevated)',
                        color: formType === t ? (t === 'expense' ? '#ef4444' : '#22c55e') : 'var(--text-secondary)',
                        border: `1px solid ${formType === t ? (t === 'expense' ? '#ef4444' : '#22c55e') : 'var(--bg-border)'}`,
                      }}
                    >
                      {t === 'expense' ? 'Expense Budget' : 'Revenue Budget'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Financial Category */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  Financial Category (Chart of Accounts)
                </label>
                <select
                  value={formCategoryName}
                  onChange={(e) => handleCategorySelect(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                >
                  <optgroup label={formType === 'expense' ? 'Common Expense Categories' : 'Revenue Categories'}>
                    {SME_BUDGET_CATEGORY_OPTIONS.filter((o) => o.budgetType === formType).map((opt) => (
                      <option key={opt.label} value={opt.label}>
                        {opt.label} (CoA {opt.coaCode})
                      </option>
                    ))}
                  </optgroup>
                  {categories.filter((c) => (formType === 'revenue' ? c.type === 'income' : c.type === 'expense')).length > 0 && (
                    <optgroup label="Your Custom Categories">
                      {categories
                        .filter((c) => (formType === 'revenue' ? c.type === 'income' : c.type === 'expense'))
                        .map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  <optgroup label="All Chart of Accounts">
                    {getBudgetableCoaAccounts(formType).map((acc) => (
                      <option key={acc.code} value={`${acc.code} — ${acc.name}`}>
                        {acc.code} — {acc.name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Budget Name */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Budget Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Monthly Rent Budget"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                />
              </div>

              {/* Period & Expected Amount */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Budget Period</label>
                  <select
                    value={formPeriod}
                    onChange={(e) => handlePeriodChange(e.target.value as BudgetPeriodType)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Expected Amount (₦)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="100000"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {/* Start & End Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Start Date</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>End Date</label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {/* Accounting Basis */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Accounting Basis</label>
                <select
                  value={formBasis}
                  onChange={(e) => setFormBasis(e.target.value as BudgetAccountingBasis)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                >
                  <option value="cash">Cash Basis (Recommended — paid transactions only; excludes unpaid bills)</option>
                  <option value="accrual">Accrual Basis (Includes issued bills &amp; invoices without double-counting payments)</option>
                </select>
              </div>

              {/* Alerts toggle */}
              {formType === 'expense' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={formAlertsEnabled}
                    onChange={(e) => setFormAlertsEnabled(e.target.checked)}
                  />
                  Send automatic notifications at 75%, 90%, 100%, and when spending exceeds budget
                </label>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving...' : editingBudget ? 'Save Changes' : 'Create Budget'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
