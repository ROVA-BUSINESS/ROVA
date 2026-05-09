import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, ArrowUpRight, ArrowDownRight, Zap, Plus, ChevronRight, Wallet } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase, type Transaction, type Account } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate, formatTime } from '../lib/format';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { MonoConnectButton } from '../components/MonoConnectButton';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DashboardPage() {
  const { user, profile, isStaff } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [arBalance, setArBalance] = useState(0);
  const [loading, setLoading] = useState(true);

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
      supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true),
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

  const chartData = MONTHS.slice(0, new Date().getMonth() + 1).map((month, i) => {
    const monthTx = transactions.filter(t => new Date(t.date).getMonth() === i);
    return {
      month,
      income: monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expenses: monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  });

  const categoryMap = new Map<string, number>();
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const cat = (t.category as any)?.name || 'Other';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + t.amount);
  });
  const pieData = Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  const PIE_COLORS = ['#9333ea', '#a855f7', '#c084fc', '#7e22ce', '#6b21a8'];

  const recentTx = transactions.slice(0, 5);

  const displayName = profile?.full_name || profile?.business_name || user?.email?.split('@')[0] || 'there';

  const statCards = [
    {
      label: 'Total Balance',
      value: formatCurrency(totalBalance),
      icon: Wallet,
      iconColor: '#9333ea',
      iconBg: 'var(--accent-dim)',
      trend: null,
    },
    {
      label: 'Total Income',
      value: formatCurrency(income),
      icon: TrendingUp,
      iconColor: 'var(--success)',
      iconBg: 'var(--success-dim)',
      trend: 'up',
    },
    {
      label: 'Total Expenses',
      value: formatCurrency(expenses),
      icon: TrendingDown,
      iconColor: 'var(--error)',
      iconBg: 'var(--error-dim)',
      trend: 'down',
    },
    {
      label: 'Net Cash Flow',
      value: formatCurrency(Math.abs(netFlow)),
      icon: DollarSign,
      iconColor: netFlow >= 0 ? 'var(--success)' : 'var(--error)',
      iconBg: netFlow >= 0 ? 'var(--success-dim)' : 'var(--error-dim)',
      trend: netFlow >= 0 ? 'up' : 'down',
    },
  ];

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1200, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>
            Good {getGreeting()}, {displayName.split(' ')[0]} 👋
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Here's your financial overview for {new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={14} />}
          onClick={() => navigate('/transactions')}
        >
          Add Transaction
        </Button>
      </div>

      {loading ? (
        <div className="mobile-grid-2 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: 100 }} />
          ))}
        </div>
      ) : (
        <>
          <div className="mobile-grid-2 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {statCards.map(card => (
              <Card key={card.label} hoverable>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-md)',
                    background: card.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <card.icon size={17} color={card.iconColor} />
                  </div>
                  {card.trend && (
                    <span style={{ color: card.trend === 'up' ? 'var(--success)' : 'var(--error)', display: 'flex', alignItems: 'center', fontSize: 11 }}>
                      {card.trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                  {card.value}
                </div>
              </Card>
            ))}
          </div>

          <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
            <Card>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 14 }}>Cash Flow Overview</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date().getFullYear()}</span>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                    <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: 'var(--text-primary)' }}
                      formatter={(v) => formatCurrency(Number(v))}
                    />
                    <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#incomeGrad)" strokeWidth={2} name="Income" />
                    <Area type="monotone" dataKey="expenses" stroke="#9333ea" fill="url(#expenseGrad)" strokeWidth={2} name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart />
              )}
            </Card>

            <Card>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, marginBottom: 2 }}>Expense Breakdown</h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Top categories</p>
              </div>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => formatCurrency(Number(v))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {pieData.map((d, i) => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i] }} />
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.name}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No expense data yet
                </div>
              )}
            </Card>
          </div>

          <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <Card>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 14 }}>Recent Transactions</h3>
                <button
                  onClick={() => navigate('/transactions')}
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

            <Card>
              <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 14 }}>Accounts</h3>
                <button
                  onClick={() => navigate('/settings')}
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
                        background: acc.color || 'var(--accent-dim)',
                        opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CreditCard size={14} color="white" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{acc.type}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>
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
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Total Net Worth</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent-light)' }}>
                    {formatCurrency(totalBalance)}
                  </div>
                </div>
              )}
              
              <div style={{ marginTop: 16 }}>
                <MonoConnectButton onSuccess={loadData} size="sm" className="w-full" />
              </div>
            </Card>
          </div>
        </>
      )}

      {!loading && transactions.length === 0 && accounts.length === 0 && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'linear-gradient(135deg, var(--accent-primary), #7e22ce)',
          borderRadius: 'var(--radius-lg)', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: 'var(--shadow-glow)', animation: 'fadeIn 1s ease',
          maxWidth: 300,
        }}>
          <Zap size={18} color="white" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'white' }}>Welcome to ROVA!</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Add transactions to get started</div>
          </div>
        </div>
      )}
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
          {tx.description || (tx.category as any)?.name || 'Transaction'}
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

function EmptyChart() {
  return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No data to display yet</p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
