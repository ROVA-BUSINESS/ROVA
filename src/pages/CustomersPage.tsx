import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, Search, FileText, Printer, Share2, Edit2, Trash2, Mail, Phone
} from 'lucide-react';
import { supabase, type Invoice } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/format';
import {
  type CustomerRecord,
  type CreditNoteRecord,
  buildCustomerStatement,
  openPrintableStatement,
  logActivity,
} from '../lib/smeAccountingService';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';

export default function CustomersPage() {
  const navigate = useNavigate();
  const { user, profile, isStaff, staffData } = useAuth();
  const effectiveUserId = isStaff && staffData ? staffData.owner_id : user?.id;

  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add/Edit Customer Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    payment_terms_days: '14',
    notes: '',
  });

  // Statement of Account Modal
  const [stmtCustomer, setStmtCustomer] = useState<CustomerRecord | null>(null);
  const [stmtStart, setStmtStart] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [stmtEnd, setStmtEnd] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (effectiveUserId) loadData();
  }, [effectiveUserId]);

  async function loadData() {
    setLoading(true);
    const [custRes, invRes, payRes, cnRes] = await Promise.all([
      supabase.from('customers').select('*').eq('user_id', effectiveUserId).order('name'),
      supabase.from('invoices').select('*').eq('user_id', effectiveUserId).order('issue_date', { ascending: false }),
      supabase.from('invoice_payments').select('*').eq('user_id', effectiveUserId),
      supabase.from('credit_notes').select('*').eq('user_id', effectiveUserId),
    ]);
    setCustomers((custRes.data as CustomerRecord[]) || []);
    setInvoices((invRes.data as Invoice[]) || []);
    setPayments(payRes.data || []);
    setCreditNotes((cnRes.data as CreditNoteRecord[]) || []);
    setLoading(false);
  }

  function openNew() {
    setEditingCustomer(null);
    setForm({ name: '', company_name: '', email: '', phone: '', address: '', tax_id: '', payment_terms_days: '14', notes: '' });
    setShowModal(true);
  }

  function openEdit(c: CustomerRecord) {
    setEditingCustomer(c);
    setForm({
      name: c.name || '',
      company_name: c.company_name || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      tax_id: c.tax_id || '',
      payment_terms_days: String(c.payment_terms_days ?? 14),
      notes: c.notes || '',
    });
    setShowModal(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !effectiveUserId) return;
    setSaving(true);
    try {
      const payload = {
        user_id: effectiveUserId,
        name: form.name.trim(),
        company_name: form.company_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        tax_id: form.tax_id.trim(),
        payment_terms_days: Number(form.payment_terms_days) || 14,
        notes: form.notes.trim(),
        updated_at: new Date().toISOString(),
      };

      if (editingCustomer) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editingCustomer.id);
        if (error) throw error;
        await logActivity(effectiveUserId, user?.id || effectiveUserId, 'updated', 'customer', editingCustomer.id, `Updated customer ${payload.name}`);
      } else {
        const { data, error } = await supabase.from('customers').insert(payload).select('id').single();
        if (error) throw error;
        await logActivity(effectiveUserId, user?.id || effectiveUserId, 'created', 'customer', data?.id || '', `Added customer ${payload.name}`);
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert('Failed to save customer: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: CustomerRecord) {
    if (!window.confirm(`Delete customer "${c.name}"? Existing invoices will remain intact.`)) return;
    await supabase.from('customers').delete().eq('id', c.id);
    setCustomers((prev) => prev.filter((x) => x.id !== c.id));
  }

  // Match invoices & credit notes to each customer (by customer_id OR case-insensitive name/email)
  function getCustomerFinancials(c: CustomerRecord) {
    const cName = c.name.trim().toLowerCase();
    const cEmail = (c.email || '').trim().toLowerCase();

    const custInvoices = invoices.filter((inv) => {
      if (inv.status === 'cancelled') return false;
      if ((inv as any).customer_id === c.id) return true;
      if (inv.client_name?.trim().toLowerCase() === cName) return true;
      if (cEmail && inv.client_email?.trim().toLowerCase() === cEmail) return true;
      return false;
    });

    const invIds = new Set(custInvoices.map((i) => i.id));
    const custPayments = payments.filter((p) => invIds.has(p.invoice_id));
    const custCredits = creditNotes.filter(
      (cn) =>
        cn.status !== 'void' &&
        cn.status !== 'draft' &&
        (cn.customer_id === c.id ||
          (cn.invoice_id && invIds.has(cn.invoice_id)) ||
          cn.customer_name?.trim().toLowerCase() === cName)
    );

    const totalBilled = custInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
    const totalPaidFromPayments = custPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalPaidFromInvoices = custInvoices.reduce((s, i) => s + (Number(i.amount_paid) || 0), 0);
    const totalPaid = Math.max(totalPaidFromPayments, totalPaidFromInvoices);
    const totalCredited = custCredits.reduce((s, cn) => s + (Number(cn.total) || 0), 0);
    const outstanding = Math.max(0, Math.round((totalBilled - totalPaid - totalCredited) * 100) / 100);

    return { custInvoices, custPayments, custCredits, totalBilled, totalPaid, totalCredited, outstanding };
  }

  const enrichedCustomers = useMemo(() => {
    return customers
      .filter(
        (c) =>
          !search.trim() ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.company_name || '').toLowerCase().includes(search.toLowerCase()) ||
          (c.email || '').toLowerCase().includes(search.toLowerCase())
      )
      .map((c) => ({ customer: c, ...getCustomerFinancials(c) }));
  }, [customers, invoices, payments, creditNotes, search]);

  const totals = useMemo(() => {
    return enrichedCustomers.reduce(
      (acc, r) => ({
        billed: acc.billed + r.totalBilled,
        paid: acc.paid + r.totalPaid,
        outstanding: acc.outstanding + r.outstanding,
      }),
      { billed: 0, paid: 0, outstanding: 0 }
    );
  }, [enrichedCustomers]);

  const activeStatement = useMemo(() => {
    if (!stmtCustomer) return null;
    const fin = getCustomerFinancials(stmtCustomer);
    return buildCustomerStatement({
      invoices: fin.custInvoices,
      payments: fin.custPayments,
      creditNotes: fin.custCredits,
      startDate: stmtStart,
      endDate: stmtEnd,
    });
  }, [stmtCustomer, stmtStart, stmtEnd, invoices, payments, creditNotes]);

  function handleShareStatement() {
    if (!stmtCustomer || !activeStatement) return;
    const biz = profile?.business_name || profile?.full_name || 'ROVA Business';
    const text = [
      `Statement of Account — ${biz}`,
      `Customer: ${stmtCustomer.name}`,
      `Period: ${formatDate(stmtStart)} to ${formatDate(stmtEnd)}`,
      `Opening Balance: ${formatCurrency(activeStatement.openingBalance)}`,
      `Total Billed: ${formatCurrency(activeStatement.totalBilled)}`,
      `Paid & Credited: ${formatCurrency(activeStatement.totalPaid + activeStatement.totalCredited)}`,
      `Balance Due: ${formatCurrency(activeStatement.closingBalance)}`,
    ].join('\n');

    if (navigator.share) {
      navigator.share({ title: `Statement — ${stmtCustomer.name}`, text }).catch(() => {});
    } else if (stmtCustomer.phone) {
      const cleanPhone = stmtCustomer.phone.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
    } else {
      navigator.clipboard.writeText(text);
      alert('Statement summary copied to clipboard!');
    }
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1180, margin: '0 auto', animation: 'fadeIn 0.25s ease' }}>
      {/* Top Sub-Navigation Pill */}
      <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', marginBottom: 20, flexWrap: 'wrap', gap: 2 }}>
        {[
          { label: 'Invoices', to: '/app/invoices' },
          { label: 'Receipts', to: '/app/receipts' },
          { label: 'Customers', to: '/app/customers', active: true },
          { label: 'Credit Notes', to: '/app/credit-notes' },
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
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Customer Directory &amp; Statements</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Track customer balances, billing history, and generate 1-click Statements of Account.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>
          Add Customer
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Total Billed</div>
          <div style={{ fontSize: 21, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(totals.billed)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--success)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Total Collected</div>
          <div style={{ fontSize: 21, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>{formatCurrency(totals.paid)}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--error)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>Outstanding Receivables</div>
          <div style={{ fontSize: 21, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: totals.outstanding > 0 ? 'var(--error)' : 'var(--text-primary)' }}>
            {formatCurrency(totals.outstanding)}
          </div>
        </Card>
      </div>

      {/* Search & Customer List */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers by name, company, or email..."
              style={{
                width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8,
                background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)',
                color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{enrichedCustomers.length} customer{enrichedCustomers.length === 1 ? '' : 's'}</span>
        </div>

        {loading ? (
          <div style={{ padding: 20 }}>
            {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 54, borderRadius: 8, marginBottom: 8 }} />)}
          </div>
        ) : enrichedCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Users size={34} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>No customers added yet</div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
              Add your customers to track balances and send Statements of Account in one click.
            </p>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openNew}>Add First Customer</Button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 740, borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                  <th style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Total Billed</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Total Paid</th>
                  <th style={{ padding: '11px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Outstanding</th>
                  <th style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrichedCustomers.map(({ customer, totalBilled, totalPaid, outstanding }, idx) => (
                  <tr key={customer.id} style={{ borderTop: idx > 0 ? '1px solid var(--bg-border)' : 'none' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {customer.name}
                        {customer.company_name && <span style={{ fontWeight: 500, color: 'var(--text-muted)', marginLeft: 6 }}>· {customer.company_name}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, flexWrap: 'wrap' }}>
                        {customer.email && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={11} /> {customer.email}</span>}
                        {customer.phone && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={11} /> {customer.phone}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: 13.5, fontWeight: 600, fontFamily: 'Space Grotesk, sans-serif' }}>
                      {formatCurrency(totalBilled)}
                    </td>
                    <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: 13.5, fontWeight: 600, color: 'var(--success)', fontFamily: 'Space Grotesk, sans-serif' }}>
                      {formatCurrency(totalPaid)}
                    </td>
                    <td style={{ padding: '14px 12px', textAlign: 'right', fontSize: 14, fontWeight: 800, color: outstanding > 0 ? 'var(--error)' : 'var(--success)', fontFamily: 'Space Grotesk, sans-serif' }}>
                      {formatCurrency(outstanding)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<FileText size={12} />}
                          onClick={() => setStmtCustomer(customer)}
                        >
                          Statement
                        </Button>
                        <button
                          onClick={() => openEdit(customer)}
                          title="Edit customer"
                          style={{ padding: 6, borderRadius: 6, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(customer)}
                          title="Delete customer"
                          style={{ padding: 6, borderRadius: 6, background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
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

      {/* Add / Edit Customer Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingCustomer ? 'Edit Customer' : 'Add Customer'}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Customer Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Chinedu Okafor" required />
          <Input label="Company Name (optional)" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="e.g. Okafor Logistics Ltd" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="client@company.com" />
            <Input label="Phone / WhatsApp" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+2348012345678" />
          </div>
          <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Office or billing address" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="TIN / Tax ID (optional)" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
            <Input label="Payment Terms (days)" type="number" min="0" value={form.payment_terms_days} onChange={(e) => setForm({ ...form, payment_terms_days: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={saving}>{editingCustomer ? 'Save Changes' : 'Add Customer'}</Button>
          </div>
        </form>
      </Modal>

      {/* Statement of Account Modal */}
      <Modal open={!!stmtCustomer} onClose={() => setStmtCustomer(null)} title={`Statement of Account — ${stmtCustomer?.name || ''}`} size="lg">
        {stmtCustomer && activeStatement && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <Input label="From Date" type="date" value={stmtStart} onChange={(e) => setStmtStart(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <Input label="To Date" type="date" value={stmtEnd} onChange={(e) => setStmtEnd(e.target.value)} />
              </div>
              <Button
                variant="primary"
                icon={<Printer size={14} />}
                onClick={() =>
                  openPrintableStatement({
                    businessName: profile?.business_name || profile?.full_name || 'ROVA Business',
                    businessAddress: profile?.address || '',
                    businessPhone: profile?.phone || '',
                    customer: stmtCustomer,
                    startDate: stmtStart,
                    endDate: stmtEnd,
                    statement: activeStatement,
                  })
                }
              >
                Print / PDF
              </Button>
              <Button variant="secondary" icon={<Share2 size={14} />} onClick={handleShareStatement}>
                Share
              </Button>
            </div>

            {/* Summary Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Opening</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', marginTop: 2 }}>{formatCurrency(activeStatement.openingBalance)}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Billed</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', marginTop: 2 }}>{formatCurrency(activeStatement.totalBilled)}</div>
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--success)', textTransform: 'uppercase' }}>Paid &amp; Credited</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)', marginTop: 2 }}>
                  {formatCurrency(activeStatement.totalPaid + activeStatement.totalCredited)}
                </div>
              </div>
              <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--error)', textTransform: 'uppercase' }}>Closing Due</div>
                <div style={{ fontSize: 15, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: activeStatement.closingBalance > 0 ? 'var(--error)' : 'var(--success)', marginTop: 2 }}>
                  {formatCurrency(activeStatement.closingBalance)}
                </div>
              </div>
            </div>

            {/* Statement Lines */}
            <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--bg-border)', borderRadius: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Date</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Type</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>Reference</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Debit</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Credit</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStatement.lines.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                        No invoices, payments, or credit notes in this date range.
                      </td>
                    </tr>
                  ) : (
                    activeStatement.lines.map((line, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--bg-border)' }}>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatDate(line.date)}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{line.type}</td>
                        <td style={{ padding: '8px 10px' }}>{line.reference}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--success)' }}>{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(line.runningBalance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
