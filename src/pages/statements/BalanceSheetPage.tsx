import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Account, type Transaction } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/format';
import { downloadCSV, printStatementHTML } from '../../lib/export';
import { computeAccountingHubFinancials } from '../../lib/accountingRules';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download, Printer, ChevronDown, Scale, AlertTriangle } from 'lucide-react';

export default function BalanceSheetPage() {
  const { user, profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [accRes, txRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true),
      supabase.from('transactions').select('*, category:categories(*)').eq('user_id', user!.id),
    ]);
    setAccounts(accRes.data || []);
    setTransactions(txRes.data || []);
    setLoading(false);
  }

  const baselineCash = useMemo(() => {
    return accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + (a.balance || 0), 0);
  }, [accounts]);

  const summary = useMemo(() => {
    // If accounts have initial balances, provide baselineCash
    return computeAccountingHubFinancials(transactions as any, [], {
      baselineCash: accounts.length > 0 ? baselineCash : 0,
    });
  }, [transactions, accounts, baselineCash]);

  const { bs, suspense } = summary;
  const today = formatDate(new Date().toISOString().split('T')[0]);
  const businessName = profile?.business_name || profile?.full_name || 'My Business';

  function handleExportCSV() {
    const rows: (string | number)[][] = [];
    rows.push(['ASSETS', '', '']);
    rows.push(['Current Assets', '', '']);
    rows.push(['', 'Cash & Cash Equivalents', bs.cashAndBank]);
    if (bs.accountsReceivable !== 0) rows.push(['', 'Accounts Receivable', bs.accountsReceivable]);
    if (bs.inventory !== 0) rows.push(['', 'Inventory', bs.inventory]);
    if (bs.prepayments !== 0) rows.push(['', 'Prepaid Expenses', bs.prepayments]);
    if (bs.suspenseAsset !== 0) rows.push(['', 'Suspense (Uncategorized Out)', bs.suspenseAsset]);
    rows.push(['Total Current Assets', '', bs.totalCurrentAssets]);
    rows.push(['', '', '']);

    rows.push(['Non-Current Assets', '', '']);
    rows.push(['', 'Property, Plant & Equipment (PPE)', bs.ppe]);
    rows.push(['Total Non-Current Assets', '', bs.totalNonCurrentAssets]);
    rows.push(['TOTAL ASSETS', '', bs.totalAssets]);
    rows.push(['', '', '']);

    rows.push(['LIABILITIES', '', '']);
    rows.push(['Current Liabilities', '', '']);
    if (bs.accountsPayable !== 0) rows.push(['', 'Accounts Payable', bs.accountsPayable]);
    if (bs.customerDeposits !== 0) rows.push(['', 'Customer Deposits (liability)', bs.customerDeposits]);
    if (bs.directorLoanPayable !== 0) rows.push(['', "Director's Loan Account", bs.directorLoanPayable]);
    if (bs.suspenseLiability !== 0) rows.push(['', 'Suspense (Uncategorized In)', bs.suspenseLiability]);
    rows.push(['Total Current Liabilities', '', bs.totalCurrentLiabilities]);
    rows.push(['', '', '']);

    rows.push(['Non-Current Liabilities', '', '']);
    rows.push(['', 'Loans Payable', bs.loanPayable]);
    rows.push(['Total Non-Current Liabilities', '', bs.totalNonCurrentLiabilities]);
    rows.push(['TOTAL LIABILITIES', '', bs.totalLiabilities]);
    rows.push(['', '', '']);

    rows.push(['EQUITY', '', '']);
    rows.push(['', 'Share Capital', bs.shareCapital]);
    rows.push(['', 'Retained Earnings', bs.retainedEarnings]);
    rows.push(['TOTAL EQUITY', '', bs.totalEquity]);
    rows.push(['', '', '']);
    rows.push(['TOTAL LIABILITIES & EQUITY', '', bs.totalLiabilitiesAndEquity]);

    downloadCSV(`balance-sheet-${new Date().toISOString().split('T')[0]}.csv`, ['Section', 'Account', 'Amount (NGN)'], rows);
    setShowExportMenu(false);
  }

  function handlePrint() {
    const html = `<table>
      <tr class="section-header"><td colspan="2">Current Assets</td></tr>
      <tr class="line-row"><td>Cash & Bank Balances</td><td class="amount positive">${formatCurrency(bs.cashAndBank)}</td></tr>
      ${bs.accountsReceivable !== 0 ? `<tr class="line-row"><td>Accounts Receivable</td><td class="amount positive">${formatCurrency(bs.accountsReceivable)}</td></tr>` : ''}
      ${bs.inventory !== 0 ? `<tr class="line-row"><td>Inventory</td><td class="amount positive">${formatCurrency(bs.inventory)}</td></tr>` : ''}
      ${bs.prepayments !== 0 ? `<tr class="line-row"><td>Prepaid Expenses</td><td class="amount positive">${formatCurrency(bs.prepayments)}</td></tr>` : ''}
      ${bs.suspenseAsset !== 0 ? `<tr class="line-row" style="color:#f59e0b"><td>Suspense (Uncategorized Out)</td><td class="amount">${formatCurrency(bs.suspenseAsset)}</td></tr>` : ''}
      <tr class="subtotal-row"><td>Total Current Assets</td><td class="amount positive">${formatCurrency(bs.totalCurrentAssets)}</td></tr>

      <tr class="section-header"><td colspan="2">Non-Current Assets</td></tr>
      <tr class="line-row"><td>Property, Plant & Equipment (PPE)</td><td class="amount positive">${formatCurrency(bs.ppe)}</td></tr>
      <tr class="subtotal-row"><td>Total Non-Current Assets</td><td class="amount positive">${formatCurrency(bs.totalNonCurrentAssets)}</td></tr>
      <tr class="total-row"><td>TOTAL ASSETS</td><td class="amount positive">${formatCurrency(bs.totalAssets)}</td></tr>

      <tr class="section-header"><td colspan="2">Current Liabilities</td></tr>
      ${bs.accountsPayable !== 0 ? `<tr class="line-row"><td>Accounts Payable</td><td class="amount negative">${formatCurrency(bs.accountsPayable)}</td></tr>` : ''}
      ${bs.customerDeposits !== 0 ? `<tr class="line-row"><td>Customer Deposits (liability)</td><td class="amount negative">${formatCurrency(bs.customerDeposits)}</td></tr>` : ''}
      ${bs.directorLoanPayable !== 0 ? `<tr class="line-row"><td>Director's Loan Account</td><td class="amount negative">${formatCurrency(bs.directorLoanPayable)}</td></tr>` : ''}
      ${bs.suspenseLiability !== 0 ? `<tr class="line-row" style="color:#f59e0b"><td>Suspense (Uncategorized In)</td><td class="amount">${formatCurrency(bs.suspenseLiability)}</td></tr>` : ''}
      <tr class="subtotal-row"><td>Total Current Liabilities</td><td class="amount negative">${formatCurrency(bs.totalCurrentLiabilities)}</td></tr>

      <tr class="section-header"><td colspan="2">Non-Current Liabilities</td></tr>
      <tr class="line-row"><td>Loans Payable</td><td class="amount negative">${formatCurrency(bs.loanPayable)}</td></tr>
      <tr class="subtotal-row"><td>Total Non-Current Liabilities</td><td class="amount negative">${formatCurrency(bs.totalNonCurrentLiabilities)}</td></tr>
      <tr class="total-row"><td>TOTAL LIABILITIES</td><td class="amount negative">${formatCurrency(bs.totalLiabilities)}</td></tr>

      <tr class="section-header"><td colspan="2">Shareholders' Equity</td></tr>
      <tr class="line-row"><td>Share Capital</td><td class="amount positive">${formatCurrency(bs.shareCapital)}</td></tr>
      <tr class="line-row"><td>Retained Earnings</td><td class="amount ${bs.retainedEarnings >= 0 ? 'positive' : 'negative'}">${bs.retainedEarnings < 0 ? '-' : ''}${formatCurrency(Math.abs(bs.retainedEarnings))}</td></tr>
      <tr class="subtotal-row"><td>Total Shareholders' Equity</td><td class="amount ${bs.totalEquity >= 0 ? 'positive' : 'negative'}">${formatCurrency(bs.totalEquity)}</td></tr>
      <tr class="total-row"><td>TOTAL LIABILITIES & EQUITY</td><td class="amount neutral">${formatCurrency(bs.totalLiabilitiesAndEquity)}</td></tr>
    </table>`;
    printStatementHTML('Balance Sheet', `As of ${today}`, businessName, html);
    setShowExportMenu(false);
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 840, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Balance Sheet</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Statement of Financial Position as of today (Assets = Liabilities + Equity)</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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

      {/* Suspense Warning Banner if uncategorized items exist */}
      {!suspense.isClear && (
        <Card style={{ marginBottom: 20, border: '1px solid rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.08)', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>
                Suspense Account Active (Uncategorized Transactions)
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Cash movements from unclassified items are isolated on the Balance Sheet. The accounting period cannot be closed until Suspense is cleared.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Accounting Equation Summary */}
      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Assets</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>{formatCurrency(bs.totalAssets)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Liabilities + Equity</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>{formatCurrency(bs.totalLiabilitiesAndEquity)}</div>
        </Card>
        <Card style={{ border: `1px solid ${bs.isBalanced ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, background: bs.isBalanced ? 'var(--success-dim)' : 'var(--error-dim)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Balance Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Scale size={16} color={bs.isBalanced ? 'var(--success)' : 'var(--error)'} />
            <span style={{ fontSize: 16, fontWeight: 700, color: bs.isBalanced ? 'var(--success)' : 'var(--error)' }}>
              {bs.isBalanced ? 'Balanced' : `Off by ${formatCurrency(bs.difference)}`}
            </span>
          </div>
        </Card>
      </div>

      {loading ? (
        <div>{[1,2].map(i => <div key={i} className="skeleton" style={{ height: 200, marginBottom: 16 }} />)}</div>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{businessName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Balance Sheet · As of {today}</div>
          </div>

          <div>
            {/* Current Assets */}
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Current Assets</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Cash & Bank Balances</span>
              <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)' }}>{formatCurrency(bs.cashAndBank)}</span>
            </div>
            {bs.accountsReceivable !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Accounts Receivable</span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)' }}>{formatCurrency(bs.accountsReceivable)}</span>
              </div>
            )}
            {bs.inventory !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Inventory</span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)' }}>{formatCurrency(bs.inventory)}</span>
              </div>
            )}
            {bs.prepayments !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Prepaid Expenses</span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)' }}>{formatCurrency(bs.prepayments)}</span>
              </div>
            )}
            {bs.suspenseAsset !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)', background: 'rgba(245, 158, 11, 0.05)' }}>
                <span style={{ fontSize: 13, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={12} /> Suspense (Uncategorized Outflow)
                </span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: '#f59e0b' }}>{formatCurrency(bs.suspenseAsset)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Total Current Assets</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>{formatCurrency(bs.totalCurrentAssets)}</span>
            </div>

            {/* Non-Current Assets */}
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Non-Current Assets</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Property, Plant & Equipment (PPE)</span>
              <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)' }}>{formatCurrency(bs.ppe)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Total Non-Current Assets</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>{formatCurrency(bs.totalNonCurrentAssets)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderTop: '2px solid var(--bg-border)', background: 'var(--bg-elevated)' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>TOTAL ASSETS</span>
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>{formatCurrency(bs.totalAssets)}</span>
            </div>

            {/* Current Liabilities */}
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '2px solid var(--bg-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Current Liabilities</span>
            </div>
            {bs.accountsPayable !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Accounts Payable</span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>{formatCurrency(bs.accountsPayable)}</span>
              </div>
            )}
            {bs.customerDeposits !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Customer Deposits (advance)</span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>{formatCurrency(bs.customerDeposits)}</span>
              </div>
            )}
            {bs.directorLoanPayable !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Director's Loan Account</span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>{formatCurrency(bs.directorLoanPayable)}</span>
              </div>
            )}
            {bs.suspenseLiability !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)', background: 'rgba(245, 158, 11, 0.05)' }}>
                <span style={{ fontSize: 13, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={12} /> Suspense (Uncategorized Inflow)
                </span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: '#f59e0b' }}>{formatCurrency(bs.suspenseLiability)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Total Current Liabilities</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>{formatCurrency(bs.totalCurrentLiabilities)}</span>
            </div>

            {/* Non-Current Liabilities */}
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Non-Current Liabilities</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Loans Payable</span>
              <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>{formatCurrency(bs.loanPayable)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Total Non-Current Liabilities</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>{formatCurrency(bs.totalNonCurrentLiabilities)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL LIABILITIES</span>
              <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>{formatCurrency(bs.totalLiabilities)}</span>
            </div>

            {/* Shareholders' Equity */}
            <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderTop: '2px solid var(--bg-border)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Shareholders' Equity</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Share Capital (Owner Contributions)</span>
              <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)' }}>{formatCurrency(bs.shareCapital)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px 9px 32px', borderTop: '1px solid var(--bg-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Retained Earnings</span>
              <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: bs.retainedEarnings >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {bs.retainedEarnings < 0 ? '-' : ''}{formatCurrency(Math.abs(bs.retainedEarnings))}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 20px', borderTop: '1px solid var(--bg-border)', background: 'rgba(0,0,0,0.02)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Total Shareholders' Equity</span>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: bs.totalEquity >= 0 ? 'var(--success)' : 'var(--error)' }}>
                {formatCurrency(bs.totalEquity)}
              </span>
            </div>

            {/* Total Liabilities & Equity */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 20px', borderTop: '2px solid var(--bg-border)', background: 'var(--bg-elevated)' }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>TOTAL LIABILITIES & EQUITY</span>
              <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>{formatCurrency(bs.totalLiabilitiesAndEquity)}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
