import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileMinus2, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase, type Invoice, type Account } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/format';
import {
  type CreditNoteRecord,
  type CreditNoteItemInput,
  issueSalesCreditNote,
} from '../lib/smeAccountingService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';

export default function CreditNotesPage() {
  const navigate = useNavigate();
  const { user, isStaff, staffData } = useAuth();
  const effectiveUserId = isStaff && staffData ? staffData.owner_id : user?.id;

  const [creditNotes, setCreditNotes] = useState<CreditNoteRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('Goods returned / Price adjustment');
  const [vatRate, setVatRate] = useState('7.5');
  const [items, setItems] = useState<CreditNoteItemInput[]>([{ description: '', quantity: 1, unit_price: 0 }]);
  const [recordRefund, setRecordRefund] = useState(false);
  const [refundMethod, setRefundMethod] = useState('Bank Transfer');
  const [refundAccountId, setRefundAccountId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (effectiveUserId) loadData();
  }, [effectiveUserId]);

  async function loadData() {
    setLoading(true);
    const [cnRes, invRes, accRes] = await Promise.all([
      supabase.from('credit_notes').select('*').eq('user_id', effectiveUserId).order('issue_date', { ascending: false }),
      supabase.from('invoices').select('*').eq('user_id', effectiveUserId).neq('status', 'cancelled').order('issue_date', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', effectiveUserId).eq('is_active', true),
    ]);
    setCreditNotes((cnRes.data as CreditNoteRecord[]) || []);
    setInvoices((invRes.data as Invoice[]) || []);
    setAccounts((accRes.data as Account[]) || []);
    setLoading(false);
  }

  function handleSelectInvoice(invId: string) {
    setSelectedInvoiceId(invId);
    const inv = invoices.find((i) => i.id === invId);
    if (!inv) return;
    setCustomerName(inv.client_name || '');
    setCustomerEmail(inv.client_email || '');
    setVatRate(String(inv.tax_rate ?? 0));
    const remaining = Math.max(0, Number(inv.total || 0) - Number((inv as any).credited_amount || 0));
    const baseSubtotal = inv.tax_rate ? Math.round((remaining / (1 + Number(inv.tax_rate) / 100)) * 100) / 100 : remaining;
    setItems([{ description: `Credit against ${inv.invoice_number}`, quantity: 1, unit_price: baseSubtotal }]);
  }

  function resetForm() {
    setSelectedInvoiceId('');
    setCustomerName('');
    setCustomerEmail('');
    setIssueDate(new Date().toISOString().slice(0, 10));
    setReason('Goods returned / Price adjustment');
    setVatRate('7.5');
    setItems([{ description: '', quantity: 1, unit_price: 0 }]);
    setRecordRefund(false);
    setRefundMethod('Bank Transfer');
    setRefundAccountId('');
    setNotes('');
    setError('');
  }

  const subtotal = items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
  const vatAmount = Math.round(subtotal * ((Number(vatRate) || 0) / 100) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!effectiveUserId) return;
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    const validItems = items.filter((i) => i.description.trim() && i.quantity > 0 && i.unit_price > 0);
    if (validItems.length === 0) {
      setError('Add at least one line item with a description and positive price.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const linkedInv = invoices.find((i) => i.id === selectedInvoiceId) || null;
      await issueSalesCreditNote({
        userId: effectiveUserId,
        actorId: user?.id || effectiveUserId,
        invoice: linkedInv,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        issueDate,
        reason,
        vatRate: Number(vatRate) || 0,
        items: validItems,
        recordRefund,
        refundMethod,
        refundAccountId: refundAccountId || undefined,
        notes,
      });
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to issue credit note.');
    } finally {
      setSaving(false);
    }
  }

  const totalCredited = creditNotes.filter((c) => c.status !== 'void').reduce((s, c) => s + Number(c.total || 0), 0);
  const totalVatReversed = creditNotes.filter((c) => c.status !== 'void').reduce((s, c) => s + Number(c.vat_amount || 0), 0);
  const totalRefunded = creditNotes.filter((c) => c.refund_recorded).reduce((s, c) => s + Number(c.total || 0), 0);

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1180, margin: '0 auto', animation: 'fadeIn 0.25s ease' }}>
      {/* Top Sub-Navigation Pill */}
      <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', marginBottom: 20, flexWrap: 'wrap', gap: 2 }}>
        {[
          { label: 'Invoices', to: '/app/invoices' },
          { label: 'Receipts', to: '/app/receipts' },
          { label: 'Customers', to: '/app/customers' },
          { label: 'Credit Notes', to: '/app/credit-notes', active: true },
        ].map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => !tab.active && navigate(tab.to)}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              background: tab.active ? 'var(--accent-primary)' : 'transparent',
              color: tab.active ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: tab.active ? 600 : 500,
              fontSize: 13,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="mobile-col mobile-gap-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Sales Credit Notes &amp; Refunds</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Adjust issued invoices cleanly without deleting audit history — automatically reverses VAT, reduces AR, and posts to General Ledger.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => { resetForm(); setShowModal(true); }}>
          Issue Credit Note
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Total Credit Notes Issued</div>
          <div style={{ fontSize: 21, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(totalCredited)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--accent-light)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Output VAT Reversed</div>
          <div style={{ fontSize: 21, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent-light)' }}>{formatCurrency(totalVatReversed)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--warning)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Cash / Bank Refunds Paid</div>
          <div style={{ fontSize: 21, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--warning)' }}>{formatCurrency(totalRefunded)}</div>
        </Card>
      </div>

      {/* Credit Notes Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 20 }}>
            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 8, marginBottom: 8 }} />)}
          </div>
        ) : creditNotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <FileMinus2 size={34} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>No credit notes issued yet</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
              Issue a credit note when a customer returns goods or receives a post-invoice discount.
            </p>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { resetForm(); setShowModal(true); }}>
              Issue First Credit Note
            </Button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 740, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                  <th style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Credit Note #</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer &amp; Reason</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>VAT Reversed</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Total Credit</th>
                  <th style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes.map((cn, idx) => (
                  <tr key={cn.id} style={{ borderTop: idx > 0 ? '1px solid var(--bg-border)' : 'none' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontSize: 13 }}>{cn.credit_note_number}</td>
                    <td style={{ padding: '14px 12px' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{cn.customer_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{cn.reason || 'Credit adjustment'}</div>
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(cn.issue_date)}</td>
                    <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(cn.vat_amount)}</td>
                    <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: 'var(--error)', fontFamily: 'Space Grotesk, sans-serif' }}>-{formatCurrency(cn.total)}</td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <Badge variant={cn.status === 'refunded' ? 'warning' : cn.status === 'applied' ? 'success' : 'default'}>
                        {cn.status === 'refunded' ? 'Refunded' : cn.status === 'applied' ? 'Applied to AR' : cn.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Issue Credit Note Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Issue Sales Credit Note" size="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Link to Issued Invoice (recommended)
            </label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => handleSelectInvoice(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none',
              }}
            >
              <option value="">Standalone Credit Note (no linked invoice)</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} — {inv.client_name} ({formatCurrency(inv.total)})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Customer Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            <Input label="Issue Date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Goods returned, overbilling, discount..." />
            <Input label="VAT Rate (%)" type="number" min="0" step="0.5" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
          </div>

          {/* Line Items */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Credit Line Items</label>
              <button
                type="button"
                onClick={() => setItems((p) => [...p, { description: '', quantity: 1, unit_price: 0 }])}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                + Add Line
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 70px 110px 30px', gap: 8, alignItems: 'center' }}>
                  <input
                    placeholder="Item description"
                    value={it.description}
                    onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))}
                    style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 13 }}
                  />
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={it.quantity}
                    onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) || 0 } : x)))}
                    style={{ padding: '8px 6px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 13, textAlign: 'center' }}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price"
                    value={it.unit_price}
                    onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, unit_price: Number(e.target.value) || 0 } : x)))}
                    style={{ padding: '8px 8px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 13 }}
                  />
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals Box */}
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>VAT Reversal ({vatRate || 0}%)</span><strong>{formatCurrency(vatAmount)}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--bg-border)', paddingTop: 6, marginTop: 4, fontSize: 15 }}>
              <span style={{ fontWeight: 700 }}>Total Credit Note</span>
              <strong style={{ color: 'var(--error)', fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(total)}</strong>
            </div>
          </div>

          {/* Optional Cash / Bank Refund */}
          <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={recordRefund} onChange={(e) => setRecordRefund(e.target.checked)} />
              <span>Also record an immediate cash/bank refund to customer</span>
            </label>
            {recordRefund && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 13 }}
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="POS / Card">POS / Card</option>
                </select>
                <select
                  value={refundAccountId}
                  onChange={(e) => setRefundAccountId(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)', fontSize: 13 }}
                >
                  <option value="">Refund from account (optional)</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--error-dim)', color: 'var(--error)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving} icon={<CheckCircle2 size={14} />}>
              Issue Credit Note &amp; Post GL
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
