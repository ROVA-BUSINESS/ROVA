import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Transaction, type Account } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { downloadCSV, printStatementHTML } from '../../lib/export';
import { computeAccountingHubFinancials } from '../../lib/accountingRules';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download, Printer, ChevronDown } from 'lucide-react';

export default function CashFlowPage() {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [txRes, accRes] = await Promise.all([
      supabase.from('transactions').select('*, category:categories(*)').eq('user_id', user!.id).order('date', { ascending: true }),
      supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true),
    ]);
    setTransactions(txRes.data || []);
    setAccounts(accRes.data || []);
    setLoading(false);
  }

  const periodTx = useMemo(
    () => transactions.filter(t => new Date(t.date).getFullYear() === year),
    [transactions, year]
  );

  const baselineCash = useMemo(() => {
    return accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + (a.balance || 0), 0);
  }, [accounts]);

  const summary = useMemo(
    () => computeAccountingHubFinancials(periodTx as any, [], {
      baselineCash: accounts.length > 0 ? baselineCash : 0,
    }),
    [periodTx, accounts, baselineCash]
  );

  const { cashFlow } = summary;
  const availableYears = [...new Set(transactions.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);
  const businessName = profile?.business_name || profile?.full_name || 'My Business';

  function handleExportCSV() {
    const rows: (string | number)[][] = [];
    rows.push(['OPERATING ACTIVITIES', '', '']);
    rows.push(['Cash inflows from operating activities', '', cashFlow.operatingInflows]);
    rows.push(['Cash outflows from operating activities', '', -cashFlow.operatingOutflows]);
    rows.push(['Net Cash from Operating Activities', '', cashFlow.netOperating]);
    rows.push(['', '', '']);

    rows.push(['INVESTING ACTIVITIES', '', '']);
    rows.push(['Cash inflows from investing activities (asset sales)', '', cashFlow.investingInflows]);
    rows.push(['Cash outflows for capital expenditures (PPE)', '', -cashFlow.investingOutflows]);
    rows.push(['Net Cash from Investing Activities', '', cashFlow.netInvesting]);
    rows.push(['', '', '']);

    rows.push(['FINANCING ACTIVITIES', '', '']);
    rows.push(['Cash inflows from equity & borrowings', '', cashFlow.financingInflows]);
    rows.push(['Cash outflows for debt repayment & dividends', '', -cashFlow.financingOutflows]);
    rows.push(['Net Cash from Financing Activities', '', cashFlow.netFinancing]);
    rows.push(['', '', '']);

    rows.push(['NET CHANGE IN CASH', '', cashFlow.netChangeInCash]);
    rows.push(['CLOSING CASH & CASH EQUIVALENTS', '', cashFlow.closingCash]);

    downloadCSV(`cash-flow-${year}.csv`, ['Section', 'Description', 'Amount (NGN)'], rows);
    setShowExportMenu(false);
  }

  function handlePrint() {
    const html = `<table>
      <tr class="section-header"><td colspan="2">Cash flows from Operating Activities</td></tr>
      <tr class="line-row"><td>Cash receipts from customers & operations</td><td class="amount positive">${formatCurrency(cashFlow.operatingInflows)}</td></tr>
      <tr class="line-row"><td>Cash payments to suppliers & operating expenses</td><td class="amount negative">-${formatCurrency(cashFlow.operatingOutflows)}</td></tr>
      <tr class="subtotal-row"><td>Net cash generated from Operating Activities</td><td class="amount ${cashFlow.netOperating >= 0 ? 'positive' : 'negative'}">${formatCurrency(cashFlow.netOperating)}</td></tr>

      <tr class="section-header"><td colspan="2">Cash flows from Investing Activities</td></tr>
      <tr class="line-row"><td>Proceeds from disposal of fixed assets</td><td class="amount positive">${formatCurrency(cashFlow.investingInflows)}</td></tr>
      <tr class="line-row"><td>Acquisition of Property, Plant & Equipment (PPE)</td><td class="amount negative">-${formatCurrency(cashFlow.investingOutflows)}</td></tr>
      <tr class="subtotal-row"><td>Net cash used in Investing Activities</td><td class="amount ${cashFlow.netInvesting >= 0 ? 'positive' : 'negative'}">${formatCurrency(cashFlow.netInvesting)}</td></tr>

      <tr class="section-header"><td colspan="2">Cash flows from Financing Activities</td></tr>
      <tr class="line-row"><td>Owner capital injections & loans received</td><td class="amount positive">${formatCurrency(cashFlow.financingInflows)}</td></tr>
      <tr class="line-row"><td>Loan principal repayments, director drawings & dividends</td><td class="amount negative">-${formatCurrency(cashFlow.financingOutflows)}</td></tr>
      <tr class="subtotal-row"><td>Net cash from Financing Activities</td><td class="amount ${cashFlow.netFinancing >= 0 ? 'positive' : 'negative'}">${formatCurrency(cashFlow.netFinancing)}</td></tr>

      <tr class="total-row"><td>Net change in cash and cash equivalents</td><td class="amount ${cashFlow.netChangeInCash >= 0 ? 'positive' : 'negative'}">${cashFlow.netChangeInCash < 0 ? '-' : ''}${formatCurrency(Math.abs(cashFlow.netChangeInCash))}</td></tr>
      <tr class="total-row"><td>Closing Cash & Cash Equivalents</td><td class="amount positive">${formatCurrency(cashFlow.closingCash)}</td></tr>
    </table>`;
    printStatementHTML('Statement of Cash Flows', `January 1 – December 31, ${year}`, businessName, html);
    setShowExportMenu(false);
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 840, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Cash Flow Statement</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Statement of Cash Flows (Operating, Investing, Financing per IAS 7)</p>
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
                <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', transition: 'background 0.1s', border: 'none', background: 'transparent', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <Download size={13} color="var(--text-muted)" /> Export CSV
                </button>
                <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', transition: 'background 0.1s', borderTop: '1px solid var(--bg-border)', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', background: 'transparent', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <Printer size={13} color="var(--text-muted)" /> Print / PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Operating Cash Flow', value: (cashFlow.netOperating < 0 ? '-' : '') + formatCurrency(Math.abs(cashFlow.netOperating)), color: cashFlow.netOperating >= 0 ? 'var(--success)' : 'var(--error)' },
          { label: 'Net Cash Change', value: (cashFlow.netChangeInCash < 0 ? '-' : '') + formatCurrency(Math.abs(cashFlow.netChangeInCash)), color: cashFlow.netChangeInCash >= 0 ? 'var(--success)' : 'var(--error)' },
          { label: 'Closing Cash Balance', value: formatCurrency(cashFlow.closingCash), color: 'var(--accent-primary)' },
        ].map(s => (
          <Card key={s.label}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            <div className="mobile-stat-value" style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {loading ? (
        <div>{[1,2].map(i => <div key={i} className="skeleton" style={{ height: 200, marginBottom: 16 }} />)}</div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{businessName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Statement of Cash Flows · January 1 – December 31, {year}</div>
          </div>

          <div>
            {/* Operating */}
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Operating Activities</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Cash receipts from operations & customers</span>
              <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>+{formatCurrency(cashFlow.operatingInflows)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Cash payments to suppliers & operating expenses</span>
              <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>-{formatCurrency(cashFlow.operatingOutflows)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Net Cash from Operating Activities</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: cashFlow.netOperating >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {cashFlow.netOperating < 0 ? '-' : '+'}{formatCurrency(Math.abs(cashFlow.netOperating))}
              </span>
            </div>

            {/* Investing */}
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Investing Activities</span>
            </div>
            {cashFlow.investingInflows > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Proceeds from disposal of fixed assets</span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>+{formatCurrency(cashFlow.investingInflows)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Acquisition of Property, Plant & Equipment (PPE)</span>
              <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: cashFlow.investingOutflows > 0 ? 'var(--error)' : 'var(--text-disabled)' }}>
                {cashFlow.investingOutflows > 0 ? `-${formatCurrency(cashFlow.investingOutflows)}` : '₦0.00'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Net Cash from Investing Activities</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: cashFlow.netInvesting >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {cashFlow.netInvesting < 0 ? '-' : ''}{formatCurrency(Math.abs(cashFlow.netInvesting))}
              </span>
            </div>

            {/* Financing */}
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Financing Activities</span>
            </div>
            {cashFlow.financingInflows > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Owner capital injections & loans received</span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>+{formatCurrency(cashFlow.financingInflows)}</span>
              </div>
            )}
            {cashFlow.financingOutflows > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Loan principal repayments, drawings & dividends</span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>-{formatCurrency(cashFlow.financingOutflows)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Net Cash from Financing Activities</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: cashFlow.netFinancing >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {cashFlow.netFinancing < 0 ? '-' : '+'}{formatCurrency(Math.abs(cashFlow.netFinancing))}
              </span>
            </div>

            {/* Net Change and Closing Cash */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', borderTop: '2px solid var(--bg-border)', background: 'var(--bg-elevated)' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Net Change in Cash</span>
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: cashFlow.netChangeInCash >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {cashFlow.netChangeInCash < 0 ? '-' : '+'}{formatCurrency(Math.abs(cashFlow.netChangeInCash))}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--bg-border)', background: 'var(--bg-elevated)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Closing Cash & Bank Balances (Reconciled with Balance Sheet)</span>
              <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>
                {formatCurrency(cashFlow.closingCash)}
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
