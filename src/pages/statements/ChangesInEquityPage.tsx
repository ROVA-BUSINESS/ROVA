import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Transaction, type Account } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { downloadCSV, downloadExcelWorkbook, printStatementHTML } from '../../lib/export';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useMobile } from '../../hooks/useMobile';
import { 
  Download, Printer, ChevronDown, Plus, Trash2, CheckCircle2, 
  AlertCircle, Scale, SlidersHorizontal
} from 'lucide-react';

export type EquityMovement = {
  id: string;
  year: number;
  description: string;
  category: 'capital_issue' | 'capital_contribution' | 'profit_loss' | 'dividends' | 'reserve_transfer' | 'prior_period' | 'other';
  shareCapital: number;
  sharePremium: number;
  retainedEarnings: number;
  otherReserves: number;
  notes?: string;
  created_at: string;
};

export type OpeningEquityConfig = {
  shareCapital: number;
  sharePremium: number;
  retainedEarnings: number;
  otherReserves: number;
  isCustom: boolean;
};

export default function ChangesInEquityPage() {
  const { user, profile } = useAuth();
  const isMobile = useMobile(1024);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAddMovementModal, setShowAddMovementModal] = useState(false);
  const [showOpeningConfigModal, setShowOpeningConfigModal] = useState(false);
  const [comparativeView, setComparativeView] = useState(false);

  // Form states
  const [preparedBy, setPreparedBy] = useState(() => localStorage.getItem(`rova_soce_prepared_${user?.id}`) || profile?.full_name || 'Chief Accountant');
  const [approvedBy, setApprovedBy] = useState(() => localStorage.getItem(`rova_soce_approved_${user?.id}`) || 'Board of Directors');

  // Manual movements persisted to localStorage
  const [customMovements, setCustomMovements] = useState<EquityMovement[]>(() => {
    if (!user) return [];
    try {
      const saved = localStorage.getItem(`rova_equity_movements_${user.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Manual opening balances overrides (for migrated companies)
  const [customOpening, setCustomOpening] = useState<Record<number, OpeningEquityConfig>>(() => {
    if (!user) return {};
    try {
      const saved = localStorage.getItem(`rova_equity_opening_${user.id}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // New movement form state
  const [movementForm, setMovementForm] = useState<{
    description: string;
    category: EquityMovement['category'];
    shareCapital: string;
    sharePremium: string;
    retainedEarnings: string;
    otherReserves: string;
    notes: string;
  }>({
    description: '',
    category: 'capital_contribution',
    shareCapital: '',
    sharePremium: '',
    retainedEarnings: '',
    otherReserves: '',
    notes: ''
  });

  // Opening config form state
  const [openingForm, setOpeningForm] = useState({
    shareCapital: '',
    sharePremium: '',
    retainedEarnings: '',
    otherReserves: '',
  });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`rova_soce_prepared_${user.id}`, preparedBy);
    }
  }, [preparedBy, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`rova_soce_approved_${user.id}`, approvedBy);
    }
  }, [approvedBy, user]);

  async function loadData() {
    setLoading(true);
    try {
      const [txRes, accRes] = await Promise.all([
        supabase.from('transactions').select('*, category:categories(*)').eq('user_id', user!.id).order('date', { ascending: true }),
        supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true)
      ]);
      setTransactions(txRes.data || []);
      setAccounts(accRes.data || []);
    } catch (err) {
      console.error('Failed to load accounting data for SOCE:', err);
    } finally {
      setLoading(false);
    }
  }

  // Available financial years from transactions or default
  const availableYears = useMemo(() => {
    const years = new Set(transactions.map(t => new Date(t.date).getFullYear()));
    years.add(new Date().getFullYear());
    years.add(new Date().getFullYear() - 1);
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Save custom movements to localStorage
  function saveMovements(movements: EquityMovement[]) {
    setCustomMovements(movements);
    if (user) {
      localStorage.setItem(`rova_equity_movements_${user.id}`, JSON.stringify(movements));
    }
  }

  // Save custom opening balances
  function saveOpeningConfig(newConfigs: Record<number, OpeningEquityConfig>) {
    setCustomOpening(newConfigs);
    if (user) {
      localStorage.setItem(`rova_equity_opening_${user.id}`, JSON.stringify(newConfigs));
    }
  }

  // Helper to compute statement for any given financial year
  function computeStatementForYear(targetYear: number) {
    // 1. Transactions strictly before this year (Opening retained earnings)
    const priorTxs = transactions.filter(t => new Date(t.date).getFullYear() < targetYear);
    const priorIncome = priorTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const priorExpenses = priorTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const computedPriorRetained = priorIncome - priorExpenses;

    // Prior equity transactions (e.g. founder funding tagged in previous years)
    const priorEquityIncome = priorTxs.filter(t => {
      const desc = (t.description || '').toLowerCase();
      const cat = ((t.category as any)?.name || '').toLowerCase();
      return t.type === 'income' && (desc.includes('equity') || desc.includes('share capital') || desc.includes('founder') || cat.includes('equity'));
    }).reduce((s, t) => s + t.amount, 0);

    // Check if user set custom opening balances
    const customOp = customOpening[targetYear];
    const openingShareCapital = customOp ? customOp.shareCapital : priorEquityIncome;
    const openingSharePremium = customOp ? customOp.sharePremium : 0;
    const openingRetainedEarnings = customOp ? customOp.retainedEarnings : computedPriorRetained;
    const openingOtherReserves = customOp ? customOp.otherReserves : 0;
    const openingTotalEquity = openingShareCapital + openingSharePremium + openingRetainedEarnings + openingOtherReserves;

    // 2. Transactions during targetYear
    const yearTxs = transactions.filter(t => new Date(t.date).getFullYear() === targetYear);
    const currentIncome = yearTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const currentExpenses = yearTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const netProfitForYear = currentIncome - currentExpenses; // Matches P&L exactly

    // Automatically detect auto-equity transactions in current year
    const autoEquityContributions = yearTxs.filter(t => {
      const desc = (t.description || '').toLowerCase();
      const cat = ((t.category as any)?.name || '').toLowerCase();
      return t.type === 'income' && (desc.includes('capital contribution') || desc.includes('founder funding') || desc.includes('share capital') || cat.includes('equity'));
    }).reduce((s, t) => s + t.amount, 0);

    // 3. User custom movements for this year
    const yearCustomMovements = customMovements.filter(m => m.year === targetYear);

    // Group movements
    const movements = [
      ...(autoEquityContributions > 0 ? [{
        id: 'auto-capital-contrib',
        description: 'Founder / Shareholder capital contribution (Recorded in ledger)',
        shareCapital: autoEquityContributions,
        sharePremium: 0,
        retainedEarnings: 0,
        otherReserves: 0,
        total: autoEquityContributions,
        isAuto: true,
      }] : []),
      ...yearCustomMovements.map(m => ({
        id: m.id,
        description: m.description,
        shareCapital: m.shareCapital,
        sharePremium: m.sharePremium,
        retainedEarnings: m.retainedEarnings,
        otherReserves: m.otherReserves,
        total: m.shareCapital + m.sharePremium + m.retainedEarnings + m.otherReserves,
        isAuto: false,
      })),
      {
        id: 'pl-net-profit',
        description: netProfitForYear >= 0 
          ? 'Profit for the financial year (transferred from Profit & Loss)' 
          : 'Loss for the financial year (transferred from Profit & Loss)',
        shareCapital: 0,
        sharePremium: 0,
        retainedEarnings: netProfitForYear,
        otherReserves: 0,
        total: netProfitForYear,
        isAuto: true,
      }
    ];

    // Total movements sum
    const totalMovementsShareCapital = movements.reduce((s, m) => s + m.shareCapital, 0);
    const totalMovementsSharePremium = movements.reduce((s, m) => s + m.sharePremium, 0);
    const totalMovementsRetainedEarnings = movements.reduce((s, m) => s + m.retainedEarnings, 0);
    const totalMovementsOtherReserves = movements.reduce((s, m) => s + m.otherReserves, 0);
    const totalMovementsEquity = totalMovementsShareCapital + totalMovementsSharePremium + totalMovementsRetainedEarnings + totalMovementsOtherReserves;

    // Closing balances
    const closingShareCapital = openingShareCapital + totalMovementsShareCapital;
    const closingSharePremium = openingSharePremium + totalMovementsSharePremium;
    const closingRetainedEarnings = openingRetainedEarnings + totalMovementsRetainedEarnings;
    const closingOtherReserves = openingOtherReserves + totalMovementsOtherReserves;
    const closingTotalEquity = closingShareCapital + closingSharePremium + closingRetainedEarnings + closingOtherReserves;

    return {
      year: targetYear,
      opening: {
        shareCapital: openingShareCapital,
        sharePremium: openingSharePremium,
        retainedEarnings: openingRetainedEarnings,
        otherReserves: openingOtherReserves,
        total: openingTotalEquity,
        isCustom: !!customOp,
      },
      movements,
      totalMovements: {
        shareCapital: totalMovementsShareCapital,
        sharePremium: totalMovementsSharePremium,
        retainedEarnings: totalMovementsRetainedEarnings,
        otherReserves: totalMovementsOtherReserves,
        total: totalMovementsEquity,
      },
      closing: {
        shareCapital: closingShareCapital,
        sharePremium: closingSharePremium,
        retainedEarnings: closingRetainedEarnings,
        otherReserves: closingOtherReserves,
        total: closingTotalEquity,
      },
      netProfitForYear,
      currentIncome,
      currentExpenses,
    };
  }

  // Statements for Current and Prior Year
  const currentStatement = useMemo(() => computeStatementForYear(year), [year, transactions, customMovements, customOpening]);
  const priorStatement = useMemo(() => computeStatementForYear(year - 1), [year, transactions, customMovements, customOpening]);

  // Balance Sheet Equity for reconciliation check
  const totalAssets = useMemo(() => accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + a.balance, 0), [accounts]);
  const totalLiabilities = useMemo(() => accounts.filter(a => a.type === 'credit').reduce((s, a) => s + Math.abs(a.balance), 0), [accounts]);
  const balanceSheetEquity = totalAssets - totalLiabilities;
  const isCurrentYear = year === new Date().getFullYear();
  const equityReconciliationDiff = Math.abs(currentStatement.closing.total - balanceSheetEquity);
  const isReconciledWithBalanceSheet = !isCurrentYear || equityReconciliationDiff < 1.0;

  // Validation status
  const validationStatus = useMemo<'Complete & Reconciled' | 'Requires Review'>(() => {
    if (!isCurrentYear) return 'Complete & Reconciled';
    if (isReconciledWithBalanceSheet) return 'Complete & Reconciled';
    return 'Requires Review';
  }, [isCurrentYear, isReconciledWithBalanceSheet]);

  const businessName = profile?.business_name || profile?.full_name || 'My Business';
  const rcNumber = profile?.rc_bn_number ? `RC: ${profile.rc_bn_number}` : 'CAC Reg: Unspecified';

  // Handle adding new custom movement
  function handleAddMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!movementForm.description.trim()) return;

    const newMv: EquityMovement = {
      id: `eq-mv-${Date.now()}`,
      year,
      description: movementForm.description.trim(),
      category: movementForm.category,
      shareCapital: Number(movementForm.shareCapital) || 0,
      sharePremium: Number(movementForm.sharePremium) || 0,
      retainedEarnings: Number(movementForm.retainedEarnings) || 0,
      otherReserves: Number(movementForm.otherReserves) || 0,
      notes: movementForm.notes.trim(),
      created_at: new Date().toISOString(),
    };

    saveMovements([...customMovements, newMv]);
    setShowAddMovementModal(false);
    setMovementForm({
      description: '',
      category: 'capital_contribution',
      shareCapital: '',
      sharePremium: '',
      retainedEarnings: '',
      otherReserves: '',
      notes: ''
    });
  }

  // Handle deleting custom movement
  function handleDeleteMovement(id: string) {
    if (!confirm('Remove this equity movement?')) return;
    saveMovements(customMovements.filter(m => m.id !== id));
  }

  // Handle saving custom opening configuration
  function handleSaveOpening(e: React.FormEvent) {
    e.preventDefault();
    const updated = {
      ...customOpening,
      [year]: {
        shareCapital: Number(openingForm.shareCapital) || 0,
        sharePremium: Number(openingForm.sharePremium) || 0,
        retainedEarnings: Number(openingForm.retainedEarnings) || 0,
        otherReserves: Number(openingForm.otherReserves) || 0,
        isCustom: true,
      }
    };
    saveOpeningConfig(updated);
    setShowOpeningConfigModal(false);
  }

  function handleResetOpening() {
    const updated = { ...customOpening };
    delete updated[year];
    saveOpeningConfig(updated);
    setShowOpeningConfigModal(false);
  }

  // Format table amount cells with accounting parenthesis for negative
  function renderAmount(val: number) {
    if (val === 0) return <span style={{ color: 'var(--text-disabled)' }}>—</span>;
    const formatted = formatCurrency(Math.abs(val));
    if (val < 0) {
      return <span style={{ color: 'var(--error)', fontFamily: 'Space Grotesk, monospace' }}>({formatted})</span>;
    }
    return <span style={{ color: 'var(--text-primary)', fontFamily: 'Space Grotesk, monospace' }}>{formatted}</span>;
  }

  // Export CSV
  function handleExportCSV() {
    const rows: (string | number)[][] = [];
    rows.push([`${businessName} - STATEMENT OF CHANGES IN EQUITY`]);
    rows.push([`For the year ended 31 December ${year}`]);
    rows.push([`Currency: Nigerian Naira (NGN)`]);
    rows.push([]);
    rows.push(['Description', 'Share Capital', 'Share Premium', 'Retained Earnings', 'Other Reserves', 'Total Equity']);

    // Opening
    rows.push([
      `Balance at 1 January ${year}`,
      currentStatement.opening.shareCapital,
      currentStatement.opening.sharePremium,
      currentStatement.opening.retainedEarnings,
      currentStatement.opening.otherReserves,
      currentStatement.opening.total
    ]);

    // Movements
    currentStatement.movements.forEach(m => {
      rows.push([m.description, m.shareCapital, m.sharePremium, m.retainedEarnings, m.otherReserves, m.total]);
    });

    // Total movements
    rows.push([
      'Total Movements during the year',
      currentStatement.totalMovements.shareCapital,
      currentStatement.totalMovements.sharePremium,
      currentStatement.totalMovements.retainedEarnings,
      currentStatement.totalMovements.otherReserves,
      currentStatement.totalMovements.total
    ]);

    // Closing
    rows.push([
      `Balance at 31 December ${year}`,
      currentStatement.closing.shareCapital,
      currentStatement.closing.sharePremium,
      currentStatement.closing.retainedEarnings,
      currentStatement.closing.otherReserves,
      currentStatement.closing.total
    ]);

    downloadCSV(`statement-of-changes-in-equity-${year}.csv`, ['Description', 'Share Capital', 'Share Premium', 'Retained Earnings', 'Other Reserves', 'Total Equity'], rows.slice(4));
    setShowExportMenu(false);
  }

  // Export Excel (.xlsx)
  function handleExportExcel() {
    const currentRows: (string | number)[][] = [
      [`${businessName}`],
      [`STATEMENT OF CHANGES IN EQUITY - FINANCIAL YEAR ${year}`],
      [`Registration: ${rcNumber} | Currency: NGN (₦)`],
      [],
      ['Line Item / Description', 'Share Capital (NGN)', 'Share Premium (NGN)', 'Retained Earnings (NGN)', 'Other Reserves (NGN)', 'Total Equity (NGN)'],
      [
        `Balance as at 1 January ${year}`,
        currentStatement.opening.shareCapital,
        currentStatement.opening.sharePremium,
        currentStatement.opening.retainedEarnings,
        currentStatement.opening.otherReserves,
        currentStatement.opening.total
      ],
      ...currentStatement.movements.map(m => [
        m.description,
        m.shareCapital,
        m.sharePremium,
        m.retainedEarnings,
        m.otherReserves,
        m.total
      ]),
      [
        'Total Movements during Year',
        currentStatement.totalMovements.shareCapital,
        currentStatement.totalMovements.sharePremium,
        currentStatement.totalMovements.retainedEarnings,
        currentStatement.totalMovements.otherReserves,
        currentStatement.totalMovements.total
      ],
      [
        `Balance as at 31 December ${year}`,
        currentStatement.closing.shareCapital,
        currentStatement.closing.sharePremium,
        currentStatement.closing.retainedEarnings,
        currentStatement.closing.otherReserves,
        currentStatement.closing.total
      ]
    ];

    const priorRows: (string | number)[][] = [
      [`${businessName}`],
      [`COMPARATIVE STATEMENT OF CHANGES IN EQUITY - FINANCIAL YEAR ${year - 1}`],
      [`Registration: ${rcNumber} | Currency: NGN (₦)`],
      [],
      ['Line Item / Description', 'Share Capital (NGN)', 'Share Premium (NGN)', 'Retained Earnings (NGN)', 'Other Reserves (NGN)', 'Total Equity (NGN)'],
      [
        `Balance as at 1 January ${year - 1}`,
        priorStatement.opening.shareCapital,
        priorStatement.opening.sharePremium,
        priorStatement.opening.retainedEarnings,
        priorStatement.opening.otherReserves,
        priorStatement.opening.total
      ],
      ...priorStatement.movements.map(m => [
        m.description,
        m.shareCapital,
        m.sharePremium,
        m.retainedEarnings,
        m.otherReserves,
        m.total
      ]),
      [
        `Balance as at 31 December ${year - 1}`,
        priorStatement.closing.shareCapital,
        priorStatement.closing.sharePremium,
        priorStatement.closing.retainedEarnings,
        priorStatement.closing.otherReserves,
        priorStatement.closing.total
      ]
    ];

    downloadExcelWorkbook(`ROVA-Statement-Of-Changes-In-Equity-${year}.xlsx`, [
      { sheetName: `Equity ${year}`, rows: currentRows },
      { sheetName: `Comparative ${year - 1}`, rows: priorRows }
    ]);
    setShowExportMenu(false);
  }

  // Print / PDF
  function handlePrint() {
    const renderPrintVal = (v: number) => {
      if (v === 0) return '—';
      if (v < 0) return `(${formatCurrency(Math.abs(v))})`;
      return formatCurrency(v);
    };

    const movementRowsHtml = currentStatement.movements.map(m => `
      <tr class="line-row">
        <td>${m.description}</td>
        <td class="amount">${renderPrintVal(m.shareCapital)}</td>
        <td class="amount">${renderPrintVal(m.sharePremium)}</td>
        <td class="amount">${renderPrintVal(m.retainedEarnings)}</td>
        <td class="amount">${renderPrintVal(m.otherReserves)}</td>
        <td class="amount" style="font-weight:600">${renderPrintVal(m.total)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-size: 11px; color: #4b5563; margin-bottom: 16px;">
        <strong>Company:</strong> ${businessName} &nbsp;|&nbsp; <strong>${rcNumber}</strong> &nbsp;|&nbsp; <strong>Reporting Currency:</strong> Nigerian Naira (NGN - ₦)
      </div>
      <table>
        <thead>
          <tr class="section-header">
            <th style="text-align:left">Description</th>
            <th style="text-align:right">Share Capital</th>
            <th style="text-align:right">Share Premium</th>
            <th style="text-align:right">Retained Earnings</th>
            <th style="text-align:right">Other Reserves</th>
            <th style="text-align:right">Total Equity</th>
          </tr>
        </thead>
        <tbody>
          <tr class="subtotal-row">
            <td><strong>Balance as at 1 January ${year}</strong></td>
            <td class="amount">${renderPrintVal(currentStatement.opening.shareCapital)}</td>
            <td class="amount">${renderPrintVal(currentStatement.opening.sharePremium)}</td>
            <td class="amount">${renderPrintVal(currentStatement.opening.retainedEarnings)}</td>
            <td class="amount">${renderPrintVal(currentStatement.opening.otherReserves)}</td>
            <td class="amount"><strong>${renderPrintVal(currentStatement.opening.total)}</strong></td>
          </tr>
          ${movementRowsHtml}
          <tr class="subtotal-row" style="background:#f9fafb; border-top:1px solid #d1d5db">
            <td><strong>Net movements during the year</strong></td>
            <td class="amount">${renderPrintVal(currentStatement.totalMovements.shareCapital)}</td>
            <td class="amount">${renderPrintVal(currentStatement.totalMovements.sharePremium)}</td>
            <td class="amount">${renderPrintVal(currentStatement.totalMovements.retainedEarnings)}</td>
            <td class="amount">${renderPrintVal(currentStatement.totalMovements.otherReserves)}</td>
            <td class="amount"><strong>${renderPrintVal(currentStatement.totalMovements.total)}</strong></td>
          </tr>
          <tr class="total-row">
            <td><strong>Balance as at 31 December ${year}</strong></td>
            <td class="amount">${renderPrintVal(currentStatement.closing.shareCapital)}</td>
            <td class="amount">${renderPrintVal(currentStatement.closing.sharePremium)}</td>
            <td class="amount">${renderPrintVal(currentStatement.closing.retainedEarnings)}</td>
            <td class="amount">${renderPrintVal(currentStatement.closing.otherReserves)}</td>
            <td class="amount"><strong>${renderPrintVal(currentStatement.closing.total)}</strong></td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; border-top: 1px dashed #d1d5db; padding-top: 24px;">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 24px;">Prepared By:</div>
          <div style="border-bottom: 1px solid #9ca3af; width: 80%; height: 20px;"></div>
          <div style="font-size: 12px; font-weight: 600; margin-top: 6px;">${preparedBy}</div>
          <div style="font-size: 11px; color: #6b7280;">Principal Accounting Officer / Head of Finance</div>
        </div>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 24px;">Approved By:</div>
          <div style="border-bottom: 1px solid #9ca3af; width: 80%; height: 20px;"></div>
          <div style="font-size: 12px; font-weight: 600; margin-top: 6px;">${approvedBy}</div>
          <div style="font-size: 11px; color: #6b7280;">Director / Board Representative</div>
        </div>
      </div>
    `;

    printStatementHTML('Statement of Changes in Equity', `For the year ended 31 December ${year}`, businessName, html);
    setShowExportMenu(false);
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1150, margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      {/* Header bar */}
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Statement of Changes in Equity</h1>
            <Badge variant={validationStatus === 'Complete & Reconciled' ? 'success' : 'warning'}>
              {validationStatus === 'Complete & Reconciled' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} /> Reconciled
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={12} /> Requires Review
                </span>
              )}
            </Badge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Share capital, share premium, retained earnings, reserves and equity movements for {year}
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            value={year} 
            onChange={e => setYear(Number(e.target.value))}
            style={{ 
              padding: '7px 12px', 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--bg-border)', 
              borderRadius: 'var(--radius-md)', 
              color: 'var(--text-primary)', 
              outline: 'none', 
              fontSize: 13,
              cursor: 'pointer' 
            }}
          >
            {availableYears.map(y => <option key={y} value={y}>FY {y}</option>)}
          </select>

          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => setComparativeView(v => !v)}
            style={{ fontSize: 12 }}
          >
            {comparativeView ? 'Current Year Only' : 'Compare FY ' + (year - 1)}
          </Button>

          <Button 
            variant="secondary" 
            size="sm"
            icon={<SlidersHorizontal size={13} />}
            onClick={() => {
              const currentOp = currentStatement.opening;
              setOpeningForm({
                shareCapital: String(currentOp.shareCapital || ''),
                sharePremium: String(currentOp.sharePremium || ''),
                retainedEarnings: String(currentOp.retainedEarnings || ''),
                otherReserves: String(currentOp.otherReserves || ''),
              });
              setShowOpeningConfigModal(true);
            }}
          >
            Opening Balances
          </Button>

          <Button 
            variant="primary" 
            size="sm"
            icon={<Plus size={14} />} 
            onClick={() => setShowAddMovementModal(true)}
          >
            Record Movement
          </Button>

          <div style={{ position: 'relative' }}>
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => setShowExportMenu(v => !v)}>
              Export <ChevronDown size={11} style={{ marginLeft: 2 }} />
            </Button>
            {showExportMenu && (
              <div style={{ 
                position: 'absolute', top: '100%', right: 0, marginTop: 4, 
                background: 'var(--bg-card)', border: '1px solid var(--bg-border)', 
                borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', 
                zIndex: 100, minWidth: 170, overflow: 'hidden' 
              }}>
                <button onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
                  <Download size={13} color="var(--success)" /> Export Excel (.xlsx)
                </button>
                <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', background: 'transparent', border: 'none', borderTop: '1px solid var(--bg-border)', textAlign: 'left', cursor: 'pointer' }}>
                  <Download size={13} color="var(--text-muted)" /> Export CSV
                </button>
                <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', background: 'transparent', border: 'none', borderTop: '1px solid var(--bg-border)', textAlign: 'left', cursor: 'pointer' }}>
                  <Printer size={13} color="var(--text-muted)" /> Print / Save PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Opening Equity (1 Jan)
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
            {formatCurrency(currentStatement.opening.total)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {currentStatement.opening.isCustom ? 'Configured historical baseline' : 'Calculated from ledger history'}
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Current Year Profit / (Loss)
          </div>
          <div style={{ 
            fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', 
            color: currentStatement.netProfitForYear >= 0 ? 'var(--success)' : 'var(--error)' 
          }}>
            {currentStatement.netProfitForYear < 0 ? '-' : ''}{formatCurrency(Math.abs(currentStatement.netProfitForYear))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Reconciles with Profit & Loss
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Net Equity Movements
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
            {formatCurrency(currentStatement.totalMovements.total)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Capital + Profit - Dividends
          </div>
        </Card>

        <Card style={{ 
          border: isReconciledWithBalanceSheet ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
          background: isReconciledWithBalanceSheet ? 'var(--success-dim)' : 'var(--error-dim)'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Closing Equity (31 Dec)
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
            {formatCurrency(currentStatement.closing.total)}
          </div>
          <div style={{ fontSize: 11, color: isReconciledWithBalanceSheet ? 'var(--success)' : 'var(--error)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Scale size={12} /> {isReconciledWithBalanceSheet ? 'Matches Balance Sheet Net Assets' : `Variance: ${formatCurrency(equityReconciliationDiff)}`}
          </div>
        </Card>
      </div>

      {/* Main Statement Table */}
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Financial Year {year} Movement Breakdown</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>All values in Nigerian Naira (NGN - ₦)</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {businessName} • {rcNumber}
          </div>
        </div>

        <div className="mobile-table-container">
          <table className="transaction-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Line Item / Description</th>
                <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Share Capital</th>
                <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Share Premium</th>
                <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Retained Earnings</th>
                <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Other Reserves</th>
                <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Equity</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {/* SECTION A: OPENING BALANCES */}
              <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--bg-border)' }}>
                <td style={{ padding: '14px 18px', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                  Balance at 1 January {year}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontSize: 13 }}>
                  {renderAmount(currentStatement.opening.shareCapital)}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontSize: 13 }}>
                  {renderAmount(currentStatement.opening.sharePremium)}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontSize: 13 }}>
                  {renderAmount(currentStatement.opening.retainedEarnings)}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontSize: 13 }}>
                  {renderAmount(currentStatement.opening.otherReserves)}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                  {renderAmount(currentStatement.opening.total)}
                </td>
                <td></td>
              </tr>

              {/* SECTION B: MOVEMENTS DURING THE YEAR */}
              {currentStatement.movements.map((mv, idx) => (
                <tr 
                  key={mv.id || idx} 
                  style={{ borderBottom: '1px solid var(--bg-border)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 18px 12px 30px', fontSize: 13, color: 'var(--text-secondary)' }}>
                    {mv.description}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13 }}>
                    {renderAmount(mv.shareCapital)}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13 }}>
                    {renderAmount(mv.sharePremium)}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13 }}>
                    {renderAmount(mv.retainedEarnings)}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13 }}>
                    {renderAmount(mv.otherReserves)}
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                    {renderAmount(mv.total)}
                  </td>
                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                    {!mv.isAuto && (
                      <button 
                        onClick={() => handleDeleteMovement(mv.id)}
                        title="Delete movement"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--error)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {/* SUBTOTAL OF MOVEMENTS */}
              <tr style={{ background: 'rgba(255, 255, 255, 0.015)', borderBottom: '1px solid var(--bg-border)' }}>
                <td style={{ padding: '12px 18px', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                  Total movements for the year
                </td>
                <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                  {renderAmount(currentStatement.totalMovements.shareCapital)}
                </td>
                <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                  {renderAmount(currentStatement.totalMovements.sharePremium)}
                </td>
                <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                  {renderAmount(currentStatement.totalMovements.retainedEarnings)}
                </td>
                <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                  {renderAmount(currentStatement.totalMovements.otherReserves)}
                </td>
                <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                  {renderAmount(currentStatement.totalMovements.total)}
                </td>
                <td></td>
              </tr>

              {/* SECTION C: CLOSING BALANCES */}
              <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--bg-border)' }}>
                <td style={{ padding: '14px 18px', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                  Balance at 31 December {year}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                  {renderAmount(currentStatement.closing.shareCapital)}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                  {renderAmount(currentStatement.closing.sharePremium)}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                  {renderAmount(currentStatement.closing.retainedEarnings)}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>
                  {renderAmount(currentStatement.closing.otherReserves)}
                </td>
                <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, fontSize: 15, color: 'var(--accent-primary)' }}>
                  {renderAmount(currentStatement.closing.total)}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Comparative View (Prior Year) if toggled */}
      {comparativeView && (
        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 24, border: '1px solid var(--accent-dim)' }}>
          <div style={{ padding: '14px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-primary)' }}>
              Comparative Prior Year: FY {year - 1} Movement Breakdown
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Closing equity for {year - 1} reconciles with opening equity for {year}
            </div>
          </div>
          <div className="mobile-table-container">
            <table className="transaction-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                  <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Share Capital</th>
                  <th style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Share Premium</th>
                  <th style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retained Earnings</th>
                  <th style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Other Reserves</th>
                  <th style={{ padding: '10px 18px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>Total Equity</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 600, fontSize: 13 }}>Balance at 1 Jan {year - 1}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13 }}>{renderAmount(priorStatement.opening.shareCapital)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13 }}>{renderAmount(priorStatement.opening.sharePremium)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13 }}>{renderAmount(priorStatement.opening.retainedEarnings)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontSize: 13 }}>{renderAmount(priorStatement.opening.otherReserves)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{renderAmount(priorStatement.opening.total)}</td>
                </tr>
                {priorStatement.movements.map((m, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                    <td style={{ padding: '10px 18px 10px 30px', fontSize: 12, color: 'var(--text-secondary)' }}>{m.description}</td>
                    <td style={{ padding: '10px 18px', textAlign: 'right', fontSize: 12 }}>{renderAmount(m.shareCapital)}</td>
                    <td style={{ padding: '10px 18px', textAlign: 'right', fontSize: 12 }}>{renderAmount(m.sharePremium)}</td>
                    <td style={{ padding: '10px 18px', textAlign: 'right', fontSize: 12 }}>{renderAmount(m.retainedEarnings)}</td>
                    <td style={{ padding: '10px 18px', textAlign: 'right', fontSize: 12 }}>{renderAmount(m.otherReserves)}</td>
                    <td style={{ padding: '10px 18px', textAlign: 'right', fontSize: 12, fontWeight: 600 }}>{renderAmount(m.total)}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--bg-border)' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 700, fontSize: 13 }}>Balance at 31 Dec {year - 1}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{renderAmount(priorStatement.closing.shareCapital)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{renderAmount(priorStatement.closing.sharePremium)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{renderAmount(priorStatement.closing.retainedEarnings)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>{renderAmount(priorStatement.closing.otherReserves)}</td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, fontSize: 14 }}>{renderAmount(priorStatement.closing.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Accounting Disclosures & Sign-off Metadata */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Scale size={16} color="var(--accent-primary)" /> Accounting & Audit Controls
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px 0' }}>
              • <strong>Reconciliation with P&L:</strong> Current year net profit / (loss) of {formatCurrency(currentStatement.netProfitForYear)} matches the general ledger and Profit & Loss Statement.
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              • <strong>Reconciliation with Balance Sheet:</strong> Total closing equity {formatCurrency(currentStatement.closing.total)} 
              {isReconciledWithBalanceSheet 
                ? ' agrees with net assets (Assets minus Liabilities) on the Balance Sheet.' 
                : ` shows a variance of ${formatCurrency(equityReconciliationDiff)} against current balance sheet accounts.`}
            </p>
            <p style={{ margin: 0 }}>
              • <strong>Pre-revenue & Loss Policies:</strong> Pre-revenue setups incur operating losses which are appropriately classified under accumulated losses within Retained Earnings rather than reducing legal Share Capital.
            </p>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            Report Sign-off & Metadata
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Prepared By (Principal Accounting Officer):</label>
              <input 
                value={preparedBy} 
                onChange={e => setPreparedBy(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Approved By (Director / Board):</label>
              <input 
                value={approvedBy} 
                onChange={e => setApprovedBy(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13 }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* MODAL: Record Movement */}
      {showAddMovementModal && (
        <Modal open={showAddMovementModal} title="Record Equity Movement" onClose={() => setShowAddMovementModal(false)}>
          <form onSubmit={handleAddMovement} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Movement Type / Classification</label>
              <select
                value={movementForm.category}
                onChange={e => {
                  const cat = e.target.value as EquityMovement['category'];
                  let defaultDesc = '';
                  if (cat === 'capital_issue') defaultDesc = 'Issue of new ordinary shares';
                  if (cat === 'capital_contribution') defaultDesc = 'Founder / Shareholder capital injection';
                  if (cat === 'dividends') defaultDesc = 'Interim / Final dividend paid to shareholders';
                  if (cat === 'reserve_transfer') defaultDesc = 'Transfer to statutory reserve';
                  if (cat === 'prior_period') defaultDesc = 'Prior-period accounting adjustment';
                  if (cat === 'other') defaultDesc = 'Other equity movement';

                  setMovementForm(prev => ({ ...prev, category: cat, description: defaultDesc }));
                }}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 13 }}
              >
                <option value="capital_contribution">Founder / Shareholder Capital Contribution</option>
                <option value="capital_issue">Issue of Ordinary Shares</option>
                <option value="dividends">Dividends Declared or Paid</option>
                <option value="reserve_transfer">Transfer to / from Reserves</option>
                <option value="prior_period">Prior-Period Adjustment</option>
                <option value="other">Other Equity Movement</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description / Narration</label>
              <Input
                placeholder="e.g. Founder cash injection for early operating runway"
                value={movementForm.description}
                onChange={e => setMovementForm(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Share Capital (₦)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={movementForm.shareCapital}
                  onChange={e => setMovementForm(prev => ({ ...prev, shareCapital: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Share Premium (₦)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={movementForm.sharePremium}
                  onChange={e => setMovementForm(prev => ({ ...prev, sharePremium: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Retained Earnings (₦)</label>
                <Input
                  type="number"
                  placeholder="Negative for dividend reduction"
                  value={movementForm.retainedEarnings}
                  onChange={e => setMovementForm(prev => ({ ...prev, retainedEarnings: e.target.value }))}
                />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Use negative (e.g. -500000) for dividends</span>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Other Reserves (₦)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={movementForm.otherReserves}
                  onChange={e => setMovementForm(prev => ({ ...prev, otherReserves: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Board Resolution / Reference Notes</label>
              <Input
                placeholder="Optional resolution number or auditor reference"
                value={movementForm.notes}
                onChange={e => setMovementForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <Button type="button" variant="secondary" onClick={() => setShowAddMovementModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Add Movement</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Configure Opening Balances */}
      {showOpeningConfigModal && (
        <Modal open={showOpeningConfigModal} title={`Configure Opening Balances for FY ${year}`} onClose={() => setShowOpeningConfigModal(false)}>
          <form onSubmit={handleSaveOpening} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Use this if your company incorporated in prior years and you are migrating historical opening balances from your previous audit or paper records.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Ordinary Share Capital (₦)</label>
                <Input
                  type="number"
                  value={openingForm.shareCapital}
                  placeholder="0.00"
                  onChange={e => setOpeningForm(prev => ({ ...prev, shareCapital: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Share Premium (₦)</label>
                <Input
                  type="number"
                  value={openingForm.sharePremium}
                  placeholder="0.00"
                  onChange={e => setOpeningForm(prev => ({ ...prev, sharePremium: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Opening Retained Earnings / (Loss) (₦)</label>
                <Input
                  type="number"
                  value={openingForm.retainedEarnings}
                  placeholder="0.00 (negative for accumulated loss)"
                  onChange={e => setOpeningForm(prev => ({ ...prev, retainedEarnings: e.target.value }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Opening Other Reserves (₦)</label>
                <Input
                  type="number"
                  value={openingForm.otherReserves}
                  placeholder="0.00"
                  onChange={e => setOpeningForm(prev => ({ ...prev, otherReserves: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <Button type="button" variant="danger" size="sm" onClick={handleResetOpening}>
                Reset to Auto Ledger
              </Button>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button type="button" variant="secondary" onClick={() => setShowOpeningConfigModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Save Opening Baseline</Button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
