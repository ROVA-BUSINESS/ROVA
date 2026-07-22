import { useEffect, useState, type FormEvent } from 'react';
import {
  Plus, Pencil, Trash2, Users, Briefcase, CreditCard,
  Download, Printer, Search, Filter, AlertTriangle
} from 'lucide-react';
import { supabase, type ExternalWorker, type ServiceAgreement, type ContractorPayment } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../lib/format';
import { downloadCSV, printStatementHTML } from '../../lib/export';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useMobile } from '../../hooks/useMobile';

const WORKER_CATEGORIES = [
  'Freelancer',
  'Contractor',
  'Vendor',
  'Consultant',
  'Service Provider',
  'Other'
];

const EXPENSE_CATEGORIES = [
  'Marketing',
  'Technology',
  'Legal',
  'Maintenance',
  'Consulting',
  'Operations',
  'Other'
];

const AGREEMENT_STATUSES = [
  { value: 'active', label: 'Active', variant: 'info' as const },
  { value: 'completed', label: 'Completed', variant: 'success' as const },
  { value: 'cancelled', label: 'Cancelled', variant: 'error' as const },
];

export default function ContractorsTab() {
  const { user, profile } = useAuth();
  const isMobile = useMobile(1024);

  // Data State
  const [workers, setWorkers] = useState<ExternalWorker[]>([]);
  const [agreements, setAgreements] = useState<ServiceAgreement[]>([]);
  const [payments, setPayments] = useState<ContractorPayment[]>([]);
  const [loading, setLoading] = useState(true);

  // Sub Tab State
  const [subTab, setSubTab] = useState<'agreements' | 'workers' | 'payments' | 'reports'>('agreements');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all'); // 'all', 'outstanding', 'paid'

  // Modals State
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<ExternalWorker | null>(null);
  const [workerForm, setWorkerForm] = useState({
    name: '', business_name: '', phone: '', email: '', category: 'Freelancer', custom_category: '', bank_name: '', account_number: '', notes: ''
  });

  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState<ServiceAgreement | null>(null);
  const [agreementForm, setAgreementForm] = useState({
    worker_id: '', title: '', category: 'Freelancer', description: '', agreed_amount: '', start_date: new Date().toISOString().split('T')[0], due_date: '', status: 'active' as ServiceAgreement['status']
  });
  const [createMatchingBill, setCreateMatchingBill] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    agreement_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0], payment_method: 'Bank Transfer', reference_number: '', notes: '', expense_category: 'Technology'
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadAllData();
  }, [user]);

  async function loadAllData() {
    setLoading(true);
    try {
      const [workersRes, agreementsRes, paymentsRes] = await Promise.all([
        supabase.from('external_workers').select('*').eq('user_id', user!.id).order('name'),
        supabase.from('service_agreements').select('*, worker:external_workers(*)').eq('user_id', user!.id).order('created_at', { ascending: false }),
        supabase.from('contractor_payments').select('*').eq('user_id', user!.id).order('payment_date', { ascending: false }),
      ]);

      setWorkers(workersRes.data || []);
      setAgreements(agreementsRes.data || []);
      setPayments(paymentsRes.data || []);
    } catch (err) {
      console.error('Failed to load contractor data:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- Helper Calculations ---
  const getAgreementsPaidAmount = (agreementId: string) => {
    return payments
      .filter(p => p.agreement_id === agreementId)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  };

  const getAgreementOutstanding = (agreement: ServiceAgreement) => {
    const paid = getAgreementsPaidAmount(agreement.id);
    return Math.max(0, Number(agreement.agreed_amount) - paid);
  };

  // --- Worker Actions ---
  function openNewWorker() {
    setEditingWorker(null);
    setWorkerForm({ name: '', business_name: '', phone: '', email: '', category: 'Freelancer', custom_category: '', bank_name: '', account_number: '', notes: '' });
    setShowWorkerModal(true);
  }

  function openEditWorker(worker: ExternalWorker) {
    setEditingWorker(worker);
    const isCustom = !WORKER_CATEGORIES.includes(worker.category);
    setWorkerForm({
      name: worker.name,
      business_name: worker.business_name || '',
      phone: worker.phone || '',
      email: worker.email || '',
      category: isCustom ? 'Other' : worker.category,
      custom_category: isCustom ? worker.category : '',
      bank_name: worker.bank_name || '',
      account_number: worker.account_number || '',
      notes: worker.notes || '',
    });
    setShowWorkerModal(true);
  }

  async function handleWorkerSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const categoryVal = workerForm.category === 'Other' && workerForm.custom_category.trim()
      ? workerForm.custom_category.trim()
      : workerForm.category;

    const payload = {
      name: workerForm.name,
      business_name: workerForm.business_name || null,
      phone: workerForm.phone || null,
      email: workerForm.email || null,
      category: categoryVal,
      bank_name: workerForm.bank_name || null,
      account_number: workerForm.account_number || null,
      notes: workerForm.notes || null,
      user_id: user!.id,
    };

    try {
      if (editingWorker) {
        await supabase.from('external_workers').update(payload).eq('id', editingWorker.id);
      } else {
        await supabase.from('external_workers').insert(payload);
      }
      setShowWorkerModal(false);
      loadAllData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleWorkerDelete(id: string) {
    if (!confirm('Are you sure you want to delete this worker? This will also delete all their service agreements and payments.')) return;
    try {
      await supabase.from('external_workers').delete().eq('id', id);
      loadAllData();
    } catch (err) {
      console.error(err);
    }
  }

  // --- Agreement Actions ---
  function openNewAgreement() {
    setEditingAgreement(null);
    setAgreementForm({
      worker_id: workers[0]?.id || '',
      title: '',
      category: 'Freelancer',
      description: '',
      agreed_amount: '',
      start_date: new Date().toISOString().split('T')[0],
      due_date: '',
      status: 'active',
    });
    setCreateMatchingBill(false);
    setShowAgreementModal(true);
  }

  function openEditAgreement(agreement: ServiceAgreement) {
    setEditingAgreement(agreement);
    setAgreementForm({
      worker_id: agreement.worker_id,
      title: agreement.title,
      category: agreement.category,
      description: agreement.description || '',
      agreed_amount: String(agreement.agreed_amount),
      start_date: agreement.start_date || '',
      due_date: agreement.due_date || '',
      status: agreement.status,
    });
    setShowAgreementModal(true);
  }

  async function handleAgreementSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      worker_id: agreementForm.worker_id,
      title: agreementForm.title,
      category: agreementForm.category,
      description: agreementForm.description || null,
      agreed_amount: Number(agreementForm.agreed_amount),
      start_date: agreementForm.start_date || null,
      due_date: agreementForm.due_date || null,
      status: agreementForm.status,
      user_id: user!.id,
    };

    try {
      if (editingAgreement) {
        await supabase.from('service_agreements').update(payload).eq('id', editingAgreement.id);
      } else {
        const { data: newAgreement, error: agreementError } = await supabase
          .from('service_agreements')
          .insert(payload)
          .select()
          .single();
        if (agreementError) throw agreementError;

        if (createMatchingBill && newAgreement) {
          const worker = workers.find(w => w.id === agreementForm.worker_id);

          // Get or create category
          let categoryId = null;
          const { data: existingCat } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', user!.id)
            .eq('name', agreementForm.category)
            .eq('type', 'expense')
            .maybeSingle();

          if (existingCat) {
            categoryId = existingCat.id;
          } else {
            const { data: newCat } = await supabase
              .from('categories')
              .insert({
                user_id: user!.id,
                name: agreementForm.category,
                type: 'expense',
                icon: 'briefcase',
                color: '#a855f7',
              })
              .select('id')
              .maybeSingle();
            categoryId = newCat?.id || null;
          }

          const today = new Date().toISOString().split('T')[0];
          const initialStatus = agreementForm.due_date && agreementForm.due_date < today ? 'overdue' : 'unpaid';

          await supabase.from('bills').insert({
            user_id: user!.id,
            bill_number: `BILL-${Date.now().toString().slice(-6)}`,
            vendor: worker?.name || 'Contractor',
            description: agreementForm.description || `Bill for Service Agreement: ${agreementForm.title}`,
            bill_date: agreementForm.start_date || today,
            due_date: agreementForm.due_date || today,
            amount: Number(agreementForm.agreed_amount),
            category_id: categoryId,
            status: initialStatus,
            notes: `Auto-generated matching bill for agreement: ${agreementForm.title}`,
            agreement_id: newAgreement.id
          });
        }
      }
      setShowAgreementModal(false);
      loadAllData();
    } catch (err) {
      console.error(err);
      alert('Failed to save agreement. Please check inputs.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAgreementDelete(id: string) {
    if (!confirm('Are you sure you want to delete this service agreement? All associated payment logs and transactions will be deleted.')) return;
    try {
      // Find payments to delete corresponding transactions first
      const associatedPayments = payments.filter(p => p.agreement_id === id);
      const txIds = associatedPayments.map(p => p.transaction_id).filter(Boolean) as string[];
      
      if (txIds.length > 0) {
        await supabase.from('transactions').delete().in('id', txIds);
      }
      await supabase.from('service_agreements').delete().eq('id', id);
      loadAllData();
    } catch (err) {
      console.error(err);
    }
  }

  // --- Payment Actions ---
  function openRecordPayment(agreementId?: string) {
    setPaymentForm({
      agreement_id: agreementId || agreements.filter(a => a.status === 'active')[0]?.id || '',
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Bank Transfer',
      reference_number: '',
      notes: '',
      expense_category: 'Technology',
    });
    setShowPaymentModal(true);
  }

  async function handlePaymentSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    const agreement = agreements.find(a => a.id === paymentForm.agreement_id);
    const worker = workers.find(w => w.id === agreement?.worker_id);

    if (!agreement) {
      alert('Please select a valid service agreement.');
      setSaving(false);
      return;
    }

    try {
      // 1. Get or Create Expense Category
      let categoryId = null;
      const { data: existingCat } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user!.id)
        .eq('name', paymentForm.expense_category)
        .eq('type', 'expense')
        .maybeSingle();

      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const { data: newCat } = await supabase
          .from('categories')
          .insert({
            user_id: user!.id,
            name: paymentForm.expense_category,
            type: 'expense',
            icon: 'briefcase',
            color: '#a855f7',
          })
          .select('id')
          .maybeSingle();
        categoryId = newCat?.id || null;
      }

      // 2. Create Transaction Expense
      const txDescription = `Contractor Payment: ${agreement.title} - ${worker?.name || 'External Worker'}`;
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          amount: Number(paymentForm.amount),
          type: 'expense',
          description: txDescription,
          date: paymentForm.payment_date,
          category_id: categoryId,
          notes: paymentForm.notes || 'Recorded via contractor payroll module',
          reference: paymentForm.reference_number || undefined,
        })
        .select('id')
        .maybeSingle();

      if (txError) throw txError;

      // 3. Record Contractor Payment
      await supabase.from('contractor_payments').insert({
        user_id: user!.id,
        agreement_id: paymentForm.agreement_id,
        payment_date: paymentForm.payment_date,
        amount: Number(paymentForm.amount),
        payment_method: paymentForm.payment_method,
        reference_number: paymentForm.reference_number || null,
        notes: paymentForm.notes || null,
        transaction_id: tx?.id || null,
      });

      // 4. Update status of agreement if fully paid
      const currentlyPaid = getAgreementsPaidAmount(agreement.id) + Number(paymentForm.amount);
      if (currentlyPaid >= Number(agreement.agreed_amount) && agreement.status === 'active') {
        await supabase.from('service_agreements').update({ status: 'completed' }).eq('id', agreement.id);
      }

      setShowPaymentModal(false);
      loadAllData();
    } catch (err) {
      console.error('Payment logging failed:', err);
      alert('Failed to log payment. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePaymentDelete(payment: ContractorPayment) {
    if (!confirm('Are you sure you want to delete this payment record? This will also delete the associated expense transaction.')) return;
    try {
      if (payment.transaction_id) {
        await supabase.from('transactions').delete().eq('id', payment.transaction_id);
      }
      await supabase.from('contractor_payments').delete().eq('id', payment.id);
      loadAllData();
    } catch (err) {
      console.error(err);
    }
  }

  // --- Filtering Logic ---
  const filteredAgreements = agreements.filter(agreement => {
    const workerName = agreement.worker?.name || '';
    const matchesSearch =
      agreement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workerName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || agreement.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || agreement.status === statusFilter;

    let matchesPayment = true;
    const outstanding = getAgreementOutstanding(agreement);
    if (paymentFilter === 'outstanding') {
      matchesPayment = outstanding > 0;
    } else if (paymentFilter === 'paid') {
      matchesPayment = outstanding === 0 && Number(agreement.agreed_amount) > 0;
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesPayment;
  });

  const filteredWorkers = workers.filter(worker => {
    const matchesSearch =
      worker.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (worker.business_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || worker.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // --- Dashboard Overview Stats ---
  const activeAgreements = agreements.filter(a => a.status === 'active');
  const completedAgreements = agreements.filter(a => a.status === 'completed');
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const paidThisMonth = payments
    .filter(p => {
      const pDate = new Date(p.payment_date);
      return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
    })
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const totalOutstandingBalance = agreements
    .filter(a => a.status !== 'cancelled')
    .reduce((sum, a) => sum + getAgreementOutstanding(a), 0);

  // --- Approaching & Overdue Alert Alerts ---
  const outstandingAgreementsAlerts = agreements.filter(a => {
    if (a.status !== 'active') return false;
    const outstanding = getAgreementOutstanding(a);
    if (outstanding === 0) return false;
    return true;
  });

  // --- Report Generations ---
  const businessName = profile?.business_name || profile?.full_name || 'My Business';

  function handleReportCSV(type: 'payments' | 'outstanding' | 'cost') {
    if (type === 'payments') {
      const rows = payments.map(p => {
        const agreement = agreements.find(a => a.id === p.agreement_id);
        const worker = workers.find(w => w.id === agreement?.worker_id);
        return [worker?.name || '—', agreement?.title || '—', p.payment_date, p.payment_method || '—', p.amount];
      });
      downloadCSV('External_Payments_Report.csv', ['Worker', 'Service Title', 'Payment Date', 'Method', 'Amount (NGN)'], rows);
    } else if (type === 'outstanding') {
      const rows = agreements
        .filter(a => a.status !== 'cancelled' && getAgreementOutstanding(a) > 0)
        .map(a => {
          const worker = workers.find(w => w.id === a.worker_id);
          return [worker?.name || '—', a.title, a.agreed_amount, getAgreementOutstanding(a), a.due_date || '—'];
        });
      downloadCSV('Outstanding_Payments_Report.csv', ['Worker', 'Service Title', 'Agreed Amount', 'Outstanding (NGN)', 'Due Date'], rows);
    } else if (type === 'cost') {
      const rows = agreements.map(a => {
        const worker = workers.find(w => w.id === a.worker_id);
        return [a.title, worker?.name || '—', a.agreed_amount, getAgreementsPaidAmount(a.id), a.status];
      });
      downloadCSV('Service_Cost_Report.csv', ['Service Title', 'Worker', 'Agreed Amount (NGN)', 'Total Paid', 'Status'], rows);
    }
  }

  function handleReportPrint(type: 'payments' | 'outstanding' | 'cost') {
    let title = '';
    let html = '';

    if (type === 'payments') {
      title = 'External Payments Report';
      const itemsHtml = payments.map(p => {
        const agreement = agreements.find(a => a.id === p.agreement_id);
        const worker = workers.find(w => w.id === agreement?.worker_id);
        return `
          <tr class="line-row">
            <td>${worker?.name || '—'}</td>
            <td>${agreement?.title || '—'}</td>
            <td>${formatDate(p.payment_date)}</td>
            <td>${p.payment_method || '—'}</td>
            <td class="amount neutral">${formatCurrency(p.amount)}</td>
          </tr>
        `;
      }).join('');
      
      html = `
        <table>
          <tr class="section-header">
            <td>Worker</td>
            <td>Service</td>
            <td>Date</td>
            <td>Method</td>
            <td style="text-align:right">Amount</td>
          </tr>
          ${itemsHtml || '<tr><td colspan="5" style="text-align:center;padding:12px">No payment records</td></tr>'}
        </table>
      `;
    } else if (type === 'outstanding') {
      title = 'Outstanding Payments Report';
      const itemsHtml = agreements
        .filter(a => a.status !== 'cancelled' && getAgreementOutstanding(a) > 0)
        .map(a => {
          const worker = workers.find(w => w.id === a.worker_id);
          return `
            <tr class="line-row">
              <td>${worker?.name || '—'}</td>
              <td>${a.title}</td>
              <td>${formatCurrency(a.agreed_amount)}</td>
              <td>${formatDate(a.due_date || '')}</td>
              <td class="amount negative">${formatCurrency(getAgreementOutstanding(a))}</td>
            </tr>
          `;
        }).join('');

      html = `
        <table>
          <tr class="section-header">
            <td>Worker</td>
            <td>Service</td>
            <td>Agreed Amount</td>
            <td>Due Date</td>
            <td style="text-align:right">Outstanding</td>
          </tr>
          ${itemsHtml || '<tr><td colspan="5" style="text-align:center;padding:12px">No outstanding payments</td></tr>'}
        </table>
      `;
    } else if (type === 'cost') {
      title = 'Service Cost Report';
      const itemsHtml = agreements.map(a => {
        const worker = workers.find(w => w.id === a.worker_id);
        return `
          <tr class="line-row">
            <td>${a.title}</td>
            <td>${worker?.name || '—'}</td>
            <td>${formatCurrency(a.agreed_amount)}</td>
            <td>${formatCurrency(getAgreementsPaidAmount(a.id))}</td>
            <td style="text-transform: capitalize">${a.status}</td>
          </tr>
        `;
      }).join('');

      html = `
        <table>
          <tr class="section-header">
            <td>Service Title</td>
            <td>Worker</td>
            <td>Agreed Amount</td>
            <td>Paid Amount</td>
            <td>Status</td>
          </tr>
          ${itemsHtml || '<tr><td colspan="5" style="text-align:center;padding:12px">No agreements records</td></tr>'}
        </table>
      `;
    }

    printStatementHTML(title, `As of ${formatDate(new Date().toISOString().split('T')[0])}`, businessName, html);
  }

  // Categories list collected from all resources to support custom categories in filtering
  const allUsedCategories = Array.from(new Set([
    ...WORKER_CATEGORIES,
    ...workers.map(w => w.category),
    ...agreements.map(a => a.category)
  ])).filter(Boolean);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: 64, borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* 1. Overview Widgets */}
      <div className="mobile-grid-2 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Workers', value: workers.length, color: 'var(--text-primary)', bg: 'var(--bg-elevated)' },
          { label: 'Active Services', value: activeAgreements.length, color: 'var(--info)', bg: 'var(--info-dim)' },
          { label: 'Completed Services', value: completedAgreements.length, color: 'var(--success)', bg: 'var(--success-dim)' },
          { label: 'Paid This Month', value: formatCurrency(paidThisMonth), color: 'var(--success)', bg: 'var(--success-dim)' },
          { label: 'Total Outstanding', value: formatCurrency(totalOutstandingBalance), color: 'var(--error)', bg: 'var(--error-dim)' },
        ].map((s, idx) => (
          <Card key={idx} style={{ background: s.bg, border: '1px solid var(--bg-border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
            <div style={{ fontSize: typeof s.value === 'string' ? 17 : 24, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: s.color }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* 2. Notifications & Due Alarms Banner */}
      {outstandingAgreementsAlerts.map(agreement => {
        const outstanding = getAgreementOutstanding(agreement);
        const workerName = agreement.worker?.name || 'Worker';
        const due = agreement.due_date ? new Date(agreement.due_date) : null;
        if (!due) return null;
        
        const daysToDue = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const isOverdue = daysToDue < 0;

        if (isOverdue) {
          return (
            <div key={agreement.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 12, color: 'var(--error)', fontSize: 13 }}>
              <AlertTriangle size={16} />
              <span>
                <strong>Overdue payment:</strong> Service <strong>"{agreement.title}"</strong> for <strong>{workerName}</strong> has an outstanding balance of <strong>{formatCurrency(outstanding)}</strong> and was due on {formatDate(agreement.due_date!)}.
              </span>
            </div>
          );
        } else if (daysToDue <= 7) {
          return (
            <div key={agreement.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--warning-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', marginBottom: 12, color: 'var(--warning)', fontSize: 13 }}>
              <AlertTriangle size={16} />
              <span>
                <strong>Deadline approaching:</strong> Service <strong>"{agreement.title}"</strong> for <strong>{workerName}</strong> is due in {daysToDue} day{daysToDue > 1 ? 's' : ''} ({formatDate(agreement.due_date!)}) with an outstanding balance of <strong>{formatCurrency(outstanding)}</strong>.
              </span>
            </div>
          );
        }
        return null;
      })}

      {/* 3. Sub Tabs & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 4 }}>
          {([
            { key: 'agreements', label: 'Service Agreements' },
            { key: 'workers', label: 'Contractors' },
            { key: 'payments', label: 'Payments Log' },
            { key: 'reports', label: 'Reports' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setSubTab(t.key)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 500,
                background: subTab === t.key ? 'var(--bg-card)' : 'transparent',
                color: subTab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'all 0.15s', border: subTab === t.key ? '1px solid var(--bg-border)' : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {subTab === 'workers' && (
            <Button variant="primary" icon={<Plus size={14} />} onClick={openNewWorker}>Add Contractor</Button>
          )}
          {subTab === 'agreements' && (
            <Button variant="primary" icon={<Plus size={14} />} onClick={openNewAgreement}>Create Agreement</Button>
          )}
          {(subTab === 'agreements' || subTab === 'payments') && agreements.length > 0 && (
            <Button variant="success" icon={<CreditCard size={14} />} onClick={() => openRecordPayment()}>Record Payment</Button>
          )}
        </div>
      </div>

      {/* 4. Search and Filters */}
      {subTab !== 'reports' && (
        <Card style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 12 }} />
              <input
                type="text"
                placeholder={subTab === 'workers' ? "Search contractors..." : "Search agreements..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px 8px 32px', background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Category Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Filter size={12} color="var(--text-muted)" />
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                  style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}>
                  <option value="all">All Categories</option>
                  {allUsedCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              {subTab === 'agreements' && (
                <>
                  {/* Status Filter */}
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}>
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  {/* Payment Status Filter */}
                  <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
                    style={{ padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}>
                    <option value="all">All Payment Statuses</option>
                    <option value="outstanding">Outstanding Balance</option>
                    <option value="paid">Fully Paid</option>
                  </select>
                </>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* 5. Sub-view Render Blocks */}
      {subTab === 'agreements' && (
        filteredAgreements.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <Briefcase size={36} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No service agreements found</p>
              {workers.length > 0 && (
                <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4, marginBottom: 16 }}>Create your first service agreement to begin tracking contractor payments</p>
              )}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            {filteredAgreements.map(agreement => {
              const paid = getAgreementsPaidAmount(agreement.id);
              const outstanding = getAgreementOutstanding(agreement);
              const percentPaid = agreement.agreed_amount > 0 ? Math.min(100, (paid / agreement.agreed_amount) * 100) : 0;
              const workerName = agreement.worker?.name || 'Worker deleted';

              return (
                <Card key={agreement.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{agreement.category}</span>
                        <Badge variant={AGREEMENT_STATUSES.find(s => s.value === agreement.status)?.variant || 'default'}>{agreement.status}</Badge>
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 6, color: 'var(--text-primary)' }}>{agreement.title}</h3>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Provider: <strong>{workerName}</strong></p>
                    </div>

                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEditAgreement(agreement)}
                        style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}
                        className="btn-hover"
                      ><Pencil size={12} /></button>
                      <button onClick={() => handleAgreementDelete(agreement.id)}
                        style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}
                        className="btn-hover-danger"
                      ><Trash2 size={12} /></button>
                    </div>
                  </div>

                  {agreement.description && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', background: 'var(--bg-elevated)', padding: 8, borderRadius: 6 }}>{agreement.description}</p>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Agreed Amount</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', marginTop: 2 }}>{formatCurrency(agreement.agreed_amount)}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-muted)' }}>Outstanding</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: outstanding > 0 ? 'var(--error)' : 'var(--success)', marginTop: 2 }}>{formatCurrency(outstanding)}</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                      <span>Paid: {formatCurrency(paid)}</span>
                      <span>{percentPaid.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${percentPaid}%`, height: '100%', background: 'var(--success)', borderRadius: 999, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--bg-border)', paddingTop: 10, marginTop: 4 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {agreement.start_date && <span>Start: {formatDate(agreement.start_date)}</span>}
                      {agreement.due_date && <span>Due: {formatDate(agreement.due_date)}</span>}
                    </div>
                    {agreement.status === 'active' && outstanding > 0 && (
                      <button
                        onClick={() => openRecordPayment(agreement.id)}
                        style={{ background: 'var(--success-dim)', color: 'var(--success)', border: 'none', padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', fontSize: 11 }}
                      >Pay Contractor</button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {subTab === 'workers' && (
        filteredWorkers.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <Users size={36} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No contractors found</p>
            </div>
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div className="mobile-table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                    {[{ label: 'Name' }, { label: 'Category' }, { label: 'Bank Details', hideMobile: true }, { label: 'Notes', hideMobile: true }, { label: '' }].map(h => (
                      <th key={h.label} className={h.hideMobile ? 'mobile-hide' : ''} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkers.map(worker => (
                    <tr key={worker.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{worker.name}</div>
                        {worker.business_name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{worker.business_name}</div>}
                        <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                          {worker.email && <span>{worker.email}</span>}
                          {worker.phone && <span>{worker.phone}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge variant="default">{worker.category}</Badge>
                      </td>
                      <td className="mobile-hide" style={{ padding: '12px 16px' }}>
                        {worker.bank_name ? (
                          <div>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{worker.bank_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{worker.account_number}</div>
                          </div>
                        ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}
                      </td>
                      <td className="mobile-hide" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {worker.notes || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button onClick={() => openEditWorker(worker)}
                            style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}
                            className="btn-hover"
                          ><Pencil size={12} /></button>
                          <button onClick={() => handleWorkerDelete(worker.id)}
                            style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}
                            className="btn-hover-danger"
                          ><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {subTab === 'payments' && (
        payments.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <CreditCard size={36} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No contractor payments logged yet</p>
            </div>
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div className="mobile-table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                    {[{ label: 'Agreement / Service' }, { label: 'Payment Date' }, { label: 'Method / Ref', hideMobile: true }, { label: 'Amount' }, { label: 'Notes', hideMobile: true }, { label: '' }].map(h => (
                      <th key={h.label} className={h.hideMobile ? 'mobile-hide' : ''} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map(payment => {
                    const agreement = agreements.find(a => a.id === payment.agreement_id);
                    const worker = workers.find(w => w.id === agreement?.worker_id);
                    return (
                      <tr key={payment.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{agreement?.title || 'Agreement deleted'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Contractor: {worker?.name || 'Worker deleted'}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-primary)' }}>
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="mobile-hide" style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{payment.payment_method}</div>
                          {payment.reference_number && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>Ref: {payment.reference_number}</div>}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="mobile-hide" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {payment.notes || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button onClick={() => handlePaymentDelete(payment)}
                            style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)' }}
                            className="btn-hover-danger"
                          ><Trash2 size={12} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {subTab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            {
              id: 'payments' as const,
              title: 'External Payment Report',
              desc: 'Lists all payments logged, showing the contractor, service agreement, and payment methods.',
            },
            {
              id: 'outstanding' as const,
              title: 'Outstanding Payments Report',
              desc: 'Shows all active service agreements with outstanding balances and their due dates.',
            },
            {
              id: 'cost' as const,
              title: 'Service Cost Report',
              desc: 'Details all agreements, showing the total agreed cost, total paid, outstanding balance, and status.',
            }
          ].map(rep => (
            <Card key={rep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{rep.title}</h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{rep.desc}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="secondary" icon={<Download size={13} />} onClick={() => handleReportCSV(rep.id)}>Export CSV</Button>
                <Button variant="primary" icon={<Printer size={13} />} onClick={() => handleReportPrint(rep.id)}>Print PDF</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* --- Worker Modal --- */}
      <Modal open={showWorkerModal} onClose={() => setShowWorkerModal(false)} title={editingWorker ? 'Edit Contractor' : 'Add Contractor'} size="lg">
        <form onSubmit={handleWorkerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Input label="Name" placeholder="Full Name or Business Name" value={workerForm.name} onChange={e => setWorkerForm(p => ({ ...p, name: e.target.value }))} required />
            <Input label="Business Name (optional)" placeholder="John Solutions Ltd" value={workerForm.business_name} onChange={e => setWorkerForm(p => ({ ...p, business_name: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Input label="Email" type="email" placeholder="john@example.com" value={workerForm.email} onChange={e => setWorkerForm(p => ({ ...p, email: e.target.value }))} />
            <Input label="Phone Number" placeholder="08000000000" value={workerForm.phone} onChange={e => setWorkerForm(p => ({ ...p, phone: e.target.value }))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Service Category</label>
              <select value={workerForm.category} onChange={e => setWorkerForm(p => ({ ...p, category: e.target.value }))}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
                {WORKER_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            {workerForm.category === 'Other' && (
              <Input label="Custom Category Name" placeholder="e.g. Electrician, Cleaner" value={workerForm.custom_category} onChange={e => setWorkerForm(p => ({ ...p, custom_category: e.target.value }))} required />
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Input label="Bank Name" placeholder="Access Bank" value={workerForm.bank_name} onChange={e => setWorkerForm(p => ({ ...p, bank_name: e.target.value }))} />
            <Input label="Account Number" placeholder="10-digit number" value={workerForm.account_number} onChange={e => setWorkerForm(p => ({ ...p, account_number: e.target.value }))} />
          </div>

          <Input label="Notes" placeholder="Additional details..." value={workerForm.notes} onChange={e => setWorkerForm(p => ({ ...p, notes: e.target.value }))} />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 6 }}>
            <Button variant="secondary" type="button" onClick={() => setShowWorkerModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">{editingWorker ? 'Save Changes' : 'Add Contractor'}</Button>
          </div>
        </form>
      </Modal>

      {/* --- Agreement Modal --- */}
      <Modal open={showAgreementModal} onClose={() => setShowAgreementModal(false)} title={editingAgreement ? 'Edit Agreement' : 'Create Service Agreement'} size="lg">
        <form onSubmit={handleAgreementSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Service Provider (Contractor)</label>
              <select value={agreementForm.worker_id} onChange={e => setAgreementForm(p => ({ ...p, worker_id: e.target.value }))} required
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="" disabled>Select Contractor</option>
                {workers.map(w => <option key={w.id} value={w.id}>{w.name} ({w.category})</option>)}
              </select>
            </div>
            <Input label="Service Title" placeholder="e.g. Website Development" value={agreementForm.title} onChange={e => setAgreementForm(p => ({ ...p, title: e.target.value }))} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Service Category</label>
              <select value={agreementForm.category} onChange={e => setAgreementForm(p => ({ ...p, category: e.target.value }))}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
                {allUsedCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <Input label="Agreed Amount (₦)" type="number" min="0" step="0.01" placeholder="0.00" value={agreementForm.agreed_amount} onChange={e => setAgreementForm(p => ({ ...p, agreed_amount: e.target.value }))} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12 }}>
            <Input label="Start Date" type="date" value={agreementForm.start_date} onChange={e => setAgreementForm(p => ({ ...p, start_date: e.target.value }))} />
            <Input label="Due Date" type="date" value={agreementForm.due_date} onChange={e => setAgreementForm(p => ({ ...p, due_date: e.target.value }))} required />
            {editingAgreement && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Agreement Status</label>
                <select value={agreementForm.status} onChange={e => setAgreementForm(p => ({ ...p, status: e.target.value as ServiceAgreement['status'] }))}
                  style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            )}
          </div>

          <Input label="Description of Service" placeholder="Describe agreed milestones, deliverables, etc." value={agreementForm.description} onChange={e => setAgreementForm(p => ({ ...p, description: e.target.value }))} />

          {!editingAgreement && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, userSelect: 'none', color: 'var(--text-primary)', marginTop: 4 }}>
              <input
                type="checkbox"
                checked={createMatchingBill}
                onChange={e => setCreateMatchingBill(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              Create a matching unpaid bill for this agreement
            </label>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 6 }}>
            <Button variant="secondary" type="button" onClick={() => setShowAgreementModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">{editingAgreement ? 'Save Changes' : 'Create Agreement'}</Button>
          </div>
        </form>
      </Modal>

      {/* --- Payment Modal --- */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title="Record Contractor Payment" size="lg">
        <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Service Agreement (Job)</label>
            <select value={paymentForm.agreement_id} onChange={e => setPaymentForm(p => ({ ...p, agreement_id: e.target.value }))} required
              style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="" disabled>Select Job Agreement</option>
              {agreements
                .filter(a => a.status === 'active')
                .map(a => {
                  const worker = workers.find(w => w.id === a.worker_id);
                  const outstanding = getAgreementOutstanding(a);
                  return (
                    <option key={a.id} value={a.id}>
                      {a.title} (Outstanding: {formatCurrency(outstanding)} · Contractor: {worker?.name || '—'})
                    </option>
                  );
                })}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Input label="Payment Amount (₦)" type="number" min="0.01" step="0.01" placeholder="0.00" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} required />
            <Input label="Payment Date" type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Expense Category (Integration)</label>
              <select value={paymentForm.expense_category} onChange={e => setPaymentForm(p => ({ ...p, expense_category: e.target.value }))}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
                {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Payment Method</label>
              <select value={paymentForm.payment_method} onChange={e => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Card Payment">Card Payment</option>
                <option value="Cheque">Cheque</option>
                <option value="Mobile Wallet">Mobile Wallet</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Input label="Reference Number" placeholder="Ref / Tx Hash / Cheque No" value={paymentForm.reference_number} onChange={e => setPaymentForm(p => ({ ...p, reference_number: e.target.value }))} />
            <Input label="Notes" placeholder="Payment details or memo" value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 6 }}>
            <Button variant="secondary" type="button" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
            <Button variant="success" loading={saving} type="submit">Record Payment</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
