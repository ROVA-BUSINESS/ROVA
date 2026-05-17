import { useEffect, useState, type FormEvent } from 'react';
import { Plus, BookMarked, ChevronDown, ChevronRight, Trash2, X } from 'lucide-react';
import { supabase, type JournalEntry, type JournalEntryLine, type ChartOfAccount } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../lib/format';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useMobile } from '../../hooks/useMobile';

export default function JournalEntriesPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [coa, setCoa] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useMobile(1024);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], description: '', reference: '' });
  const [lines, setLines] = useState<{ account_id: string; account_name: string; debit: string; credit: string; description: string }[]>([
    { account_id: '', account_name: '', debit: '', credit: '', description: '' },
    { account_id: '', account_name: '', debit: '', credit: '', description: '' },
  ]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [entriesRes, coaRes] = await Promise.all([
      supabase.from('journal_entries').select('*').eq('user_id', user!.id).order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('chart_of_accounts').select('*').eq('user_id', user!.id).eq('is_active', true).order('code'),
    ]);
    setEntries(entriesRes.data || []);
    setCoa(coaRes.data || []);
    setLoading(false);
  }

  async function loadLines(entryId: string) {
    const { data } = await supabase.from('journal_entry_lines').select('*').eq('journal_entry_id', entryId);
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, lines: data || [] } : e));
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); loadLines(id); }
      return next;
    });
  }

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isBalanced || totalDebit === 0) return;
    setSaving(true);
    const entryNumber = `JE-${Date.now().toString().slice(-6)}`;
    const { data: entry, error } = await supabase.from('journal_entries').insert({
      user_id: user!.id,
      entry_number: entryNumber,
      date: form.date,
      description: form.description,
      reference: form.reference,
      source: 'manual',
      is_posted: true,
    }).select().maybeSingle();

    if (!error && entry) {
      const validLines = lines.filter(l => l.account_name && (Number(l.debit) > 0 || Number(l.credit) > 0));
      await supabase.from('journal_entry_lines').insert(
        validLines.map(l => ({
          journal_entry_id: entry.id,
          account_id: l.account_id || null,
          account_name: l.account_name,
          description: l.description,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        }))
      );
      setShowModal(false);
      resetForm();
      loadData();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this journal entry?')) return;
    await supabase.from('journal_entry_lines').delete().eq('journal_entry_id', id);
    await supabase.from('journal_entries').delete().eq('id', id);
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  function resetForm() {
    setForm({ date: new Date().toISOString().split('T')[0], description: '', reference: '' });
    setLines([
      { account_id: '', account_name: '', debit: '', credit: '', description: '' },
      { account_id: '', account_name: '', debit: '', credit: '', description: '' },
    ]);
  }

  function updateLine(i: number, field: string, value: string) {
    setLines(prev => prev.map((l, j) => {
      if (j !== i) return l;
      if (field === 'account_id') {
        const acc = coa.find(c => c.id === value);
        return { ...l, account_id: value, account_name: acc?.name || '' };
      }
      return { ...l, [field]: value };
    }));
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1000, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Journal Entries</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Manual and automated double-entry records</p>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => { resetForm(); setShowModal(true); }}>
          New Entry
        </Button>
      </div>

      {loading ? (
        <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 8 }} />)}</div>
      ) : entries.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <BookMarked size={36} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No journal entries yet</p>
            <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4 }}>Create your first manual journal entry</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(entry => (
            <Card key={entry.id} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}>
                <button
                  onClick={() => toggleExpand(entry.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', cursor: 'pointer', flex: 1 }}
                >
                  {expanded.has(entry.id) ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-light)', fontFamily: 'Space Grotesk, sans-serif' }}>{entry.entry_number}</span>
                      <Badge variant={entry.source === 'manual' ? 'default' : 'info'}>{entry.source}</Badge>
                      {entry.is_posted && <Badge variant="success">Posted</Badge>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                      {formatDate(entry.date)} · {entry.description}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s', flexShrink: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--error-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--error)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {expanded.has(entry.id) && entry.lines && (
                <div className="mobile-table-container" style={{ borderTop: '1px solid var(--bg-border)' }}>
                  <table className="transaction-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)' }}>
                        {[
                          { label: 'Account' },
                          { label: 'Description', hideMobile: true },
                          { label: 'Debit' },
                          { label: 'Credit' }
                        ].map(h => (
                          <th key={h.label} className={h.hideMobile ? 'mobile-hide' : ''} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entry.lines.map((line: JournalEntryLine) => (
                        <tr key={line.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                          <td className="mobile-tight-td" style={{ padding: '9px 16px', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                            <div className="mobile-desc-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{line.account_name}</div>
                          </td>
                          <td className="mobile-hide" style={{ padding: '9px 16px', fontSize: 12, color: 'var(--text-muted)' }}>{line.description || '—'}</td>
                          <td className="mobile-tight-td" style={{ padding: '9px 16px', fontSize: 13, color: line.debit ? 'var(--success)' : 'var(--text-disabled)', fontFamily: 'Space Grotesk, sans-serif' }}>
                            {line.debit ? formatCurrency(line.debit) : '—'}
                          </td>
                          <td className="mobile-tight-td" style={{ padding: '9px 16px', fontSize: 13, color: line.credit ? 'var(--error)' : 'var(--text-disabled)', fontFamily: 'Space Grotesk, sans-serif' }}>
                            {line.credit ? formatCurrency(line.credit) : '—'}
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

      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm(); }} title="New Journal Entry" size="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr 1fr', gap: 10 }}>
            <Input label="Date" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
            <Input label="Description" placeholder="Journal entry description..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
            <Input label="Reference" placeholder="Ref #..." value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Debit / Credit Lines</div>
            <div className="mobile-overflow-x">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 600 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: 6 }}>
                  {['Account', 'Description', 'Debit (₦)', 'Credit (₦)', ''].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', paddingBottom: 2 }}>{h}</div>
                  ))}
                </div>
                {lines.map((line, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr auto', gap: 6, alignItems: 'center' }}>
                    {coa.length > 0 ? (
                      <select
                        value={line.account_id}
                        onChange={e => updateLine(i, 'account_id', e.target.value)}
                        style={{ padding: '9px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: line.account_id ? 'var(--text-primary)' : 'var(--text-muted)', outline: 'none', fontSize: 13 }}
                      >
                        <option value="">Select account...</option>
                        {coa.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                      </select>
                    ) : (
                      <Input placeholder="Account name..." value={line.account_name} onChange={e => updateLine(i, 'account_name', e.target.value)} />
                    )}
                    <Input placeholder="Line description..." value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)} />
                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)} />
                    <button type="button" onClick={() => setLines(p => p.filter((_, j) => j !== i))}
                      style={{ padding: 8, background: 'var(--error-dim)', borderRadius: 'var(--radius-sm)', color: 'var(--error)', display: 'flex', alignItems: 'center' }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setLines(p => [...p, { account_id: '', account_name: '', debit: '', credit: '', description: '' }])}
                  style={{ padding: '7px 12px', background: 'var(--bg-elevated)', border: '1px dashed var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', marginTop: 2, width: 'max-content' }}>
                  <Plus size={12} /> Add Line
                </button>
              </div>
            </div>
          </div>

          <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: isBalanced && totalDebit > 0 ? 'var(--success-dim)' : 'var(--error-dim)', border: `1px solid ${isBalanced && totalDebit > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, gap: 24 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total Debits: <strong style={{ fontFamily: 'Space Grotesk', color: 'var(--success)' }}>{formatCurrency(totalDebit)}</strong></span>
              <span style={{ color: 'var(--text-secondary)' }}>Total Credits: <strong style={{ fontFamily: 'Space Grotesk', color: 'var(--error)' }}>{formatCurrency(totalCredit)}</strong></span>
              <span style={{ fontWeight: 600, color: isBalanced && totalDebit > 0 ? 'var(--success)' : 'var(--error)', fontSize: 12 }}>
                {isBalanced && totalDebit > 0 ? 'Balanced' : totalDebit === 0 ? 'Enter amounts' : `Difference: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit" disabled={!isBalanced || totalDebit === 0}>Post Entry</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
