import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Receipt, Send, Check, Eye, Trash2, X, Download } from 'lucide-react';
import { supabase, type Invoice, type InventoryItem } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/format';
import { downloadCSV } from '../lib/export';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { useMobile } from '../hooks/useMobile';
import { createInvoice } from '../lib/invoiceService';

type InvoiceStatus = Invoice['status'];

const statusVariant: Record<InvoiceStatus, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  draft: 'default', sent: 'info', paid: 'success', overdue: 'error', cancelled: 'error',
};

function downloadInvoicePDF(inv: Invoice, businessName: string) {
  const items = inv.items || [];
  const itemRows = items.map(item => `
    <tr>
      <td class="item-desc">${item.description}</td>
      <td class="item-num">${item.quantity}</td>
      <td class="item-num">${formatCurrency(item.unit_price)}</td>
      <td class="item-num total-cell">${formatCurrency(item.amount)}</td>
    </tr>
  `).join('');

  const statusColor: Record<InvoiceStatus, string> = {
    draft: '#6b7280', sent: '#3b82f6', paid: '#22c55e', overdue: '#ef4444', cancelled: '#ef4444',
  };

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${inv.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; background: white; font-size: 13px; line-height: 1.5; }
    .page { max-width: 800px; margin: 0 auto; padding: 48px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand { display: flex; flex-direction: column; gap: 4px; }
    .brand-name { font-size: 26px; font-weight: 800; color: #7c3aed; letter-spacing: -0.5px; }
    .brand-sub { font-size: 12px; color: #6b7280; }
    .invoice-meta { text-align: right; }
    .invoice-number { font-size: 22px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; background: ${statusColor[inv.status]}22; color: ${statusColor[inv.status]}; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 28px 0; }
    .parties { display: flex; justify-content: space-between; margin-bottom: 32px; }
    .party h3 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
    .party p { font-size: 13px; color: #374151; margin-bottom: 2px; }
    .party .name { font-size: 15px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px; }
    .dates { display: flex; gap: 40px; margin-bottom: 32px; }
    .date-item h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 4px; }
    .date-item p { font-size: 13px; font-weight: 600; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead tr { background: #f9fafb; }
    th { padding: 10px 14px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; }
    .item-desc { color: #1a1a1a; font-weight: 500; }
    .item-num { text-align: right; color: #374151; }
    .total-cell { font-weight: 600; color: #1a1a1a; }
    .totals { margin-left: auto; width: 260px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #6b7280; }
    .totals-row.grand { font-size: 16px; font-weight: 800; color: #1a1a1a; border-top: 2px solid #e5e7eb; padding-top: 12px; margin-top: 4px; }
    .totals-row.grand span:last-child { color: #7c3aed; }
    .notes { margin-top: 32px; padding: 16px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #7c3aed; }
    .notes h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 6px; }
    .notes p { font-size: 12px; color: #6b7280; line-height: 1.6; }
    .footer { margin-top: 48px; text-align: center; font-size: 11px; color: #d1d5db; border-top: 1px solid #f3f4f6; padding-top: 20px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="brand">
        <div class="brand-name">ROVA</div>
        <div class="brand-sub">${businessName || 'Financial Operating System'}</div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-number">${inv.invoice_number}</div>
        <span class="status-badge">${inv.status}</span>
      </div>
    </div>

    <hr class="divider" />

    <div class="parties">
      <div class="party">
        <h3>Billed To (Customer)</h3>
        <p class="name">${inv.client_name}</p>
        ${inv.client_email ? `<p>${inv.client_email}</p>` : ''}
        ${inv.client_address ? `<p>${inv.client_address}</p>` : ''}
      </div>
    </div>

    <div class="dates">
      <div class="date-item">
        <h4>Issue Date</h4>
        <p>${formatDate(inv.issue_date)}</p>
      </div>
      <div class="date-item">
        <h4>Due Date</h4>
        <p>${formatDate(inv.due_date)}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:50%">Description</th>
          <th style="text-align:right">Qty</th>
          <th style="text-align:right">Unit Price</th>
          <th style="text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || `<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:20px">No line items</td></tr>`}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(inv.subtotal)}</span></div>
      ${inv.discount_rate ? `<div class="totals-row" style="color:#16a34a"><span>Discount (${inv.discount_rate}%)</span><span>-${formatCurrency(inv.discount_amount || 0)}</span></div>` : ''}
      <div class="totals-row"><span>Tax (${inv.tax_rate}%)</span><span>${formatCurrency(inv.tax_amount)}</span></div>
      <div class="totals-row grand"><span>Total</span><span>${formatCurrency(inv.total)}</span></div>
      ${inv.amount_paid ? `
      <div class="totals-row" style="color:#16a34a;margin-top:4px"><span>Amount Paid</span><span>${formatCurrency(inv.amount_paid)}</span></div>
      <div class="totals-row" style="color:#ea580c;font-weight:600"><span>Balance Due</span><span>${formatCurrency(inv.total - inv.amount_paid)}</span></div>
      ` : ''}
    </div>

    ${inv.notes ? `
    <div class="notes">
      <h4>Notes</h4>
      <p>${inv.notes}</p>
    </div>` : ''}

    <div class="footer">Generated by ROVA · rova.finance</div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

export default function InvoicesPage() {
  const isMobile = useMobile();
  const { user, profile, isStaff, staffData } = useAuth();
  const effectiveUserId = isStaff && staffData ? staffData.owner_id : user?.id;
  const location = useLocation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_address: '',
    due_date: '', tax_rate: '0', discount_rate: '0', notes: '', payment_status: 'unpaid' as 'unpaid' | 'paid_in_full' | 'part_payment', amount_paid: '',
  });
  const [items, setItems] = useState<{ description: string; quantity: string; unit_price: string; inventory_item_id: string }[]>([
    { description: '', quantity: '1', unit_price: '', inventory_item_id: '' }
  ]);

  useEffect(() => {
    if (effectiveUserId) loadInvoices();
  }, [effectiveUserId]);

  useEffect(() => {
    if (location.state?.openCreateModal) {
      const payload = location.state.payload || {};
      setForm(p => ({
        ...p,
        client_name: payload.client_name || '',
        client_email: payload.client_email || '',
        client_address: payload.client_address || '',
        due_date: payload.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tax_rate: String(payload.tax_rate ?? '0'),
        discount_rate: String(payload.discount_rate ?? '0'),
        notes: payload.notes || '',
        payment_status: payload.payment_status || 'unpaid',
        amount_paid: String(payload.amount_paid ?? ''),
      }));
      if (payload.items && Array.isArray(payload.items)) {
        setItems(payload.items.map((item: any) => ({
          description: item.description || '',
          quantity: String(item.quantity ?? '1'),
          unit_price: String(item.unit_price ?? ''),
          inventory_item_id: item.inventory_item_id || '',
        })));
      } else if (payload.amount) {
        setItems([{
          description: payload.item_description || payload.description || 'Service',
          quantity: '1',
          unit_price: String(payload.amount),
          inventory_item_id: '',
        }]);
      }
      setShowModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (location.state?.viewInvoiceId && effectiveUserId) {
      loadInvoiceWithItems(location.state.viewInvoiceId);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, effectiveUserId]);

  async function loadInvoices() {
    setLoading(true);
    let invQuery = supabase.from('invoices').select('*').eq('user_id', effectiveUserId).order('created_at', { ascending: false });

    if (isStaff) {
      const limit = profile?.staff_visibility_limit || 500000;
      invQuery = invQuery.lt('total', limit);
    }

    const [invRes, invItemsRes] = await Promise.all([
      invQuery,
      supabase.from('inventory_items').select('*').eq('user_id', effectiveUserId).eq('status', 'active')
    ]);
    setInvoices(invRes.data || []);
    setInventoryItems(invItemsRes.data || []);
    setLoading(false);
  }

  async function loadInvoiceWithItems(id: string) {
    const { data: inv } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
    const { data: itemsData } = await supabase.from('invoice_items').select('*').eq('invoice_id', id);
    setViewInvoice(inv ? { ...inv, items: itemsData || [] } : null);
  }

  function calcTotals() {
    const subtotal = items.reduce((s, item) => s + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0);
    const discountAmount = subtotal * (Number(form.discount_rate) / 100 || 0);
    const taxAmount = (subtotal - discountAmount) * (Number(form.tax_rate) / 100 || 0);
    return { subtotal, discountAmount, taxAmount, total: subtotal - discountAmount + taxAmount };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const validItems = items
        .filter(i => i.description && Number(i.unit_price) > 0)
        .map(i => ({
          description: i.description,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          inventory_item_id: i.inventory_item_id || null,
        }));

      await createInvoice({
        userId: effectiveUserId!,
        client_name: form.client_name,
        client_email: form.client_email,
        client_address: form.client_address,
        due_date: form.due_date,
        tax_rate: Number(form.tax_rate) || 0,
        discount_rate: Number(form.discount_rate) || 0,
        notes: form.notes,
        payment_status: form.payment_status,
        amount_paid: Number(form.amount_paid) || 0,
        items: validItems,
      });

      setShowModal(false);
      resetForm();
      loadInvoices();
    } catch (err) {
      console.error('Failed to create invoice:', err);
      alert('Error creating invoice. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: InvoiceStatus) {
    await supabase.from('invoices').update({ status }).eq('id', id);
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));
    if (viewInvoice?.id === id) setViewInvoice(prev => prev ? { ...prev, status } : null);
  }

  async function confirmDelete(id: string) {
    await supabase.from('invoice_items').delete().eq('invoice_id', id);
    await supabase.from('invoices').delete().eq('id', id);
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    setConfirmDeleteId(null);
    if (viewInvoice?.id === id) setViewInvoice(null);
  }

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    if (!viewInvoice) return;
    setSaving(true);

    const amount = Number(paymentAmount);
    if (amount <= 0) return;

    const newAmountPaid = (viewInvoice.amount_paid || 0) + amount;
    const newStatus = newAmountPaid >= viewInvoice.total ? 'paid' : viewInvoice.status;

    await supabase.from('invoices').update({
      amount_paid: newAmountPaid,
      status: newStatus
    }).eq('id', viewInvoice.id);

    await supabase.from('transactions').insert({
      user_id: user!.id,
      amount: amount,
      type: 'income',
      description: `Payment for ${viewInvoice.invoice_number}`,
      reference: viewInvoice.invoice_number,
      date: new Date().toISOString().split('T')[0],
      notes: `Partial/Full payment received`,
    });

    setInvoices(prev => prev.map(inv => inv.id === viewInvoice.id ? { ...inv, amount_paid: newAmountPaid, status: newStatus } : inv));
    setViewInvoice(prev => prev ? { ...prev, amount_paid: newAmountPaid, status: newStatus } : null);
    setShowPaymentModal(false);
    setPaymentAmount('');
    setSaving(false);
  }

  function resetForm() {
    setForm({ client_name: '', client_email: '', client_address: '', due_date: '', tax_rate: '0', discount_rate: '0', notes: '', payment_status: 'unpaid', amount_paid: '' });
    setItems([{ description: '', quantity: '1', unit_price: '', inventory_item_id: '' }]);
  }

  function addItem() {
    setItems(p => [...p, { description: '', quantity: '1', unit_price: '', inventory_item_id: '' }]);
  }

  function removeItem(i: number) {
    setItems(p => p.filter((_, idx) => idx !== i));
  }

  // Extract unique customers from existing invoices
  const recentCustomers = Object.values(
    invoices.reduce<Record<string, { name: string; email: string; address: string; date: string }>>((acc, inv) => {
      const name = inv.client_name?.trim();
      if (!name) return acc;
      const key = name.toLowerCase();
      if (!acc[key] || new Date(inv.created_at) > new Date(acc[key].date)) {
        acc[key] = {
          name: inv.client_name,
          email: inv.client_email || '',
          address: inv.client_address || '',
          date: inv.created_at || inv.issue_date,
        };
      }
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const { subtotal, discountAmount, taxAmount, total } = calcTotals();

  const filtered = statusFilter === 'all' ? invoices : invoices.filter(i => i.status === statusFilter);
  const paidTotal = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0);
  const pendingTotal = invoices.filter(i => i.status === 'sent' || i.status === 'draft').reduce((s, i) => s + i.total, 0);
  const overdueTotal = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total, 0);

  const businessName = profile?.business_name || profile?.full_name || '';

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1000, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Invoices</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Create and manage customer invoices</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" icon={<Download size={14} />} onClick={() => {
            const rows = invoices.map(inv => [inv.invoice_number, inv.client_name, inv.client_email, formatDate(inv.issue_date), formatDate(inv.due_date), inv.status, inv.subtotal, inv.tax_amount, inv.total]);
            downloadCSV(`invoices-${new Date().toISOString().split('T')[0]}.csv`, ['Invoice #', 'Customer', 'Email', 'Issue Date', 'Due Date', 'Status', 'Subtotal', 'Tax', 'Total (NGN)'], rows);
          }}>Export CSV</Button>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => { resetForm(); setShowModal(true); }}>
            New Invoice
          </Button>
        </div>
      </div>

      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Paid', value: paidTotal, color: 'var(--success)', bg: 'var(--success-dim)', border: 'rgba(34,197,94,0.2)' },
          { label: 'Pending', value: pendingTotal, color: 'var(--warning)', bg: 'var(--warning-dim)', border: 'rgba(245,158,11,0.2)' },
          { label: 'Overdue', value: overdueTotal, color: 'var(--error)', bg: 'var(--error-dim)', border: 'rgba(239,68,68,0.2)' },
        ].map(s => (
          <Card key={s.label} style={{ border: `1px solid ${s.border}`, background: s.bg }}>
            <div style={{ fontSize: 11, color: s.color, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
              {formatCurrency(s.value)}
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', gap: 6 }}>
          {(['all', 'draft', 'sent', 'paid', 'overdue'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500,
                background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: statusFilter === s ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                transition: 'all 0.15s', textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 20 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 64, marginBottom: 8 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Receipt size={32} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No invoices found</p>
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>
            {filtered.map(inv => (
              <div key={inv.id} onClick={() => loadInvoiceWithItems(inv.id)} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', background: 'var(--bg-primary)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-light)' }}>{inv.invoice_number}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{inv.client_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      Due: <span style={{ color: new Date(inv.due_date) < new Date() && inv.status !== 'paid' ? 'var(--error)' : 'inherit' }}>{formatDate(inv.due_date)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>
                      {formatCurrency(inv.total)}
                    </div>
                    <div style={{ marginTop: 6, display: 'inline-block' }}><Badge variant={statusVariant[inv.status]}>{inv.status}</Badge></div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px dashed var(--bg-border)', paddingTop: 12 }} onClick={e => e.stopPropagation()}>
                  {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                    <button
                      onClick={() => updateStatus(inv.id, inv.status === 'draft' ? 'sent' : 'paid')}
                      style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500, color: 'var(--success)', background: 'var(--success-dim)' }}
                    >
                      {inv.status === 'draft' ? 'Mark Sent' : 'Mark Paid'}
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDeleteId(inv.id)}
                    style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500, color: 'var(--error)', background: 'var(--error-dim)' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mobile-overflow-x">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
               <tr style={{ background: 'var(--bg-elevated)' }}>
                {[
                  { label: 'Invoice #' }, { label: 'Customer' }, 
                  { label: 'Issue Date', hideMobile: true }, { label: 'Due Date', hideMobile: true }, 
                  { label: 'Amount' }, { label: 'Status' }, { label: '' }
                ].map(h => (
                  <th key={h.label} className={h.hideMobile ? "mobile-hide" : ""} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv, i) => (
                <tr
                  key={inv.id}
                  onClick={() => loadInvoiceWithItems(inv.id)}
                  style={{
                    borderTop: i > 0 ? '1px solid var(--bg-border)' : 'none',
                    transition: 'background 0.1s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--accent-light)' }}>{inv.invoice_number}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{inv.client_name}</div>
                    {inv.client_email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.client_email}</div>}
                  </td>
                  <td className="mobile-hide" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(inv.issue_date)}</td>
                  <td className="mobile-hide" style={{ padding: '12px 16px', fontSize: 12, color: new Date(inv.due_date) < new Date() && inv.status !== 'paid' ? 'var(--error)' : 'var(--text-secondary)' }}>
                    {formatDate(inv.due_date)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>
                    {formatCurrency(inv.total)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge variant={statusVariant[inv.status]}>{inv.status}</Badge>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => loadInvoiceWithItems(inv.id)}
                        title="View invoice"
                        style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                      ><Eye size={13} /></button>
                      {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                        <button
                          onClick={() => updateStatus(inv.id, inv.status === 'draft' ? 'sent' : 'paid')}
                          title={inv.status === 'draft' ? 'Mark as Sent' : 'Mark as Paid'}
                          style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--success)', transition: 'all 0.15s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--success-dim)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                          {inv.status === 'draft' ? <Send size={13} /> : <Check size={13} />}
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDeleteId(inv.id)}
                        title="Delete invoice"
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
        )}
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Invoice" size="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Input
                label="Customer Name"
                placeholder="Customer Name"
                value={form.client_name}
                onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                required
              />
              {showCustomerDropdown && (
                (() => {
                  const filtered = recentCustomers.filter(cust =>
                    cust.name.toLowerCase().includes(form.client_name.toLowerCase())
                  ).slice(0, 5);
                  if (filtered.length === 0) return null;
                  return (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                      zIndex: 50,
                      maxHeight: 200,
                      overflowY: 'auto'
                    }}>
                      {filtered.map(cust => (
                        <div
                          key={cust.name}
                          onMouseDown={() => {
                            setForm(p => ({
                              ...p,
                              client_name: cust.name,
                              client_email: cust.email,
                              client_address: cust.address
                            }));
                            setShowCustomerDropdown(false);
                          }}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--bg-border)',
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{cust.name}</div>
                          {cust.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cust.email}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
            <Input label="Customer Email" type="email" placeholder="customer@example.com" value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} />
          </div>
          <Input label="Customer Address" placeholder="123 Main St, Lagos" value={form.client_address} onChange={e => setForm(p => ({ ...p, client_address: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
            <Input label="Due Date" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} required />
            <Input label="Discount Rate (%)" type="number" min="0" max="100" step="0.1" value={form.discount_rate} onChange={e => setForm(p => ({ ...p, discount_rate: e.target.value }))} />
            <Input label="Tax Rate (%)" type="number" min="0" max="100" step="0.1" value={form.tax_rate} onChange={e => setForm(p => ({ ...p, tax_rate: e.target.value }))} />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8 }}>Line Items</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((item, i) => (
                <div key={i} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr 1fr 1.5fr auto', 
                  gap: 12, 
                  alignItems: isMobile ? 'stretch' : 'end',
                  borderBottom: isMobile ? '1px dashed var(--bg-border)' : 'none',
                  paddingBottom: isMobile ? 16 : 0,
                  marginBottom: isMobile ? 8 : 0
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {isMobile && <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>Inventory Item</label>}
                    <select
                      value={item.inventory_item_id}
                      onChange={e => {
                        const selectedId = e.target.value;
                        const invItem = inventoryItems.find(x => x.id === selectedId);
                        setItems(p => p.map((x, j) => j === i ? {
                          ...x,
                          inventory_item_id: selectedId,
                          description: invItem ? invItem.name : x.description,
                          unit_price: invItem ? String(invItem.selling_price) : x.unit_price
                        } : x));
                      }}
                      style={{ padding: '10px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', height: 40, fontSize: 14 }}
                    >
                      <option value="">Custom Item...</option>
                      {inventoryItems.map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.name} ({inv.current_stock} in stock)</option>
                      ))}
                    </select>
                  </div>
                  <Input label={isMobile ? "Description" : undefined} placeholder="Description" value={item.description} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                  <Input label={isMobile ? "Quantity" : undefined} placeholder="Qty" type="number" min="0" step="0.01" value={item.quantity} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} />
                  <Input label={isMobile ? "Unit Price (₦)" : undefined} placeholder="Unit Price (₦)" type="number" min="0" step="0.01" value={item.unit_price} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))} />
                  <button type="button" onClick={() => removeItem(i)}
                    style={{ 
                      padding: '10px 12px', 
                      background: 'var(--error-dim)', 
                      borderRadius: 'var(--radius-md)', 
                      color: 'var(--error)', 
                      display: 'flex', 
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      marginTop: isMobile ? 8 : 0,
                      width: isMobile ? '100%' : 'auto',
                      height: isMobile ? 40 : 'auto'
                    }}>
                    <X size={14} /> {isMobile && "Remove Item"}
                  </button>
                </div>
              ))}
              <button type="button" onClick={addItem}
                style={{ padding: '7px 12px', background: 'var(--bg-elevated)', border: '1px dashed var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                <Plus size={12} /> Add Item
              </button>
            </div>
          </div>

          <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
            </div>
            {Number(form.discount_rate) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--success)' }}>
                <span>Discount ({form.discount_rate || 0}%)</span><span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>Tax ({form.tax_rate || 0}%)</span><span>{formatCurrency(taxAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', borderTop: '1px solid var(--bg-border)', paddingTop: 6, marginTop: 2 }}>
              <span>Total</span><span style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent-light)' }}>{formatCurrency(total)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Payment Terms</div>
            <div style={{ display: 'grid', gridTemplateColumns: form.payment_status === 'part_payment' ? '1fr 1fr' : '1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Payment Status</label>
                <select
                  value={form.payment_status}
                  onChange={e => setForm(p => ({ ...p, payment_status: e.target.value as any }))}
                  style={{ padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}
                >
                  <option value="unpaid">Credit Sale (Invoice - Unpaid)</option>
                  <option value="paid_in_full">Paid in Full Immediately (Receipt)</option>
                  <option value="part_payment">Part Payment Received</option>
                </select>
              </div>
              
              {form.payment_status === 'part_payment' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Amount Paid Now (₦)</label>
                  <input
                    type="number" min="0" step="0.01" max={total}
                    value={form.amount_paid}
                    onChange={e => setForm(p => ({ ...p, amount_paid: e.target.value }))}
                    placeholder="e.g. 5000"
                    required
                    style={{ padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>
              )}
            </div>
            
            {form.payment_status === 'part_payment' && (
              <div style={{ fontSize: 12, color: 'var(--warning)', background: 'var(--warning-dim)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                Balance Due: <strong>{formatCurrency(total - (Number(form.amount_paid) || 0))}</strong>
              </div>
            )}
          </div>

          <Input label="Notes" placeholder="Payment terms, bank details, etc." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">Create Invoice</Button>
          </div>
        </form>
      </Modal>

      {viewInvoice && (
        <Modal open={!!viewInvoice} onClose={() => setViewInvoice(null)} title={`Invoice ${viewInvoice.invoice_number}`} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{viewInvoice.client_name}</div>
                {viewInvoice.client_email && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{viewInvoice.client_email}</div>}
                {viewInvoice.client_address && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{viewInvoice.client_address}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <Badge variant={statusVariant[viewInvoice.status]}>{viewInvoice.status}</Badge>
                <button
                  onClick={() => downloadInvoicePDF(viewInvoice, businessName)}
                  title="Download PDF"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                    background: 'var(--accent-dim)', color: 'var(--accent-light)',
                    border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-md)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-primary)'; (e.currentTarget as HTMLElement).style.color = 'white'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-light)'; }}
                >
                  <Download size={13} /> PDF
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Issue Date</div><div style={{ fontSize: 13, fontWeight: 500 }}>{formatDate(viewInvoice.issue_date)}</div></div>
              <div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Due Date</div><div style={{ fontSize: 13, fontWeight: 500 }}>{formatDate(viewInvoice.due_date)}</div></div>
            </div>

            {viewInvoice.items && viewInvoice.items.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {['Description', 'Qty', 'Price', 'Amount'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viewInvoice.items.map(item => (
                    <tr key={item.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{item.description}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{item.quantity}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{formatCurrency(item.unit_price)}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <span>Subtotal</span><span>{formatCurrency(viewInvoice.subtotal)}</span>
              </div>
              {Number(viewInvoice.discount_rate) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--success)', marginBottom: 4 }}>
                  <span>Discount ({viewInvoice.discount_rate}%)</span><span>-{formatCurrency(viewInvoice.discount_amount || 0)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                <span>Tax ({viewInvoice.tax_rate}%)</span><span>{formatCurrency(viewInvoice.tax_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, borderTop: '1px solid var(--bg-border)', paddingTop: 8, marginBottom: 8 }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent-light)', fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(viewInvoice.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--success)' }}>
                <span>Amount Paid</span><span>{formatCurrency(viewInvoice.amount_paid || 0)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginTop: 4 }}>
                <span>Balance Due</span><span>{formatCurrency(viewInvoice.total - (viewInvoice.amount_paid || 0))}</span>
              </div>
            </div>

            {viewInvoice.notes && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                {viewInvoice.notes}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <button
                onClick={() => { setViewInvoice(null); setConfirmDeleteId(viewInvoice.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px',
                  background: 'var(--error-dim)', color: 'var(--error)',
                  border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <Trash2 size={13} /> Delete Invoice
              </button>

              {viewInvoice.status !== 'paid' && viewInvoice.status !== 'cancelled' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {viewInvoice.status === 'draft' && (
                    <Button variant="secondary" icon={<Send size={13} />} onClick={() => updateStatus(viewInvoice.id, 'sent')}>Mark as Sent</Button>
                  )}
                  <Button variant="success" icon={<Check size={13} />} onClick={() => { setPaymentAmount(String(viewInvoice.total - (viewInvoice.amount_paid || 0))); setShowPaymentModal(true); }}>Record Payment</Button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment" size="sm">
        <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {viewInvoice && (
            <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Balance Due</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)', fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(viewInvoice.total - (viewInvoice.amount_paid || 0))}</div>
            </div>
          )}
          <Input label="Payment Amount (₦)" type="number" min="0" step="0.01" max={viewInvoice ? String(viewInvoice.total - (viewInvoice.amount_paid || 0)) : undefined} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">Save Payment</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Delete Invoice" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Are you sure you want to delete this invoice? This action cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="danger" icon={<Trash2 size={13} />} onClick={() => confirmDeleteId && confirmDelete(confirmDeleteId)}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
