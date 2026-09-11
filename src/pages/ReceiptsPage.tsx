import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus, Receipt as ReceiptIcon, Search, Download, Send, Eye,
  X, Share2, AlertTriangle, ArrowLeftRight
} from 'lucide-react';
import { supabase, type Receipt, type InventoryItem, type Transaction } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/format';
import { downloadCSV } from '../lib/export';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { useMobile } from '../hooks/useMobile';
import {
  createReceipt,
  getReceipts,
  cancelReceipt,
  downloadReceiptPDF,
  generateReceiptImageDataUrl,
  checkExistingReceiptForTransaction,
} from '../lib/receiptService';

type ReceiptStatus = Receipt['status'];

const statusVariant: Record<ReceiptStatus, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  draft: 'default',
  generated: 'purple',
  sent: 'info',
  viewed: 'success',
  cancelled: 'error',
};

const PAYMENT_METHODS = [
  'Bank Transfer',
  'Cash',
  'POS',
  'Card',
  'Mobile Money',
  'Other',
];

export default function ReceiptsPage() {
  const isMobile = useMobile();
  const location = useLocation();
  const { user, profile, isStaff, staffData } = useAuth();
  const effectiveUserId = isStaff && staffData ? staffData.owner_id : user?.id;

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [incomeTransactions, setIncomeTransactions] = useState<Transaction[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<ReceiptStatus | 'all'>('all');

  // Modals & Active State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);
  const [previewImageDataUrl, setPreviewImageDataUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Duplicate Warning State
  const [existingReceiptWarning, setExistingReceiptWarning] = useState<Receipt | null>(null);

  // Create Form State
  const [selectedTxId, setSelectedTxId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [customPaymentMethod, setCustomPaymentMethod] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [description, setDescription] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);

  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [items, setItems] = useState<
    Array<{
      product_id: string;
      description: string;
      quantity: string;
      unit_price: string;
      discount: string;
    }>
  >([
    { product_id: '', description: '', quantity: '1', unit_price: '', discount: '0' },
  ]);

  useEffect(() => {
    if (effectiveUserId) loadData();
  }, [effectiveUserId]);

  // Handle location state navigation (e.g. from Transactions page "Generate Receipt")
  useEffect(() => {
    if (location.state?.openCreateModal && effectiveUserId) {
      const txId = location.state.transactionId || location.state.txId;
      resetForm();
      setShowCreateModal(true);

      if (txId) {
        setSelectedTxId(txId);
        handleSelectTransaction(txId);
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state, effectiveUserId]);

  async function loadData() {
    if (!effectiveUserId) return;
    setLoading(true);

    const [rcptData, txRes, invRes] = await Promise.all([
      getReceipts(effectiveUserId),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('type', 'income')
        .order('date', { ascending: false })
        .limit(100),
      supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('status', 'active'),
    ]);

    setReceipts(rcptData);
    setIncomeTransactions(txRes.data || []);
    setInventoryItems(invRes.data || []);
    setLoading(false);
  }

  async function handleSelectTransaction(txId: string) {
    if (!txId) {
      setExistingReceiptWarning(null);
      return;
    }

    const tx = incomeTransactions.find((t) => t.id === txId);
    if (!tx) return;

    // Check duplicate receipt
    const existing = await checkExistingReceiptForTransaction(effectiveUserId!, tx.id);
    if (existing) {
      setExistingReceiptWarning(existing);
    } else {
      setExistingReceiptWarning(null);
    }

    // Auto-populate from transaction
    setReceiptDate(tx.date || new Date().toISOString().split('T')[0]);
    setDescription(tx.description || 'Payment for sale');
    setPaymentReference(tx.reference || '');

    // Extract customer name if in notes/description or reference
    let detectedCustomer = '';
    if (tx.notes && tx.notes.toLowerCase().includes('customer:')) {
      const match = tx.notes.match(/customer:\s*([^\n|]+)/i);
      if (match) detectedCustomer = match[1].trim();
    }
    if (!detectedCustomer && tx.description) {
      const match = tx.description.match(/(?:from|for)\s+([a-zA-Z\s]+?)(?:\s+\d+|$)/i);
      if (match) detectedCustomer = match[1].trim();
    }

    if (detectedCustomer) setCustomerName(detectedCustomer);

    setItems([
      {
        product_id: '',
        description: tx.description || 'Completed payment',
        quantity: '1',
        unit_price: String(tx.amount || 0),
        discount: '0',
      },
    ]);
  }

  function calcTotals() {
    let subtotal = 0;
    let totalDiscount = 0;

    items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const disc = Number(item.discount) || 0;
      subtotal += qty * price;
      totalDiscount += disc;
    });

    const total = Math.max(0, subtotal - totalDiscount);
    return { subtotal, totalDiscount, total };
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!effectiveUserId) return;

    if (!customerName.trim()) {
      alert('Please enter a customer name.');
      return;
    }

    const validItems = items.filter(
      (i) => i.description.trim() && Number(i.unit_price) > 0
    );

    if (validItems.length === 0) {
      alert('Please enter at least one valid item with a description and unit price.');
      return;
    }

    setSaving(true);
    try {
      const finalMethod =
        paymentMethod === 'Other' && customPaymentMethod.trim()
          ? customPaymentMethod.trim()
          : paymentMethod;

      const actorText = isStaff
        ? 'Staff'
        : profile?.full_name
        ? `Admin (${profile.full_name})`
        : 'Admin';

      const newReceipt = await createReceipt({
        userId: effectiveUserId,
        transaction_id: selectedTxId || null,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        payment_method: finalMethod,
        payment_reference: paymentReference,
        description,
        receipt_date: receiptDate,
        created_by: actorText,
        items: validItems.map((i) => ({
          product_id: i.product_id || null,
          description: i.description,
          quantity: Number(i.quantity) || 1,
          unit_price: Number(i.unit_price) || 0,
          discount: Number(i.discount) || 0,
        })),
      });

      setShowCreateModal(false);
      resetForm();
      await loadData();

      // Show preview immediately for instant download/send
      handleOpenPreview(newReceipt);
    } catch (err: any) {
      console.error('Failed to create receipt:', err);
      alert(err.message || 'Error generating receipt. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenPreview(receipt: Receipt) {
    setPreviewReceipt(receipt);
    const dataUrl = await generateReceiptImageDataUrl(receipt, profile);
    setPreviewImageDataUrl(dataUrl);
  }

  async function handleCancelReceipt(receiptId: string) {
    if (!confirm('Are you sure you want to cancel this receipt? Financial audit records will be preserved.')) return;
    const ok = await cancelReceipt(receiptId);
    if (ok) {
      setReceipts((prev) =>
        prev.map((r) => (r.id === receiptId ? { ...r, status: 'cancelled' } : r))
      );
      if (previewReceipt?.id === receiptId) {
        setPreviewReceipt((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
      }
    }
  }

  function handleSendWhatsApp(receipt: Receipt) {
    const phone = receipt.customer_phone?.replace(/\D/g, '');
    const cleanPhone = phone ? (phone.startsWith('0') ? `234${phone.slice(1)}` : phone) : '';

    const text = encodeURIComponent(
      `Hello ${receipt.customer_name},\n\nHere is your official payment receipt from ${
        profile?.business_name || profile?.full_name || 'ROVA Business'
      }.\n\nReceipt No: ${receipt.receipt_number}\nAmount Paid: ${formatCurrency(
        receipt.total
      )}\nDate: ${formatDate(receipt.receipt_date)}\nPayment Method: ${
        receipt.payment_method
      }\n\nThank you for your business!`
    );

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;

    window.open(url, '_blank');
  }

  function handleShare(receipt: Receipt) {
    if (navigator.share) {
      navigator.share({
        title: `Receipt ${receipt.receipt_number}`,
        text: `Payment Receipt ${receipt.receipt_number} for ${receipt.customer_name} - ${formatCurrency(receipt.total)}`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(
        `Receipt ${receipt.receipt_number} for ${receipt.customer_name} - ${formatCurrency(receipt.total)}`
      );
      alert('Receipt summary copied to clipboard!');
    }
  }

  function resetForm() {
    setSelectedTxId('');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setPaymentMethod('Bank Transfer');
    setCustomPaymentMethod('');
    setPaymentReference('');
    setDescription('');
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setExistingReceiptWarning(null);
    setItems([
      { product_id: '', description: '', quantity: '1', unit_price: '', discount: '0' },
    ]);
  }

  function addItem() {
    setItems((p) => [
      ...p,
      { product_id: '', description: '', quantity: '1', unit_price: '', discount: '0' },
    ]);
  }

  function removeItem(idx: number) {
    setItems((p) => p.filter((_, i) => i !== idx));
  }

  // Filtered receipts
  const filteredReceipts = receipts.filter((r) => {
    const matchSearch =
      !search ||
      r.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
      r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.customer_phone?.toLowerCase().includes(search.toLowerCase()) ||
      r.payment_reference?.toLowerCase().includes(search.toLowerCase());

    const matchMethod =
      paymentMethodFilter === 'all' || r.payment_method === paymentMethodFilter;
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchSearch && matchMethod && matchStatus;
  });

  const totalReceiptsAmount = receipts
    .filter((r) => r.status !== 'cancelled')
    .reduce((s, r) => s + (r.total || r.amount || 0), 0);

  const activeCount = receipts.filter((r) => r.status !== 'cancelled').length;
  const sentCount = receipts.filter((r) => r.status === 'sent' || r.status === 'viewed').length;

  const { subtotal, totalDiscount, total } = calcTotals();

  // Extract unique customers from existing receipts/invoices
  const recentCustomers = Object.values(
    receipts.reduce<
      Record<string, { name: string; phone: string; email: string }>
    >((acc, r) => {
      const name = r.customer_name?.trim();
      if (!name) return acc;
      const key = name.toLowerCase();
      if (!acc[key]) {
        acc[key] = {
          name: r.customer_name,
          phone: r.customer_phone || '',
          email: r.customer_email || '',
        };
      }
      return acc;
    }, {})
  ).slice(0, 5);

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1060, animation: 'fadeIn 0.3s ease' }}>
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div
        className="mobile-col mobile-gap-4"
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Receipts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Create, manage and send payment receipts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="secondary"
            icon={<Download size={14} />}
            onClick={() => {
              const rows = receipts.map((r) => [
                r.receipt_number,
                r.customer_name,
                r.customer_phone || '',
                formatDate(r.receipt_date),
                r.payment_method,
                r.total,
                r.status,
                r.created_by || '',
              ]);
              downloadCSV(
                `receipts-${new Date().toISOString().split('T')[0]}.csv`,
                ['Receipt #', 'Customer', 'Phone', 'Date', 'Payment Method', 'Amount (NGN)', 'Status', 'Created By'],
                rows
              );
            }}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={14} />}
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
          >
            + Create Receipt
          </Button>
        </div>
      </div>

      {/* ── Stats Summary Grid ─────────────────────────────────── */}
      <div
        className="mobile-grid-1 mobile-gap-4"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <Card style={{ border: '1px solid rgba(124,58,237,0.2)', background: 'var(--accent-dim)' }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--accent-light)',
              marginBottom: 6,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Total Generated Receipts
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif',
              color: 'var(--text-primary)',
            }}
          >
            {formatCurrency(totalReceiptsAmount)}
          </div>
        </Card>

        <Card style={{ border: '1px solid rgba(34,197,94,0.2)', background: 'var(--success-dim)' }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--success)',
              marginBottom: 6,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Receipts Issued
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif',
              color: 'var(--text-primary)',
            }}
          >
            {activeCount} Total
          </div>
        </Card>

        <Card style={{ border: '1px solid rgba(59,130,246,0.2)', background: 'var(--info-dim)' }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--info)',
              marginBottom: 6,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            Delivered / Sent
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif',
              color: 'var(--text-primary)',
            }}
          >
            {sentCount} Receipts
          </div>
        </Card>
      </div>

      {/* ── Receipts List & Search Filter Container ───────────── */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--bg-border)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by receipt #, customer, phone..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: 13,
              }}
            />
          </div>

          {/* Payment Method Filter */}
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 12,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          >
            <option value="all">All Payment Methods</option>
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm} value={pm}>
                {pm}
              </option>
            ))}
          </select>

          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'generated', 'sent', 'cancelled'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  fontWeight: 500,
                  background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: statusFilter === s ? 'white' : 'var(--text-secondary)',
                  border: `1px solid ${
                    statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-border)'
                  }`,
                  transition: 'all 0.15s',
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 20 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 60, marginBottom: 8 }} />
            ))}
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '54px 20px' }}>
            <ReceiptIcon size={36} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}>
              No payment receipts found
            </p>
            <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4 }}>
              Click "+ Create Receipt" to issue your first payment receipt.
            </p>
          </div>
        ) : isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>
            {filteredReceipts.map((r) => (
              <div
                key={r.id}
                onClick={() => handleOpenPreview(r)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: 16,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--bg-border)',
                  background: 'var(--bg-primary)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-light)' }}>
                      {r.receipt_number}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                      {r.customer_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {formatDate(r.receipt_date)} · {r.payment_method}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 15,
                        color: 'var(--text-primary)',
                        fontFamily: 'Space Grotesk, sans-serif',
                      }}
                    >
                      {formatCurrency(r.total || r.amount)}
                    </div>
                    <div style={{ marginTop: 6, display: 'inline-block' }}>
                      <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                    </div>
                  </div>
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
                    'Receipt #',
                    'Customer Name',
                    'Amount',
                    'Date',
                    'Payment Method',
                    'Created By',
                    'Status',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((r, i) => (
                  <tr
                    key={r.id}
                    onClick={() => handleOpenPreview(r)}
                    style={{
                      borderTop: i > 0 ? '1px solid var(--bg-border)' : 'none',
                      transition: 'background 0.1s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.background = 'transparent')
                    }
                  >
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--accent-light)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.receipt_number}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.customer_name}
                      </div>
                      {r.customer_phone && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {r.customer_phone}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontWeight: 700,
                        fontSize: 14,
                        color: 'var(--text-primary)',
                        fontFamily: 'Space Grotesk, sans-serif',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatCurrency(r.total || r.amount)}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(r.receipt_date)}
                    </td>
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: 12,
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Badge variant="default">{r.payment_method}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.created_by || 'Admin'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Badge variant={statusVariant[r.status]}>{r.status}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenPreview(r)}
                          title="Preview Receipt"
                          style={{
                            padding: 6,
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-muted)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'var(--bg-border)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                          }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => downloadReceiptPDF(r, profile)}
                          title="Download PDF"
                          style={{
                            padding: 6,
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--accent-light)',
                            background: 'var(--accent-dim)',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleSendWhatsApp(r)}
                          title="Send to Customer via WhatsApp"
                          style={{
                            padding: 6,
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--success)',
                            background: 'var(--success-dim)',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <Send size={14} />
                        </button>
                        {r.status !== 'cancelled' && (
                          <button
                            onClick={() => handleCancelReceipt(r.id)}
                            title="Cancel Receipt"
                            style={{
                              padding: 6,
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--error)',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = 'var(--error-dim)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = 'transparent';
                            }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── CREATE RECEIPT MODAL ────────────────────────────────── */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Payment Receipt" size="lg">
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Business Info Header Banner */}
          <div
            style={{
              padding: 12,
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--bg-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Issuing Business Profile
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                {profile?.business_name || profile?.full_name || 'ROVA Business'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                {profile?.phone || user?.email}
              </div>
            </div>
            <Badge variant="purple">ROVA Auto-Populated</Badge>
          </div>

          {/* Link to existing completed income transaction */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 12,
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent-border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeftRight size={13} /> Select Existing Completed Sale Transaction (Optional)
            </label>
            <select
              value={selectedTxId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedTxId(id);
                handleSelectTransaction(id);
              }}
              style={{
                padding: '9px 12px',
                background: 'var(--bg-base)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: 13,
              }}
            >
              <option value="">Create standalone receipt (no transaction link)</option>
              {incomeTransactions.map((tx) => (
                <option key={tx.id} value={tx.id}>
                  {tx.date} — {formatCurrency(tx.amount)} ({tx.description})
                </option>
              ))}
            </select>
          </div>

          {/* Duplicate Receipt Alert */}
          {existingReceiptWarning && (
            <div
              style={{
                padding: '12px 14px',
                background: 'var(--warning-dim)',
                border: '1px solid rgba(245,158,11,0.3)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--warning)' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>
                  Receipt <strong>{existingReceiptWarning.receipt_number}</strong> already exists for this transaction.
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowCreateModal(false);
                  handleOpenPreview(existingReceiptWarning);
                }}
              >
                View Existing Receipt
              </Button>
            </div>
          )}

          {/* Customer Details */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Input
                label="Customer Name *"
                placeholder="e.g. John Stores, Musa..."
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onFocus={() => setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                required
              />
              {showCustomerDropdown && (
                (() => {
                  const filtered = recentCustomers.filter((c) =>
                    c.name.toLowerCase().includes(customerName.toLowerCase())
                  );
                  if (filtered.length === 0) return null;
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: 4,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--bg-border)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        zIndex: 50,
                      }}
                    >
                      {filtered.map((c) => (
                        <div
                          key={c.name}
                          onMouseDown={() => {
                            setCustomerName(c.name);
                            if (c.phone) setCustomerPhone(c.phone);
                            if (c.email) setCustomerEmail(c.email);
                            setShowCustomerDropdown(false);
                          }}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--bg-border)',
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                          {c.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
            <Input
              label="Customer Phone"
              placeholder="e.g. 08012345678"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <Input
              label="Customer Email"
              type="email"
              placeholder="customer@example.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </div>

          {/* Payment Info */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
            <Input
              label="Payment Date *"
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              required
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
                Payment Method *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  padding: '9px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontSize: 13,
                }}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>
            {paymentMethod === 'Other' ? (
              <Input
                label="Custom Payment Method"
                placeholder="e.g. Cheque, Crypto..."
                value={customPaymentMethod}
                onChange={(e) => setCustomPaymentMethod(e.target.value)}
              />
            ) : (
              <Input
                label="Payment Reference / Transaction Ref"
                placeholder="e.g. TRF-9823412"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            )}
          </div>

          {/* Receipt Line Items Builder */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              Receipt Items / Products *
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1.5fr 2fr 1fr 1.2fr 1fr auto',
                    gap: 10,
                    alignItems: 'end',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {idx === 0 && <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stock Item</label>}
                    <select
                      value={item.product_id}
                      onChange={(e) => {
                        const pid = e.target.value;
                        const inv = inventoryItems.find((x) => x.id === pid);
                        setItems((p) =>
                          p.map((x, j) =>
                            j === idx
                              ? {
                                  ...x,
                                  product_id: pid,
                                  description: inv ? inv.name : x.description,
                                  unit_price: inv ? String(inv.selling_price) : x.unit_price,
                                }
                              : x
                          )
                        );
                      }}
                      style={{
                        padding: '9px 10px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--bg-border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        fontSize: 13,
                        height: 40,
                      }}
                    >
                      <option value="">Custom Item...</option>
                      {inventoryItems.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.name} ({inv.current_stock} in stock)
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label={idx === 0 ? 'Description *' : undefined}
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, j) => (j === idx ? { ...x, description: e.target.value } : x))
                      )
                    }
                    required
                  />
                  <Input
                    label={idx === 0 ? 'Qty *' : undefined}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, j) => (j === idx ? { ...x, quantity: e.target.value } : x))
                      )
                    }
                    required
                  />
                  <Input
                    label={idx === 0 ? 'Unit Price (₦) *' : undefined}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={item.unit_price}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, j) => (j === idx ? { ...x, unit_price: e.target.value } : x))
                      )
                    }
                    required
                  />
                  <Input
                    label={idx === 0 ? 'Discount (₦)' : undefined}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={item.discount}
                    onChange={(e) =>
                      setItems((p) =>
                        p.map((x, j) => (j === idx ? { ...x, discount: e.target.value } : x))
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    style={{
                      padding: 10,
                      height: 40,
                      background: 'var(--error-dim)',
                      color: 'var(--error)',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      cursor: items.length === 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addItem}
                style={{
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px dashed var(--bg-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginTop: 4,
                }}
              >
                <Plus size={12} /> Add Receipt Line Item
              </button>
            </div>
          </div>

          {/* Totals Summary */}
          <div
            style={{
              padding: 14,
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--success)' }}>
                <span>Discount</span>
                <span>-{formatCurrency(totalDiscount)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text-primary)',
                borderTop: '1px solid var(--bg-border)',
                paddingTop: 8,
                marginTop: 2,
              }}
            >
              <span>TOTAL PAID</span>
              <span style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent-light)' }}>
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} type="submit">
              Generate Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── RECEIPT PREVIEW & SHARE MODAL ────────────────────────── */}
      {previewReceipt && (
        <Modal open={!!previewReceipt} onClose={() => setPreviewReceipt(null)} title={`Receipt ${previewReceipt.receipt_number}`} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header info */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {previewReceipt.customer_name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Date: {formatDate(previewReceipt.receipt_date)} · {previewReceipt.payment_method}
                </div>
              </div>
              <Badge variant={statusVariant[previewReceipt.status]}>{previewReceipt.status}</Badge>
            </div>

            {/* Receipt Image / Card Canvas Preview */}
            {previewImageDataUrl && (
              <div
                style={{
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  border: '1px solid var(--bg-border)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  textAlign: 'center',
                  background: '#fff',
                  padding: 8,
                }}
              >
                <img
                  src={previewImageDataUrl}
                  alt="Receipt Preview"
                  style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 4 }}
                />
              </div>
            )}

            {/* Quick Action CTAs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                gap: 10,
                marginTop: 4,
              }}
            >
              <Button
                variant="primary"
                icon={<Download size={14} />}
                onClick={() => downloadReceiptPDF(previewReceipt, profile)}
              >
                PDF
              </Button>
              <Button
                variant="secondary"
                icon={<Download size={14} />}
                onClick={() => {
                  if (!previewImageDataUrl) return;
                  const link = document.createElement('a');
                  link.download = `receipt-${previewReceipt.receipt_number}.png`;
                  link.href = previewImageDataUrl;
                  link.click();
                }}
              >
                Image
              </Button>
              <Button
                variant="secondary"
                icon={<Send size={14} />}
                onClick={() => handleSendWhatsApp(previewReceipt)}
              >
                WhatsApp
              </Button>
              <Button
                variant="secondary"
                icon={<Share2 size={14} />}
                onClick={() => handleShare(previewReceipt)}
              >
                Share
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
