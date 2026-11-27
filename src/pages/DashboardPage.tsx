import WhatsAppIcon from '../components/ui/WhatsAppIcon';
import { useEffect, useState, useMemo } from 'react';
import { 
  ArrowUpRight, ArrowDownRight, 
  Plus, Wallet, RefreshCw, TrendingUp,
  ChevronDown, FileText, Receipt, Package
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { supabase, syncAllBanks, type Transaction, type Account } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate, cleanDescription } from '../lib/format';
import { useNavigate } from 'react-router-dom';
import BankConnectChoiceModal from '../components/BankConnectChoiceModal';
import QuickAddModal from '../components/QuickAddModal';
import { useMobile } from '../hooks/useMobile';
import { useTheme } from '../contexts/ThemeContext';

const ALL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const [waComingSoon, setWaComingSoon] = useState(false);
  const { user, profile, isStaff, staffData } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const effectiveUserId = isStaff && staffData ? staffData.owner_id : user?.id;
  const navigate = useNavigate();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
  const [unpaidBills, setUnpaidBills] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
  const [lowStockItems, setLowStockItems] = useState<{ id: string; name: string; current_stock: number; reorder_level: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBankChoiceOpen, setIsBankChoiceOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<'year' | 'recent'>('year');

  const isMobile = useMobile(1024);
  const isSmall = useMobile(640);

  useEffect(() => {
    if (effectiveUserId) loadData();
  }, [effectiveUserId]);

  async function handleSyncBanks() {
    setIsSyncing(true);
    try {
      await syncAllBanks(effectiveUserId);
      await loadData();
    } catch (err) {
      console.error('Failed to sync banks:', err);
    } finally {
      setIsSyncing(false);
    }
  }

  async function loadData() {
    setLoading(true);
    let txQuery = supabase
      .from('transactions')
      .select('*, category:categories(*), account:accounts(*)')
      .eq('user_id', effectiveUserId)
      .order('date', { ascending: false })
      .limit(2000);

    let invQuery = supabase
      .from('invoices')
      .select('total, amount_paid, status')
      .eq('user_id', effectiveUserId)
      .in('status', ['sent', 'overdue', 'partially_paid']);

    const billsQuery = supabase
      .from('bills')
      .select('amount, status')
      .eq('user_id', effectiveUserId)
      .in('status', ['unpaid', 'overdue', 'partially_paid']);

    const invItemsQuery = supabase
      .from('inventory_items')
      .select('id, name, current_stock, reorder_level')
      .eq('user_id', effectiveUserId)
      .eq('status', 'active');

    if (isStaff) {
      const limit = profile?.staff_visibility_limit || 500000;
      txQuery = txQuery.lt('amount', limit);
      invQuery = invQuery.lt('total', limit);
    }

    const [txRes, accRes, invRes, billsRes, stockRes] = await Promise.all([
      txQuery,
      supabase.from('accounts').select('*').eq('user_id', effectiveUserId),
      invQuery,
      billsQuery,
      invItemsQuery,
    ]);

    setTransactions(txRes.data || []);
    setAccounts(accRes.data || []);

    const invList = invRes.data || [];
    const arTotal = invList.reduce((s, inv) => s + Math.max(0, (Number(inv.total) || 0) - (Number(inv.amount_paid) || 0)), 0);
    setUnpaidInvoices({ total: arTotal, count: invList.length });

    const billsList = billsRes.data || [];
    const apTotal = billsList.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    setUnpaidBills({ total: apTotal, count: billsList.length });

    const lowStock = (stockRes.data || []).filter(
      (item) => (Number(item.current_stock) || 0) <= (Number(item.reorder_level) || 5)
    );
    setLowStockItems(lowStock);

    setLoading(false);
  }

  // --- Dynamic Stats Calculations (100% Real Data) ---
  // ONLY sums real connected bank accounts — never mixes unpaid invoices into bank balance
  const totalBalance = useMemo(() => {
    return accounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  }, [accounts]);

  const totalMoneyIn = useMemo(() => {
    return transactions
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }, [transactions]);

  const totalMoneyOut = useMemo(() => {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }, [transactions]);

  // Real Profit Margin %
  const profitMargin = useMemo(() => {
    if (totalMoneyIn <= 0) return 0;
    const net = totalMoneyIn - totalMoneyOut;
    return Math.round((net / totalMoneyIn) * 1000) / 10;
  }, [totalMoneyIn, totalMoneyOut]);

  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();
  const lastMonthIdx = currentMonthIdx === 0 ? 11 : currentMonthIdx - 1;
  const lastMonthYear = currentMonthIdx === 0 ? currentYear - 1 : currentYear;

  const currentMonthIncome = useMemo(() => {
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear && t.type === 'income';
      })
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }, [transactions, currentMonthIdx, currentYear]);

  const lastMonthIncome = useMemo(() => {
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === lastMonthIdx && d.getFullYear() === lastMonthYear && t.type === 'income';
      })
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }, [transactions, lastMonthIdx, lastMonthYear]);

  const incomeChange = lastMonthIncome === 0
    ? (currentMonthIncome > 0 ? 100 : 0)
    : Math.round(((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100);

  const currentMonthExpenses = useMemo(() => {
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === currentMonthIdx && d.getFullYear() === currentYear && t.type === 'expense';
      })
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }, [transactions, currentMonthIdx, currentYear]);

  const lastMonthExpenses = useMemo(() => {
    return transactions
      .filter(t => {
        const d = new Date(t.date);
        return d.getMonth() === lastMonthIdx && d.getFullYear() === lastMonthYear && t.type === 'expense';
      })
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
  }, [transactions, lastMonthIdx, lastMonthYear]);

  const expenseChange = lastMonthExpenses === 0
    ? (currentMonthExpenses > 0 ? 100 : 0)
    : Math.round(((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100);

  // Top Spending Categories from real expense transactions
  const topExpenseCategories = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const cat = (t.category as any)?.name || t.ai_category || 'General Expense';
        map[cat] = (map[cat] || 0) + (Number(t.amount) || 0);
      });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, amount]) => ({
        name,
        amount,
        pct: totalMoneyOut > 0 ? Math.round((amount / totalMoneyOut) * 100) : 0,
      }));
  }, [transactions, totalMoneyOut]);

  // Real Chart Data: Aggregates ALL actual user-inputted transactions by month
  const chartData = useMemo(() => {
    const monthsToShow = selectedMonthFilter === 'recent'
      ? ALL_MONTHS.slice(Math.max(0, currentMonthIdx - 5), currentMonthIdx + 1)
      : ALL_MONTHS;

    return monthsToShow.map((m) => {
      const mIdx = ALL_MONTHS.indexOf(m);
      const mTx = transactions.filter(t => {
        if (!t.date) return false;
        const d = new Date(t.date);
        return d.getMonth() === mIdx && d.getFullYear() === currentYear;
      });
      const inc = mTx.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const exp = mTx.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

      return {
        month: m,
        moneyIn: inc,
        moneyOut: exp,
        isCurrent: mIdx === currentMonthIdx,
      };
    });
  }, [transactions, currentMonthIdx, currentYear, selectedMonthFilter]);

  const recentTx = transactions.slice(0, 5);

  // Design color tokens — ROVA Purple UI + Green for Money In
  const colors = {
    purple: isDark ? '#9333ea' : '#7c3aed',
    purpleLight: isDark ? '#a855f7' : '#8b5cf6',
    purpleDark: isDark ? '#7e22ce' : '#662D91',
    purpleDim: isDark ? 'rgba(147, 51, 234, 0.16)' : 'rgba(124, 58, 237, 0.10)',
    purpleBorder: isDark ? 'rgba(147, 51, 234, 0.35)' : 'rgba(124, 58, 237, 0.25)',
    green: isDark ? '#22c55e' : '#16a34a',
    greenDim: isDark ? 'rgba(34, 197, 94, 0.16)' : '#ecfdf5',
    greenBorder: isDark ? 'rgba(34, 197, 94, 0.32)' : '#bbf7d0',
    expenseBar: isDark ? '#f43f5e' : '#e11d48',
    expenseDim: isDark ? 'rgba(244, 63, 94, 0.16)' : '#fff1f2',
    expenseBorder: isDark ? 'rgba(244, 63, 94, 0.3)' : '#fecdd3',
    cardBg: isDark ? '#141417' : '#ffffff',
    cardBorder: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
    cardShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 2px 14px rgba(0,0,0,0.03)',
    pillBg: isDark ? '#1f1f23' : '#f4f5f7',
    pillBorder: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
    textPrimary: isDark ? '#fafafa' : '#111827',
    textSecondary: isDark ? '#a1a1aa' : '#64748b',
    textMuted: isDark ? '#71717a' : '#94a3b8',
  };

  const displayName = profile?.business_name || profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Partner';

  return (
    <div style={{ maxWidth: 1220, margin: '0 auto', padding: isMobile ? '20px 14px 100px' : '28px 24px 100px' }}>
      
      {/* Top Header Controls Bar */}
      <div style={{ 
        marginBottom: 28, 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        justifyContent: 'space-between', 
        gap: 16 
      }}>
        <div>
          <h1 style={{ 
            fontSize: isMobile ? 24 : 28, 
            fontWeight: 800, 
            color: colors.textPrimary, 
            letterSpacing: '-0.02em',
            margin: 0,
            lineHeight: 1.2
          }}>
            Good {getGreeting()}, {displayName}!
          </h1>
          <p style={{ color: colors.textSecondary, fontSize: 13.5, margin: '6px 0 0', fontWeight: 500 }}>
            Here is your financial and business overview today.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <button
            type="button"
            onClick={() => setWaComingSoon(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px',
              borderRadius: 20,
              background: waComingSoon ? colors.purpleDim : colors.pillBg,
              border: waComingSoon ? `1px solid ${colors.purpleBorder}` : colors.pillBorder,
              color: waComingSoon ? colors.purpleLight : colors.textPrimary,
              fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            <WhatsAppIcon size={16} color={waComingSoon ? colors.purpleLight : 'currentColor'} />
            <span>{waComingSoon ? 'Coming Soon' : 'WhatsApp AI'}</span>
          </button>

          <button
            onClick={handleSyncBanks}
            disabled={isSyncing}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 20,
              background: colors.pillBg,
              border: colors.pillBorder,
              color: colors.textPrimary,
              fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Banks'}</span>
          </button>

          <button
            onClick={() => navigate('/app/invoices')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 20,
              background: colors.pillBg,
              border: colors.pillBorder,
              color: colors.textPrimary,
              fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            <span>New Invoice</span>
          </button>

          <button
            data-tour="add-transaction-btn"
            onClick={() => setIsQuickAddOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 20,
              background: colors.purple,
              border: 'none',
              color: '#ffffff',
              fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
              boxShadow: '0 2px 10px rgba(124, 58, 237, 0.35)'
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.92')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 18, marginBottom: 28 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: 135, borderRadius: 20 }} />
          ))}
        </div>
      ) : (
        <>
          {/* Top 4 KPI Metric Cards (Clean — no 3 dots) */}
          <div
            data-tour="dashboard-overview"
            style={{
            display: 'grid',
            gridTemplateColumns: isSmall ? '1fr' : isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}>
            {/* Card 1: Real Connected Bank Balance */}
            <div style={{
              background: colors.cardBg,
              borderRadius: 20,
              border: colors.cardBorder,
              boxShadow: colors.cardShadow,
              padding: '22px 22px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onClick={() => navigate('/app/payment')}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: colors.purpleDim,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: colors.purpleLight,
              }}>
                <Wallet size={17} />
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{
                  fontSize: 25,
                  fontWeight: 800,
                  color: colors.textPrimary,
                  fontFamily: 'Space Grotesk, sans-serif',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {formatCurrency(totalBalance)}
                </div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 7, fontWeight: 500 }}>
                  {accounts.length > 0
                    ? `Connected bank${accounts.length === 1 ? '' : 's'} (${accounts.length})`
                    : 'Connected bank balance'}
                </div>
              </div>
            </div>

            {/* Card 2: Money In (Green Arrow, Black/Primary Text) */}
            <div data-tour="dashboard-money-in" style={{
              background: colors.cardBg,
              borderRadius: 20,
              border: colors.cardBorder,
              boxShadow: colors.cardShadow,
              padding: '22px 22px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onClick={() => navigate('/app/transactions')}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: colors.greenDim,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: colors.green,
              }}>
                <ArrowUpRight size={18} />
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{
                  fontSize: 25,
                  fontWeight: 800,
                  color: colors.textPrimary,
                  fontFamily: 'Space Grotesk, sans-serif',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {formatCurrency(totalMoneyIn)}
                </div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 7, fontWeight: 500 }}>
                  Money In
                </div>
              </div>
            </div>

            {/* Card 3: Money Out */}
            <div data-tour="dashboard-money-out" style={{
              background: colors.cardBg,
              borderRadius: 20,
              border: colors.cardBorder,
              boxShadow: colors.cardShadow,
              padding: '22px 22px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onClick={() => navigate('/app/transactions')}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: colors.expenseDim,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: colors.expenseBar,
              }}>
                <ArrowDownRight size={18} />
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{
                  fontSize: 25,
                  fontWeight: 800,
                  color: colors.textPrimary,
                  fontFamily: 'Space Grotesk, sans-serif',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {formatCurrency(totalMoneyOut)}
                </div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 7, fontWeight: 500 }}>
                  Money Out
                </div>
              </div>
            </div>

            {/* Card 4: Profit Margin */}
            <div style={{
              background: colors.cardBg,
              borderRadius: 20,
              border: colors.cardBorder,
              boxShadow: colors.cardShadow,
              padding: '22px 22px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onClick={() => navigate('/app/profit-loss')}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: colors.purpleDim,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: colors.purpleLight,
              }}>
                <TrendingUp size={17} />
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{
                  fontSize: 25,
                  fontWeight: 800,
                  color: colors.textPrimary,
                  fontFamily: 'Space Grotesk, sans-serif',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {profitMargin}%
                </div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 7, fontWeight: 500 }}>
                  Profit Margin
                </div>
              </div>
            </div>
          </div>

          {/* Main 2-Column Grid (Left: 66%, Right: 34%) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.9fr 1fr',
            gap: 20,
            alignItems: 'start',
          }}>
            
            {/* LEFT COLUMN: Real Cash Flow Bar Chart + Recent Transactions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              
              {/* Cash Flow Overview Card */}
              <div data-tour="dashboard-cashflow" style={{
                background: colors.cardBg,
                borderRadius: 20,
                border: colors.cardBorder,
                boxShadow: colors.cardShadow,
                padding: isMobile ? '20px 16px' : '24px 26px',
              }}>
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 16,
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: colors.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>
                      Cash Flow Overview
                    </h3>
                    <p style={{ fontSize: 12.5, color: colors.textMuted, margin: '4px 0 0', fontWeight: 500 }}>
                      Money In vs Money Out from your recorded transactions
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setSelectedMonthFilter(selectedMonthFilter === 'year' ? 'recent' : 'year')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 20,
                        background: colors.pillBg,
                        border: colors.pillBorder,
                        color: colors.textPrimary,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <span>{selectedMonthFilter === 'year' ? `Full Year (${currentYear})` : 'Last 6 Months'}</span>
                      <ChevronDown size={13} color={colors.textMuted} />
                    </button>

                    <button
                      onClick={() => navigate('/app/reports')}
                      title="View Full Reports"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: colors.pillBg,
                        border: colors.pillBorder,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: colors.textPrimary,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = isDark ? '#27272a' : '#e2e8f0')}
                      onMouseLeave={e => (e.currentTarget.style.background = colors.pillBg)}
                    >
                      <ArrowUpRight size={15} />
                    </button>
                  </div>
                </div>

                {/* Metrics Breakdown: Money In (Green) & Money Out (Red) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 18 : 32,
                  marginBottom: 20,
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: colors.textMuted, fontWeight: 600, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.green }} />
                      <span>Money In</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary, fontFamily: 'Space Grotesk, sans-serif' }}>
                        {formatCurrency(totalMoneyIn)}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 12,
                        background: colors.greenDim,
                        color: colors.green,
                        border: `1px solid ${colors.greenBorder}`,
                      }}>
                        {incomeChange >= 0 ? `+${incomeChange}%` : `${incomeChange}%`}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: colors.textMuted, fontWeight: 600, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.expenseBar }} />
                      <span>Money Out</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: colors.textPrimary, fontFamily: 'Space Grotesk, sans-serif' }}>
                        {formatCurrency(totalMoneyOut)}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 12,
                        background: colors.expenseDim,
                        color: colors.expenseBar,
                        border: `1px solid ${colors.expenseBorder}`,
                      }}>
                        {expenseChange >= 0 ? `+${expenseChange}%` : `${expenseChange}%`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Real Dual-Bar Chart: Money In (Green) & Money Out (Rose) */}
                <div style={{ height: 245, width: '100%', marginTop: 8 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 16, right: 10, left: -16, bottom: 0 }} barGap={4}>
                      <CartesianGrid vertical={false} stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'} strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11.5, fill: colors.textMuted, fontWeight: 500 }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10.5, fill: colors.textMuted }} 
                        tickFormatter={v => v >= 1000000 ? `₦${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `₦${Math.round(v / 1000)}k` : `₦${v}`} 
                      />
                      <Tooltip content={<CustomChartTooltip isDark={isDark} colors={colors} />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }} />
                      <Bar 
                        dataKey="moneyIn" 
                        name="Money In"
                        fill={colors.green}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={24}
                      />
                      <Bar 
                        dataKey="moneyOut" 
                        name="Money Out"
                        fill={colors.expenseBar}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={24}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Transactions Card */}
              <div style={{
                background: colors.cardBg,
                borderRadius: 20,
                border: colors.cardBorder,
                boxShadow: colors.cardShadow,
                padding: isMobile ? '20px 16px' : '22px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
                      Recent Transactions
                    </h3>
                    <p style={{ fontSize: 12, color: colors.textMuted, margin: '3px 0 0' }}>
                      Latest automated and recorded activity
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/app/transactions')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'none',
                      border: 'none',
                      color: colors.purpleLight,
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <span>View all</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>

                {recentTx.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recentTx.map(tx => (
                      <TransactionRowItem 
                        key={tx.id} 
                        tx={tx} 
                        colors={colors} 
                        isDark={isDark} 
                        onClick={() => navigate('/app/transactions')} 
                      />
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '36px 0' }}>
                    <p style={{ color: colors.textMuted, fontSize: 13, margin: 0 }}>No transactions recorded yet</p>
                    <button
                      onClick={() => setIsQuickAddOpen(true)}
                      style={{
                        marginTop: 10,
                        padding: '6px 14px',
                        borderRadius: 16,
                        background: colors.pillBg,
                        border: colors.pillBorder,
                        color: colors.textPrimary,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      + Record first transaction
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Useful Live Insights from Invoices, Bills, Categories & Inventory */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              
              {/* Widget 1: Invoices & Bills Summary (Receivables & Payables) */}
              <div style={{
                background: colors.cardBg,
                borderRadius: 20,
                border: colors.cardBorder,
                boxShadow: colors.cardShadow,
                padding: '22px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <h3 style={{ fontSize: 15.5, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
                    Invoices &amp; Bills
                  </h3>
                  <button
                    onClick={() => navigate('/app/invoices')}
                    title="Open Invoices"
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: colors.pillBg, border: colors.pillBorder,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: colors.textPrimary, cursor: 'pointer',
                    }}
                  >
                    <ArrowUpRight size={13} />
                  </button>
                </div>
                <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500, marginBottom: 16 }}>
                  Pending receivables &amp; upcoming payables
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {/* Unpaid Invoices */}
                  <div
                    onClick={() => navigate('/app/invoices')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '13px 14px', borderRadius: 14,
                      background: colors.pillBg, border: colors.pillBorder,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: colors.greenDim, color: colors.green,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <FileText size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary }}>Unpaid Invoices</div>
                        <div style={{ fontSize: 11, color: colors.textMuted }}>
                          {unpaidInvoices.count} awaiting payment
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary }}>
                      {formatCurrency(unpaidInvoices.total)}
                    </div>
                  </div>

                  {/* Unpaid Bills */}
                  <div
                    onClick={() => navigate('/app/bills')}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '13px 14px', borderRadius: 14,
                      background: colors.pillBg, border: colors.pillBorder,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: colors.expenseDim, color: colors.expenseBar,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Receipt size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary }}>Unpaid Bills</div>
                        <div style={{ fontSize: 11, color: colors.textMuted }}>
                          {unpaidBills.count} pending settlement
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary }}>
                      {formatCurrency(unpaidBills.total)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => navigate('/app/invoices')}
                    style={{
                      padding: '9px 12px', borderRadius: 12,
                      background: colors.purpleDim, border: `1px solid ${colors.purpleBorder}`,
                      color: colors.purpleLight, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Manage Invoices
                  </button>
                  <button
                    onClick={() => navigate('/app/bills')}
                    style={{
                      padding: '9px 12px', borderRadius: 12,
                      background: colors.pillBg, border: colors.pillBorder,
                      color: colors.textPrimary, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Manage Bills
                  </button>
                </div>
              </div>

              {/* Widget 2: Top Spending Categories & Inventory Alerts */}
              <div style={{
                background: colors.cardBg,
                borderRadius: 20,
                border: colors.cardBorder,
                boxShadow: colors.cardShadow,
                padding: '22px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <h3 style={{ fontSize: 15.5, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
                    Top Spending Categories
                  </h3>
                  <button
                    onClick={() => navigate('/app/reports')}
                    title="View Reports"
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: colors.pillBg, border: colors.pillBorder,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: colors.textPrimary, cursor: 'pointer',
                    }}
                  >
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500, marginBottom: 16 }}>
                  Where your Money Out is going
                </div>

                {topExpenseCategories.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                    {topExpenseCategories.map((cat) => (
                      <div key={cat.name}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '58%' }}>
                            {cat.name}
                          </span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary }}>
                            {formatCurrency(cat.amount)}
                            <span style={{ fontSize: 11, fontWeight: 500, color: colors.textMuted, marginLeft: 5 }}>({cat.pct}%)</span>
                          </span>
                        </div>
                        <div style={{
                          width: '100%', height: 7, borderRadius: 6,
                          background: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${Math.max(cat.pct, 4)}%`, height: '100%', borderRadius: 6,
                            background: `linear-gradient(90deg, ${colors.purpleDark}, ${colors.purpleLight})`,
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: colors.textMuted, padding: '16px 0', textAlign: 'center' }}>
                    Record expenses to see your category breakdown.
                  </div>
                )}

                {/* Low Stock Inventory Alert (pulled from Inventory page) */}
                {lowStockItems.length > 0 && (
                  <div
                    onClick={() => navigate('/app/inventory')}
                    style={{
                      marginTop: 18,
                      padding: '12px 14px',
                      borderRadius: 14,
                      background: isDark ? 'rgba(245, 158, 11, 0.12)' : '#fffbeb',
                      border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.28)' : '#fde68a'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <Package size={16} color={isDark ? '#fbbf24' : '#d97706'} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#fbbf24' : '#b45309' }}>
                          {lowStockItems.length} Low Stock Item{lowStockItems.length === 1 ? '' : 's'}
                        </div>
                        <div style={{ fontSize: 11, color: colors.textMuted }}>
                          {lowStockItems[0].name}{lowStockItems.length > 1 ? ` +${lowStockItems.length - 1} more` : ''}
                        </div>
                      </div>
                    </div>
                    <ArrowUpRight size={14} color={isDark ? '#fbbf24' : '#b45309'} />
                  </div>
                )}
              </div>

              {/* Connect Bank Account Clean Card */}
              <div 
                onClick={() => setIsBankChoiceOpen(true)}
                style={{
                  background: colors.cardBg,
                  borderRadius: 20,
                  border: `1.5px dashed ${colors.purpleBorder}`,
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget.style.borderColor = colors.purple);
                  (e.currentTarget.style.background = colors.purpleDim);
                }}
                onMouseLeave={e => {
                  (e.currentTarget.style.borderColor = colors.purpleBorder);
                  (e.currentTarget.style.background = colors.cardBg);
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: colors.purple,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#ffffff', flexShrink: 0,
                }}>
                  <Plus size={18} strokeWidth={2.5} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>
                    Connect Bank Account
                  </div>
                  <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
                    Sync transactions via Email Sync or Mono
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <BankConnectChoiceModal
        open={isBankChoiceOpen}
        onClose={() => setIsBankChoiceOpen(false)}
        onSuccess={loadData}
      />

      <QuickAddModal 
        open={isQuickAddOpen}
        onClose={() => { setIsQuickAddOpen(false); loadData(); }}
      />
    </div>
  );
}

// --- Custom Recharts Tooltip ---
function CustomChartTooltip({ active, payload, label, isDark, colors }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{
        background: isDark ? '#1f1f23' : '#111827',
        color: '#ffffff',
        padding: '10px 14px',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        fontSize: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.green }} />
          <span>Money In: <strong>{formatCurrency(data.moneyIn)}</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.9 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.expenseBar }} />
          <span>Money Out: <strong>{formatCurrency(data.moneyOut)}</strong></span>
        </div>
      </div>
    );
  }
  return null;
}

// --- Recent Transaction Row Item ---
function TransactionRowItem({ tx, colors, isDark, onClick }: { tx: Transaction; colors: any; isDark: boolean; onClick: () => void }) {
  const isIncome = tx.type === 'income';
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 10px',
        borderRadius: 12,
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: isIncome ? colors.greenDim : colors.expenseDim,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {isIncome ? (
            <ArrowUpRight size={15} color={colors.green} />
          ) : (
            <ArrowDownRight size={15} color={colors.expenseBar} />
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: colors.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {cleanDescription(tx.description) || (tx.category as any)?.name || 'Transaction'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: colors.textMuted }}>{formatDate(tx.date)}</span>
            {(tx.category as any)?.name && (
              <span style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: colors.pillBg,
                color: colors.textSecondary,
                fontWeight: 500,
              }}>
                {(tx.category as any).name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{
        fontSize: 13.5,
        fontWeight: 700,
        fontFamily: 'Space Grotesk, sans-serif',
        color: isIncome ? colors.green : colors.textPrimary,
        flexShrink: 0,
        marginLeft: 12,
      }}>
        {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
