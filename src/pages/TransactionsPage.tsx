import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { Plus, Search, ArrowUpRight, ArrowDownRight, Trash2, Check, Brain, Download, Edit2, Receipt, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, type Transaction, type Account, type Category } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate, formatTime, cleanDescription } from '../lib/format';
import { autoClassify } from '../lib/categorise';
import { downloadCSV } from '../lib/export';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';

type FilterType = 'all' | 'income' | 'expense';


export default function TransactionsPage() {
  const navigate = useNavigate();
  const { user, isStaff, profile, isAdmin, staffData } = useAuth();
  const effectiveUserId = isStaff && staffData ? staffData.owner_id : user?.id;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'description' | 'category' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedDescId, setExpandedDescId] = useState<string | null>(null);
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);

  const [form, setForm] = useState({
    description: '', amount: '', type: 'expense' as 'income' | 'expense',
    date: new Date().toISOString().split('T')[0], category_id: '', account_id: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [autoSuggestion, setAutoSuggestion] = useState('');

  useEffect(() => {
    if (effectiveUserId) loadData();
  }, [effectiveUserId]);

  async function loadData() {
    setLoading(true);
    let txQuery = supabase.from('transactions').select('*, category:categories(*), account:accounts(*)').eq('user_id', effectiveUserId).order('date', { ascending: false });
    
    if (isStaff) {
      const limit = profile?.staff_visibility_limit || 500000;
      txQuery = txQuery.lt('amount', limit);
    }

    const [txRes, accRes, catRes] = await Promise.all([
      txQuery,
      supabase.from('accounts').select('*').eq('user_id', effectiveUserId).eq('is_active', true),
      supabase.from('categories').select('*').or(`user_id.eq.${effectiveUserId},is_system.eq.true`),
    ]);
    const cats = catRes.data || [];
    const hasSales = cats.some(c => c.name.toLowerCase() === 'sales' && c.type === 'income');
    if (!hasSales && effectiveUserId) {
      const { data: newCat } = await supabase.from('categories').insert({
        user_id: effectiveUserId,
        name: 'Sales',
        type: 'income',
        is_system: false,
      }).select().maybeSingle();
      if (newCat) cats.push(newCat);
    }

    setTransactions(txRes.data || []);
    setAccounts(accRes.data || []);
    setCategories(cats);
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }
    setSaving(true);
    setFormError('');
    const actorText = isStaff ? 'Staff' : (profile?.full_name ? `Admin (${profile.full_name})` : 'Admin 1');
    const notesWithActor = form.notes ? `${form.notes} | Performed by: ${actorText}` : `Performed by: ${actorText}`;

    const { error } = await supabase.from('transactions').insert({
      user_id: effectiveUserId,
      description: form.description,
      amount: Number(form.amount),
      type: form.type,
      date: form.date,
      category_id: form.category_id || null,
      account_id: form.account_id || null,
      notes: notesWithActor,
    });
    setSaving(false);
    if (error) { setFormError('Failed to save transaction.'); return; }
    setShowModal(false);
    resetForm();
    loadData();
  }

  async function handleSaveEdit(txId: string, field: 'description' | 'category_id', value: string) {
    if (field === 'description' && !value.trim()) {
      setEditingId(null);
      setEditingField(null);
      return;
    }
    const { error } = await supabase.from('transactions').update({ [field]: value || null }).eq('id', txId);
    if (!error) {
      if (field === 'category_id') {
        const category = categories.find(c => c.id === value) || undefined;
        setTransactions(prev => prev.map(t => t.id === txId ? { ...t, category_id: value || null, category } : t));
      } else {
        setTransactions(prev => prev.map(t => t.id === txId ? { ...t, [field]: value } : t));
      }
    }
    setEditingId(null);
    setEditingField(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this transaction?')) return;
    await supabase.from('transactions').delete().eq('id', id);
    setTransactions(prev => prev.filter(t => t.id !== id));
  }

  async function toggleVerify(tx: Transaction) {
    await supabase.from('transactions').update({ is_verified: !tx.is_verified }).eq('id', tx.id);
    setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, is_verified: !t.is_verified } : t));
  }

  function handleExportCSV() {
    const rows = filtered.map(tx => [
      formatDate(tx.date), formatTime(tx.created_at), tx.description || '', tx.type,
      (tx.category as any)?.name || '', (tx.account as any)?.name || '',
      tx.type === 'income' ? tx.amount : -tx.amount,
      tx.is_verified ? 'Verified' : 'Pending', tx.notes || '',
    ]);
    downloadCSV(`transactions-${new Date().toISOString().split('T')[0]}.csv`,
      ['Date', 'Time', 'Description', 'Type', 'Category', 'Account', 'Amount (NGN)', 'Status', 'Notes'], rows);
  }

  function resetForm() {
    setForm({ description: '', amount: '', type: 'expense', date: new Date().toISOString().split('T')[0], category_id: '', account_id: '', notes: '' });
    setFormError('');
    setAutoSuggestion('');
  }

  function handleDescriptionChange(desc: string) {
    setForm(prev => {
      const updated = { ...prev, description: desc };
      if (desc.length >= 3) {
        const result = autoClassify(desc);
        if (result.categoryName) {
          const matched = categories.find(c =>
            c.name.toLowerCase() === result.categoryName.toLowerCase() &&
            (c.type === result.type || c.type === 'both')
          );
          setAutoSuggestion(result.categoryName);
          return { ...updated, type: result.type, category_id: matched ? matched.id : prev.category_id };
        }
      }
      setAutoSuggestion('');
      return updated;
    });
  }

  // Duplicate payment detection pass: group by type + amount within 3-day window
  const duplicateIds = useMemo(() => {
    const dups = new Set<string>();
    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        const a = transactions[i];
        const b = transactions[j];
        if (a.type === b.type && Number(a.amount) === Number(b.amount)) {
          const timeDiff = Math.abs(new Date(a.date).getTime() - new Date(b.date).getTime());
          const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
          if (daysDiff <= 3) {
            const descA = (a.description || '').trim().toLowerCase();
            const descB = (b.description || '').trim().toLowerCase();
            if (!descA || !descB || descA === descB || descA.includes(descB) || descB.includes(descA)) {
              dups.add(a.id);
              dups.add(b.id);
            }
          }
        }
      }
    }
    return dups;
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      const matchSearch = !search || tx.description?.toLowerCase().includes(search.toLowerCase()) || (tx.category as any)?.name?.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === 'all' || tx.type === filter;
      const matchDuplicate = !showDuplicatesOnly || duplicateIds.has(tx.id);
      return matchSearch && matchFilter && matchDuplicate;
    });
  }, [transactions, search, filter, showDuplicatesOnly, duplicateIds]);

  const incomeTotal = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenseTotal = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const filteredCats = categories.filter(c => c.type === form.type || c.type === 'both');

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1000, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Transactions</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Track all your income and expenses</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" icon={<Download size={14} />} onClick={handleExportCSV}>Export CSV</Button>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => { resetForm(); setShowModal(true); }}>
            Add Transaction
          </Button>
        </div>
      </div>

      {duplicateIds.size > 0 && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#f59e0b' }}>
            <AlertTriangle size={16} />
            <span><strong>{duplicateIds.size} potential duplicate transactions</strong> detected (matching amount within 3 days).</span>
          </div>
          <button
            onClick={() => setShowDuplicatesOnly(prev => !prev)}
            style={{
              padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6,
              background: showDuplicatesOnly ? 'var(--warning)' : 'transparent',
              color: showDuplicatesOnly ? '#000' : 'var(--warning)',
              border: '1px solid var(--warning)', cursor: 'pointer'
            }}
          >
            {showDuplicatesOnly ? 'Show All Transactions' : 'Review Duplicates'}
          </button>
        </div>
      )}

      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Income', value: incomeTotal, color: 'var(--success)' },
          { label: 'Total Expenses', value: expenseTotal, color: 'var(--error)' },
          { label: 'Net Flow', value: incomeTotal - expenseTotal, color: incomeTotal - expenseTotal >= 0 ? 'var(--success)' : 'var(--error)' },
        ].map(s => (
          <Card key={s.label}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: s.color }}>
              {formatCurrency(Math.abs(s.value))}
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search transactions..."
              style={{
                width: '100%', padding: '8px 12px 8px 32px',
                background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'income', 'expense'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '7px 14px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500,
                  background: filter === f ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: filter === f ? 'white' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: filter === f ? 'var(--accent-primary)' : 'var(--bg-border)',
                  transition: 'all 0.15s ease', textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 20 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No transactions found</p>
            <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4 }}>
              {transactions.length === 0 ? 'Add your first transaction to get started' : 'Try adjusting your search or filter'}
            </p>
          </div>
        ) : (
          <div className="mobile-table-container">
            <table className="transaction-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {[
                  { label: 'Date' }, { label: 'Description' }, 
                  { label: 'Category', hideMobile: true }, { label: 'Account', hideMobile: true }, 
                  { label: 'Amount' }, { label: 'Status', hideMobile: true }, { label: '', className: 'mobile-actions' }
                ].map(h => (
                  <th key={h.label} className={`${h.hideMobile ? "mobile-hide" : ""} ${h.className || ""}`} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx, i) => (
                <tr
                  key={tx.id}
                  style={{
                    borderTop: i > 0 ? '1px solid var(--bg-border)' : 'none',
                    borderLeft: duplicateIds.has(tx.id) ? '3px solid var(--warning)' : '3px solid transparent',
                    background: duplicateIds.has(tx.id) ? 'rgba(245, 158, 11, 0.03)' : 'transparent',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = duplicateIds.has(tx.id) ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = duplicateIds.has(tx.id) ? 'rgba(245, 158, 11, 0.03)' : 'transparent'}
                >
                  <td className="mobile-tight-td" style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(tx.date)}</div>
                    <div className="mobile-hide" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{formatTime(tx.created_at)}</div>
                  </td>
                  <td className="mobile-tight-td" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="mobile-hide" style={{
                        width: 28, height: 28, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                        background: tx.type === 'income' ? 'var(--success-dim)' : 'var(--error-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {tx.type === 'income' ? <ArrowUpRight size={13} color="var(--success)" /> : <ArrowDownRight size={13} color="var(--error)" />}
                      </div>
                      {editingId === tx.id && editingField === 'description' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                          <input 
                            autoFocus
                            value={editValue} 
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => handleSaveEdit(tx.id, 'description', editValue)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(tx.id, 'description', editValue); if (e.key === 'Escape') setEditingId(null); }}
                            style={{ width: '100%', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--accent-primary)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                          <div 
                            title={tx.description || ''}
                            onClick={() => setExpandedDescId(expandedDescId === tx.id ? null : tx.id)}
                            style={{ 
                              fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', 
                              overflow: expandedDescId === tx.id ? 'visible' : 'hidden', 
                              textOverflow: expandedDescId === tx.id ? 'clip' : 'ellipsis', 
                              whiteSpace: expandedDescId === tx.id ? 'normal' : 'nowrap', 
                              maxWidth: expandedDescId === tx.id ? 'none' : '160px',
                              cursor: 'pointer',
                              wordBreak: expandedDescId === tx.id ? 'break-word' : 'normal',
                              lineHeight: 1.4
                            }} 
                            className={expandedDescId === tx.id ? "" : "mobile-desc-text"}
                          >
                            {cleanDescription(tx.description) || 'No description'}
                          </div>
                          {duplicateIds.has(tx.id) && (
                            <span style={{
                              fontSize: 10, padding: '2px 6px', borderRadius: 4,
                              background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)',
                              fontWeight: 600, flexShrink: 0
                            }}>
                              Duplicate
                            </span>
                          )}
                          <button 
                            onClick={() => { setEditingId(tx.id); setEditingField('description'); setEditValue(tx.description || ''); }}
                            style={{ padding: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                            title="Edit Description"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="mobile-hide" style={{ padding: '12px 16px' }}>
                    {editingId === tx.id && editingField === 'category' ? (
                      <select
                        autoFocus
                        value={editValue}
                        onChange={e => handleSaveEdit(tx.id, 'category_id', e.target.value)}
                        onBlur={() => setEditingId(null)}
                        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--accent-primary)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', outline: 'none', fontSize: 12, maxWidth: 120 }}
                      >
                        <option value="">No Category</option>
                        {categories.filter(c => c.type === tx.type || c.type === 'both').map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Badge 
                          variant="default"
                          title={(tx.category as any)?.name || ''}
                          onClick={() => setExpandedCatId(expandedCatId === tx.id ? null : tx.id)}
                          style={{
                            cursor: 'pointer',
                            overflow: expandedCatId === tx.id ? 'visible' : 'hidden',
                            textOverflow: expandedCatId === tx.id ? 'clip' : 'ellipsis',
                            whiteSpace: expandedCatId === tx.id ? 'normal' : 'nowrap',
                            maxWidth: expandedCatId === tx.id ? 'none' : 120,
                            wordBreak: expandedCatId === tx.id ? 'break-word' : 'normal',
                            lineHeight: 1.4
                          }}
                        >
                          {(tx.category as any)?.name || '—'}
                        </Badge>
                        {isAdmin && (
                          <button 
                            onClick={() => { setEditingId(tx.id); setEditingField('category'); setEditValue(tx.category_id || ''); }}
                            style={{ padding: 4, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                            title="Edit Category"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="mobile-hide" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <div>{(tx.account as any)?.name || 'General'}</div>
                    <div style={{ fontSize: 10, color: 'var(--accent-light)', marginTop: 2, fontWeight: 500 }}>
                      {tx.notes?.includes('Performed by:')
                        ? tx.notes.split('Performed by:')[1].trim()
                        : (isStaff ? 'Staff' : 'Admin')}
                    </div>
                  </td>
                  <td className="mobile-tight-td" style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, color: tx.type === 'income' ? 'var(--success)' : 'var(--error)', fontFamily: 'Space Grotesk, sans-serif', whiteSpace: 'nowrap' }}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </td>
                  <td className="mobile-hide" style={{ padding: '12px 16px' }}>
                    <Badge variant={tx.is_verified ? 'success' : 'default'}>
                      {tx.is_verified ? 'Verified' : 'Pending'}
                    </Badge>
                  </td>
                  <td className="mobile-tight-td mobile-actions" style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {tx.type === 'income' && (
                        <button
                          onClick={() => navigate('/app/receipts', { state: { openCreateModal: true, transactionId: tx.id } })}
                          title="Generate Receipt"
                          style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--accent-light)', transition: 'all 0.15s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-light)'; }}
                        >
                          <Receipt size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => toggleVerify(tx)}
                        title={tx.is_verified ? 'Mark as unverified' : 'Mark as verified'}
                        style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: tx.is_verified ? 'var(--success)' : 'var(--text-muted)', transition: 'all 0.15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-border)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        title="Delete"
                        style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--error-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--error)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Transaction">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Input
              label="Description"
              placeholder="e.g. Salary payment, Office rent, MTN data..."
              value={form.description}
              onChange={e => handleDescriptionChange(e.target.value)}
            />
            {autoSuggestion && (
              <div style={{
                marginTop: 6, padding: '7px 10px', borderRadius: 'var(--radius-md)',
                background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              }}>
                <Brain size={12} color="var(--accent-light)" />
                <span style={{ color: 'var(--text-muted)' }}>Auto-detected:</span>
                <strong style={{ color: 'var(--accent-light)', textTransform: 'capitalize' }}>{form.type}</strong>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--text-secondary)' }}>{autoSuggestion}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['income', 'expense'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setForm(p => ({ ...p, type: t, category_id: '' })); setAutoSuggestion(''); }}
                style={{
                  flex: 1, padding: '9px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600,
                  border: '1px solid',
                  background: form.type === t ? (t === 'income' ? 'var(--success-dim)' : 'var(--error-dim)') : 'var(--bg-elevated)',
                  color: form.type === t ? (t === 'income' ? 'var(--success)' : 'var(--error)') : 'var(--text-muted)',
                  borderColor: form.type === t ? (t === 'income' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)') : 'var(--bg-border)',
                  transition: 'all 0.15s', textTransform: 'capitalize',
                }}
              >
                {t === 'income' ? '↑ Income' : '↓ Expense'}
              </button>
            ))}
          </div>
          <Input
            label="Amount (₦)"
            type="number"
            placeholder="0.00"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            required
          />
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
            required
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Category</label>
            <select
              value={form.category_id}
              onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
              style={{
                padding: '9px 12px', background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)',
                color: form.category_id ? 'var(--text-primary)' : 'var(--text-muted)', outline: 'none',
              }}
            >
              <option value="">Select category...</option>
              {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Account</label>
            <select
              value={form.account_id}
              onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))}
              style={{
                padding: '9px 12px', background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)',
                color: form.account_id ? 'var(--text-primary)' : 'var(--text-muted)', outline: 'none',
              }}
            >
              <option value="">Select account (optional)</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <Input
            label="Notes (optional)"
            placeholder="Additional notes..."
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          />
          {formError && (
            <div style={{ padding: '10px 12px', background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: 13 }}>
              {formError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button variant="secondary" onClick={() => setShowModal(false)} type="button">Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">Save Transaction</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
