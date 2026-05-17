import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { supabase, type ChartOfAccount } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useMobile } from '../../hooks/useMobile';

const TYPE_COLORS: Record<ChartOfAccount['account_type'], 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  asset: 'success', liability: 'error', equity: 'warning', income: 'info', expense: 'default',
};

const DEFAULTS: Omit<ChartOfAccount, 'id' | 'user_id' | 'created_at'>[] = [
  { code: '1000', name: 'Cash & Bank', account_type: 'asset', normal_balance: 'debit', description: 'Cash on hand and bank accounts', is_system: false, is_active: true, parent_id: null },
  { code: '1100', name: 'Accounts Receivable', account_type: 'asset', normal_balance: 'debit', description: 'Amounts owed by customers', is_system: false, is_active: true, parent_id: null },
  { code: '1200', name: 'Inventory', account_type: 'asset', normal_balance: 'debit', description: 'Goods held for sale', is_system: false, is_active: true, parent_id: null },
  { code: '2000', name: 'Accounts Payable', account_type: 'liability', normal_balance: 'credit', description: 'Amounts owed to suppliers', is_system: false, is_active: true, parent_id: null },
  { code: '2100', name: 'Loans Payable', account_type: 'liability', normal_balance: 'credit', description: 'Outstanding loan balances', is_system: false, is_active: true, parent_id: null },
  { code: '3000', name: "Owner's Equity", account_type: 'equity', normal_balance: 'credit', description: 'Owner investment and retained earnings', is_system: false, is_active: true, parent_id: null },
  { code: '4000', name: 'Revenue', account_type: 'income', normal_balance: 'credit', description: 'Primary business revenue', is_system: false, is_active: true, parent_id: null },
  { code: '5000', name: 'Operating Expenses', account_type: 'expense', normal_balance: 'debit', description: 'General business expenses', is_system: false, is_active: true, parent_id: null },
];

export default function ChartOfAccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useMobile(1024);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ChartOfAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', account_type: 'asset' as ChartOfAccount['account_type'], normal_balance: 'debit' as 'debit' | 'credit', description: '' });

  useEffect(() => {
    if (user) loadAccounts();
  }, [user]);

  async function loadAccounts() {
    setLoading(true);
    const { data } = await supabase.from('chart_of_accounts').select('*').eq('user_id', user!.id).order('code', { ascending: true });
    setAccounts(data || []);
    setLoading(false);
  }

  async function seedDefaults() {
    setSeeding(true);
    await supabase.from('chart_of_accounts').insert(DEFAULTS.map(d => ({ ...d, user_id: user!.id })));
    loadAccounts();
    setSeeding(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      await supabase.from('chart_of_accounts').update({ ...form }).eq('id', editing.id);
    } else {
      await supabase.from('chart_of_accounts').insert({ ...form, user_id: user!.id });
    }
    setSaving(false);
    setShowModal(false);
    setEditing(null);
    resetForm();
    loadAccounts();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account?')) return;
    await supabase.from('chart_of_accounts').delete().eq('id', id);
    setAccounts(prev => prev.filter(a => a.id !== id));
  }

  function openEdit(acc: ChartOfAccount) {
    setEditing(acc);
    setForm({ code: acc.code, name: acc.name, account_type: acc.account_type, normal_balance: acc.normal_balance, description: acc.description });
    setShowModal(true);
  }

  function openNew() {
    setEditing(null);
    resetForm();
    setShowModal(true);
  }

  function resetForm() {
    setForm({ code: '', name: '', account_type: 'asset', normal_balance: 'debit', description: '' });
  }

  const grouped = (['asset', 'liability', 'equity', 'income', 'expense'] as const).map(type => ({
    type, accounts: accounts.filter(a => a.account_type === type),
  })).filter(g => g.accounts.length > 0);

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1000, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Chart of Accounts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Customizable account structure for your books</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {accounts.length === 0 && (
            <Button variant="secondary" loading={seeding} onClick={seedDefaults}>Load Defaults</Button>
          )}
          <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>Add Account</Button>
        </div>
      </div>

      {loading ? (
        <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8 }} />)}</div>
      ) : accounts.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Layers size={36} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 4 }}>No accounts set up yet</p>
            <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginBottom: 16 }}>Load defaults to get started quickly</p>
            <Button variant="primary" loading={seeding} onClick={seedDefaults}>Load Default Accounts</Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {grouped.map(({ type, accounts: accs }) => (
            <Card key={type} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge variant={TYPE_COLORS[type]}>{type}</Badge>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{accs.length} account{accs.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="mobile-table-container">
                <table className="transaction-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)' }}>
                      {[
                        { label: 'Code' },
                        { label: 'Name' },
                        { label: 'Normal Balance', hideMobile: true },
                        { label: 'Description', hideMobile: true },
                        { label: '', className: 'mobile-actions' }
                      ].map(h => (
                        <th key={h.label} className={`${h.hideMobile ? 'mobile-hide' : ''} ${h.className || ''}`} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accs.map((acc, i) => (
                      <tr key={acc.id}
                        style={{ borderTop: i > 0 ? '1px solid var(--bg-border)' : 'none' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <td className="mobile-tight-td" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--accent-light)', fontFamily: 'Space Grotesk, sans-serif' }}>{acc.code}</td>
                        <td className="mobile-tight-td" style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                           <div className="mobile-desc-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{acc.name}</div>
                        </td>
                        <td className="mobile-hide" style={{ padding: '10px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: acc.normal_balance === 'debit' ? 'var(--success)' : 'var(--error)' }}>
                            {acc.normal_balance}
                          </span>
                        </td>
                        <td className="mobile-hide" style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{acc.description || '—'}</td>
                        <td className="mobile-tight-td mobile-actions" style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            <button onClick={() => openEdit(acc)}
                              title="Edit account"
                              style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                            ><Pencil size={13} /></button>
                            <button onClick={() => handleDelete(acc.id)}
                              title="Delete account"
                              style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--error-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--error)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                            ><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditing(null); resetForm(); }} title={editing ? 'Edit Account' : 'Add Account'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: 10 }}>
            <Input label="Code" placeholder="1000" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} required />
            <Input label="Account Name" placeholder="Cash & Bank" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Account Type</label>
              <select value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value as ChartOfAccount['account_type'] }))}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
                {['asset', 'liability', 'equity', 'income', 'expense'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Normal Balance</label>
              <select value={form.normal_balance} onChange={e => setForm(p => ({ ...p, normal_balance: e.target.value as 'debit' | 'credit' }))}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
              </select>
            </div>
          </div>
          <Input label="Description (optional)" placeholder="Brief description..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => { setShowModal(false); setEditing(null); resetForm(); }}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">{editing ? 'Save Changes' : 'Add Account'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
