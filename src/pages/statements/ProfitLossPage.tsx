import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Transaction } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { downloadCSV, printStatementHTML } from '../../lib/export';
import { computeAccountingHubFinancials } from '../../lib/accountingRules';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download, Printer, TrendingUp, TrendingDown, DollarSign, ChevronDown } from 'lucide-react';

export default function ProfitLossPage() {
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from('transactions').select('*, category:categories(*)').eq('user_id', user!.id).order('date');
    setTransactions(data || []);
    setLoading(false);
  }

  const periodTx = useMemo(
    () => transactions.filter(t => new Date(t.date).getFullYear() === year),
    [transactions, year]
  );

  const summary = useMemo(
    () => computeAccountingHubFinancials(periodTx as any),
    [periodTx]
  );

  const { pl } = summary;
  const availableYears = [...new Set(transactions.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);
  const businessName = profile?.business_name || profile?.full_name || 'My Business';

  function handleExportCSV() {
    const rows: (string | number)[][] = [];
    rows.push(['REVENUE', '', '']);
    rows.push(['', 'Gross Sales / Service Revenue', pl.revenue]);
    if (pl.salesReturns > 0) {
      rows.push(['', 'Less: Customer Refunds / Returns', -pl.salesReturns]);
    }
    rows.push(['Net Revenue', '', pl.netRevenue]);
    rows.push(['', '', '']);

    rows.push(['COST OF SALES', '', '']);
    rows.push(['', 'Direct Costs / Cost of Sales', pl.costOfSales]);
    rows.push(['Gross Profit', '', pl.grossProfit]);
    rows.push(['', '', '']);

    rows.push(['OPERATING EXPENSES', '', '']);
    Object.entries(pl.operatingExpensesByCategory).forEach(([name, amount]) => rows.push(['', name, amount]));
    rows.push(['Total Operating Expenses', '', pl.totalOperatingExpenses]);
    rows.push(['Operating Profit (EBIT)', '', pl.operatingProfit]);
    rows.push(['', '', '']);

    if (pl.totalOtherIncome > 0) {
      rows.push(['OTHER INCOME', '', '']);
      Object.entries(pl.otherIncomeByCategory).forEach(([name, amount]) => rows.push(['', name, amount]));
      rows.push(['Total Other Income', '', pl.totalOtherIncome]);
      rows.push(['', '', '']);
    }

    if (pl.financeCosts > 0) {
      rows.push(['FINANCE COSTS', '', '']);
      rows.push(['', 'Loan Interest & Financing Fees', pl.financeCosts]);
      rows.push(['', '', '']);
    }

    rows.push([pl.netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS', '', pl.netProfit]);
    rows.push(['Profit Margin', '', `${pl.profitMargin.toFixed(1)}%`]);
    downloadCSV(`profit-loss-${year}.csv`, ['Section', 'Category', 'Amount (NGN)'], rows);
    setShowExportMenu(false);
  }

  function handlePrint() {
    const opExpenseRows = Object.entries(pl.operatingExpensesByCategory).map(([name, amt]) =>
      `<tr class="line-row"><td>${name}</td><td class="amount negative">${formatCurrency(amt)}</td></tr>`).join('') ||
      '<tr class="line-row"><td style="color:#9ca3af">No operating expenses</td><td>₦0.00</td></tr>';

    const otherIncomeRows = Object.entries(pl.otherIncomeByCategory).map(([name, amt]) =>
      `<tr class="line-row"><td>${name}</td><td class="amount positive">${formatCurrency(amt)}</td></tr>`).join('');

    const html = `<table>
      <tr class="section-header"><td colspan="2">Revenue</td></tr>
      <tr class="line-row"><td>Gross Sales & Service Revenue</td><td class="amount positive">${formatCurrency(pl.revenue)}</td></tr>
      ${pl.salesReturns > 0 ? `<tr class="line-row"><td>Less: Customer Refunds / Returns</td><td class="amount negative">-${formatCurrency(pl.salesReturns)}</td></tr>` : ''}
      <tr class="subtotal-row"><td>Net Revenue</td><td class="amount positive">${formatCurrency(pl.netRevenue)}</td></tr>

      <tr class="section-header"><td colspan="2">Cost of Sales</td></tr>
      <tr class="line-row"><td>Direct Costs (Hosting, Materials, Subcontractors)</td><td class="amount negative">${formatCurrency(pl.costOfSales)}</td></tr>
      <tr class="subtotal-row"><td>Gross Profit</td><td class="amount ${pl.grossProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(pl.grossProfit)}</td></tr>

      <tr class="section-header"><td colspan="2">Operating Expenses</td></tr>
      ${opExpenseRows}
      <tr class="subtotal-row"><td>Total Operating Expenses</td><td class="amount negative">${formatCurrency(pl.totalOperatingExpenses)}</td></tr>

      ${pl.totalOtherIncome > 0 ? `
      <tr class="section-header"><td colspan="2">Other Income</td></tr>
      ${otherIncomeRows}
      <tr class="subtotal-row"><td>Total Other Income</td><td class="amount positive">${formatCurrency(pl.totalOtherIncome)}</td></tr>
      ` : ''}

      ${pl.financeCosts > 0 ? `
      <tr class="section-header"><td colspan="2">Finance Costs</td></tr>
      <tr class="line-row"><td>Loan Interest</td><td class="amount negative">${formatCurrency(pl.financeCosts)}</td></tr>
      ` : ''}

      <tr class="total-row">
        <td>Net ${pl.netProfit >= 0 ? 'Profit' : 'Loss'} &nbsp;<span style="font-size:11px;font-weight:400;color:#6b7280">Margin: ${pl.profitMargin.toFixed(1)}%</span></td>
        <td class="amount ${pl.netProfit >= 0 ? 'positive' : 'negative'}">${pl.netProfit < 0 ? '-' : ''}${formatCurrency(Math.abs(pl.netProfit))}</td>
      </tr>
    </table>`;
    printStatementHTML('Profit & Loss Statement', `January 1 – December 31, ${year}`, businessName, html);
    setShowExportMenu(false);
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 840, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Profit & Loss Statement</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Statement of Comprehensive Income (Capital transactions excluded per accounting standards)</p>
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
          { label: 'Net Revenue', value: formatCurrency(pl.netRevenue), color: 'var(--success)', icon: TrendingUp },
          { label: 'Total Operating Expenses', value: formatCurrency(pl.totalOperatingExpenses), color: 'var(--error)', icon: TrendingDown },
          { label: 'Net Profit', value: (pl.netProfit < 0 ? '-' : '') + formatCurrency(Math.abs(pl.netProfit)), color: pl.netProfit >= 0 ? 'var(--success)' : 'var(--error)', icon: DollarSign },
        ].map(s => (
          <Card key={s.label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <s.icon size={14} color={s.color} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</span>
            </div>
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
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Income Statement · January 1 – December 31, {year}</div>
          </div>

          <div>
            {/* Revenue */}
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Revenue</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Sales / Service Revenue</span>
              <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)' }}>{formatCurrency(pl.revenue)}</span>
            </div>
            {pl.salesReturns > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--error)' }}>Less: Customer Refunds / Returns</span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>-{formatCurrency(pl.salesReturns)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Net Revenue</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>{formatCurrency(pl.netRevenue)}</span>
            </div>

            {/* Cost of Sales */}
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Cost of Sales</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Direct Costs (Hosting, Materials, Subcontractors)</span>
              <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)' }}>{formatCurrency(pl.costOfSales)}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--bg-border)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-elevated)' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Gross Profit</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: pl.grossProfit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {formatCurrency(pl.grossProfit)}
              </span>
            </div>

            {/* Operating Expenses */}
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Operating Expenses</span>
            </div>
            {Object.keys(pl.operatingExpensesByCategory).length === 0 ? (
              <div style={{ padding: '9px 20px 9px 32px', fontSize: 13, color: 'var(--text-muted)' }}>No operating expenses recorded</div>
            ) : (
              Object.entries(pl.operatingExpensesByCategory).map(([name, amount]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{name}</span>
                  <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)' }}>{formatCurrency(amount)}</span>
                </div>
              ))
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Total Operating Expenses</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>{formatCurrency(pl.totalOperatingExpenses)}</span>
            </div>

            {/* Operating Profit */}
            <div style={{ borderTop: '1px solid var(--bg-border)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-elevated)' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Operating Profit (EBIT)</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: pl.operatingProfit >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {formatCurrency(pl.operatingProfit)}
              </span>
            </div>

            {/* Other Income */}
            {pl.totalOtherIncome > 0 && (
              <>
                <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Other Income</span>
                </div>
                {Object.entries(pl.otherIncomeByCategory).map(([name, amount]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{name}</span>
                    <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>{formatCurrency(amount)}</span>
                  </div>
                ))}
              </>
            )}

            {/* Finance Costs */}
            {pl.financeCosts > 0 && (
              <>
                <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Finance Costs</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Loan Interest</span>
                  <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>{formatCurrency(pl.financeCosts)}</span>
                </div>
              </>
            )}

            {/* Net Profit */}
            <div style={{ borderTop: '2px solid var(--bg-border)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-elevated)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Net {pl.netProfit >= 0 ? 'Profit' : 'Loss'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Profit Margin: {pl.profitMargin.toFixed(1)}%</div>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: pl.netProfit >= 0 ? 'var(--success)' : 'var(--error)', alignSelf: 'center' }}>
                {pl.netProfit < 0 ? '-' : ''}{formatCurrency(Math.abs(pl.netProfit))}
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
