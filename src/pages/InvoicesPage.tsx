import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Receipt, Send, Check, Eye, Trash2, X, Download, Package, Share2 } from 'lucide-react';
import ShareDocumentModal, { type ShareDocumentData } from '../components/ShareDocumentModal';
import { supabase, type Invoice, type InventoryItem, type InvoicePayment } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/format';
import { downloadCSV } from '../lib/export';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { useMobile } from '../hooks/useMobile';
import { createInvoice, getInvoicePayments, recordInvoicePayment } from '../lib/invoiceService';

type InvoiceStatus = Invoice['status'];

const statusVariant: Record<InvoiceStatus, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  draft: 'default',
  sent: 'info',
  unpaid: 'warning',
  partially_paid: 'purple',
  paid: 'success',
  overdue: 'error',
  cancelled: 'error',
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
    draft: '#6b7280', sent: '#3b82f6', unpaid: '#f59e0b', partially_paid: '#8b5cf6', paid: '#22c55e', overdue: '#ef4444', cancelled: '#ef4444',
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
        <div class="brand-name">Rova</div>
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
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [nextReminderDate, setNextReminderDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [viewInvoicePayments, setViewInvoicePayments] = useState<InvoicePayment[]>([]);
  const [shareData, setShareData] = useState<ShareDocumentData | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const getDefaultDueDate = () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_address: '',
    due_date: getDefaultDueDate(), tax_rate: '0', discount_rate: '0', notes: '', payment_status: 'unpaid' as 'unpaid' | 'paid_in_full' | 'part_payment', amount_paid: '', repayment_reminder_date: '',
    allow_partial_payments: false,
    partial_payment_type: 'any' as 'any' | 'minimum' | 'fixed_deposit',
    minimum_partial_amount: '',
    fixed_deposit_amount: '',
  });
  const [items, setItems] = useState<{ description: string; quantity: string; unit_price: string; inventory_item_id: string; addToInventory?: boolean }[]>([
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
    const paymentsData = await getInvoicePayments(id);

    let activePaymentLink = inv?.payment_link_url || null;
    if (!activePaymentLink && inv?.id) {
      const { data: linkData } = await supabase
        .from('payment_links')
        .select('payment_url, provider_slug')
        .contains('metadata', { invoice_id: inv.id })
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (linkData?.payment_url) {
        activePaymentLink = linkData.payment_url;
      } else if (linkData?.provider_slug) {
        activePaymentLink = `${window.location.origin}/pay/${linkData.provider_slug}`;
      }
    }

    setViewInvoice(inv ? { ...inv, payment_link_url: activePaymentLink, items: itemsData || [] } : null);
    setViewInvoicePayments(paymentsData || []);
  }

  function openShareInvoice(inv: Invoice) {
    setShareData({
      type: 'invoice',
      documentId: inv.id,
      paymentLinkUrl: inv.payment_link_url || undefined,
      documentNumber: inv.invoice_number,
      recipientName: inv.client_name,
      recipientPhone: '',
      recipientEmail: inv.client_email,
      amount: inv.total,
      amountPaid: inv.amount_paid || 0,
      balanceDue: inv.total - (inv.amount_paid || 0),
      issueDate: inv.issue_date,
      dueDate: inv.due_date,
      status: inv.status,
      businessName,
      notes: inv.notes,
      onDownloadPDF: () => downloadInvoicePDF(inv, businessName),
    });
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
      if (!form.client_name.trim()) {
        alert('Please enter a Customer / Client name.');
        setSaving(false);
        return;
      }

      const validItems = items
        .filter(i => i.description?.trim() && Number(i.unit_price) > 0)
        .map(i => ({
          description: i.description.trim(),
          quantity: Math.max(1, Number(i.quantity) || 1),
          unit_price: Number(i.unit_price),
          inventory_item_id: i.inventory_item_id || null,
        }));

      if (validItems.length === 0) {
        alert('Please add at least one line item with a description and unit price greater than 0.');
        setSaving(false);
        return;
      }

      const effectiveDueDate = form.due_date || getDefaultDueDate();

      const createdInv = await createInvoice({
        userId: effectiveUserId!,
        client_name: form.client_name.trim(),
        client_email: form.client_email?.trim() || '',
        client_address: form.client_address?.trim() || '',
        due_date: effectiveDueDate,
        tax_rate: Number(form.tax_rate) || 0,
        discount_rate: Number(form.discount_rate) || 0,
        notes: form.repayment_reminder_date ? (form.notes ? `${form.notes} | Repayment Reminder: ${form.repayment_reminder_date}` : `Repayment Reminder: ${form.repayment_reminder_date}`) : form.notes,
        payment_status: form.payment_status,
        amount_paid: Number(form.amount_paid) || 0,
        items: validItems,
        allow_partial_payments: form.allow_partial_payments,
        partial_payment_type: form.allow_partial_payments ? form.partial_payment_type : 'any',
        minimum_partial_amount: form.allow_partial_payments && form.minimum_partial_amount ? Number(form.minimum_partial_amount) : undefined,
        fixed_deposit_amount: form.allow_partial_payments && form.fixed_deposit_amount ? Number(form.fixed_deposit_amount) : undefined,
      });


      // Save any custom items marked "+ Add Item" to inventory with sequential chronological SKUs
      const toAddToInventory = items.filter(i => i.addToInventory && !i.inventory_item_id && i.description);
      if (toAddToInventory.length > 0) {
        let maxNum = 0;
        for (const item of inventoryItems) {
          if (!item.sku) continue;
          const match = item.sku.match(/SKU-(\d+)/i);
          if (match) {
            const n = parseInt(match[1], 10);
            if (n > maxNum) maxNum = n;
          }
        }
        if (maxNum === 0 && inventoryItems.length > 0) maxNum = inventoryItems.length;

        await supabase.from('inventory_items').insert(
          toAddToInventory.map((i, idx) => ({
            user_id: effectiveUserId!,
            name: i.description,
            selling_price: Number(i.unit_price) || 0,
            cost_price: Number(i.unit_price) || 0,
            current_stock: 0,
            reorder_level: 0,
            status: 'active' as const,
            sku: `SKU-${String(maxNum + idx + 1).padStart(3, '0')}`,
            description: '',
            category: '',
            unit: '',
            notes: 'Added from invoice',
            supplier_id: null,
          }))
        );
      }
      setShowModal(false);
      resetForm();
      loadInvoices();

      // Lead to the Payment Link tab in Banking & Payment page
      navigate('/app/payment?tab=links', {
        state: {
          openCreateLink: true,
          invoice: createdInv,
        }
      });
    } catch (err: any) {
      console.error('Failed to create invoice:', err);
      alert(err?.message || 'Error creating invoice. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: InvoiceStatus) {
    const inv = invoices.find(i => i.id === id);
    await supabase.from('invoices').update({ status }).eq('id', id);

    // When marking an invoice as fully paid, record the remaining balance as income
    if (status === 'paid' && inv) {
      const alreadyPaid = inv.amount_paid || 0;
      const remaining = inv.total - alreadyPaid;
      if (remaining > 0) {
        // Avoid duplicate: check if an income transaction for this invoice already covers the full amount
        const { data: existing } = await supabase
          .from('transactions')
          .select('id')
          .eq('user_id', effectiveUserId!)
          .eq('reference', inv.invoice_number)
          .eq('type', 'income')
          .limit(1);
        const alreadyHasFullTx = existing && existing.length > 0 && alreadyPaid === 0;
        if (!alreadyHasFullTx) {
          await supabase.from('transactions').insert({
            user_id: effectiveUserId,
            amount: remaining,
            type: 'income',
            description: `Invoice payment – ${inv.invoice_number} (${inv.client_name})`,
            reference: inv.invoice_number,
            date: new Date().toISOString().split('T')[0],
            notes: `Balance settled. Invoice marked paid.`,
          });
        }
      }
    }

    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status } : i));
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
    if (amount <= 0) {
      setSaving(false);
      return;
    }

    try {
      const manualRef = `ROVA_MAN_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const result = await recordInvoicePayment({
        invoiceId: viewInvoice.id,
        amount,
        paymentReference: manualRef,
        paymentMethod: 'Direct Payment / Bank Transfer',
        payerName: viewInvoice.client_name,
        notes: nextReminderDate ? `Manual payment received. Next reminder: ${nextReminderDate}` : 'Manual payment recorded by merchant',
      });

      if (result.success && result.invoice) {
        setInvoices(prev => prev.map(inv => inv.id === viewInvoice.id ? { ...inv, amount_paid: result.invoice.amount_paid, status: result.invoice.status } : inv));
        await loadInvoiceWithItems(viewInvoice.id);
      } else {
        const newAmountPaid = (viewInvoice.amount_paid || 0) + amount;
        const newStatus = newAmountPaid >= viewInvoice.total ? 'paid' : 'partially_paid';
        await supabase.from('invoices').update({ amount_paid: newAmountPaid, status: newStatus }).eq('id', viewInvoice.id);
        setInvoices(prev => prev.map(inv => inv.id === viewInvoice.id ? { ...inv, amount_paid: newAmountPaid, status: newStatus } : inv));
        await loadInvoiceWithItems(viewInvoice.id);
      }

      setShowPaymentModal(false);
      setPaymentAmount('');
      setNextReminderDate('');
    } catch (err: any) {
      console.error('Error recording payment:', err);
      alert('Failed to record payment');
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setForm({
      client_name: '', client_email: '', client_address: '', due_date: getDefaultDueDate(), tax_rate: '0', discount_rate: '0', notes: '', payment_status: 'unpaid', amount_paid: '', repayment_reminder_date: '',
      allow_partial_payments: false, partial_payment_type: 'any', minimum_partial_amount: '', fixed_deposit_amount: '',
    });
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
      {/* Unified Tab Switcher for Invoices & Receipts */}
      <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', marginBottom: 20 }}>
        <button
          type="button"
          style={{ padding: '6px 18px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)', color: '#ffffff', fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer' }}
        >
          Invoices
        </button>
        <button
          type="button"
          onClick={() => navigate('/app/receipts')}
          style={{ padding: '6px 18px', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13, border: 'none', cursor: 'pointer' }}
        >
          Receipts
        </button>
      </div>
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
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'draft', 'sent', 'partially_paid', 'paid', 'overdue'] as const).map(s => (
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
              {s === 'partially_paid' ? 'Partially Paid' : s}
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
                        onClick={() => openShareInvoice(inv)}
                        title="Share invoice via WhatsApp, Email, etc."
                        style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: '#25D366', transition: 'all 0.15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(37, 211, 102, 0.15)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      ><Share2 size={13} /></button>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Input label={isMobile ? "Description" : undefined} placeholder={!item.inventory_item_id ? "Type custom item name..." : "Description"} value={item.description} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
                    {!item.inventory_item_id && (
                       <button
                         type="button"
                         onClick={() => setItems(p => p.map((x, j) => j === i ? { ...x, addToInventory: !x.addToInventory } : x))}
                         style={{
                           display: 'inline-flex', alignItems: 'center', gap: 5,
                           padding: '5px 12px', borderRadius: 'var(--radius-md)', fontSize: 12,
                           border: '1px solid', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
                           background: item.addToInventory ? 'var(--accent-primary)' : 'var(--accent-dim)',
                           color: 'white',
                           borderColor: 'var(--accent-border)',
                         }}
                       >
                         <Package size={11} />
                         {item.addToInventory ? 'Added to Inventory' : '+ Add Item'}
                       </button>
                     )}
                  </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: form.payment_status === 'part_payment' && window.innerWidth >= 640 ? '1fr 1fr' : '1fr', gap: 12 }}>
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

          {/* Customer Online Payment / Instalments Settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Customer Online Instalments</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Allow your customer to pay this invoice in instalments via Paystack
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={form.allow_partial_payments}
                  onChange={e => setForm(p => ({ ...p, allow_partial_payments: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: form.allow_partial_payments ? 'var(--accent-light)' : 'var(--text-muted)' }}>
                  {form.allow_partial_payments ? 'Partial Payments Allowed' : 'Full Payment Only'}
                </span>
              </label>
            </div>

            {form.allow_partial_payments && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, borderTop: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Instalment Rule:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                  <label style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${form.partial_payment_type === 'any' ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                    background: form.partial_payment_type === 'any' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <input
                      type="radio"
                      name="partial_type"
                      checked={form.partial_payment_type === 'any'}
                      onChange={() => setForm(p => ({ ...p, partial_payment_type: 'any' }))}
                    />
                    <span>Any Amount</span>
                  </label>

                  <label style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${form.partial_payment_type === 'minimum' ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                    background: form.partial_payment_type === 'minimum' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <input
                      type="radio"
                      name="partial_type"
                      checked={form.partial_payment_type === 'minimum'}
                      onChange={() => setForm(p => ({ ...p, partial_payment_type: 'minimum' }))}
                    />
                    <span>Minimum Amount</span>
                  </label>

                  <label style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${form.partial_payment_type === 'fixed_deposit' ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                    background: form.partial_payment_type === 'fixed_deposit' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <input
                      type="radio"
                      name="partial_type"
                      checked={form.partial_payment_type === 'fixed_deposit'}
                      onChange={() => setForm(p => ({ ...p, partial_payment_type: 'fixed_deposit' }))}
                    />
                    <span>Fixed Deposit</span>
                  </label>
                </div>

                {form.partial_payment_type === 'minimum' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Minimum Payment per Instalment (₦)</label>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      placeholder="e.g. 5000"
                      value={form.minimum_partial_amount}
                      onChange={e => setForm(p => ({ ...p, minimum_partial_amount: e.target.value }))}
                      style={{ padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                )}

                {form.partial_payment_type === 'fixed_deposit' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Required Initial Deposit Amount (₦)</label>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      placeholder="e.g. 20000"
                      value={form.fixed_deposit_amount}
                      onChange={e => setForm(p => ({ ...p, fixed_deposit_amount: e.target.value }))}
                      style={{ padding: '8px 12px', background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  </div>
                )}
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
                  onClick={() => openShareInvoice(viewInvoice)}
                  title="Share invoice via WhatsApp, Email, etc."
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                    background: 'rgba(37, 211, 102, 0.15)', color: '#25D366',
                    border: '1px solid rgba(37, 211, 102, 0.35)', borderRadius: 'var(--radius-md)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(37, 211, 102, 0.25)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(37, 211, 102, 0.15)'; }}
                >
                  <Share2 size={13} /> Share
                </button>
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

              {/* Progress bar */}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--bg-border)' }}>
                <div style={{ width: '100%', height: 6, background: 'var(--bg-border)', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--success)',
                      width: `${viewInvoice.total > 0 ? Math.min(100, Math.round(((viewInvoice.amount_paid || 0) / viewInvoice.total) * 100)) : 0}%`,
                      transition: 'width 0.3s ease',
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  <span>{viewInvoice.total > 0 ? Math.min(100, Math.round(((viewInvoice.amount_paid || 0) / viewInvoice.total) * 100)) : 0}% Paid</span>
                  <span>
                    {viewInvoice.allow_partial_payments
                      ? `Instalments Allowed (${viewInvoice.partial_payment_type === 'minimum' ? `Min ₦${viewInvoice.minimum_partial_amount}` : viewInvoice.partial_payment_type === 'fixed_deposit' ? `Deposit ₦${viewInvoice.fixed_deposit_amount}` : 'Any amount'})`
                      : 'Full Payment Only'}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Online Payment Link Box */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Customer Online Payment Link</span>
                <span style={{ fontSize: 11, color: 'var(--accent-light)', fontWeight: 600 }}>
                  {viewInvoice.allow_partial_payments ? '💳 Pay in Instalments' : '💳 Pay Full'}
                </span>
              </div>
              {(() => {
                const activePaymentUrl = viewInvoice.payment_link_url || `${window.location.origin}/pay/invoice/${viewInvoice.id}`;
                const isCustomBankingLink = Boolean(viewInvoice.payment_link_url);

                return (
                  <>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        readOnly
                        value={activePaymentUrl}
                        style={{
                          flex: 1, padding: '6px 10px', background: 'var(--bg-base)', border: '1px solid var(--bg-border)',
                          borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--text-secondary)', outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activePaymentUrl);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        style={{
                          padding: '6px 12px', background: 'var(--accent-dim)', color: 'var(--accent-light)',
                          border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        {copiedLink ? 'Copied!' : 'Copy Link'}
                      </button>
                      <a
                        href={activePaymentUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '6px 12px', background: 'var(--bg-base)', color: 'var(--text-primary)',
                          border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center'
                        }}
                      >
                        Open
                      </a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: isCustomBankingLink ? 'var(--success)' : 'var(--text-muted)' }}>
                        {isCustomBankingLink ? '✓ Using Banking & Payments Link' : 'Default Invoice Link'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigate('/app/payment?tab=links', {
                            state: {
                              openCreateLink: true,
                              invoice: viewInvoice,
                            }
                          });
                        }}
                        style={{
                          background: 'none', border: 'none', color: 'var(--accent-light)', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0
                        }}
                      >
                        🔗 {isCustomBankingLink ? 'Change in Banking & Payments →' : 'Create Banking & Payment Link →'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Payment History Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Payment History ({viewInvoicePayments.length})
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>
                  Total Collected: {formatCurrency(viewInvoice.amount_paid || 0)}
                </span>
              </div>

              {viewInvoicePayments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  No instalment records yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {viewInvoicePayments.map((p, idx) => (
                    <div key={p.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--bg-border)', fontSize: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(p.amount)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          {formatDate(p.payment_date)} &bull; {p.payment_method || 'Online'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--success-dim)', color: 'var(--success)', fontWeight: 600 }}>
                          {p.status || 'success'}
                        </span>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                          {p.payment_reference}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

      <ShareDocumentModal
        open={!!shareData}
        onClose={() => setShareData(null)}
        data={shareData}
      />

      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Payment" size="sm">
        <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {viewInvoice && (
            <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Balance Due</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)', fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(viewInvoice.total - (viewInvoice.amount_paid || 0))}</div>
            </div>
          )}
          <Input label="Payment Amount (₦)" type="number" min="0" step="0.01" max={viewInvoice ? String(viewInvoice.total - (viewInvoice.amount_paid || 0)) : undefined} value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required />
          {viewInvoice && Number(paymentAmount) < (viewInvoice.total - (viewInvoice.amount_paid || 0)) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)' }}>Next Repayment Reminder Date</label>
              <input
                type="date"
                value={nextReminderDate}
                onChange={e => setNextReminderDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--warning)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: 13,
                }}
              />
            </div>
          )}
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
