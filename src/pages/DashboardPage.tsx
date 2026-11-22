import WhatsAppIcon from '../components/ui/WhatsAppIcon';
import { useEffect, useState, useMemo } from 'react';
import { 
  ArrowUpRight, ArrowDownRight, 
  Plus, Wallet, RefreshCw, CreditCard, 
  MoreVertical, ChevronDown
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
  const [arBalance, setArBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBankChoiceOpen, setIsBankChoiceOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<'year' | 'recent'>('year');
  const [activeMenuCard, setActiveMenuCard] = useState<number | null>(null);

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
      .select('total, amount_paid')
      .eq('user_id', effectiveUserId)
      .in('status', ['sent', 'overdue']);

    if (isStaff) {
      const limit = profile?.staff_visibility_limit || 500000;
      txQuery = txQuery.lt('amount', limit);
      invQuery = invQuery.lt('total', limit);
    }

    const [txRes, accRes, invRes] = await Promise.all([
      txQuery,
      supabase.from('accounts').select('*').eq('user_id', effectiveUserId),
      invQuery,
    ]);

    setTransactions(txRes.data || []);
    setAccounts(accRes.data || []);

    const arTotal = (invRes.data || []).reduce((s, inv) => s + (inv.total - (inv.amount_paid || 0)), 0);
    setArBalance(arTotal);
    setLoading(false);
  }

  // --- Dynamic Stats Calculations (100% Real Data) ---
  const totalBalance = useMemo(() => {
    return accounts.reduce((s, a) => s + (a.balance || 0), 0) + arBalance;
  }, [accounts, arBalance]);

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

  const uncategorizedCount = useMemo(() => {
    return transactions.filter(t => !(t.category as any)?.name && !t.category_id && !t.ai_category).length;
  }, [transactions]);

  const categorizedCount = transactions.length - uncategorizedCount;
  const categorizedPct = transactions.length > 0
    ? Math.round((categorizedCount / transactions.length) * 100)
    : 0;

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

  // Today & This Week's earnings
  const { todayIncome, weekIncome } = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const todayInc = transactions
      .filter(t => t.type === 'income' && t.date?.slice(0, 10) === todayStr)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const weekInc = transactions
      .filter(t => t.type === 'income' && new Date(t.date) >= oneWeekAgo)
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);

    return { todayIncome: todayInc, weekIncome: weekInc };
  }, [transactions]);

  // Real Profit Margin / Cash Flow Health
  const successRate = useMemo(() => {
    if (totalMoneyIn > 0) {
      const net = totalMoneyIn - totalMoneyOut;
      const margin = (net / totalMoneyIn) * 100;
      return Math.max(0, Math.min(100, Math.round(margin * 10) / 10));
    }
    return 0;
  }, [totalMoneyIn, totalMoneyOut]);

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

  // Design color tokens — ROVA Purple palette
  const colors = {
    purple: isDark ? '#9333ea' : '#7c3aed',
    purpleLight: isDark ? '#a855f7' : '#8b5cf6',
    purpleDark: isDark ? '#7e22ce' : '#662D91',
    purpleDim: isDark ? 'rgba(147, 51, 234, 0.16)' : 'rgba(124, 58, 237, 0.10)',
    purpleBorder: isDark ? 'rgba(147, 51, 234, 0.35)' : 'rgba(124, 58, 237, 0.25)',
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
          {/* Top 4 KPI Metric Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isSmall ? '1fr' : isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: 16,
            marginBottom: 24,
          }}>
            {/* Card 1: Bank Balance */}
            <div style={{
              background: colors.cardBg,
              borderRadius: 20,
              border: colors.cardBorder,
              boxShadow: colors.cardShadow,
              padding: '22px 22px 20px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onClick={() => navigate('/app/banking')}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: colors.purpleDim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colors.purpleLight,
                }}>
                  <Wallet size={17} />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveMenuCard(activeMenuCard === 1 ? null : 1); }}
                  style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: 4 }}
                >
                  <MoreVertical size={16} />
                </button>
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
                  Your bank balance
                </div>
              </div>
            </div>

            {/* Card 2: Money In */}
            <div style={{
              background: colors.cardBg,
              borderRadius: 20,
              border: colors.cardBorder,
              boxShadow: colors.cardShadow,
              padding: '22px 22px 20px',
              position: 'relative',
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: colors.purpleDim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colors.purpleLight,
                }}>
                  <ArrowUpRight size={18} />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveMenuCard(activeMenuCard === 2 ? null : 2); }}
                  style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: 4 }}
                >
                  <MoreVertical size={16} />
                </button>
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{
                  fontSize: 25,
                  fontWeight: 800,
                  color: colors.purpleLight,
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
            <div style={{
              background: colors.cardBg,
              borderRadius: 20,
              border: colors.cardBorder,
              boxShadow: colors.cardShadow,
              padding: '22px 22px 20px',
              position: 'relative',
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: colors.expenseDim,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colors.expenseBar,
                }}>
                  <ArrowDownRight size={18} />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveMenuCard(activeMenuCard === 3 ? null : 3); }}
                  style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: 4 }}
                >
                  <MoreVertical size={16} />
                </button>
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

            {/* Card 4: This Month's Spending */}
            <div style={{
              background: colors.cardBg,
              borderRadius: 20,
              border: colors.cardBorder,
              boxShadow: colors.cardShadow,
              padding: '22px 22px 20px',
              position: 'relative',
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colors.textPrimary,
                }}>
                  <CreditCard size={17} />
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveMenuCard(activeMenuCard === 4 ? null : 4); }}
                  style={{ background: 'none', border: 'none', color: colors.textMuted, cursor: 'pointer', padding: 4 }}
                >
                  <MoreVertical size={16} />
                </button>
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
                  {formatCurrency(currentMonthExpenses)}
                </div>
                <div style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 7, fontWeight: 500 }}>
                  This month's expenses
                </div>
              </div>
            </div>
          </div>

          {/* Main 2-Column Grid (Left: 68%, Right: 32%) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.9fr 1fr',
            gap: 20,
            alignItems: 'start',
          }}>
            
            {/* LEFT COLUMN: Real Cash Flow Bar Chart + Recent Transactions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              
              {/* Cash Flow Overview Card */}
              <div style={{
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
                    {/* Time Filter Pill */}
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

                    {/* Diagonal Arrow Action Button */}
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

                {/* Metrics Breakdown: Money In & Money Out */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 18 : 32,
                  marginBottom: 20,
                  flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: colors.textMuted, fontWeight: 600, marginBottom: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors.purple }} />
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
                        background: colors.purpleDim,
                        color: colors.purpleLight,
                        border: `1px solid ${colors.purpleBorder}`,
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

                {/* Real Dual-Bar Chart: Money In (Purple) & Money Out (Rose) */}
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
                        fill={colors.purple}
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

            {/* RIGHT COLUMN: Bookkeeping Status Widget & Profit Margin Radial Gauge */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
              
              {/* Bookkeeping Status Card (Replaces Formation Status) */}
              <div style={{
                background: colors.cardBg,
                borderRadius: 20,
                border: colors.cardBorder,
                boxShadow: colors.cardShadow,
                padding: '22px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <h3 style={{ fontSize: 15.5, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
                    Bookkeeping Status
                  </h3>
                  <button
                    onClick={() => navigate('/app/transactions')}
                    title="Open Ledger"
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
                
                <div style={{ fontSize: 12.5, color: colors.textMuted, fontWeight: 500, marginBottom: 16 }}>
                  {transactions.length === 0
                    ? 'Ready to record your first entry'
                    : uncategorizedCount === 0
                    ? 'All entries categorised & ready'
                    : `${uncategorizedCount} transaction${uncategorizedCount === 1 ? '' : 's'} pending review`}
                </div>

                {/* Rounded Purple Progress Bar */}
                <div style={{
                  width: '100%',
                  height: 22,
                  borderRadius: 12,
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 3,
                  boxSizing: 'border-box',
                  marginBottom: 16,
                }}>
                  <div style={{
                    width: `${Math.max(categorizedPct, transactions.length > 0 ? 6 : 0)}%`,
                    height: '100%',
                    borderRadius: 9,
                    background: `linear-gradient(90deg, ${colors.purpleDark}, ${colors.purpleLight})`,
                    transition: 'width 0.4s ease',
                  }} />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                    ROVA Ledger Health ({categorizedPct}%)
                  </div>
                  <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 3 }}>
                    {categorizedCount} of {transactions.length} transactions categorised
                  </div>
                </div>

                {/* Review Books Pill Button */}
                <button
                  onClick={() => navigate('/app/transactions')}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: 24,
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0',
                    color: colors.textPrimary,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'center',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget.style.background = colors.purpleDim);
                    (e.currentTarget.style.borderColor = colors.purpleBorder);
                    (e.currentTarget.style.color = colors.purpleLight);
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff');
                    (e.currentTarget.style.borderColor = isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #e2e8f0');
                    (e.currentTarget.style.color = colors.textPrimary);
                  }}
                >
                  Review Books
                </button>
              </div>

              {/* Profit Margin / Success Rate Radial Gauge Card */}
              <div style={{
                background: colors.cardBg,
                borderRadius: 20,
                border: colors.cardBorder,
                boxShadow: colors.cardShadow,
                padding: '22px 24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <h3 style={{ fontSize: 15.5, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
                    Profit Margin
                  </h3>
                  <button
                    onClick={() => navigate('/app/reports')}
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

                <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500, marginBottom: 12 }}>
                  Net retention from your real cash flow
                </div>

                {/* SVG Semi-Circle Radial Gauge (Purple) */}
                <div style={{ display: 'flex', justifyContent: 'center', position: 'relative', margin: '14px 0 6px' }}>
                  <svg width="220" height="125" viewBox="0 0 220 125">
                    {/* Background Arc */}
                    <path
                      d="M 25 110 A 85 85 0 0 1 195 110"
                      fill="none"
                      stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9'}
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray="4 8"
                    />
                    {/* Foreground Purple Arc */}
                    <path
                      d="M 25 110 A 85 85 0 0 1 195 110"
                      fill="none"
                      stroke={colors.purple}
                      strokeWidth="14"
                      strokeLinecap="round"
                      strokeDasharray="4 8"
                      strokeDashoffset={(1 - (successRate / 100)) * 267}
                    />
                  </svg>

                  {/* Percentage in center */}
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                  }}>
                    <div style={{
                      fontSize: 27,
                      fontWeight: 800,
                      color: colors.textPrimary,
                      fontFamily: 'Space Grotesk, sans-serif',
                      lineHeight: 1,
                    }}>
                      {successRate}%
                    </div>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: colors.purpleLight,
                      marginTop: 4,
                    }}>
                      {totalMoneyIn >= totalMoneyOut ? 'Positive Net' : 'Net Deficit'}
                    </div>
                  </div>
                </div>

                {/* Real Activity Summary Capsule */}
                <div style={{
                  marginTop: 18,
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: colors.pillBg,
                  border: colors.pillBorder,
                  textAlign: 'center',
                }}>
                  <p style={{
                    fontSize: 12,
                    color: colors.textSecondary,
                    margin: 0,
                    lineHeight: 1.5,
                    fontWeight: 500,
                  }}>
                    You recorded{' '}
                    <strong style={{ color: colors.textPrimary }}>
                      {formatCurrency(todayIncome)}
                    </strong>{' '}
                    in Money In today and{' '}
                    <strong style={{ color: colors.textPrimary }}>
                      {formatCurrency(weekIncome)}
                    </strong>{' '}
                    this week.
                  </p>
                </div>
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
        <div style={{ fontWeight: 700, color: colors.purpleLight, marginBottom: 2 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: colors.purple }} />
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
          background: isIncome ? colors.purpleDim : colors.expenseDim,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {isIncome ? (
            <ArrowUpRight size={15} color={colors.purpleLight} />
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
        color: isIncome ? colors.purpleLight : colors.textPrimary,
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
