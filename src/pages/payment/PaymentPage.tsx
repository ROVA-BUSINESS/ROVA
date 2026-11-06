import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  CreditCard,
  Link as LinkIcon,
  Plus,
  Search,
  Download,
  Upload,
  RefreshCw,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Share2,
  Check,
  Eye,
  Info,
  Calendar,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Account, type Category } from '../../lib/supabase';
import { formatCurrency, formatDate, formatTime } from '../../lib/format';
import { downloadCSV } from '../../lib/export';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import {
  PROVIDER_CAPABILITIES,
  getProviderConfigs,
  getPaymentLinks,
  createPaymentLink,
  getPaymentTransactions,
  calculateOverviewMetrics,
  syncProviderTransactions,
  classifyPaymentTransaction,
  importStatementRecords,
  recordDirectPayment,
} from '../../lib/paymentService';
import { generatePaymentRef, openPaystackPopup } from '../../lib/paystack';
import {
  parseCSVText,
  autoDetectMapping,
  mapAndValidateRows,
  type ColumnMapping,
} from '../../lib/statementParser';
import type {
  PaymentProvider,
  PaymentProviderConfig,
  PaymentLink,
  PaymentTransaction,
  PaymentOverviewMetrics,
  StatementParsedRow,
} from '../../types/payment';

type ActiveTab = 'overview' | 'providers' | 'links' | 'transactions' | 'import';
type DateFilter = 'today' | '7days' | 'month' | 'custom';

export default function PaymentPage() {
  const { user, profile, isStaff, staffData } = useAuth();
  const effectiveUserId = isStaff && staffData ? staffData.owner_id : user?.id;

  // Tabs
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

  // Loading & notification states
  const [loading, setLoading] = useState(true);
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Direct Pay (Pay into Rova via Paystack) state
  const [showDirectPayModal, setShowDirectPayModal] = useState(false);
  const [directPayAmount, setDirectPayAmount] = useState('5000');
  const [directPayPurpose, setDirectPayPurpose] = useState('Payment for Goods');
  const [directPayEmail, setDirectPayEmail] = useState('');
  const [directPayName, setDirectPayName] = useState('');
  const [directPayProcessing, setDirectPayProcessing] = useState(false);

  // Data states
  const [configs, setConfigs] = useState<Record<PaymentProvider, PaymentProviderConfig | null>>({
    paystack: null,
    kuda: null,
    opay: null,
    moniepoint: null,
  });
  const [providerServerStatus, setProviderServerStatus] = useState<Record<string, { configured: boolean; status: string }>>({});
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalTxCount, setTotalTxCount] = useState(0);

  // Filter states
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterVerification, setFilterVerification] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Modals
  const [showCreateLinkModal, setShowCreateLinkModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState<PaymentProvider | null>(null);
  const [showShareModal, setShowShareModal] = useState<PaymentLink | null>(null);
  const [showTxDetailsModal, setShowTxDetailsModal] = useState<PaymentTransaction | null>(null);
  const [showReconcileModal, setShowReconcileModal] = useState<PaymentTransaction | null>(null);

  // Form states for creating link
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [linkAmount, setLinkAmount] = useState('');
  const [linkCurrency, setLinkCurrency] = useState('NGN');
  const [linkCustomAmount, setLinkCustomAmount] = useState(false);
  const [linkProvider, setLinkProvider] = useState<PaymentProvider>('paystack');
  const [creatingLink, setCreatingLink] = useState(false);

  // Reconciliation form
  const [reconcileType, setReconcileType] = useState<'income' | 'expense' | 'transfer' | 'ignored'>('income');
  const [reconcileCategory, setReconcileCategory] = useState('');
  const [reconcileAccount, setReconcileAccount] = useState('');
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [reconciling, setReconciling] = useState(false);

  // Statement import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTargetProvider, setImportTargetProvider] = useState<PaymentProvider | 'manual_import'>('manual_import');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({ date: '', description: '', reference: '', amount: '' });
  const [parsedImportRows, setParsedImportRows] = useState<StatementParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  // Copied toast state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── Load Initial Data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (effectiveUserId) {
      loadAllData();
    }
  }, [effectiveUserId]);

  async function loadAllData() {
    if (!effectiveUserId) return;
    setLoading(true);
    try {
      const [configsData, linksData, txData, accsData, catsData] = await Promise.all([
        getProviderConfigs(effectiveUserId),
        getPaymentLinks(effectiveUserId),
        getPaymentTransactions(effectiveUserId, { limit: 100 }),
        supabase.from('accounts').select('*').eq('user_id', effectiveUserId).eq('is_active', true),
        supabase.from('categories').select('*').or(`user_id.eq.${effectiveUserId},is_system.eq.true`),
      ]);

      const configMap: Record<PaymentProvider, PaymentProviderConfig | null> = {
        paystack: null,
        kuda: null,
        opay: null,
        moniepoint: null,
      };

      configsData.forEach(c => {
        if (c.provider in configMap) {
          configMap[c.provider as PaymentProvider] = c;
        }
      });

      setConfigs(configMap);

      // Fetch server-side provider connection status (env-var-based)
      try {
        const statusRes = await fetch('/api/payment/providers/status');
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.success && statusData.providers) {
            setProviderServerStatus(statusData.providers);
          }
        }
      } catch {
        // Server status endpoint not available — fall back to local config data
      }

      setPaymentLinks(linksData);
      setTransactions(txData.transactions);
      setTotalTxCount(txData.totalCount);
      setAccounts(accsData.data || []);
      setCategories(catsData.data || []);
    } catch (err: any) {
      console.error('Error loading payment data:', err);
      showNotice('error', 'Failed to load payment data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function showNotice(type: 'success' | 'error' | 'info', message: string) {
    setActionNotice({ type, message });
    setTimeout(() => setActionNotice(null), 6000);
  }

  // ── Computed Metrics & Date Filtering ─────────────────────────────────────
  const { dateRangeStart, dateRangeEnd } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (dateFilter === 'today') {
      return { dateRangeStart: todayStr, dateRangeEnd: todayStr };
    }
    if (dateFilter === '7days') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { dateRangeStart: past.toISOString().split('T')[0], dateRangeEnd: todayStr };
    }
    if (dateFilter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateRangeStart: monthStart.toISOString().split('T')[0], dateRangeEnd: todayStr };
    }
    return { dateRangeStart: customStartDate, dateRangeEnd: customEndDate };
  }, [dateFilter, customStartDate, customEndDate]);

  const filteredOverviewTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = t.transaction_date.slice(0, 10);
      if (dateRangeStart && d < dateRangeStart) return false;
      if (dateRangeEnd && d > dateRangeEnd) return false;
      return true;
    });
  }, [transactions, dateRangeStart, dateRangeEnd]);

  const metrics: PaymentOverviewMetrics = useMemo(() => {
    return calculateOverviewMetrics(filteredOverviewTransactions);
  }, [filteredOverviewTransactions]);

  // Filtered transactions for the Transactions Tab
  const displayedTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterProvider !== 'all' && t.provider !== filterProvider) return false;
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterStatus !== 'all' && t.provider_status !== filterStatus) return false;
      if (filterVerification !== 'all' && t.verification_status !== filterVerification) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const refMatch = t.provider_reference.toLowerCase().includes(q);
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const cpMatch = (t.counterparty_name || '').toLowerCase().includes(q) || (t.counterparty_email || '').toLowerCase().includes(q);
        if (!refMatch && !descMatch && !cpMatch) return false;
      }
      return true;
    });
  }, [transactions, filterProvider, filterType, filterStatus, filterVerification, searchQuery]);

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    return displayedTransactions.slice(start, start + pageSize);
  }, [displayedTransactions, page]);

  const totalPages = Math.ceil(displayedTransactions.length / pageSize) || 1;

  // Helper: check if provider is connected via server env or local config
  const isPaystackConfigured = Boolean(
    import.meta.env.VITE_PAYSTACK_PUBLIC_KEY &&
    String(import.meta.env.VITE_PAYSTACK_PUBLIC_KEY).trim().startsWith('pk_')
  );

  function isProviderConnected(provider: PaymentProvider): boolean {
    if (provider === 'paystack' && isPaystackConfigured) return true;
    if (providerServerStatus[provider]?.configured) return true;
    return configs[provider]?.status === 'connected';
  }

  // ── Handlers: Direct Pay into Rova ─────────────────────────────────────────
  function openDirectPayModal() {
    setDirectPayEmail(user?.email || '');
    setDirectPayName(profile?.full_name || profile?.business_name || '');
    setDirectPayAmount('5000');
    setDirectPayPurpose('Payment for Goods');
    setShowDirectPayModal(true);
  }

  async function handleExecuteDirectPayment(e: FormEvent) {
    e.preventDefault();
    if (!effectiveUserId) return;

    const amt = parseFloat(directPayAmount);
    if (isNaN(amt) || amt <= 0) {
      showNotice('error', 'Please enter a valid amount greater than 0.');
      return;
    }

    if (!directPayEmail.trim()) {
      showNotice('error', 'Please enter a valid email address.');
      return;
    }

    setDirectPayProcessing(true);
    const ref = generatePaymentRef('PAY');

    try {
      await openPaystackPopup({
        email: directPayEmail.trim(),
        amountNaira: amt,
        reference: ref,
        metadata: {
          userId: effectiveUserId,
          purpose: directPayPurpose,
          payerName: directPayName,
        },
        onSuccess: async (returnedRef) => {
          try {
            await recordDirectPayment({
              userId: effectiveUserId,
              provider: 'paystack',
              reference: returnedRef || ref,
              amount: amt,
              description: directPayPurpose || 'Payment into Rova via Paystack',
              payerName: directPayName,
              payerEmail: directPayEmail,
              metadata: {
                payment_method: 'paystack_inline',
                settlement_type: 'direct_goods_payment',
              },
            });
            showNotice('success', `Payment of ${formatCurrency(amt)} successfully processed! Ref: ${returnedRef || ref}`);
            setShowDirectPayModal(false);
            await loadAllData();
          } catch (err: any) {
            showNotice('error', 'Payment succeeded but error recording transaction: ' + err.message);
          } finally {
            setDirectPayProcessing(false);
          }
        },
        onClose: () => {
          setDirectPayProcessing(false);
        },
      });
    } catch (err: any) {
      setDirectPayProcessing(false);
      showNotice('error', err.message || 'Unable to open Paystack payment popup.');
    }
  }

  // ── Handlers: Create Payment Link ─────────────────────────────────────────
  async function handleCreateLink(e: FormEvent) {
    e.preventDefault();
    if (!effectiveUserId) return;
    setCreatingLink(true);

    try {
      const amt = linkCustomAmount ? null : parseFloat(linkAmount);
      const newLink = await createPaymentLink({
        userId: effectiveUserId,
        provider: linkProvider,
        title: linkTitle,
        description: linkDesc,
        amount: amt,
        currency: linkCurrency,
        allowCustomAmount: linkCustomAmount,
      });

      setPaymentLinks(prev => [newLink, ...prev]);
      setShowCreateLinkModal(false);
      setLinkTitle('');
      setLinkDesc('');
      setLinkAmount('');
      setLinkCustomAmount(false);
      showNotice('success', `Payment link "${newLink.title}" created successfully!`);
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to create payment link.');
    } finally {
      setCreatingLink(false);
    }
  }

  // ── Handlers: Provider Sync ───────────────────────────────────────────────
  async function handleSyncProvider(provider: PaymentProvider) {
    if (!effectiveUserId) return;
    setSyncingProvider(provider);

    try {
      const result = await syncProviderTransactions(effectiveUserId, provider);
      if (result.success) {
        showNotice('success', result.message);
        await loadAllData();
      } else {
        showNotice('info', result.message);
      }
    } catch (err: any) {
      showNotice('error', err.message || `Sync failed for ${provider}`);
    } finally {
      setSyncingProvider(null);
    }
  }

  async function handleSyncAll() {
    const providers: PaymentProvider[] = ['paystack', 'kuda', 'opay', 'moniepoint'];
    for (const p of providers) {
      await handleSyncProvider(p);
    }
  }

  // ── Handlers: Reconcile / Classify ────────────────────────────────────────
  function openReconcileModal(tx: PaymentTransaction) {
    setShowReconcileModal(tx);
    // Suggest default type based on transaction type
    if (tx.type === 'credit') setReconcileType('income');
    else if (tx.type === 'debit') setReconcileType('expense');
    else if (tx.type === 'transfer') setReconcileType('transfer');
    else setReconcileType('income');

    setReconcileCategory('');
    setReconcileAccount(accounts[0]?.id || '');
    setReconcileNotes('');
  }

  async function handleReconcile(e: FormEvent) {
    e.preventDefault();
    if (!effectiveUserId || !showReconcileModal) return;
    setReconciling(true);

    try {
      const res = await classifyPaymentTransaction({
        userId: effectiveUserId,
        paymentTransaction: showReconcileModal,
        classificationType: reconcileType,
        categoryId: reconcileCategory || null,
        accountId: reconcileAccount || null,
        notes: reconcileNotes,
      });

      if (!res.success) throw new Error(res.error || 'Reconciliation failed');

      // Update in local state
      setTransactions(prev =>
        prev.map(t =>
          t.id === showReconcileModal.id
            ? {
                ...t,
                rova_transaction_id: res.rovaTransactionId || t.rova_transaction_id,
                accounting_status: reconcileType === 'ignored' ? 'ignored' : (`classified_${reconcileType}` as any),
              }
            : t
        )
      );

      setShowReconcileModal(null);
      showNotice('success', 'Transaction classified into Rova accounting ledger without duplicate entries.');
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to reconcile transaction.');
    } finally {
      setReconciling(false);
    }
  }

  // ── Handlers: Statement File Selection & Parsing ──────────────────────────
  function handleFileSelected(file: File) {
    setImportFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      if (!text) return;

      const { headers, data } = parseCSVText(text);
      if (headers.length === 0) {
        showNotice('error', 'The uploaded file appears empty or could not be parsed as CSV.');
        return;
      }

      setRawHeaders(headers);
      setRawRows(data);

      const detected = autoDetectMapping(headers);
      setColumnMapping(detected);

      const parsed = mapAndValidateRows(data, detected, transactions);
      setParsedImportRows(parsed);
    };
    reader.readAsText(file);
  }

  function handleMappingChange(field: keyof ColumnMapping, value: string) {
    const updated = { ...columnMapping, [field]: value };
    setColumnMapping(updated);
    const parsed = mapAndValidateRows(rawRows, updated, transactions);
    setParsedImportRows(parsed);
  }

  async function handleConfirmImport() {
    if (!effectiveUserId || parsedImportRows.length === 0) return;
    setImporting(true);

    try {
      const { importedCount, skippedCount, errors } = await importStatementRecords(
        effectiveUserId,
        parsedImportRows,
        importTargetProvider
      );

      setImportResult({ imported: importedCount, skipped: skippedCount });

      if (errors.length > 0) {
        showNotice('info', `Imported ${importedCount} records. ${skippedCount} duplicate/invalid records skipped. Note: ${errors[0]}`);
      } else {
        showNotice('success', `Import complete: ${importedCount} new transactions recorded, ${skippedCount} duplicates skipped.`);
      }

      await loadAllData();
    } catch (err: any) {
      showNotice('error', err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  // ── Copy Helper ───────────────────────────────────────────────────────────
  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  // ── CSV Export ────────────────────────────────────────────────────────────
  function handleExportTransactionsCSV() {
    const headers = [
      'Date',
      'Reference',
      'Provider',
      'Type',
      'Description',
      'Amount (NGN)',
      'Provider Status',
      'Verification Status',
      'Counterparty',
      'Source',
      'Accounting Status',
    ];

    const rows = displayedTransactions.map(t => [
      t.transaction_date,
      t.provider_reference,
      t.provider.toUpperCase(),
      t.type,
      t.description,
      t.amount,
      t.provider_status,
      t.verification_status,
      t.counterparty_name || t.counterparty_email || '',
      t.source,
      t.accounting_status,
    ]);

    downloadCSV(`rova_payment_transactions_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '80px 28px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--accent-primary)' }} />
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Loading payment workspace...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Action Notification Alert */}
      {actionNotice && (
        <div
          style={{
            marginBottom: 20,
            padding: '12px 18px',
            borderRadius: 'var(--radius-md)',
            background:
              actionNotice.type === 'success'
                ? 'var(--success-dim)'
                : actionNotice.type === 'error'
                ? 'var(--error-dim)'
                : 'var(--info-dim)',
            color:
              actionNotice.type === 'success'
                ? 'var(--success)'
                : actionNotice.type === 'error'
                ? 'var(--error)'
                : 'var(--info)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            fontWeight: 500,
            border: `1px solid ${
              actionNotice.type === 'success'
                ? 'rgba(34,197,94,0.3)'
                : actionNotice.type === 'error'
                ? 'rgba(239,68,68,0.3)'
                : 'rgba(59,130,246,0.3)'
            }`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {actionNotice.type === 'success' && <CheckCircle2 size={16} />}
            {actionNotice.type === 'error' && <AlertCircle size={16} />}
            {actionNotice.type === 'info' && <Info size={16} />}
            <span>{actionNotice.message}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, var(--accent-primary), #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}
            >
              <CreditCard size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>Payment</h1>
              <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                Manage your payment providers, collect payments, and track transactions in one place.
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={14} className={syncingProvider ? 'animate-spin' : ''} />}
            onClick={handleSyncAll}
            disabled={!!syncingProvider}
          >
            {syncingProvider ? `Syncing...` : 'Sync All'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Upload size={14} />}
            onClick={() => setActiveTab('import')}
          >
            Import Statement
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setShowCreateLinkModal(true)}
          >
            Create Payment Link
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<CreditCard size={14} />}
            onClick={openDirectPayModal}
            style={{
              background: '#00c3f7',
              borderColor: '#00c3f7',
              color: '#09090b',
              fontWeight: 700,
            }}
          >
            Pay with Paystack
          </Button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--bg-border)',
          marginBottom: 24,
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        {[
          { id: 'overview', label: 'Overview', icon: Layers },
          { id: 'providers', label: 'Payment Providers', icon: CreditCard, count: 4 },
          { id: 'links', label: 'Payment Links', icon: LinkIcon, count: paymentLinks.length },
          { id: 'transactions', label: 'Transactions', icon: Clock, count: totalTxCount },
          { id: 'import', label: 'Import Statements', icon: Upload },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: isActive ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: OVERVIEW & DASHBOARD                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Date Range Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              background: 'var(--bg-card)',
              padding: '10px 16px',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--bg-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Period:</span>
              {(['today', '7days', 'month', 'custom'] as DateFilter[]).map(df => (
                <button
                  key={df}
                  onClick={() => setDateFilter(df)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 12,
                    borderRadius: 'var(--radius-sm)',
                    border: dateFilter === df ? '1px solid var(--accent-primary)' : '1px solid transparent',
                    background: dateFilter === df ? 'var(--accent-dim)' : 'transparent',
                    color: dateFilter === df ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontWeight: dateFilter === df ? 600 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {df === 'today' ? 'Today' : df === '7days' ? 'Last 7 Days' : df === 'month' ? 'This Month' : 'Custom'}
                </button>
              ))}
            </div>

            {dateFilter === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 12,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                  }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 12,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--bg-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
            )}
          </div>

          {/* Metric Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {/* Total Received */}
            <Card style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Total Payments Received</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: 'var(--success)' }}>
                {formatCurrency(metrics.totalReceived)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {metrics.successfulCount} successful collections
              </div>
            </Card>

            {/* Net Collections */}
            <Card style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Net Collections</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: 'var(--text-primary)' }}>
                {formatCurrency(metrics.netCollections)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Gross collections minus refunds
              </div>
            </Card>

            {/* Pending Payments */}
            <Card style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Pending Payments</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: 'var(--warning)' }}>
                {formatCurrency(metrics.pendingVolume)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {metrics.pendingCount} awaiting confirmation
              </div>
            </Card>

            {/* Failed Payments */}
            <Card style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Failed Payments</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: 'var(--error)' }}>
                {formatCurrency(metrics.failedVolume)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                {metrics.failedCount} declined transactions
              </div>
            </Card>

            {/* Refunded Amounts */}
            <Card style={{ padding: 18 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Refunds & Reversals</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: 'var(--text-muted)' }}>
                {formatCurrency(metrics.refundedVolume)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Returned customer funds
              </div>
            </Card>
          </div>

          {/* Connected Providers Quick Summary */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Payment Providers Overview</h2>
              <button
                onClick={() => setActiveTab('providers')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Manage all providers →
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {(['paystack', 'kuda', 'opay', 'moniepoint'] as PaymentProvider[]).map(provider => {
                const cap = PROVIDER_CAPABILITIES[provider];
                const conf = configs[provider];
                const isConnected = isProviderConnected(provider);

                return (
                  <Card key={provider} style={{ padding: 16, borderLeft: `4px solid ${cap.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{cap.displayName}</span>
                      <Badge variant={isConnected ? 'success' : cap.accessStatus === 'ready' ? 'info' : 'warning'}>
                        {isConnected ? 'Connected' : cap.accessStatus === 'ready' ? 'Ready to Connect' : 'Setup Required'}
                      </Badge>
                    </div>

                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '8px 0 12px', minHeight: 32, lineHeight: 1.4 }}>
                      {cap.tagline}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                      <span>Last sync: {conf?.last_synced_at ? formatDate(conf.last_synced_at) : 'Never'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {provider === 'paystack' && isConnected && (
                          <button
                            onClick={openDirectPayModal}
                            style={{
                              background: 'rgba(0, 195, 247, 0.12)',
                              border: '1px solid rgba(0, 195, 247, 0.3)',
                              color: '#00c3f7',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: 11,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <CreditCard size={11} />
                            Pay Now
                          </button>
                        )}
                        <button
                          onClick={() => handleSyncProvider(provider)}
                          disabled={syncingProvider === provider}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          {syncingProvider === provider ? 'Syncing...' : 'Sync'}
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Recent Payment Activity</h2>
              <button
                onClick={() => setActiveTab('transactions')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                View all transactions →
              </button>
            </div>

            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {transactions.length === 0 ? (
                <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CreditCard size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No payment activity recorded yet</p>
                  <p style={{ margin: '4px 0 16px', fontSize: 12 }}>
                    Create a payment link or import a statement to start tracking your business collections.
                  </p>
                  <Button size="sm" variant="primary" onClick={() => setShowCreateLinkModal(true)}>
                    Create First Payment Link
                  </Button>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Description</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Provider</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Amount</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Verification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.slice(0, 8).map(tx => (
                        <tr
                          key={tx.id}
                          onClick={() => setShowTxDetailsModal(tx)}
                          style={{
                            borderBottom: '1px solid var(--bg-border)',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 500 }}>{formatDate(tx.transaction_date)}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(tx.transaction_date)}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 600 }}>{tx.description || 'Payment'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ref: {tx.provider_reference}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge variant="default" style={{ textTransform: 'uppercase', fontSize: 10 }}>
                              {tx.provider}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                            <span style={{ color: tx.type === 'credit' ? 'var(--success)' : 'var(--error)' }}>
                              {tx.type === 'credit' ? '+' : '-'} {formatCurrency(tx.amount, tx.currency)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <Badge
                              variant={
                                tx.provider_status === 'success'
                                  ? 'success'
                                  : tx.provider_status === 'pending'
                                  ? 'warning'
                                  : 'error'
                              }
                            >
                              {tx.provider_status}
                            </Badge>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {tx.verification_status === 'verified' ? (
                                <>
                                  <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
                                  <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>Verified</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle size={14} style={{ color: 'var(--text-muted)' }} />
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unverified</span>
                                </>
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
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: PAYMENT PROVIDERS                                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'providers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Connected Payment Providers</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Connect your Nigerian business accounts and gateways to collect payments and sync transactions automatically.
              </p>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Webhook endpoint base: <code style={{ color: 'var(--accent-primary)' }}>/api/payment/webhook/:provider</code>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {(['paystack', 'kuda', 'opay', 'moniepoint'] as PaymentProvider[]).map(provider => {
              const cap = PROVIDER_CAPABILITIES[provider];
              const conf = configs[provider];
              const isConnected = isProviderConnected(provider);

              return (
                <Card
                  key={provider}
                  style={{
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                    borderTop: `4px solid ${cap.color}`,
                  }}
                >
                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 18, fontWeight: 800 }}>{cap.displayName}</span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                          {cap.tagline}
                        </span>
                      </div>

                      <Badge variant={isConnected ? 'success' : cap.accessStatus === 'ready' ? 'info' : 'warning'}>
                        {isConnected ? 'Connected' : cap.accessStatus === 'ready' ? 'Ready to Connect' : 'Approval / Setup Required'}
                      </Badge>
                    </div>

                    {/* Notice */}
                    <div
                      style={{
                        padding: '10px 12px',
                        background: cap.bgLight,
                        borderRadius: 'var(--radius-md)',
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: 'var(--text-primary)',
                        marginBottom: 16,
                      }}
                    >
                      {cap.accessNotice}
                    </div>

                    {/* Features checklist */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                        Supported Capabilities
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cap.supportedFeatures.paymentLinks ? <Check size={14} style={{ color: 'var(--success)' }} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          <span style={{ color: cap.supportedFeatures.paymentLinks ? 'var(--text-primary)' : 'var(--text-muted)' }}>Payment Links</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cap.supportedFeatures.webhooks ? <Check size={14} style={{ color: 'var(--success)' }} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          <span style={{ color: cap.supportedFeatures.webhooks ? 'var(--text-primary)' : 'var(--text-muted)' }}>Real-time Webhooks</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cap.supportedFeatures.historyApi ? <Check size={14} style={{ color: 'var(--success)' }} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          <span style={{ color: cap.supportedFeatures.historyApi ? 'var(--text-primary)' : 'var(--text-muted)' }}>API History Sync</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {cap.supportedFeatures.instantVerification ? <Check size={14} style={{ color: 'var(--success)' }} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          <span style={{ color: cap.supportedFeatures.instantVerification ? 'var(--text-primary)' : 'var(--text-muted)' }}>Server Verification</span>
                        </div>
                      </div>
                    </div>

                    {/* Sync Status info */}
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        marginBottom: 16,
                      }}
                    >
                      <div>Last Synced: <strong>{conf?.last_synced_at ? formatDate(conf.last_synced_at) : 'Not synced'}</strong></div>
                      {conf?.last_sync_error && (
                        <div style={{ color: 'var(--warning)', marginTop: 4 }}>Note: {conf.last_sync_error}</div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--bg-border)' }}>
                    {provider === 'paystack' && isConnected ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<CreditCard size={14} />}
                        onClick={openDirectPayModal}
                        style={{
                          flex: 1,
                          background: '#00c3f7',
                          borderColor: '#00c3f7',
                          color: '#09090b',
                          fontWeight: 700,
                        }}
                      >
                        Pay with Paystack
                      </Button>
                    ) : (
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: isConnected ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                          fontSize: 11,
                          color: isConnected ? 'var(--success)' : 'var(--warning)',
                        }}
                      >
                        {isConnected ? <CheckCircle2 size={12} /> : <Info size={12} />}
                        {isConnected ? 'Connected via server env' : 'Configure via server environment variables'}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<RefreshCw size={13} className={syncingProvider === provider ? 'animate-spin' : ''} />}
                      onClick={() => handleSyncProvider(provider)}
                      disabled={syncingProvider === provider}
                    >
                      Sync
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Info size={13} />}
                      onClick={() => setShowDocsModal(provider)}
                    >
                      Guide
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: PAYMENT LINKS                                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'links' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Payment Links</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Create and share payment links with your customers. Powered by Paystack's secure checkout.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setShowCreateLinkModal(true)}
            >
              Create New Link
            </Button>
          </div>

          {paymentLinks.length === 0 ? (
            <Card style={{ padding: 48, textAlign: 'center' }}>
              <LinkIcon size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 16px', opacity: 0.6 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>No Payment Links Created Yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '8px 0 20px', maxWidth: 420, marginInline: 'auto' }}>
                Payment links let you collect funds from customers via WhatsApp, email, or social media without building an e-commerce website.
              </p>
              <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowCreateLinkModal(true)}>
                Create First Link
              </Button>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {paymentLinks.map(link => (
                <Card key={link.id} style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{link.title}</h3>
                      <Badge variant={link.status === 'active' ? 'success' : 'default'}>
                        {link.status}
                      </Badge>
                    </div>

                    {link.description && (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 12px', lineHeight: 1.4 }}>
                        {link.description}
                      </p>
                    )}

                    <div style={{ margin: '12px 0', padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>Price / Amount</div>
                      <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2, color: 'var(--accent-primary)' }}>
                        {link.allow_custom_amount || !link.amount
                          ? 'Customer decides amount'
                          : formatCurrency(link.amount, link.currency)}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>
                      <div>Total Collections: <strong>{formatCurrency(link.total_collected, link.currency)}</strong></div>
                      <div>Payments Count: <strong>{link.payments_count}</strong></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14, borderTop: '1px solid var(--bg-border)' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={copiedId === link.id ? <Check size={13} style={{ color: 'var(--success)' }} /> : <Copy size={13} />}
                      onClick={() => handleCopy(link.payment_url, link.id)}
                      style={{ flex: 1 }}
                    >
                      {copiedId === link.id ? 'Copied!' : 'Copy Link'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Share2 size={13} />}
                      onClick={() => setShowShareModal(link)}
                    >
                      Share
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink size={13} />}
                      onClick={() => window.open(link.payment_url, '_blank')}
                      title="Open payment page"
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: UNIFIED TRANSACTIONS                                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header & Export Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Unified Transaction History</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                Consolidated transaction records from Paystack, Kuda, OPay, Moniepoint, and imported statements.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                variant="outline"
                size="sm"
                icon={<Download size={13} />}
                onClick={handleExportTransactionsCSV}
              >
                Export CSV
              </Button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <Card style={{ padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {/* Search input */}
              <div style={{ gridColumn: 'span 2' }}>
                <Input
                  placeholder="Search by reference, narration, customer name..."
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  prefix={<Search size={14} />}
                />
              </div>

              {/* Provider Filter */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Provider</label>
                <select
                  value={filterProvider}
                  onChange={e => { setFilterProvider(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                >
                  <option value="all">All Providers</option>
                  <option value="paystack">Paystack</option>
                  <option value="kuda">Kuda Business</option>
                  <option value="opay">OPay Business</option>
                  <option value="moniepoint">Moniepoint Business</option>
                  <option value="manual_import">Manual Import</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Type</label>
                <select
                  value={filterType}
                  onChange={e => { setFilterType(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                >
                  <option value="all">All Types</option>
                  <option value="credit">Credit (Collection)</option>
                  <option value="debit">Debit (Payout)</option>
                  <option value="refund">Refund</option>
                  <option value="transfer">Account Transfer</option>
                  <option value="fee">Bank / Gateway Fee</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Status</label>
                <select
                  value={filterStatus}
                  onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              {/* Verification Filter */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Verification</label>
                <select
                  value={filterVerification}
                  onChange={e => { setFilterVerification(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                >
                  <option value="all">All</option>
                  <option value="verified">Verified</option>
                  <option value="unverified">Unverified</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Transactions Table */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {displayedTransactions.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>No transactions match your filters</h4>
                <p style={{ fontSize: 12, margin: '6px 0 16px' }}>
                  Try resetting your search query or provider filter.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFilterProvider('all');
                    setFilterType('all');
                    setFilterStatus('all');
                    setFilterVerification('all');
                    setSearchQuery('');
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Date & Time</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Description & Ref</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Provider</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Amount</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Verification</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)' }}>Accounting</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTransactions.map(tx => (
                      <tr
                        key={tx.id}
                        style={{ borderBottom: '1px solid var(--bg-border)', transition: 'background 0.15s ease' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 500 }}>{formatDate(tx.transaction_date)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(tx.transaction_date)}</div>
                        </td>

                        <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                          <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.description || 'Transaction'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>Ref: {tx.provider_reference}</span>
                            <button
                              onClick={() => handleCopy(tx.provider_reference, tx.id)}
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
                              title="Copy reference"
                            >
                              <Copy size={10} />
                            </button>
                          </div>
                          {tx.counterparty_name && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                              From: {tx.counterparty_name}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <Badge variant="default" style={{ textTransform: 'uppercase', fontSize: 10 }}>
                            {tx.provider}
                          </Badge>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{tx.source}</div>
                        </td>

                        <td style={{ padding: '12px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <span style={{ color: tx.type === 'credit' ? 'var(--success)' : 'var(--error)' }}>
                            {tx.type === 'credit' ? '+' : '-'} {formatCurrency(tx.amount, tx.currency)}
                          </span>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <Badge
                            variant={
                              tx.provider_status === 'success'
                                ? 'success'
                                : tx.provider_status === 'pending'
                                ? 'warning'
                                : 'error'
                            }
                          >
                            {tx.provider_status}
                          </Badge>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {tx.verification_status === 'verified' ? (
                              <>
                                <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
                                <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>Verified</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={14} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unverified</span>
                              </>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '12px 16px' }}>
                          <Badge
                            variant={
                              tx.accounting_status.startsWith('classified')
                                ? 'success'
                                : tx.accounting_status === 'ignored'
                                ? 'default'
                                : 'warning'
                            }
                          >
                            {tx.accounting_status === 'unclassified'
                              ? 'Unclassified'
                              : tx.accounting_status.replace('classified_', '')}
                          </Badge>
                        </td>

                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Eye size={12} />}
                              onClick={() => setShowTxDetailsModal(tx)}
                              title="View Details"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openReconcileModal(tx)}
                            >
                              Classify
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {displayedTransactions.length > pageSize && (
              <div
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--bg-border)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                <div>
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, displayedTransactions.length)} of {displayedTransactions.length}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: STATEMENT IMPORT                                             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'import' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Import Transaction Statement</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Upload your bank or provider statement (CSV). Rova auto-detects fields, flags duplicates, and allows column remapping.
            </p>
          </div>

          {importResult && (
            <Card style={{ padding: 16, background: 'var(--success-dim)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
                  <div>
                    <strong style={{ color: 'var(--success)', fontSize: 14 }}>Import Process Completed</strong>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Successfully recorded <strong>{importResult.imported}</strong> new transactions. Skipped <strong>{importResult.skipped}</strong> duplicate records.
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setImportResult(null)}>
                  Dismiss
                </Button>
              </div>
            </Card>
          )}

          {/* Upload Dropzone */}
          <Card style={{ padding: 32, textAlign: 'center', border: '2px dashed var(--bg-border)' }}>
            <Upload size={36} style={{ color: 'var(--accent-primary)', margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Select or Drop Statement File</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 16px' }}>
              Supports standard Nigerian bank CSV statements (Kuda, OPay, Moniepoint, Zenith, GTB, Access, etc.)
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 18px',
                  background: 'var(--accent-primary)',
                  color: 'white',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Choose CSV File
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelected(f);
                  }}
                  style={{ display: 'none' }}
                />
              </label>

              {importFile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                  <span>{importFile.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({(importFile.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>
          </Card>

          {/* Parsed Rows Preview & Column Mapper */}
          {rawHeaders.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Column Mapper Card */}
              <Card style={{ padding: 18 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Confirm Column Mapping</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Date Column *</label>
                    <select
                      value={columnMapping.date}
                      onChange={e => handleMappingChange('date', e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                    >
                      {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Description Column *</label>
                    <select
                      value={columnMapping.description}
                      onChange={e => handleMappingChange('description', e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                    >
                      {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Reference Column</label>
                    <select
                      value={columnMapping.reference}
                      onChange={e => handleMappingChange('reference', e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                    >
                      <option value="">(None - Auto generate)</option>
                      {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Amount Column *</label>
                    <select
                      value={columnMapping.amount}
                      onChange={e => handleMappingChange('amount', e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                    >
                      {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Target Provider Tag</label>
                    <select
                      value={importTargetProvider}
                      onChange={e => setImportTargetProvider(e.target.value as any)}
                      style={{ width: '100%', padding: '6px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                    >
                      <option value="manual_import">Manual Import (Generic)</option>
                      <option value="kuda">Kuda Business</option>
                      <option value="opay">OPay Business</option>
                      <option value="moniepoint">Moniepoint Business</option>
                      <option value="paystack">Paystack</option>
                    </select>
                  </div>
                </div>
              </Card>

              {/* Preview & Duplicate Detection Table */}
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--bg-border)' }}>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Parsed Statement Preview</h4>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Total rows: {parsedImportRows.length} | Ready to import:{' '}
                      <strong style={{ color: 'var(--success)' }}>
                        {parsedImportRows.filter(r => !r.isDuplicate && !r.validationError).length}
                      </strong>{' '}
                      | Potential duplicates (will be skipped):{' '}
                      <strong style={{ color: 'var(--warning)' }}>
                        {parsedImportRows.filter(r => r.isDuplicate).length}
                      </strong>
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    loading={importing}
                    disabled={parsedImportRows.filter(r => !r.isDuplicate && !r.validationError).length === 0}
                    onClick={handleConfirmImport}
                  >
                    Confirm & Import Records
                  </Button>
                </div>

                <div style={{ overflowX: 'auto', maxHeight: 420 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                        <th style={{ padding: '8px 12px' }}>#</th>
                        <th style={{ padding: '8px 12px' }}>Date</th>
                        <th style={{ padding: '8px 12px' }}>Description</th>
                        <th style={{ padding: '8px 12px' }}>Reference</th>
                        <th style={{ padding: '8px 12px' }}>Amount</th>
                        <th style={{ padding: '8px 12px' }}>Type</th>
                        <th style={{ padding: '8px 12px' }}>Status Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedImportRows.slice(0, 50).map(row => (
                        <tr
                          key={row.rowNumber}
                          style={{
                            borderBottom: '1px solid var(--bg-border)',
                            background: row.isDuplicate ? 'rgba(234, 179, 8, 0.06)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{row.rowNumber}</td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>{row.date}</td>
                          <td style={{ padding: '8px 12px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.description}
                          </td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{row.reference}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{formatCurrency(row.amount)}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <Badge variant={row.type === 'credit' ? 'success' : 'error'}>{row.type}</Badge>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {row.isDuplicate ? (
                              <Badge variant="warning">Duplicate (Skip)</Badge>
                            ) : row.validationError ? (
                              <Badge variant="error">{row.validationError}</Badge>
                            ) : (
                              <Badge variant="success">New Record</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: DIRECT PAY INTO ROVA (VIA PAYSTACK)                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showDirectPayModal}
        onClose={() => !directPayProcessing && setShowDirectPayModal(false)}
        title="Pay into Rova via Paystack"
        size="md"
      >
        <form onSubmit={handleExecuteDirectPayment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 195, 247, 0.08)',
              border: '1px solid rgba(0, 195, 247, 0.25)',
              fontSize: 12,
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#00c3f7',
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CreditCard size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Instant Paystack Checkout</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Pay securely with Debit Card, Bank Transfer, USSD, or Apple Pay. Funds are verified and recorded in your Rova ledger.
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Amount to Pay (₦) *
            </label>
            <Input
              type="number"
              placeholder="e.g. 5000"
              value={directPayAmount}
              onChange={e => setDirectPayAmount(e.target.value)}
              required
              min="100"
            />
            {/* Quick Amount Chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {['1000', '2500', '5000', '10000', '20000', '50000'].map(preset => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => setDirectPayAmount(preset)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: directPayAmount === preset ? '1px solid #00c3f7' : '1px solid var(--bg-border)',
                    background: directPayAmount === preset ? 'rgba(0, 195, 247, 0.15)' : 'var(--bg-elevated)',
                    color: directPayAmount === preset ? '#00c3f7' : 'var(--text-primary)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  ₦{Number(preset).toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Payment Purpose / Description"
            placeholder="e.g. Payment for Goods, Business Deposit, Client Invoice"
            value={directPayPurpose}
            onChange={e => setDirectPayPurpose(e.target.value)}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="Payer / Customer Name"
              placeholder="e.g. John Doe"
              value={directPayName}
              onChange={e => setDirectPayName(e.target.value)}
            />
            <Input
              label="Payer Email *"
              type="email"
              placeholder="name@example.com"
              value={directPayEmail}
              onChange={e => setDirectPayEmail(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--bg-border)' }}>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setShowDirectPayModal(false)}
              disabled={directPayProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              loading={directPayProcessing}
              icon={<CreditCard size={14} />}
              style={{
                background: '#00c3f7',
                borderColor: '#00c3f7',
                color: '#09090b',
                fontWeight: 700,
              }}
            >
              {directPayProcessing ? 'Opening Paystack...' : `Pay ${directPayAmount ? `₦${Number(directPayAmount).toLocaleString()}` : ''}`}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE PAYMENT LINK                                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        open={showCreateLinkModal}
        onClose={() => setShowCreateLinkModal(false)}
        title="Create Payment Link"
        size="md"
      >
        <form onSubmit={handleCreateLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Input
            label="Payment Title *"
            placeholder="e.g. Graphic Design Retainer or Web Consultation"
            value={linkTitle}
            onChange={e => setLinkTitle(e.target.value)}
            required
          />

          <Input
            label="Description (Optional)"
            placeholder="Brief details about what the customer is paying for"
            value={linkDesc}
            onChange={e => setLinkDesc(e.target.value)}
          />

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={linkCustomAmount}
                onChange={e => setLinkCustomAmount(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Let customer enter the amount</span>
            </label>

            {!linkCustomAmount && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Currency</label>
                  <select
                    value={linkCurrency}
                    onChange={e => setLinkCurrency(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                  >
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GHS">GHS (GH₵)</option>
                  </select>
                </div>
                <Input
                  label="Amount *"
                  type="number"
                  min="100"
                  step="0.01"
                  placeholder="e.g. 15000"
                  value={linkAmount}
                  onChange={e => setLinkAmount(e.target.value)}
                  required={!linkCustomAmount}
                />
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Provider</label>
            <select
              value={linkProvider}
              onChange={e => setLinkProvider(e.target.value as PaymentProvider)}
              style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
            >
              <option value="paystack">Paystack (Recommended & Ready)</option>
              <option value="opay">OPay Business (Cashier Link)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <Button variant="secondary" type="button" onClick={() => setShowCreateLinkModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={creatingLink}>
              Generate Link
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: PROVIDER DOCUMENTATION & SETUP REQUIREMENTS                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        open={!!showDocsModal}
        onClose={() => setShowDocsModal(null)}
        title={showDocsModal ? `${PROVIDER_CAPABILITIES[showDocsModal].displayName} Access & Documentation Guide` : 'Guide'}
        size="lg"
      >
        {showDocsModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 'var(--radius-md)',
                background: PROVIDER_CAPABILITIES[showDocsModal].bgLight,
                borderLeft: `4px solid ${PROVIDER_CAPABILITIES[showDocsModal].color}`,
              }}
            >
              <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>
                {PROVIDER_CAPABILITIES[showDocsModal].displayName} Official API Guide
              </h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                {PROVIDER_CAPABILITIES[showDocsModal].tagline}
              </p>
            </div>

            <div>
              <h5 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Prerequisites & Approval Requirements</h5>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {PROVIDER_CAPABILITIES[showDocsModal].approvalRequirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>

            <div>
              <h5 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>Webhook Setup</h5>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                Set your provider dashboard webhook notification URL to:
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
              >
                <span>{window.location.origin}/api/payment/webhook/{showDocsModal}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={copiedId === 'webhook_url' ? <Check size={12} /> : <Copy size={12} />}
                  onClick={() => handleCopy(`${window.location.origin}/api/payment/webhook/${showDocsModal}`, 'webhook_url')}
                >
                  {copiedId === 'webhook_url' ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <Button
                variant="outline"
                size="sm"
                icon={<ExternalLink size={13} />}
                onClick={() => window.open(PROVIDER_CAPABILITIES[showDocsModal].docsUrl, '_blank')}
              >
                Open Official Docs
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowDocsModal(null)}>
                Got it
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: SHARE PAYMENT LINK                                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        open={!!showShareModal}
        onClose={() => setShowShareModal(null)}
        title="Share Payment Link"
        size="sm"
      >
        {showShareModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700 }}>{showShareModal.title}</h4>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                {showShareModal.allow_custom_amount || !showShareModal.amount
                  ? 'Customer enters amount'
                  : formatCurrency(showShareModal.amount, showShareModal.currency)}
              </p>
            </div>

            <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', wordBreak: 'break-all', fontSize: 12, color: 'var(--accent-primary)', fontWeight: 600 }}>
              {showShareModal.payment_url}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button
                variant="primary"
                fullWidth
                icon={<Copy size={14} />}
                onClick={() => handleCopy(showShareModal.payment_url, 'share_modal')}
              >
                {copiedId === 'share_modal' ? 'Copied to Clipboard!' : 'Copy Payment Link'}
              </Button>

              <Button
                variant="secondary"
                fullWidth
                icon={<Share2 size={14} />}
                onClick={() => {
                  const text = `Hi, please use this link to complete your payment for ${showShareModal.title}: ${showShareModal.payment_url}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                }}
              >
                Share via WhatsApp
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: TRANSACTION DETAILS                                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        open={!!showTxDetailsModal}
        onClose={() => setShowTxDetailsModal(null)}
        title="Transaction Details"
        size="md"
      >
        {showTxDetailsModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid var(--bg-border)' }}>
              <div>
                <span style={{ fontSize: 22, fontWeight: 800, color: showTxDetailsModal.type === 'credit' ? 'var(--success)' : 'var(--error)' }}>
                  {showTxDetailsModal.type === 'credit' ? '+' : '-'} {formatCurrency(showTxDetailsModal.amount, showTxDetailsModal.currency)}
                </span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {formatDate(showTxDetailsModal.transaction_date)} at {formatTime(showTxDetailsModal.transaction_date)}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <Badge variant={showTxDetailsModal.provider_status === 'success' ? 'success' : 'warning'}>
                  {showTxDetailsModal.provider_status}
                </Badge>
                <Badge variant={showTxDetailsModal.verification_status === 'verified' ? 'success' : 'default'}>
                  {showTxDetailsModal.verification_status}
                </Badge>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Provider</span>
                <div style={{ fontWeight: 600, textTransform: 'uppercase' }}>{showTxDetailsModal.provider}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Source</span>
                <div style={{ fontWeight: 600 }}>{showTxDetailsModal.source}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Reference Number</span>
                <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{showTxDetailsModal.provider_reference}</div>
              </div>
              {showTxDetailsModal.counterparty_name && (
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Counterparty</span>
                  <div style={{ fontWeight: 600 }}>{showTxDetailsModal.counterparty_name}</div>
                </div>
              )}
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Narration / Description</span>
                <div style={{ fontWeight: 500 }}>{showTxDetailsModal.description || 'N/A'}</div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Accounting Ledger Status</span>
                <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{showTxDetailsModal.accounting_status}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, borderTop: '1px solid var(--bg-border)', paddingTop: 14 }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const tx = showTxDetailsModal;
                  setShowTxDetailsModal(null);
                  openReconcileModal(tx);
                }}
              >
                Classify to Accounting
              </Button>
              <Button variant="primary" size="sm" onClick={() => setShowTxDetailsModal(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: RECONCILE / CLASSIFY TO ACCOUNTING LEDGER                    */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <Modal
        open={!!showReconcileModal}
        onClose={() => setShowReconcileModal(null)}
        title="Classify Transaction into Rova Accounting"
        size="md"
      >
        {showReconcileModal && (
          <form onSubmit={handleReconcile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', fontSize: 12 }}>
              <div>Classifying: <strong>{showReconcileModal.description}</strong></div>
              <div>Amount: <strong>{formatCurrency(showReconcileModal.amount, showReconcileModal.currency)}</strong> (Ref: {showReconcileModal.provider_reference})</div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Accounting Classification *</label>
              <select
                value={reconcileType}
                onChange={e => setReconcileType(e.target.value as any)}
                style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
              >
                <option value="income">Business Income / Sales</option>
                <option value="expense">Business Expense</option>
                <option value="transfer">Internal Transfer between Business Accounts</option>
                <option value="ignored">Ignore (Do not include in financial reports)</option>
              </select>
            </div>

            {reconcileType !== 'ignored' && (
              <>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Category</label>
                  <select
                    value={reconcileCategory}
                    onChange={e => setReconcileCategory(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                  >
                    <option value="">(Select Category)</option>
                    {categories
                      .filter(c => reconcileType === 'transfer' || c.type === reconcileType || c.type === 'both')
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Destination Account</label>
                  <select
                    value={reconcileAccount}
                    onChange={e => setReconcileAccount(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', color: 'var(--text-primary)' }}
                  >
                    <option value="">(None)</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.institution})
                      </option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Accounting Notes"
                  placeholder="Additional context or notes for your accountant"
                  value={reconcileNotes}
                  onChange={e => setReconcileNotes(e.target.value)}
                />
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <Button variant="secondary" type="button" onClick={() => setShowReconcileModal(null)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={reconciling}>
                Save Classification
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
