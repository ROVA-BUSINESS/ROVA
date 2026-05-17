import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Account, type Transaction } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/format';
import { downloadCSV, printStatementHTML } from '../../lib/export';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { Download, Printer, ChevronDown } from 'lucide-react';
import { useMobile } from '../../hooks/useMobile';

export default function BalanceSheetPage() {
  const { user, profile } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const isMobile = useMobile(1024);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [accRes, txRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true),
      supabase.from('transactions').select('*').eq('user_id', user!.id),
    ]);
    setAccounts(accRes.data || []);
    setTransactions(txRes.data || []);
    setLoading(false);
  }

  const totalAssets = accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === 'credit').reduce((s, a) => s + Math.abs(a.balance), 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const retainedEarnings = totalIncome - totalExpenses;
  const totalEquity = totalAssets - totalLiabilities;
  const today = formatDate(new Date().toISOString().split('T')[0]);
  const assetAccounts = accounts.filter(a => a.type !== 'credit');
  const liabilityAccounts = accounts.filter(a => a.type === 'credit');
  const businessName = profile?.business_name || profile?.full_name || 'My Business';

  function handleExportCSV() {
    const rows: (string | number)[][] = [];
    rows.push(['ASSETS', '', '']);
    assetAccounts.forEach(a => rows.push(['', a.name, a.balance]));
    rows.push(['Total Assets', '', totalAssets]);
    rows.push(['', '', '']);
    rows.push(['LIABILITIES', '', '']);
    liabilityAccounts.forEach(a => rows.push(['', a.name, Math.abs(a.balance)]));
    rows.push(['Total Liabilities', '', totalLiabilities]);
    rows.push(['', '', '']);
    rows.push(['EQUITY', '', '']);
    rows.push(['', 'Retained Earnings', retainedEarnings]);
    rows.push(['Total Equity', '', totalEquity]);
    rows.push(['', '', '']);
    rows.push(['Liabilities + Equity', '', totalLiabilities + totalEquity]);
    downloadCSV(`balance-sheet-${new Date().toISOString().split('T')[0]}.csv`, ['Section', 'Account', 'Amount (NGN)'], rows);
    setShowExportMenu(false);
  }

  function handlePrint() {
    const assetRows = assetAccounts.map(a =>
      `<tr class="line-row"><td>${a.name} <span style="font-size:11px;color:#9ca3af">${a.type}</span></td><td class="amount positive">${formatCurrency(a.balance)}</td></tr>`).join('');
    const liabilityRows = liabilityAccounts.map(a =>
      `<tr class="line-row"><td>${a.name}</td><td class="amount negative">${formatCurrency(Math.abs(a.balance))}</td></tr>`).join('');
    const html = `<table>
      <tr class="section-header"><td colspan="2">Assets</td></tr>
      ${assetRows || '<tr class="line-row"><td colspan="2" style="color:#9ca3af">No asset accounts</td></tr>'}
      <tr class="subtotal-row"><td>Total Assets</td><td class="amount positive">${formatCurrency(totalAssets)}</td></tr>
      <tr class="section-header"><td colspan="2">Liabilities</td></tr>
      ${liabilityRows || '<tr class="line-row"><td colspan="2" style="color:#9ca3af">No liability accounts</td></tr>'}
      <tr class="subtotal-row"><td>Total Liabilities</td><td class="amount negative">${formatCurrency(totalLiabilities)}</td></tr>
      <tr class="section-header"><td colspan="2">Equity</td></tr>
      <tr class="line-row"><td>Retained Earnings</td><td class="amount ${retainedEarnings >= 0 ? 'positive' : 'negative'}">${retainedEarnings < 0 ? '-' : ''}${formatCurrency(Math.abs(retainedEarnings))}</td></tr>
      <tr class="subtotal-row"><td>Total Equity</td><td class="amount ${totalEquity >= 0 ? 'positive' : 'negative'}">${totalEquity < 0 ? '-' : ''}${formatCurrency(Math.abs(totalEquity))}</td></tr>
      <tr class="total-row"><td>Liabilities + Equity</td><td class="amount neutral">${formatCurrency(totalLiabilities + totalEquity)}</td></tr>
    </table>`;
    printStatementHTML('Balance Sheet', `As of ${today}`, businessName, html);
    setShowExportMenu(false);
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 800, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Balance Sheet</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Assets, liabilities and equity as of today</p>
        </div>
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

      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Assets', value: totalAssets, color: 'var(--success)' },
          { label: 'Total Liabilities', value: totalLiabilities, color: 'var(--error)' },
          { label: 'Total Equity', value: totalEquity, color: totalEquity >= 0 ? 'var(--success)' : 'var(--error)' },
        ].map(s => (
          <Card key={s.label}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            <div className="mobile-stat-value" style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: s.color }}>{formatCurrency(Math.abs(s.value))}</div>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 400 }} />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{businessName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Balance Sheet · As of {today}</div>
          </div>

          <div className="mobile-grid-1" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 0, borderBottom: '1px solid var(--bg-border)' }}>
            <div style={{ borderRight: isMobile ? 'none' : '1px solid var(--bg-border)', borderBottom: isMobile ? '1px solid var(--bg-border)' : 'none' }}>
              <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--success)' }}>Assets</span>
              </div>
              {assetAccounts.length === 0 ? (
                <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-disabled)' }}>No asset accounts found</div>
              ) : assetAccounts.map(acc => (
                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px', borderBottom: '1px solid var(--bg-border)' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{acc.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{acc.type}</div>
                  </div>
                  <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)', alignSelf: 'center' }}>{formatCurrency(acc.balance)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Total Assets</span>
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>{formatCurrency(totalAssets)}</span>
              </div>
            </div>

            <div>
              <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--error)' }}>Liabilities</span>
              </div>
              {liabilityAccounts.length === 0 ? (
                <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-disabled)' }}>No liability accounts found</div>
              ) : liabilityAccounts.map(acc => (
                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px', borderBottom: '1px solid var(--bg-border)' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{acc.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>Credit Account</div>
                  </div>
                  <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)', alignSelf: 'center' }}>{formatCurrency(Math.abs(acc.balance))}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Total Liabilities</span>
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>{formatCurrency(totalLiabilities)}</span>
              </div>
              <div style={{ padding: '10px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)', borderTop: '2px solid var(--bg-border)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--warning)' }}>Equity</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 20px', borderBottom: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Retained Earnings</span>
                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: retainedEarnings >= 0 ? 'var(--success)' : 'var(--error)' }}>{formatCurrency(retainedEarnings)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Total Equity</span>
                <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: totalEquity >= 0 ? 'var(--success)' : 'var(--error)' }}>{formatCurrency(Math.abs(totalEquity))}</span>
              </div>
            </div>
          </div>

          <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-elevated)' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Liabilities + Equity</span>
            <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent-light)' }}>
              {formatCurrency(totalLiabilities + totalEquity)}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
