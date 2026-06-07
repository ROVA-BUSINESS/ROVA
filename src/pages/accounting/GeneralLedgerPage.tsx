import { useEffect, useState } from 'react';
import { BookOpen, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase, type Transaction } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate, cleanDescription } from '../../lib/format';
import Card from '../../components/ui/Card';

type LedgerAccount = {
  name: string;
  type: string;
  entries: { date: string; description: string; debit: number; credit: number; balance: number }[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

export default function GeneralLedgerPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from('transactions').select('*, category:categories(*), account:accounts(*)').eq('user_id', user!.id).order('date', { ascending: true });
    setTransactions(data || []);
    setLoading(false);
  }

  const ledger = buildLedger(transactions);
  const filtered = search
    ? ledger.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : ledger;

  function toggleExpand(name: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1100, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>General Ledger</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>All account activity using double-entry bookkeeping</p>
      </div>

      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 320 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search accounts..."
          style={{
            width: '100%', padding: '8px 12px 8px 32px',
            background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none',
          }}
        />
      </div>

      {loading ? (
        <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8 }} />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <BookOpen size={32} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No ledger accounts found</p>
            <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4 }}>Add transactions to see ledger entries</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(account => (
            <Card key={account.name} style={{ padding: 0, overflow: 'hidden' }}>
              <button
                className="mobile-col"
                onClick={() => toggleExpand(account.name)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', background: 'none', cursor: 'pointer', border: 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {expanded.has(account.name) ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'left' }}>{account.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize', textAlign: 'left' }}>{account.type} · {account.entries.length} entries</div>
                  </div>
                </div>
                <div className="mobile-ledger-stats" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Debit</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(account.totalDebit)}</div>
                  </div>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Credit</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(account.totalCredit)}</div>
                  </div>
                  <div style={{ textAlign: 'right', flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Balance</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: account.balance >= 0 ? 'var(--success)' : 'var(--error)' }}>
                      {formatCurrency(Math.abs(account.balance))}
                    </div>
                  </div>
                </div>
              </button>

              {expanded.has(account.name) && (
                <div className="mobile-overflow-x" style={{ borderTop: '1px solid var(--bg-border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)' }}>
                        {['Date', 'Description', 'Debit', 'Credit', 'Balance'].map(h => (
                          <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {account.entries.map((e, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--bg-border)' }}>
                          <td style={{ padding: '9px 16px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(e.date)}</td>
                          <td style={{ padding: '9px 16px', fontSize: 13, color: 'var(--text-primary)' }}>{e.description}</td>
                          <td style={{ padding: '9px 16px', fontSize: 13, color: e.debit ? 'var(--success)' : 'var(--text-disabled)', fontFamily: 'Space Grotesk, sans-serif' }}>
                            {e.debit ? formatCurrency(e.debit) : '—'}
                          </td>
                          <td style={{ padding: '9px 16px', fontSize: 13, color: e.credit ? 'var(--error)' : 'var(--text-disabled)', fontFamily: 'Space Grotesk, sans-serif' }}>
                            {e.credit ? formatCurrency(e.credit) : '—'}
                          </td>
                          <td style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'Space Grotesk, sans-serif', color: e.balance >= 0 ? 'var(--text-primary)' : 'var(--error)' }}>
                            {formatCurrency(Math.abs(e.balance))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function buildLedger(transactions: Transaction[]): LedgerAccount[] {
  const accountMap = new Map<string, LedgerAccount>();

  function getOrCreate(name: string, type: string): LedgerAccount {
    if (!accountMap.has(name)) {
      accountMap.set(name, { name, type, entries: [], totalDebit: 0, totalCredit: 0, balance: 0 });
    }
    return accountMap.get(name)!;
  }

  transactions.forEach(tx => {
    const catName = (tx.category as any)?.name || 'Uncategorized';
    const accountName = (tx.account as any)?.name || 'Cash';

    const cleanedDesc = cleanDescription(tx.description);

    if (tx.type === 'income') {
      const cashAcc = getOrCreate(accountName, 'asset');
      const incomeAcc = getOrCreate(catName, 'income');

      cashAcc.totalDebit += tx.amount;
      cashAcc.balance += tx.amount;
      cashAcc.entries.push({ date: tx.date, description: cleanedDesc || catName, debit: tx.amount, credit: 0, balance: cashAcc.balance });

      incomeAcc.totalCredit += tx.amount;
      incomeAcc.balance += tx.amount;
      incomeAcc.entries.push({ date: tx.date, description: cleanedDesc || accountName, debit: 0, credit: tx.amount, balance: incomeAcc.balance });
    }

    if (tx.type === 'expense') {
      const expAcc = getOrCreate(catName, 'expense');
      const cashAcc = getOrCreate(accountName, 'asset');

      expAcc.totalDebit += tx.amount;
      expAcc.balance += tx.amount;
      expAcc.entries.push({ date: tx.date, description: cleanedDesc || accountName, debit: tx.amount, credit: 0, balance: expAcc.balance });

      cashAcc.totalCredit += tx.amount;
      cashAcc.balance -= tx.amount;
      cashAcc.entries.push({ date: tx.date, description: cleanedDesc || catName, debit: 0, credit: tx.amount, balance: cashAcc.balance });
    }
  });

  return Array.from(accountMap.values()).sort((a, b) => {
    const order = ['asset', 'liability', 'equity', 'income', 'expense'];
    return order.indexOf(a.type) - order.indexOf(b.type) || a.name.localeCompare(b.name);
  });
}
