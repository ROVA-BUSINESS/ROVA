import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, ChartBar as BarChart2, Download, ChevronDown } from 'lucide-react';
import { downloadCSV } from '../lib/export';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend
} from 'recharts';
import { supabase, type Transaction } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/format';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'3m' | '6m' | '12m'>('6m');

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select('*, category:categories(*)')
      .eq('user_id', user!.id)
      .order('date', { ascending: true });
    setTransactions(data || []);
    setLoading(false);
  }

  const periodMonths = period === '3m' ? 3 : period === '6m' ? 6 : 12;
  const now = new Date();

  const monthlyData = Array.from({ length: periodMonths }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (periodMonths - 1 - i), 1);
    const monthTx = transactions.filter(t => {
      const td = new Date(t.date);
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    });
    const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return {
      month: `${MONTHS[d.getMonth()]} ${d.getFullYear() !== now.getFullYear() ? d.getFullYear().toString().slice(2) : ''}`.trim(),
      income,
      expenses,
      net: income - expenses,
    };
  });

  const categoryMap = new Map<string, { income: number; expense: number }>();
  transactions.forEach(t => {
    const cat = (t.category as any)?.name || 'Uncategorized';
    const cur = categoryMap.get(cat) || { income: 0, expense: 0 };
    if (t.type === 'income') cur.income += t.amount;
    if (t.type === 'expense') cur.expense += t.amount;
    categoryMap.set(cat, cur);
  });
  const categoryData = Array.from(categoryMap.entries())
    .map(([name, v]) => ({ name, ...v, total: v.income + v.expense }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  const [showExportMenu, setShowExportMenu] = useState(false);

  function handleExportCSV() {
    const rows: (string | number)[][] = monthlyData.map(d => [d.month, d.income, d.expenses, d.net]);
    downloadCSV(`financial-report-${period}.csv`, ['Month', 'Income (NGN)', 'Expenses (NGN)', 'Net (NGN)'], rows);
    setShowExportMenu(false);
  }

  function handleExportCategories() {
    const rows = categoryData.map(c => [c.name, c.income, c.expense]);
    downloadCSV(`category-breakdown.csv`, ['Category', 'Income (NGN)', 'Expenses (NGN)'], rows);
    setShowExportMenu(false);
  }

  const summaryStats = [
    { label: 'Total Revenue', value: formatCurrency(totalIncome), color: 'var(--success)', icon: TrendingUp },
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), color: 'var(--error)', icon: TrendingDown },
    { label: 'Net Profit/Loss', value: formatCurrency(Math.abs(netProfit)), color: netProfit >= 0 ? 'var(--success)' : 'var(--error)', icon: BarChart2 },
    { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%`, color: profitMargin >= 0 ? 'var(--success)' : 'var(--error)', icon: TrendingUp },
  ];

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1100, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Financial Reports</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Insights and analytics for your finances</p>
        </div>
        <div style={{ position: 'relative' }}>
          <Button variant="secondary" icon={<Download size={14} />} onClick={() => setShowExportMenu(v => !v)}>
            Export <ChevronDown size={11} style={{ marginLeft: 2 }} />
          </Button>
          {showExportMenu && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', zIndex: 100, minWidth: 200, overflow: 'hidden' }}>
              <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <Download size={13} color="var(--text-muted)" /> Monthly Summary CSV
              </button>
              <button onClick={handleExportCategories} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', transition: 'background 0.1s', borderTop: '1px solid var(--bg-border)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <Download size={13} color="var(--text-muted)" /> Category Breakdown CSV
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <Card hoverable onClick={() => navigate('/app/profit-loss')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: 'var(--success-dim)', borderRadius: 10 }}>
            <TrendingUp size={20} color="var(--success)" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Profit & Loss</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Income vs Expenses</div>
          </div>
        </Card>
      </div>

      {loading ? (
        <div className="mobile-grid-2 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 90 }} />)}
        </div>
      ) : (
        <>
          <div className="mobile-grid-2 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {summaryStats.map(s => (
              <Card key={s.label} hoverable>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={16} color={s.color} />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                <div className="mobile-stat-value" style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: s.color }}>{s.value}</div>
              </Card>
            ))}
          </div>

          <div className="mobile-overflow-x" style={{ display: 'flex', gap: 8, marginBottom: 20, maxWidth: '100%' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center', marginRight: 4 }}>Period:</span>
            {(['3m', '6m', '12m'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500,
                  background: period === p ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: period === p ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${period === p ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                  transition: 'all 0.15s',
                }}
              >
                {p === '3m' ? '3 Months' : p === '6m' ? '6 Months' : '12 Months'}
              </button>
            ))}
          </div>

          <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <Card>
              <h3 style={{ fontSize: 14, marginBottom: 16 }}>Income vs Expenses</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => formatCurrency(Number(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="income" fill="#22c55e" radius={[3, 3, 0, 0]} name="Income" />
                  <Bar dataKey="expenses" fill="var(--accent-primary)" radius={[3, 3, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 style={{ fontSize: 14, marginBottom: 16 }}>Net Cash Flow Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => formatCurrency(Number(v))}
                  />
                  <Area type="monotone" dataKey="net" stroke="var(--accent-primary)" fill="url(#netGrad)" strokeWidth={2} name="Net Flow" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card>
            <h3 style={{ fontSize: 14, marginBottom: 16 }}>Spending by Category</h3>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => formatCurrency(Number(v))}
                  />
                  <Bar dataKey="income" fill="#22c55e" radius={[0, 3, 3, 0]} name="Income" stackId="a" />
                  <Bar dataKey="expense" fill="var(--accent-primary)" radius={[0, 3, 3, 0]} name="Expense" stackId="b" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>No data available</div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
