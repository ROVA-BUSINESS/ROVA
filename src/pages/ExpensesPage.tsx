import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, TrendingDown, Search, Download, CreditCard, Clock, AlertTriangle, CheckCircle, Eye, Printer, Calendar
} from 'lucide-react';
import { supabase, type Expense, type Account, type Bill, type ServiceAgreement } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/format';
import { downloadCSV, printStatementHTML } from '../lib/export';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { useMobile } from '../hooks/useMobile';
import { ReceiptUploader } from '../components/ui/ReceiptUploader';

const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Internet',
  'Marketing',
  'Transportation',
  'Fuel',
  'Salaries',
  'Professional Services',
  'Technology',
  'Maintenance',
  'Office Supplies',
  'Other'
];

const BILL_CATEGORIES = [
  'Rent',
  'Utilities',
  'Internet',
  'Marketing',
  'Transportation',
  'Fuel',
  'Salaries',
  'Professional Services',
  'Technology',
  'Maintenance',
  'Office Supplies',
  'Other'
];

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Card', 'Mobile Money', 'Other'];

export default function ExpensesPage() {
  const { user } = useAuth();
  const isMobile = useMobile(1024);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  // Main Tab Selection
  const [mainTab, setMainTab] = useState<'expenses' | 'bills'>(
    tabParam === 'bills' ? 'bills' : 'expenses'
  );

  // Core Data States
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<ServiceAgreement[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Expenses Tab States ---
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    category: 'Rent',
    custom_category: '',
    amount: '',
    payment_method: 'Bank Transfer',
    account_id: '',
    description: '',
    attachment_url: ''
  });

  // --- Bills Tab States ---
  const [billsActiveSubTab, setBillsActiveSubTab] = useState<'bills' | 'payments' | 'reports'>('bills');
  const [billsSearchQuery, setBillsSearchQuery] = useState('');
  const [billsStatusFilter, setBillsStatusFilter] = useState<'all' | 'unpaid' | 'partially_paid' | 'overdue' | 'paid'>('all');
  const [billsCategoryFilter, setBillsCategoryFilter] = useState('all');

  const [showBillModal, setShowBillModal] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [savingBill, setSavingBill] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [savingPayment, setSavingPayment] = useState(false);

  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingBill, setViewingBill] = useState<Bill | null>(null);

  const [billForm, setBillForm] = useState({
    bill_number: '',
    vendor: '',
    description: '',
    bill_date: new Date().toISOString().split('T')[0],
    due_date: '',
    amount: '',
    category: 'Technology',
    custom_category: '',
    notes: '',
    attachment_url: '',
    link_agreement: false,
    agreement_id: ''
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'Bank Transfer',
    account_id: '',
    reference_number: '',
    notes: ''
  });

  // Listen to tabParam change
  useEffect(() => {
    if (tabParam === 'bills') {
      setMainTab('bills');
    } else if (tabParam === 'expenses') {
      setMainTab('expenses');
    }
  }, [tabParam]);

  const handleMainTabChange = (tab: 'expenses' | 'bills') => {
    setMainTab(tab);
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    try {
      const [expRes, accRes, catRes, billsRes, agreementsRes, paymentsRes] = await Promise.all([
        supabase.from('expenses').select('*, category:categories(*), account:accounts(*)').eq('user_id', user!.id).order('date', { ascending: false }),
        supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true),
        supabase.from('categories').select('*').or(`user_id.eq.${user!.id},is_system.eq.true`),
        supabase.from('bills').select('*, category:categories(*), agreement:service_agreements(*), bill_payments(*)').eq('user_id', user!.id).order('due_date', { ascending: true }),
        supabase.from('service_agreements').select('*, worker:external_workers(*)').eq('user_id', user!.id).eq('status', 'active'),
        supabase.from('bill_payments').select('*, bill:bills(*)').eq('user_id', user!.id).order('payment_date', { ascending: false })
      ]);

      setExpenses(expRes.data || []);
      setAccounts(accRes.data || []);
      setCategories(catRes.data || []);
      setBills(billsRes.data || []);
      setAgreements(agreementsRes.data || []);
      setPayments(paymentsRes.data || []);

      // Defaults
      if (accRes.data && accRes.data.length > 0) {
        setForm(f => ({ ...f, account_id: accRes.data[0].id }));
        setPaymentForm(p => ({ ...p, account_id: accRes.data[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // --- Expenses Actions ---
  function openNewExpense() {
    setEditingExpense(null);
    setForm({
      date: new Date().toISOString().split('T')[0],
      vendor: '',
      category: 'Rent',
      custom_category: '',
      amount: '',
      payment_method: 'Bank Transfer',
      account_id: accounts[0]?.id || '',
      description: '',
      attachment_url: ''
    });
    setShowModal(true);
  }

  function openEditExpense(exp: Expense) {
    setEditingExpense(exp);
    const isCustom = exp.category ? !DEFAULT_EXPENSE_CATEGORIES.includes(exp.category.name) : false;
    setForm({
      date: exp.date,
      vendor: exp.vendor,
      category: isCustom ? 'Other' : (exp.category?.name || 'Other'),
      custom_category: isCustom ? (exp.category?.name || '') : '',
      amount: String(exp.amount),
      payment_method: exp.payment_method || 'Bank Transfer',
      account_id: exp.account_id || '',
      description: exp.description || '',
      attachment_url: exp.attachment_url || ''
    });
    setShowModal(true);
  }

  async function handleExpenseSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    const amountVal = Number(form.amount);
    const categoryName = form.category === 'Other' && form.custom_category.trim()
      ? form.custom_category.trim()
      : form.category;

    try {
      // 1. Get or Create Category
      let catId = null;
      const matchedCat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase() && c.type === 'expense');
      if (matchedCat) {
        catId = matchedCat.id;
      } else {
        const { data: newCat } = await supabase
          .from('categories')
          .insert({
            user_id: user!.id,
            name: categoryName,
            type: 'expense',
            icon: 'briefcase',
            color: '#a855f7',
            is_system: false
          })
          .select()
          .single();
        if (newCat) {
          catId = newCat.id;
          setCategories(prev => [...prev, newCat]);
        }
      }

      // 2. Insert/Update Transaction
      let txId = editingExpense?.transaction_id || null;
      const txDescription = `Expense: ${categoryName} - ${form.vendor}`;
      
      if (txId) {
        await supabase
          .from('transactions')
          .update({
            amount: amountVal,
            description: txDescription,
            date: form.date,
            category_id: catId,
            account_id: form.account_id || null,
            notes: form.description || null
          })
          .eq('id', txId);
      } else {
        const { data: newTx } = await supabase
          .from('transactions')
          .insert({
            user_id: user!.id,
            amount: amountVal,
            type: 'expense',
            description: txDescription,
            date: form.date,
            category_id: catId,
            account_id: form.account_id || null,
            notes: form.description || 'Recorded via Expenses module',
            reference: `EXP-${Date.now().toString().slice(-6)}`
          })
          .select()
          .single();
        txId = newTx?.id || null;
      }

      // 3. Insert/Update Expense
      const expenseNumber = editingExpense?.expense_number || `EXP-${Date.now().toString().slice(-6)}`;
      const payload = {
        user_id: user!.id,
        expense_number: expenseNumber,
        date: form.date,
        vendor: form.vendor,
        category_id: catId,
        amount: amountVal,
        payment_method: form.payment_method,
        account_id: form.account_id || null,
        description: form.description || null,
        attachment_url: form.attachment_url || null,
        transaction_id: txId
      };

      if (editingExpense) {
        await supabase.from('expenses').update(payload).eq('id', editingExpense.id);
      } else {
        await supabase.from('expenses').insert(payload);
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to save expense log.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExpense(exp: Expense) {
    if (!confirm('Are you sure you want to delete this expense log? This will also remove the corresponding transaction.')) return;
    try {
      if (exp.transaction_id) {
        await supabase.from('transactions').delete().eq('id', exp.transaction_id);
      }
      await supabase.from('expenses').delete().eq('id', exp.id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  }

  // --- Expenses Calculations ---
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch =
      exp.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exp.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const catName = exp.category?.name || 'Uncategorized';
    const matchesCategory = categoryFilter === 'all' || catName === categoryFilter;
    const matchesMethod = methodFilter === 'all' || exp.payment_method === methodFilter;

    return matchesSearch && matchesCategory && matchesMethod;
  });

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const totalThisMonth = expenses
    .filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const totalThisYear = expenses
    .filter(e => new Date(e.date).getFullYear() === currentYear)
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryMap: Record<string, number> = {};
  expenses.forEach(e => {
    const catName = e.category?.name || 'Uncategorized';
    categoryMap[catName] = (categoryMap[catName] || 0) + Number(e.amount);
  });
  const topCategories = Object.entries(categoryMap)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const allUsedCategories = Array.from(new Set(expenses.map(e => e.category?.name).filter(Boolean)));

  function handleExportExpensesCSV() {
    const rows = expenses.map(e => [e.expense_number, formatDate(e.date), e.vendor, e.category?.name || '—', e.payment_method || '—', e.amount, e.description || '—']);
    downloadCSV(`Expenses_Report.csv`, ['Expense #', 'Date', 'Vendor/Payee', 'Category', 'Method', 'Amount (NGN)', 'Description'], rows);
  }


  // --- Bills Actions ---
  const getBillPaymentsTotal = (bill: Bill) => {
    const bps = (bill as any).bill_payments || [];
    return bps.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  };

  const getBillOutstanding = (bill: Bill) => {
    const paid = getBillPaymentsTotal(bill);
    return Math.max(0, Number(bill.amount) - paid);
  };

  function openNewBill() {
    setEditingBill(null);
    setBillForm({
      bill_number: `BILL-${Date.now().toString().slice(-6)}`,
      vendor: '',
      description: '',
      bill_date: new Date().toISOString().split('T')[0],
      due_date: '',
      amount: '',
      category: 'Technology',
      custom_category: '',
      notes: '',
      attachment_url: '',
      link_agreement: false,
      agreement_id: agreements[0]?.id || ''
    });
    setShowBillModal(true);
  }

  function openEditBill(bill: Bill) {
    setEditingBill(bill);
    const isCustom = bill.category ? !BILL_CATEGORIES.includes(bill.category.name) : false;
    setBillForm({
      bill_number: bill.bill_number,
      vendor: bill.vendor,
      description: bill.description || '',
      bill_date: bill.bill_date,
      due_date: bill.due_date,
      amount: String(bill.amount),
      category: isCustom ? 'Other' : (bill.category?.name || 'Other'),
      custom_category: isCustom ? (bill.category?.name || '') : '',
      notes: bill.notes || '',
      attachment_url: bill.attachment_url || '',
      link_agreement: !!bill.agreement_id,
      agreement_id: bill.agreement_id || agreements[0]?.id || ''
    });
    setShowBillModal(true);
  }

  async function handleBillSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingBill(true);

    const amountVal = Number(billForm.amount);
    const categoryName = billForm.category === 'Other' && billForm.custom_category.trim()
      ? billForm.custom_category.trim()
      : billForm.category;

    try {
      let catId = null;
      const matchedCat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase() && c.type === 'expense');
      if (matchedCat) {
        catId = matchedCat.id;
      } else {
        const { data: newCat } = await supabase
          .from('categories')
          .insert({
            user_id: user!.id,
            name: categoryName,
            type: 'expense',
            icon: 'briefcase',
            color: '#8b5cf6',
            is_system: false
          })
          .select()
          .single();
        if (newCat) {
          catId = newCat.id;
          setCategories(prev => [...prev, newCat]);
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const initialStatus = billForm.due_date < today ? 'overdue' : 'unpaid';

      const payload: any = {
        user_id: user!.id,
        bill_number: billForm.bill_number,
        vendor: billForm.vendor,
        description: billForm.description || null,
        bill_date: billForm.bill_date,
        due_date: billForm.due_date,
        amount: amountVal,
        category_id: catId,
        notes: billForm.notes || null,
        attachment_url: billForm.attachment_url || null,
        agreement_id: billForm.link_agreement && billForm.agreement_id ? billForm.agreement_id : null,
      };

      if (editingBill) {
        const paid = getBillPaymentsTotal(editingBill);
        let newStatus = editingBill.status;
        if (paid >= amountVal) {
          newStatus = 'paid';
        } else if (paid > 0) {
          newStatus = billForm.due_date < today ? 'overdue' : 'partially_paid';
        } else {
          newStatus = billForm.due_date < today ? 'overdue' : 'unpaid';
        }
        payload.status = newStatus;

        await supabase.from('bills').update(payload).eq('id', editingBill.id);
      } else {
        payload.status = initialStatus;
        await supabase.from('bills').insert(payload);
      }

      setShowBillModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to save bill.');
    } finally {
      setSavingBill(false);
    }
  }

  async function handleDeleteBill(bill: Bill) {
    if (!confirm('Are you sure you want to delete this bill? This will also remove all associated payment transactions and payments logs.')) return;
    try {
      const bps = (bill as any).bill_payments || [];
      const txIds = bps.map((p: any) => p.transaction_id).filter(Boolean);

      if (txIds.length > 0) {
        await supabase.from('transactions').delete().in('id', txIds);
      }
      await supabase.from('bills').delete().eq('id', bill.id);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete bill.');
    }
  }

  function openRecordPayment(bill: Bill) {
    const outstanding = getBillOutstanding(bill);
    setPayingBill(bill);
    setPaymentForm({
      amount: String(outstanding),
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'Bank Transfer',
      account_id: accounts[0]?.id || '',
      reference_number: '',
      notes: ''
    });
    setShowPaymentModal(true);
  }

  async function handlePaymentSubmit(e: FormEvent) {
    e.preventDefault();
    if (!payingBill) return;
    setSavingPayment(true);

    const paymentAmount = Number(paymentForm.amount);

    if (paymentAmount <= 0) {
      alert('Please enter a valid amount.');
      setSavingPayment(false);
      return;
    }

    try {
      // 1. Create Transaction (Type: expense)
      const txDescription = `Bill Payment: ${payingBill.bill_number} - ${payingBill.vendor}`;
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user!.id,
          amount: paymentAmount,
          type: 'expense',
          description: txDescription,
          date: paymentForm.payment_date,
          category_id: payingBill.category_id,
          account_id: paymentForm.account_id || null,
          notes: paymentForm.notes || 'Recorded via Bills module payment',
          reference: paymentForm.reference_number || payingBill.bill_number
        })
        .select()
        .single();

      if (txError) throw txError;

      // 2. Insert Bill Payment
      const { error: bpError } = await supabase
        .from('bill_payments')
        .insert({
          user_id: user!.id,
          bill_id: payingBill.id,
          payment_date: paymentForm.payment_date,
          amount: paymentAmount,
          payment_method: paymentForm.payment_method,
          reference_number: paymentForm.reference_number || null,
          notes: paymentForm.notes || null,
          transaction_id: tx?.id || null
        });

      if (bpError) throw bpError;

      // 3. Update Bill Status
      const newPaidTotal = getBillPaymentsTotal(payingBill) + paymentAmount;
      const today = new Date().toISOString().split('T')[0];
      let newStatus: Bill['status'] = 'unpaid';
      if (newPaidTotal >= payingBill.amount) {
        newStatus = 'paid';
      } else {
        newStatus = payingBill.due_date < today ? 'overdue' : 'partially_paid';
      }

      await supabase.from('bills').update({ status: newStatus }).eq('id', payingBill.id);

      // 4. Contractor Sync
      if (payingBill.agreement_id) {
        await supabase.from('contractor_payments').insert({
          user_id: user!.id,
          agreement_id: payingBill.agreement_id,
          payment_date: paymentForm.payment_date,
          amount: paymentAmount,
          payment_method: paymentForm.payment_method,
          reference_number: paymentForm.reference_number || null,
          notes: paymentForm.notes || 'Paid via Bills page',
          transaction_id: tx?.id || null
        });

        const { data: cpPayments } = await supabase
          .from('contractor_payments')
          .select('amount')
          .eq('agreement_id', payingBill.agreement_id);
        
        const totalCpPaid = (cpPayments || []).reduce((sum, cp) => sum + Number(cp.amount), 0);
        
        const { data: agreement } = await supabase
          .from('service_agreements')
          .select('agreed_amount, status')
          .eq('id', payingBill.agreement_id)
          .single();

        if (agreement && totalCpPaid >= Number(agreement.agreed_amount) && agreement.status === 'active') {
          await supabase.from('service_agreements').update({ status: 'completed' }).eq('id', payingBill.agreement_id);
        }
      }

      setShowPaymentModal(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to record payment.');
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleDeletePayment(payment: any) {
    if (!confirm('Are you sure you want to delete this payment record? This will also remove the associated expense transaction.')) return;
    try {
      if (payment.transaction_id) {
        await supabase.from('transactions').delete().eq('id', payment.transaction_id);
      }
      
      if (payment.bill?.agreement_id) {
        await supabase.from('contractor_payments').delete()
          .eq('agreement_id', payment.bill.agreement_id)
          .eq('payment_date', payment.payment_date)
          .eq('amount', payment.amount)
          .eq('transaction_id', payment.transaction_id);
      }

      await supabase.from('bill_payments').delete().eq('id', payment.id);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete payment.');
    }
  }

  // --- Bills Calculations & Filters ---
  const todayStr = new Date().toISOString().split('T')[0];

  const filteredBills = bills.filter(bill => {
    const matchesSearch =
      bill.vendor.toLowerCase().includes(billsSearchQuery.toLowerCase()) ||
      bill.bill_number.toLowerCase().includes(billsSearchQuery.toLowerCase()) ||
      (bill.description || '').toLowerCase().includes(billsSearchQuery.toLowerCase());

    const isOverdue = getBillOutstanding(bill) > 0 && bill.due_date < todayStr;
    const isPaid = getBillOutstanding(bill) === 0;
    const isPartially = getBillOutstanding(bill) > 0 && getBillPaymentsTotal(bill) > 0;
    const isUnpaid = getBillOutstanding(bill) > 0 && getBillPaymentsTotal(bill) === 0;

    let matchesStatus = true;
    if (billsStatusFilter === 'unpaid') {
      matchesStatus = isUnpaid;
    } else if (billsStatusFilter === 'partially_paid') {
      matchesStatus = isPartially;
    } else if (billsStatusFilter === 'overdue') {
      matchesStatus = isOverdue;
    } else if (billsStatusFilter === 'paid') {
      matchesStatus = isPaid;
    }

    const matchesCategory = billsCategoryFilter === 'all' || (bill.category?.name === billsCategoryFilter);

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const outstandingTotal = bills.reduce((sum, b) => sum + getBillOutstanding(b), 0);

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const dueThisWeekTotal = bills
    .filter(b => getBillOutstanding(b) > 0 && b.due_date >= todayStr && b.due_date <= nextWeekStr)
    .reduce((sum, b) => sum + getBillOutstanding(b), 0);

  const overdueTotal = bills
    .filter(b => getBillOutstanding(b) > 0 && b.due_date < todayStr)
    .reduce((sum, b) => sum + getBillOutstanding(b), 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const recentlyPaidTotal = payments
    .filter(p => p.payment_date >= thirtyAgoStr)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  function exportOutstandingBillsCSV() {
    const unpaid = bills.filter(b => getBillOutstanding(b) > 0);
    const rows = unpaid.map(b => [
      b.bill_number,
      b.vendor,
      formatDate(b.bill_date),
      formatDate(b.due_date),
      b.amount,
      getBillOutstanding(b),
      b.status
    ]);
    downloadCSV('Outstanding_Bills_Report.csv', ['Bill #', 'Vendor', 'Bill Date', 'Due Date', 'Amount (NGN)', 'Outstanding (NGN)', 'Status'], rows);
  }

  function exportPaymentHistoryCSV() {
    const rows = payments.map(p => [
      p.bill?.bill_number || '—',
      p.bill?.vendor || '—',
      formatDate(p.payment_date),
      p.payment_method || '—',
      p.amount,
      p.reference_number || '—'
    ]);
    downloadCSV('Bill_Payments_Report.csv', ['Bill #', 'Vendor/Payee', 'Payment Date', 'Method', 'Amount (NGN)', 'Reference'], rows);
  }

  function printBillsPDF() {
    const unpaid = bills.filter(b => getBillOutstanding(b) > 0);
    const rowsHtml = unpaid.map(b => `
      <tr class="line-row">
        <td>${b.bill_number}</td>
        <td>${b.vendor}</td>
        <td>${formatDate(b.bill_date)}</td>
        <td>${formatDate(b.due_date)}</td>
        <td class="amount">${formatCurrency(b.amount)}</td>
        <td class="amount negative">${formatCurrency(getBillOutstanding(b))}</td>
      </tr>
    `).join('');

    const html = `
      <div style="margin-bottom: 24px">
        <h2 style="font-size: 16px; margin-bottom: 12px; font-weight: 700">Outstanding Vendor Bills Summary</h2>
        <p style="color: #4b5563; font-size: 12px; margin-bottom: 16px">Total outstanding vendor obligations tracking sheet.</p>
      </div>
      <table>
        <thead>
          <tr class="section-header">
            <td>Bill #</td>
            <td>Vendor</td>
            <td>Bill Date</td>
            <td>Due Date</td>
            <td class="amount">Bill Amount</td>
            <td class="amount">Outstanding</td>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="6" style="text-align:center;padding:12px;color:#9ca3af">No outstanding bills found</td></tr>'}
          <tr class="total-row">
            <td colspan="5"><strong>Total Outstanding Balance</strong></td>
            <td class="amount negative"><strong>${formatCurrency(outstandingTotal)}</strong></td>
          </tr>
        </tbody>
      </table>
    `;

    printStatementHTML('Outstanding Bills Statement', `Generated on ${formatDate(todayStr)}`, 'ROVA Financial OS', html);
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1100, animation: 'fadeIn 0.3s ease' }}>
      {/* Title Header */}
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Bills & Expenses</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {mainTab === 'expenses'
              ? 'Track business expenses that have already been paid'
              : 'Track money your business owes to suppliers and contractors'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {mainTab === 'expenses' ? (
            <>
              <Button variant="secondary" icon={<Download size={14} />} onClick={handleExportExpensesCSV}>Export CSV</Button>
              <Button variant="primary" icon={<Plus size={14} />} onClick={openNewExpense}>Log Expense</Button>
            </>
          ) : (
            <Button variant="primary" icon={<Plus size={14} />} onClick={openNewBill}>Add Bill</Button>
          )}
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="mobile-overflow-x" style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
        {[
          { id: 'expenses', label: 'Paid Expenses', count: expenses.length },
          { id: 'bills', label: 'Vendor Bills', count: bills.length }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => handleMainTabChange(t.id as any)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: mainTab === t.id ? 'var(--accent-dim)' : 'transparent',
              color: mainTab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
              transition: 'all 0.15s'
            }}
          >
            {t.label} <span style={{ fontSize: 10, background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 10, marginLeft: 6, color: 'var(--text-muted)' }}>{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 60, borderRadius: 'var(--radius-md)' }} />
          ))}
        </div>
      ) : (
        <>
          {/* VIEW A: EXPENSES TAB */}
          {mainTab === 'expenses' && (
            <div>
              {/* Expenses stats cards */}
              <div className="mobile-grid-2 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingDown size={16} color="var(--accent-primary)" />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total This Month</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(totalThisMonth)}</div>
                </Card>

                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingDown size={16} color="var(--accent-primary)" />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total This Year</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(totalThisYear)}</div>
                </Card>

                <Card>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Categories</div>
                  {topCategories.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No expenses recorded</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {topCategories.map(cat => (
                        <div key={cat.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ fontWeight: 500 }}>{cat.name}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(cat.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Filters panel (Expenses) */}
              <div className="mobile-col mobile-gap-4" style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                  <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search payee, description..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 36px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--bg-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: 13
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--bg-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: 13
                    }}
                  >
                    <option value="all">All Categories</option>
                    {allUsedCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>

                  <select
                    value={methodFilter}
                    onChange={e => setMethodFilter(e.target.value)}
                    style={{
                      padding: '9px 12px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--bg-border)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontSize: 13
                    }}
                  >
                    <option value="all">All Payment Methods</option>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Expenses Table List */}
              {filteredExpenses.length === 0 ? (
                <Card style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <TrendingDown size={32} style={{ margin: '0 auto 12px', color: 'var(--text-disabled)' }} />
                  <p style={{ fontSize: 14, fontWeight: 500 }}>No expenses logged yet</p>
                  <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-disabled)' }}>Log a new expense using the button at the top right.</p>
                </Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredExpenses.map(exp => (
                    <div
                      key={exp.id}
                      className="mobile-col"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '16px 20px',
                        background: 'var(--bg-card)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--bg-border)',
                        boxShadow: 'var(--shadow-sm)',
                        transition: 'all 0.2s',
                        animation: 'fadeIn 0.2s ease'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{exp.expense_number}</span>
                          <Badge variant="purple">{exp.category?.name || 'Uncategorized'}</Badge>
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{exp.vendor}</div>
                        {exp.description && (
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {exp.description}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                          <span>Date: {formatDate(exp.date)}</span>
                          <span>Method: {exp.payment_method || '—'}</span>
                          <span>Paid Account: {exp.account?.name || '—'}</span>
                        </div>
                      </div>

                      <div className="mobile-col" style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right', minWidth: 100 }}>
                          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(exp.amount)}</div>
                        </div>

                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button size="sm" variant="secondary" icon={<Pencil size={13} />} onClick={() => openEditExpense(exp)} />
                          <Button size="sm" variant="secondary" icon={<Trash2 size={13} />} style={{ color: 'var(--error)' }} onClick={() => handleDeleteExpense(exp)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW B: BILLS TAB */}
          {mainTab === 'bills' && (
            <div>
              {/* Bills Dashboard Cards */}
              <div className="mobile-grid-2 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--warning-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Clock size={16} color="var(--warning)" />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outstanding Total</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--warning)' }}>{formatCurrency(outstandingTotal)}</div>
                </Card>

                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--info-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Calendar size={16} color="var(--info)" />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Due This Week</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--info)' }}>{formatCurrency(dueThisWeekTotal)}</div>
                </Card>

                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--error-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <AlertTriangle size={16} color="var(--error)" />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Overdue Total</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--error)' }}>{formatCurrency(overdueTotal)}</div>
                </Card>

                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-md)', background: 'var(--success-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle size={16} color="var(--success)" />
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paid Last 30 Days</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>{formatCurrency(recentlyPaidTotal)}</div>
                </Card>
              </div>

              {/* Bills Sub Tab switcher */}
              <div className="mobile-overflow-x" style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                {[
                  { id: 'bills', label: 'Bills Dashboard', count: bills.length },
                  { id: 'payments', label: 'Payment History', count: payments.length },
                  { id: 'reports', label: 'Reports & Exports' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setBillsActiveSubTab(t.id as any)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      background: billsActiveSubTab === t.id ? 'var(--accent-dim)' : 'transparent',
                      color: billsActiveSubTab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      transition: 'all 0.15s'
                    }}
                  >
                    {t.label} {t.count !== undefined && <span style={{ fontSize: 10, background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 10, marginLeft: 6, color: 'var(--text-muted)' }}>{t.count}</span>}
                  </button>
                ))}
              </div>

              {/* Sub-tab Content: Bills list */}
              {billsActiveSubTab === 'bills' && (
                <div>
                  {/* Filters panel (Bills) */}
                  <div className="mobile-col mobile-gap-4" style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                      <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        placeholder="Search vendor, description, bill #..."
                        value={billsSearchQuery}
                        onChange={e => setBillsSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px 9px 36px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--bg-border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          fontSize: 13
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <select
                        value={billsStatusFilter}
                        onChange={e => setBillsStatusFilter(e.target.value as any)}
                        style={{
                          padding: '9px 12px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--bg-border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          fontSize: 13
                        }}
                      >
                        <option value="all">All Statuses</option>
                        <option value="unpaid">Unpaid Only</option>
                        <option value="partially_paid">Partially Paid</option>
                        <option value="overdue">Overdue Only</option>
                        <option value="paid">Paid Only</option>
                      </select>

                      <select
                        value={billsCategoryFilter}
                        onChange={e => setBillsCategoryFilter(e.target.value)}
                        style={{
                          padding: '9px 12px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--bg-border)',
                          borderRadius: 'var(--radius-md)',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          fontSize: 13
                        }}
                      >
                        <option value="all">All Categories</option>
                        {BILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* List (Bills) */}
                  {filteredBills.length === 0 ? (
                    <Card style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <CreditCard size={32} style={{ margin: '0 auto 12px', color: 'var(--text-disabled)' }} />
                      <p style={{ fontSize: 14, fontWeight: 500 }}>No bills match your filters</p>
                      <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-disabled)' }}>Create a bill or adjust search filters.</p>
                    </Card>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {filteredBills.map(bill => {
                        const outstanding = getBillOutstanding(bill);
                        const paidAmount = getBillPaymentsTotal(bill);
                        const isOverdue = outstanding > 0 && bill.due_date < todayStr;
                        
                        let badgeVar: 'success' | 'warning' | 'error' | 'info' = 'warning';
                        let badgeLabel = 'Unpaid';
                        if (outstanding === 0) {
                          badgeVar = 'success';
                          badgeLabel = 'Paid';
                        } else if (isOverdue) {
                          badgeVar = 'error';
                          badgeLabel = 'Overdue';
                        } else if (paidAmount > 0) {
                          badgeVar = 'info';
                          badgeLabel = 'Partially Paid';
                        }

                        return (
                          <div
                            key={bill.id}
                            className="mobile-col"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 16,
                              padding: '16px 20px',
                              background: 'var(--bg-card)',
                              borderRadius: 'var(--radius-lg)',
                              border: '1px solid var(--bg-border)',
                              boxShadow: 'var(--shadow-sm)',
                              transition: 'all 0.2s',
                              animation: 'fadeIn 0.2s ease'
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{bill.bill_number}</span>
                                <Badge variant={badgeVar}>{badgeLabel}</Badge>
                                {bill.agreement_id && (
                                  <Badge variant="purple" style={{ fontSize: 10 }}>Linked Job</Badge>
                                )}
                              </div>
                              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{bill.vendor}</div>
                              {bill.description && (
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {bill.description}
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
                                <span>Bill Date: {formatDate(bill.bill_date)}</span>
                                <span style={{ color: isOverdue ? 'var(--error)' : 'inherit', fontWeight: isOverdue ? 600 : 'normal' }}>
                                  Due Date: {formatDate(bill.due_date)} {isOverdue && '(Overdue)'}
                                </span>
                                <span>Category: {bill.category?.name || 'Uncategorized'}</span>
                              </div>
                            </div>

                            <div className="mobile-col" style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
                              <div style={{ textAlign: 'right', minWidth: 100 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Amount</div>
                                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(bill.amount)}</div>
                                {outstanding > 0 && outstanding !== Number(bill.amount) && (
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                    Paid: {formatCurrency(paidAmount)}
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: 6 }}>
                                {outstanding > 0 && (
                                  <Button size="sm" variant="primary" onClick={() => openRecordPayment(bill)}>Record Payment</Button>
                                )}
                                <Button size="sm" variant="secondary" icon={<Eye size={13} />} onClick={() => { setViewingBill(bill); setShowViewModal(true); }} />
                                <Button size="sm" variant="secondary" icon={<Pencil size={13} />} onClick={() => openEditBill(bill)} />
                                <Button size="sm" variant="secondary" icon={<Trash2 size={13} />} style={{ color: 'var(--error)' }} onClick={() => handleDeleteBill(bill)} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab Content: Payment History */}
              {billsActiveSubTab === 'payments' && (
                <div>
                  {payments.length === 0 ? (
                    <Card style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <CreditCard size={32} style={{ margin: '0 auto 12px', color: 'var(--text-disabled)' }} />
                      <p style={{ fontSize: 14, fontWeight: 500 }}>No payments recorded yet</p>
                      <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-disabled)' }}>Payment history records appear here once you make payments on bills.</p>
                    </Card>
                  ) : (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            <th style={{ padding: '12px 16px' }}>Date</th>
                            <th style={{ padding: '12px 16px' }}>Bill #</th>
                            <th style={{ padding: '12px 16px' }}>Vendor</th>
                            <th style={{ padding: '12px 16px' }}>Method</th>
                            <th style={{ padding: '12px 16px' }}>Reference</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Amount Paid</th>
                            <th style={{ padding: '12px 16px', width: 60 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}>
                              <td style={{ padding: '12px 16px' }}>{formatDate(p.payment_date)}</td>
                              <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>{p.bill?.bill_number || '—'}</td>
                              <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.bill?.vendor || '—'}</td>
                              <td style={{ padding: '12px 16px' }}>{p.payment_method || '—'}</td>
                              <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>{p.reference_number || '—'}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(p.amount)}</td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleDeletePayment(p)}
                                  style={{ border: 'none', background: 'transparent', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab Content: Reports */}
              {billsActiveSubTab === 'reports' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                  <Card>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Outstanding Bills Report</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Summary of all unpaid and partially paid vendor invoices</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button variant="secondary" icon={<Download size={14} />} onClick={exportOutstandingBillsCSV}>CSV Export</Button>
                      <Button variant="secondary" icon={<Printer size={14} />} onClick={printBillsPDF}>Print / PDF</Button>
                    </div>
                  </Card>

                  <Card>
                    <div style={{ marginBottom: 16 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Payment History Report</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Complete ledger of all bill payments and cash outflows</p>
                    </div>
                    <Button variant="secondary" icon={<Download size={14} />} onClick={exportPaymentHistoryCSV}>CSV Export</Button>
                  </Card>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* --- MODAL: LOG/EDIT EXPENSE --- */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editingExpense ? 'Edit Expense Log' : 'Log Expense'} size="lg">
        <form onSubmit={handleExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Input label="Expense Date" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
            <Input label="Vendor / Payee Name" placeholder="MTN, AWS, Landlord, etc." value={form.vendor} onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Expense Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}>
                {DEFAULT_EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                <option value="Other">Other (Custom Category)</option>
              </select>
            </div>
            {form.category === 'Other' && (
              <Input label="Custom Category Name" placeholder="e.g. Internet Bills" value={form.custom_category} onChange={e => setForm(p => ({ ...p, custom_category: e.target.value }))} required />
            )}
            <Input label="Amount (₦)" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Payment Method</label>
              <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}>
                {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Paid Bank Account</label>
              <select value={form.account_id} onChange={e => setForm(p => ({ ...p, account_id: e.target.value }))} required
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>)}
              </select>
            </div>
          </div>

          <Input label="Description / Details" placeholder="Fuel for office generator, month-end utilities..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <ReceiptUploader label="Receipt / Invoice Document" value={form.attachment_url} onChange={url => setForm(p => ({ ...p, attachment_url: url }))} />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 6 }}>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">{editingExpense ? 'Save Changes' : 'Log Expense'}</Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL: CREATE/EDIT BILL --- */}
      <Modal open={showBillModal} onClose={() => setShowBillModal(false)} title={editingBill ? 'Edit Vendor Bill' : 'Log Vendor Bill'} size="lg">
        <form onSubmit={handleBillSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Input label="Bill Number" value={billForm.bill_number} onChange={e => setBillForm(p => ({ ...p, bill_number: e.target.value }))} required />
            <Input label="Vendor / Payee Name" placeholder="e.g. AWS, MTN, Supplier Corp" value={billForm.vendor} onChange={e => setBillForm(p => ({ ...p, vendor: e.target.value }))} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Expense Category</label>
              <select value={billForm.category} onChange={e => setBillForm(p => ({ ...p, category: e.target.value }))}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}>
                {BILL_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                <option value="Other">Other (Custom Category)</option>
              </select>
            </div>
            {billForm.category === 'Other' && (
              <Input label="Custom Category Name" placeholder="e.g. Legal Fees" value={billForm.custom_category} onChange={e => setBillForm(p => ({ ...p, custom_category: e.target.value }))} required />
            )}
            <Input label="Bill Amount (₦)" type="number" min="0" step="0.01" placeholder="0.00" value={billForm.amount} onChange={e => setBillForm(p => ({ ...p, amount: e.target.value }))} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Input label="Bill Date" type="date" value={billForm.bill_date} onChange={e => setBillForm(p => ({ ...p, bill_date: e.target.value }))} required />
            <Input label="Due Date" type="date" value={billForm.due_date} onChange={e => setBillForm(p => ({ ...p, due_date: e.target.value }))} required />
          </div>

          <Input label="Description / Milestones" placeholder="Subscription period, milestones etc." value={billForm.description} onChange={e => setBillForm(p => ({ ...p, description: e.target.value }))} />

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <ReceiptUploader label="Invoice Document" value={billForm.attachment_url} onChange={url => setBillForm(p => ({ ...p, attachment_url: url }))} />
            <Input label="Additional Notes" placeholder="Terms, payment directions..." value={billForm.notes} onChange={e => setBillForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          {/* Active agreements link */}
          {!editingBill && agreements.length > 0 && (
            <div style={{ background: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, userSelect: 'none', color: 'var(--text-primary)', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={billForm.link_agreement}
                  onChange={e => setBillForm(p => ({ ...p, link_agreement: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                />
                Link this bill to an active contractor job agreement
              </label>

              {billForm.link_agreement && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Select contractor agreement. Recording payments on this bill will auto-update contractor milestones.</span>
                  <select
                    value={billForm.agreement_id}
                    onChange={e => setBillForm(p => ({ ...p, agreement_id: e.target.value }))}
                    style={{ padding: '9px 12px', background: 'var(--bg-card)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: 12 }}
                  >
                    {agreements.map(a => (
                      <option key={a.id} value={a.id}>{a.worker?.name || 'Contractor'} — {a.title} (Outstanding: {formatCurrency(Number(a.agreed_amount))})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 6 }}>
            <Button variant="secondary" type="button" onClick={() => setShowBillModal(false)}>Cancel</Button>
            <Button variant="primary" loading={savingBill} type="submit">{editingBill ? 'Save Changes' : 'Log Bill'}</Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL: RECORD BILL PAYMENT --- */}
      <Modal open={showPaymentModal} onClose={() => setShowPaymentModal(false)} title={`Record Payment for ${payingBill?.bill_number}`} size="lg">
        {payingBill && (
          <form onSubmit={handlePaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Vendor</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{payingBill.vendor}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Outstanding Balance</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--warning)' }}>{formatCurrency(getBillOutstanding(payingBill))}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <Input label="Amount to Pay (₦)" type="number" min="0.01" max={getBillOutstanding(payingBill)} step="0.01" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} required />
              <Input label="Payment Date" type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Payment Method</label>
                <select value={paymentForm.payment_method} onChange={e => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))}
                  style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}>
                  {PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Debit Bank Account</label>
                <select value={paymentForm.account_id} onChange={e => setPaymentForm(p => ({ ...p, account_id: e.target.value }))} required
                  style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none', fontSize: 13 }}>
                  {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <Input label="Reference Number" placeholder="e.g. TXN-1029302" value={paymentForm.reference_number} onChange={e => setPaymentForm(p => ({ ...p, reference_number: e.target.value }))} />
              <Input label="Transaction Notes" placeholder="e.g. Milestone 2 final payout" value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 6 }}>
              <Button variant="secondary" type="button" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
              <Button variant="primary" loading={savingPayment} type="submit">Record Payment</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* --- MODAL: VIEW BILL DETAILS --- */}
      <Modal open={showViewModal} onClose={() => setShowViewModal(false)} title={`Bill Details: ${viewingBill?.bill_number}`} size="lg">
        {viewingBill && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <Card style={{ padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Vendor</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{viewingBill.vendor}</div>
              </Card>
              <Card style={{ padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Category</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{viewingBill.category?.name || 'Uncategorized'}</div>
              </Card>
              <Card style={{ padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Bill Date</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{formatDate(viewingBill.bill_date)}</div>
              </Card>
              <Card style={{ padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Due Date</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: getBillOutstanding(viewingBill) > 0 && viewingBill.due_date < todayStr ? 'var(--error)' : 'inherit' }}>
                  {formatDate(viewingBill.due_date)} {getBillOutstanding(viewingBill) > 0 && viewingBill.due_date < todayStr && '(Overdue)'}
                </div>
              </Card>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Amounts</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Total Bill:</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(viewingBill.amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Amount Paid:</span>
                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(getBillPaymentsTotal(viewingBill))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid var(--bg-border)', paddingTop: 4, marginTop: 4 }}>
                    <span style={{ fontWeight: 700 }}>Outstanding:</span>
                    <span style={{ fontWeight: 700, color: getBillOutstanding(viewingBill) > 0 ? 'var(--warning)' : 'var(--text-secondary)' }}>{formatCurrency(getBillOutstanding(viewingBill))}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Details & Documents</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', height: 'calc(100% - 24px)' }}>
                  {viewingBill.description && (
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                      <strong>Description:</strong> {viewingBill.description}
                    </div>
                  )}
                  {viewingBill.notes && (
                    <div style={{ fontSize: 12, marginBottom: 6 }}>
                      <strong>Notes:</strong> {viewingBill.notes}
                    </div>
                  )}
                  {viewingBill.attachment_url && (
                    <div style={{ fontSize: 12 }}>
                      <strong>Invoice Document:</strong> <a href={viewingBill.attachment_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>View Attachment</a>
                    </div>
                  )}
                  {viewingBill.agreement && (
                    <div style={{ fontSize: 12 }}>
                      <strong>Linked Agreement:</strong> {viewingBill.agreement.title}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bill Payments Sub-list */}
            <div>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Payments History</h4>
              {!(viewingBill as any).bill_payments || (viewingBill as any).bill_payments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                  No payments logged for this bill.
                </div>
              ) : (
                <div style={{ border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '8px 12px' }}>Date</th>
                        <th style={{ padding: '8px 12px' }}>Method</th>
                        <th style={{ padding: '8px 12px' }}>Reference</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewingBill as any).bill_payments.map((p: any) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                          <td style={{ padding: '8px 12px' }}>{formatDate(p.payment_date)}</td>
                          <td style={{ padding: '8px 12px' }}>{p.payment_method || '—'}</td>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{p.reference_number || '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <Button variant="secondary" onClick={() => setShowViewModal(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
