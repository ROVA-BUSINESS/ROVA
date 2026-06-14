import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Plus, ChevronRight, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase, type Transaction, type Account } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate, formatTime, cleanDescription } from '../lib/format';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { MonoConnectButton } from '../components/MonoConnectButton';
import EmailSyncSetup from '../components/bank-sync/EmailSyncSetup';
import QuickAddModal from '../components/QuickAddModal';
import { useMobile } from '../hooks/useMobile';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const { user, profile, isStaff } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [arBalance, setArBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isEmailSyncOpen, setIsEmailSyncOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const isMobile = useMobile(1024);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    let txQuery = supabase.from('transactions').select('*, category:categories(*), account:accounts(*)').eq('user_id', user!.id).order('date', { ascending: false }).limit(50);
    let invQuery = supabase.from('invoices').select('total, amount_paid').eq('user_id', user!.id).in('status', ['sent', 'overdue']);

    if (isStaff) {
      const limit = profile?.staff_visibility_limit || 500000;
      txQuery = txQuery.lt('amount', limit);
      invQuery = invQuery.lt('total', limit);
    }

    const [txRes, accRes, invRes] = await Promise.all([
      txQuery,
      supabase.from('accounts').select('*').eq('user_id', user!.id),
      invQuery
    ]);
    setTransactions(txRes.data || []);
    setAccounts(accRes.data || []);
    
    const arTotal = (invRes.data || []).reduce((s, inv) => s + (inv.total - (inv.amount_paid || 0)), 0);
    setArBalance(arTotal);
    
    setLoading(false);
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0) + arBalance;
  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netFlow = income - expenses;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const currentMonthIncome = transactions.filter(t => new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear && t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const lastMonthIncome = transactions.filter(t => new Date(t.date).getMonth() === lastMonth && new Date(t.date).getFullYear() === lastMonthYear && t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const incomeChange = lastMonthIncome === 0 ? (currentMonthIncome > 0 ? 100 : 0) : ((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100;

  const currentMonthExpenses = transactions.filter(t => new Date(t.date).getMonth() === currentMonth && new Date(t.date).getFullYear() === currentYear && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const lastMonthExpenses = transactions.filter(t => new Date(t.date).getMonth() === lastMonth && new Date(t.date).getFullYear() === lastMonthYear && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const expenseChange = lastMonthExpenses === 0 ? (currentMonthExpenses > 0 ? 100 : 0) : ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;

  const chartData = MONTHS.slice(0, new Date().getMonth() + 1).map((month, i) => {
    const monthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === i && d.getFullYear() === currentYear;
    });
    return {
      month,
      income: monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expenses: monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  });

  const recentTx = transactions.slice(0, 5);

  return (
    <div className="mobile-p-4" style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 12px 100px' }}>


      {/* Header controls bar */}
      <div style={{ marginBottom: 32, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 16 : 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Good {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'User'}!</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Here's what's happening with your business today.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <Button variant="secondary" size="sm" onClick={() => navigate('/app/transactions')} style={{ flex: isMobile ? 1 : 'none', minWidth: 'fit-content' }}>
            View History
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/app/invoices')} style={{ flex: isMobile ? 1 : 'none', minWidth: 'fit-content' }}>
            New Invoice
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsQuickAddOpen(true)} style={{ flex: isMobile ? '100%' : 'none', minWidth: 'fit-content' }}>
            <Plus size={16} /> Add Transaction
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 20 }} />)}
        </div>
      ) : (
        <>
          {/* Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginBottom: 32 }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: 'var(--accent-dim)', borderRadius: 12 }}>
                  <TrendingUp size={20} color="var(--accent-primary)" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Total Revenue</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 12 }}>
                {formatCurrency(income)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10 }}>
                <div style={{ fontSize: 12, color: incomeChange >= 0 ? 'var(--success)' : 'var(--error)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {incomeChange >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {incomeChange > 0 ? '+' : ''}{incomeChange.toFixed(1)}% from last month
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: 'var(--error-dim)', borderRadius: 12 }}>
                  <TrendingDown size={20} color="var(--error)" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Expenses</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 12 }}>
                {formatCurrency(expenses)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10 }}>
                <div style={{ fontSize: 12, color: expenseChange <= 0 ? 'var(--success)' : 'var(--error)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {expenseChange >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} {expenseChange > 0 ? '+' : ''}{expenseChange.toFixed(1)}% from last month
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: 'var(--success-dim)', borderRadius: 12 }}>
                  <DollarSign size={20} color="var(--success)" />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Net Cashflow</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: netFlow >= 0 ? 'var(--success)' : 'var(--error)', marginBottom: 12 }}>
                {formatCurrency(netFlow)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Current period profitability
                </div>
              </div>
            </Card>
          </div>

          <div className="mobile-col" style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
              <Card>
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700 }}>Financial Performance</h3>
                </div>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--bg-border)" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} tickFormatter={(v) => `₦${v/1000}k`} />
                      <Tooltip />
                      <Area type="monotone" dataKey="income" stroke="var(--accent-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: 14 }}>Recent Transactions</h3>
                  <button 
                    onClick={() => navigate('/app/transactions')}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-light)', fontSize: 12, fontWeight: 500 }}
                  >
                    View all <ChevronRight size={12} />
                  </button>
                </div>
                {recentTx.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {recentTx.map(tx => (
                      <TransactionRow key={tx.id} tx={tx} />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No transactions yet" sub="Add your first transaction to get started" />
                )}
              </Card>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <Card>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 14 }}>Accounts</h3>
                <button 
                  onClick={() => navigate('/app/settings')}
                  style={{ color: 'var(--accent-light)', fontSize: 12, fontWeight: 500 }}
                >
                  Manage
                </button>
              </div>
              {accounts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {accounts.map(acc => (
                    <div key={acc.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-md)',
                        background: (acc.color && acc.color.toLowerCase() === '#9333ea') ? 'var(--accent-primary)' : (acc.color || 'var(--accent-dim)'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Wallet size={14} color="white" style={{ display: 'block' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{acc.institution}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                        {formatCurrency(acc.balance)}
                      </div>
                    </div>
                  ))}
                  
                  {arBalance > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', background: 'var(--warning-dim)',
                      borderRadius: 'var(--radius-md)', border: '1px dashed rgba(245,158,11,0.4)',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 'var(--radius-md)',
                        background: 'var(--warning)',
                        opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <DollarSign size={14} color="white" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Accounts Receivable</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Unpaid Invoices</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)', fontFamily: 'Space Grotesk, sans-serif' }}>
                        {formatCurrency(arBalance)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState message="No accounts yet" sub="Add accounts in Settings" />
              )}

              {accounts.length > 0 && (
                <div style={{
                  marginTop: 16, padding: '12px', background: 'var(--accent-dim)',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Total Balance</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent-light)' }}>
                    {formatCurrency(totalBalance)}
                  </div>
                </div>
              )}
              
              {/* Bank Connection Card styled after mockup connect card */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Bank Connection</div>
                <div 
                  onClick={() => setIsEmailSyncOpen(true)}
                  style={{
                    border: '1px dashed var(--accent-border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-elevated)',
                    padding: '24px 16px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-primary)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-border)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
                  }}
                >
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'rgba(147,51,234,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent-primary)',
                  }}>
                    <Plus size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Connect Bank Account</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Secure bank connection via Mono or Email Sync</div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <MonoConnectButton onSuccess={loadData} size="sm" className="w-full" />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </>
      )}

      <EmailSyncSetup 
        isOpen={isEmailSyncOpen}
        onClose={() => setIsEmailSyncOpen(false)}
        onSuccess={loadData}
      />

      <QuickAddModal 
        open={isQuickAddOpen}
        onClose={() => { setIsQuickAddOpen(false); loadData(); }}
      />
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isIncome = tx.type === 'income';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 0', borderBottom: '1px solid var(--bg-border)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--radius-md)', flexShrink: 0,
        background: isIncome ? 'var(--success-dim)' : 'var(--error-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isIncome ? <ArrowUpRight size={14} color="var(--success)" /> : <ArrowDownRight size={14} color="var(--error)" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cleanDescription(tx.description) || (tx.category as any)?.name || 'Transaction'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(tx.date)}</div>
          <div style={{ fontSize: 10, color: 'var(--text-disabled)' }}>{formatTime(tx.created_at)}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: isIncome ? 'var(--success)' : 'var(--error)', flexShrink: 0, fontFamily: 'Space Grotesk, sans-serif' }}>
        {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
      </div>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{message}</p>
      {sub && <p style={{ color: 'var(--text-disabled)', fontSize: 11, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
