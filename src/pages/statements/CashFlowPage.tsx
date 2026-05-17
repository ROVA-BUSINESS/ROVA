import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Transaction } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { downloadCSV, printStatementHTML } from '../../lib/export';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download, Printer, ChevronDown, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMobile } from '../../hooks/useMobile';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CashFlowPage() {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const isMobile = useMobile(1024);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from('transactions').select('*, category:categories(*)').eq('user_id', user!.id).order('date', { ascending: true });
    setTransactions(data || []);
    setLoading(false);
  }

  const periodTx = transactions.filter(t => new Date(t.date).getFullYear() === year);

  const operating = periodTx.filter(t => {
    const cat = (t.category as any)?.name?.toLowerCase() || '';
    return !cat.includes('investment') && !cat.includes('loan') && !cat.includes('equity');
  });
  const investing = periodTx.filter(t => {
    const cat = (t.category as any)?.name?.toLowerCase() || '';
    return cat.includes('investment');
  });
  const financing = periodTx.filter(t => {
    const cat = (t.category as any)?.name?.toLowerCase() || '';
    return cat.includes('loan') || cat.includes('equity');
  });

  const netOperating = operating.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  const netInvesting = investing.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  const netFinancing = financing.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
  const netChange = netOperating + netInvesting + netFinancing;

  const monthlyData = MONTHS.map((month, i) => {
    const monthTx = periodTx.filter(t => new Date(t.date).getMonth() === i);
    const inflow = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const outflow = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { month, inflow, outflow, net: inflow - outflow };
  }).filter(d => d.inflow > 0 || d.outflow > 0);

  const availableYears = [...new Set(transactions.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);
  const businessName = profile?.business_name || profile?.full_name || 'My Business';

  function buildSectionItems(txs: Transaction[]) {
    return txs.reduce<Record<string, number>>((map, t) => {
      const desc = t.description || (t.category as any)?.name || 'Other';
      map[desc] = (map[desc] || 0) + (t.type === 'income' ? t.amount : -t.amount);
      return map;
    }, {});
  }

  function handleExportCSV() {
    const rows: (string | number)[][] = [];
    const addSection = (title: string, txs: Transaction[], net: number) => {
      rows.push([title, '', '']);
      const items = buildSectionItems(txs);
      Object.entries(items).forEach(([desc, val]) => rows.push(['', desc, val]));
      rows.push([`Net Cash from ${title}`, '', net]);
      rows.push(['', '', '']);
    };
    addSection('Operating Activities', operating, netOperating);
    addSection('Investing Activities', investing, netInvesting);
    addSection('Financing Activities', financing, netFinancing);
    rows.push(['Net Change in Cash', '', netChange]);
    downloadCSV(`cash-flow-${year}.csv`, ['Section', 'Description', 'Amount (NGN)'], rows);
    setShowExportMenu(false);
  }

  function handlePrint() {
    const renderSection = (title: string, txs: Transaction[], net: number) => {
      const items = buildSectionItems(txs);
      const itemRows = Object.entries(items).map(([name, val]) =>
        `<tr class="line-row"><td>${name}</td><td class="amount ${val >= 0 ? 'positive' : 'negative'}">${val < 0 ? '-' : '+'}${formatCurrency(Math.abs(val))}</td></tr>`).join('') ||
        '<tr class="line-row"><td style="color:#9ca3af">No activity</td><td></td></tr>';
      return `
        <tr class="section-header"><td colspan="2">${title}</td></tr>
        ${itemRows}
        <tr class="subtotal-row"><td>Net Cash from ${title}</td><td class="amount ${net >= 0 ? 'positive' : 'negative'}">${net < 0 ? '-' : ''}${formatCurrency(Math.abs(net))}</td></tr>`;
    };
    const html = `<table>
      ${renderSection('Operating Activities', operating, netOperating)}
      ${renderSection('Investing Activities', investing, netInvesting)}
      ${renderSection('Financing Activities', financing, netFinancing)}
      <tr class="total-row"><td>Net Change in Cash</td><td class="amount ${netChange >= 0 ? 'positive' : 'negative'}">${netChange < 0 ? '-' : ''}${formatCurrency(Math.abs(netChange))}</td></tr>
    </table>`;
    printStatementHTML('Cash Flow Statement', `Year Ended December 31, ${year}`, businessName, html);
    setShowExportMenu(false);
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 900, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Cash Flow Statement</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Track the movement of cash in and out</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '7px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}>
            {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div style={{ position: 'relative' }}>
            <Button variant="secondary" icon={<Download size={14} />} onClick={() => setShowExportMenu(v => !v)}>
              Export <ChevronDown size={11} style={{ marginLeft: 2 }} />
            </Button>
            {showExportMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', zIndex: 100, minWidth: 160, overflow: 'hidden' }}>
                <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <Download size={13} color="var(--text-muted)" /> Export CSV
                </button>
                <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', transition: 'background 0.1s', borderTop: '1px solid var(--bg-border)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <Printer size={13} color="var(--text-muted)" /> Print / PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mobile-grid-2 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Operating', value: netOperating, icon: RefreshCw },
          { label: 'Investing', value: netInvesting, icon: ArrowUpRight },
          { label: 'Financing', value: netFinancing, icon: ArrowDownRight },
          { label: 'Net Change', value: netChange, icon: ArrowUpRight },
        ].map(s => (
          <Card key={s.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <s.icon size={13} color={s.value >= 0 ? 'var(--success)' : 'var(--error)'} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
            </div>
            <div className="mobile-stat-value" style={{ fontSize: 17, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: s.value >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {s.value < 0 ? '-' : ''}{formatCurrency(Math.abs(s.value))}
            </div>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 250, marginBottom: 20 }} />
      ) : (
        <>
          <Card style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 16 }}>Monthly Cash Flow — {year}</h3>
            {monthlyData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>No data for {year}</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => formatCurrency(Number(v))}
                  />
                  <Area type="monotone" dataKey="inflow" stroke="#22c55e" fill="url(#inflowGrad)" strokeWidth={2} name="Inflow" />
                  <Area type="monotone" dataKey="outflow" stroke="#ef4444" fill="url(#outflowGrad)" strokeWidth={2} name="Outflow" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg-border)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{businessName}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Cash Flow Statement · Year Ended December 31, {year}</div>
            </div>

            <CashFlowSection title="Operating Activities" transactions={operating} />
            <SummaryRow label="Net Cash from Operating Activities" value={netOperating} />

            <CashFlowSection title="Investing Activities" transactions={investing} />
            <SummaryRow label="Net Cash from Investing Activities" value={netInvesting} />

            <CashFlowSection title="Financing Activities" transactions={financing} />
            <SummaryRow label="Net Cash from Financing Activities" value={netFinancing} />

            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-elevated)', borderTop: '2px solid var(--bg-border)' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Net Change in Cash</span>
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: netChange >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {netChange < 0 ? '-' : ''}{formatCurrency(Math.abs(netChange))}
              </span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function CashFlowSection({ title, transactions }: { title: string; transactions: Transaction[] }) {
  const items = transactions.reduce<Record<string, number>>((map, t) => {
    const desc = t.description || (t.category as any)?.name || 'Other';
    map[desc] = (map[desc] || 0) + (t.type === 'income' ? t.amount : -t.amount);
    return map;
  }, {});

  return (
    <div>
      <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>{title}</span>
      </div>
      {Object.entries(items).length === 0 ? (
        <div style={{ padding: '10px 32px', fontSize: 12, color: 'var(--text-disabled)' }}>No activity</div>
      ) : Object.entries(items).map(([name, val]) => (
        <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 20px 8px 32px', borderTop: '1px solid var(--bg-border)' }}>
          <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{name}</span>
          <span style={{ fontSize: 12, fontFamily: 'Space Grotesk, sans-serif', color: val >= 0 ? 'var(--success)' : 'var(--error)' }}>
            {val < 0 ? '-' : '+'}{formatCurrency(Math.abs(val))}
          </span>
        </div>
      ))}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: value >= 0 ? 'var(--success)' : 'var(--error)' }}>
        {value < 0 ? '-' : ''}{formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}
