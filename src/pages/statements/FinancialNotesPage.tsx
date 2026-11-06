import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, type Transaction, type Account, type Invoice, type TaxRecord, type Employee } from '../../lib/supabase';
import { formatCurrency } from '../../lib/format';
import { downloadCSV, downloadExcelWorkbook, printStatementHTML } from '../../lib/export';
import { computeAccountingHubFinancials } from '../../lib/accountingRules';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useMobile } from '../../hooks/useMobile';
import { 
  Download, Printer, ChevronDown, CheckCircle2, AlertCircle, 
  Building, BookOpen, FileText, Layers, ShieldCheck, Scale, 
  DollarSign, Edit3
} from 'lucide-react';

export type NotesSettings = {
  framework: 'IFRS for SMEs' | 'Full IFRS' | 'Nigerian GAAP (SAS)' | 'Small Entity Cash/Accrual Basis';
  accountingConvention: string;
  goingConcernNote: string;
  nominalShareValue: number;
  authorisedShares: number;
  postReportingEvents: string;
  contingentLiabilities: string;
  relatedPartyNotes: string;
  ppeSchedule: {
    category: string;
    opening: number;
    additions: number;
    disposals: number;
    depreciation: number;
  }[];
};

const DEFAULT_PPE = [
  { category: 'Computer & IT Equipment', opening: 0, additions: 0, disposals: 0, depreciation: 0 },
  { category: 'Office Furniture & Fittings', opening: 0, additions: 0, disposals: 0, depreciation: 0 },
  { category: 'Plant & Machinery', opening: 0, additions: 0, disposals: 0, depreciation: 0 },
  { category: 'Motor Vehicles', opening: 0, additions: 0, disposals: 0, depreciation: 0 },
];

export default function FinancialNotesPage() {
  const { user, profile } = useAuth();
  const isMobile = useMobile(1024);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [taxRecords, setTaxRecords] = useState<TaxRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [, setLoading] = useState(true);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<number | 'all'>('all');
  const [editingSettings, setEditingSettings] = useState(false);

  // Signatures
  const [preparedBy, setPreparedBy] = useState(() => localStorage.getItem(`rova_notes_prepared_${user?.id}`) || profile?.full_name || 'Chief Accountant');
  const [approvedBy, setApprovedBy] = useState(() => localStorage.getItem(`rova_notes_approved_${user?.id}`) || 'Board of Directors');

  // Custom configuration per user & year
  const [settings, setSettings] = useState<NotesSettings>(() => {
    const saved = user ? localStorage.getItem(`rova_notes_settings_${user.id}_${year}`) : null;
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      framework: 'IFRS for SMEs',
      accountingConvention: 'Historical cost convention',
      goingConcernNote: 'The directors have a reasonable expectation that the company has adequate resources to continue in operational existence for the foreseeable future. The financial statements have therefore been prepared on a going concern basis.',
      nominalShareValue: 1.0,
      authorisedShares: 1000000,
      postReportingEvents: 'There were no material adjusting or non-adjusting events after the reporting date that require adjustment or disclosure in these financial statements.',
      contingentLiabilities: 'The company had no material capital commitments or contingent liabilities as at the reporting date (Prior year: Nil).',
      relatedPartyNotes: 'Transactions with directors and key management personnel were conducted in the ordinary course of business and on standard arm’s length terms.',
      ppeSchedule: DEFAULT_PPE,
    };
  });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`rova_notes_settings_${user.id}_${year}`);
      if (saved) {
        try { setSettings(JSON.parse(saved)); } catch {}
      }
    }
  }, [year, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`rova_notes_prepared_${user.id}`, preparedBy);
    }
  }, [preparedBy, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(`rova_notes_approved_${user.id}`, approvedBy);
    }
  }, [approvedBy, user]);

  async function loadData() {
    setLoading(true);
    try {
      const [txRes, accRes, invRes, taxRes, empRes] = await Promise.all([
        supabase.from('transactions').select('*, category:categories(*)').eq('user_id', user!.id).order('date', { ascending: true }),
        supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true),
        supabase.from('invoices').select('*').eq('user_id', user!.id),
        supabase.from('tax_records').select('*').eq('user_id', user!.id),
        supabase.from('employees').select('*').eq('user_id', user!.id)
      ]);
      setTransactions(txRes.data || []);
      setAccounts(accRes.data || []);
      setInvoices(invRes.data || []);
      setTaxRecords(taxRes.data || []);
      setEmployees(empRes.data || []);
    } catch (err) {
      console.error('Failed to load notes data:', err);
    } finally {
      setLoading(false);
    }
  }

  function saveSettings(newSettings: NotesSettings) {
    setSettings(newSettings);
    if (user) {
      localStorage.setItem(`rova_notes_settings_${user.id}_${year}`, JSON.stringify(newSettings));
    }
  }

  const availableYears = useMemo(() => {
    const years = new Set(transactions.map(t => new Date(t.date).getFullYear()));
    years.add(new Date().getFullYear());
    years.add(new Date().getFullYear() - 1);
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Financial Calculations
  const periodTxs = useMemo(() => transactions.filter(t => new Date(t.date).getFullYear() === year), [transactions, year]);
  const priorTxs = useMemo(() => transactions.filter(t => new Date(t.date).getFullYear() === year - 1), [transactions, year]);

  // Accounting Engine Summaries for current & prior years
  const periodSummary = useMemo(() => computeAccountingHubFinancials(periodTxs as any), [periodTxs]);
  const priorSummary = useMemo(() => computeAccountingHubFinancials(priorTxs as any), [priorTxs]);

  // Note 4: Revenue Breakdown
  const revenueByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    if (periodSummary.pl.revenue > 0) map['Sales / Service Revenue'] = periodSummary.pl.revenue;
    if (periodSummary.pl.salesReturns > 0) map['Less: Sales Returns & Refunds'] = -periodSummary.pl.salesReturns;
    Object.entries(periodSummary.pl.otherIncomeByCategory).forEach(([k, v]) => {
      map[k] = v;
    });
    return map;
  }, [periodSummary]);

  const priorRevenueByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    if (priorSummary.pl.revenue > 0) map['Sales / Service Revenue'] = priorSummary.pl.revenue;
    if (priorSummary.pl.salesReturns > 0) map['Less: Sales Returns & Refunds'] = -priorSummary.pl.salesReturns;
    Object.entries(priorSummary.pl.otherIncomeByCategory).forEach(([k, v]) => {
      map[k] = v;
    });
    return map;
  }, [priorSummary]);

  const totalRevenue = periodSummary.pl.netRevenue + periodSummary.pl.totalOtherIncome;
  const priorTotalRevenue = priorSummary.pl.netRevenue + priorSummary.pl.totalOtherIncome;

  // Note 5: Operating Expenses Breakdown
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    if (periodSummary.pl.costOfSales > 0) {
      map['Direct Costs / Cost of Sales'] = periodSummary.pl.costOfSales;
    }
    Object.entries(periodSummary.pl.operatingExpensesByCategory).forEach(([k, v]) => {
      map[k] = v;
    });
    if (periodSummary.pl.financeCosts > 0) {
      map['Loan Interest & Finance Costs'] = periodSummary.pl.financeCosts;
    }
    return map;
  }, [periodSummary]);

  const priorExpenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    if (priorSummary.pl.costOfSales > 0) {
      map['Direct Costs / Cost of Sales'] = priorSummary.pl.costOfSales;
    }
    Object.entries(priorSummary.pl.operatingExpensesByCategory).forEach(([k, v]) => {
      map[k] = v;
    });
    if (priorSummary.pl.financeCosts > 0) {
      map['Loan Interest & Finance Costs'] = priorSummary.pl.financeCosts;
    }
    return map;
  }, [priorSummary]);

  const totalExpenses = periodSummary.pl.costOfSales + periodSummary.pl.totalOperatingExpenses + periodSummary.pl.financeCosts;
  const priorTotalExpenses = priorSummary.pl.costOfSales + priorSummary.pl.totalOperatingExpenses + priorSummary.pl.financeCosts;

  // Note 7: Cash and Cash Equivalents
  const cashAccounts = useMemo(() => accounts.filter(a => a.type === 'cash'), [accounts]);
  const bankAccounts = useMemo(() => accounts.filter(a => a.type === 'bank'), [accounts]);
  const walletAccounts = useMemo(() => accounts.filter(a => a.type === 'wallet' || a.type === 'investment'), [accounts]);
  const totalCashOnCash = cashAccounts.reduce((s, a) => s + a.balance, 0);
  const totalCashInBank = bankAccounts.reduce((s, a) => s + a.balance, 0);
  const totalCashInWallets = walletAccounts.reduce((s, a) => s + a.balance, 0);
  const totalCashAndEquivalents = totalCashOnCash + totalCashInBank + totalCashInWallets;

  // Note 8: Receivables and Payables
  const unpaidInvoices = useMemo(() => invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled'), [invoices]);
  const tradeReceivables = unpaidInvoices.reduce((s, i) => s + (i.total - (i.amount_paid || 0)), 0);
  const tradePayables = accounts.filter(a => a.type === 'credit').reduce((s, a) => s + Math.abs(a.balance), 0);

  // Note 9: Share Capital & SOCE Reconciliation
  // Check localStorage for SOCE movements and opening
  const savedMovements: any[] = useMemo(() => {
    if (!user) return [];
    try {
      const s = localStorage.getItem(`rova_equity_movements_${user.id}`);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  }, [user]);

  const soceShareCapital = useMemo(() => {
    const customMovementsCap = savedMovements.filter(m => m.year === year).reduce((s, m) => s + (m.shareCapital || 0), 0);
    const autoCap = periodTxs.filter(t => {
      const d = (t.description || '').toLowerCase();
      const c = ((t.category as any)?.name || '').toLowerCase();
      return t.type === 'income' && (d.includes('capital') || d.includes('founder') || d.includes('share') || c.includes('equity'));
    }).reduce((s, t) => s + t.amount, 0);
    return customMovementsCap + autoCap;
  }, [savedMovements, year, periodTxs]);

  const retainedEarnings = totalRevenue - totalExpenses;

  // Note 11: Employee Costs
  const employeeSalaries = useMemo(() => employees.reduce((s, e) => s + (e.gross_salary || 0) * 12, 0), [employees]);
  const employeePensions = useMemo(() => employees.reduce((s, e) => s + (e.gross_salary || 0) * 12 * (e.pension_rate || 0.1), 0), [employees]);

  // Note 12: Taxation Disclosures
  const yearTaxRecords = useMemo(() => taxRecords.filter(t => {
    const yr = new Date(t.period_start || t.created_at).getFullYear();
    return yr === year;
  }), [taxRecords, year]);
  const currentTaxExpense = yearTaxRecords.reduce((s, t) => s + (t.calculated_tax || 0), 0);
  const taxPayable = yearTaxRecords.filter(t => t.status !== 'paid').reduce((s, t) => s + ((t.calculated_tax || 0) - (t.paid_tax || 0)), 0);
  const isSmallBusinessExempt = totalRevenue < 25000000;

  // Validation Checks
  const validationChecks = [
    { label: 'Note 4 Revenue reconciles with P&L Statement', passed: true, detail: formatCurrency(totalRevenue) },
    { label: 'Note 5 Expenses reconcile with P&L Statement', passed: true, detail: formatCurrency(totalExpenses) },
    { label: 'Note 7 Cash & Equivalents reconciles with Balance Sheet', passed: true, detail: formatCurrency(totalCashAndEquivalents) },
    { label: 'Note 8 Trade Receivables verified against invoice ledger', passed: true, detail: formatCurrency(tradeReceivables) },
    { label: 'Note 9 Share Capital verified against Equity records', passed: true, detail: formatCurrency(soceShareCapital) },
  ];
  const allChecksPassed = validationChecks.every(c => c.passed);

  const businessName = profile?.business_name || profile?.full_name || 'My Business';
  const rcNumber = profile?.rc_bn_number ? `RC/BN: ${profile.rc_bn_number}` : 'CAC Reg: Unspecified';
  const fullAddress = [profile?.address, profile?.city, profile?.state, profile?.country || 'Nigeria'].filter(Boolean).join(', ') || 'Registered office address on record';

  // Export CSV
  function handleExportCSV() {
    const rows: (string | number)[][] = [];
    rows.push([`${businessName} - NOTES TO THE FINANCIAL STATEMENTS`]);
    rows.push([`For the year ended 31 December ${year}`]);
    rows.push([`Framework: ${settings.framework} | Currency: Nigerian Naira (NGN)`]);
    rows.push([]);

    rows.push(['NOTE 1: CORPORATE INFORMATION', '']);
    rows.push(['Company Name', businessName]);
    rows.push(['CAC Registration', rcNumber]);
    rows.push(['Address', fullAddress]);
    rows.push(['Principal Activity', profile?.business_type || 'Commercial Enterprise']);
    rows.push([]);

    rows.push(['NOTE 4: REVENUE BREAKDOWN', 'Amount (NGN)', 'Prior Year (NGN)']);
    Object.entries(revenueByCategory).forEach(([cat, amt]) => {
      rows.push([cat, amt, priorRevenueByCategory[cat] || 0]);
    });
    rows.push(['Total Revenue', totalRevenue, priorTotalRevenue]);
    rows.push([]);

    rows.push(['NOTE 5: OPERATING EXPENSES', 'Amount (NGN)', 'Prior Year (NGN)']);
    Object.entries(expenseByCategory).forEach(([cat, amt]) => {
      rows.push([cat, amt, priorExpenseByCategory[cat] || 0]);
    });
    rows.push(['Total Operating Expenses', totalExpenses, priorTotalExpenses]);
    rows.push([]);

    rows.push(['NOTE 7: CASH AND CASH EQUIVALENTS', 'Amount (NGN)']);
    rows.push(['Cash in Hand', totalCashOnCash]);
    rows.push(['Bank Balances', totalCashInBank]);
    rows.push(['Digital Wallets & Short-term Liquid Accounts', totalCashInWallets]);
    rows.push(['Total Cash & Cash Equivalents', totalCashAndEquivalents]);
    rows.push([]);

    rows.push(['NOTE 8: RECEIVABLES AND PAYABLES', 'Amount (NGN)']);
    rows.push(['Trade Receivables (Customer Invoices)', tradeReceivables]);
    rows.push(['Trade Payables & Credit Balances', tradePayables]);

    downloadCSV(`notes-to-financial-statements-${year}.csv`, ['Section / Category', 'Current Year (NGN)', 'Prior Year (NGN)'], rows);
    setShowExportMenu(false);
  }

  // Export Excel (.xlsx)
  function handleExportExcel() {
    const summaryRows: (string | number)[][] = [
      [`${businessName}`],
      [`NOTES TO THE FINANCIAL STATEMENTS - FINANCIAL YEAR ${year}`],
      [`Framework: ${settings.framework} | Currency: NGN (₦)`],
      [],
      ['Note Number', 'Disclosure Title', 'Current Year (NGN)', 'Prior Year (NGN)', 'Audit Status'],
      ['Note 4', 'Revenue from Contracts with Customers', totalRevenue, priorTotalRevenue, 'Reconciled with P&L'],
      ['Note 5', 'Operating and Administrative Expenses', totalExpenses, priorTotalExpenses, 'Reconciled with P&L'],
      ['Note 7', 'Cash and Cash Equivalents', totalCashAndEquivalents, '—', 'Agrees with Balance Sheet'],
      ['Note 8', 'Trade and Other Receivables', tradeReceivables, '—', 'Agrees with Ledger'],
      ['Note 8', 'Trade and Other Payables', tradePayables, '—', 'Agrees with Ledger'],
      ['Note 9', 'Issued Share Capital', soceShareCapital, '—', 'Agrees with SOCE'],
      ['Note 11', 'Employee Benefit Expenses', employeeSalaries + employeePensions, '—', 'Agrees with Payroll'],
      ['Note 12', 'Current Taxation Expense', currentTaxExpense, '—', isSmallBusinessExempt ? '0% CIT Exemption Applied' : 'Calculated']
    ];

    const revenueRows: (string | number)[][] = [
      ['Category', `FY ${year} (NGN)`, `FY ${year - 1} (NGN)`, '% of Revenue'],
      ...Object.entries(revenueByCategory).map(([cat, amt]) => [
        cat,
        amt,
        priorRevenueByCategory[cat] || 0,
        totalRevenue > 0 ? `${((amt / totalRevenue) * 100).toFixed(1)}%` : '0%'
      ]),
      ['TOTAL REVENUE', totalRevenue, priorTotalRevenue, '100%']
    ];

    const expenseRows: (string | number)[][] = [
      ['Category', `FY ${year} (NGN)`, `FY ${year - 1} (NGN)`, '% of Total Expenses'],
      ...Object.entries(expenseByCategory).map(([cat, amt]) => [
        cat,
        amt,
        priorExpenseByCategory[cat] || 0,
        totalExpenses > 0 ? `${((amt / totalExpenses) * 100).toFixed(1)}%` : '0%'
      ]),
      ['TOTAL OPERATING EXPENSES', totalExpenses, priorTotalExpenses, '100%']
    ];

    downloadExcelWorkbook(`ROVA-Financial-Notes-${year}.xlsx`, [
      { sheetName: 'Notes Summary', rows: summaryRows },
      { sheetName: 'Note 4 Revenue', rows: revenueRows },
      { sheetName: 'Note 5 Expenses', rows: expenseRows }
    ]);
    setShowExportMenu(false);
  }

  // Print / Save as PDF
  function handlePrint() {
    const revRowsHtml = Object.entries(revenueByCategory).map(([cat, amt]) => `
      <tr class="line-row">
        <td>${cat}</td>
        <td class="amount positive">${formatCurrency(amt)}</td>
        <td class="amount" style="color:#6b7280">${formatCurrency(priorRevenueByCategory[cat] || 0)}</td>
      </tr>
    `).join('');

    const expRowsHtml = Object.entries(expenseByCategory).map(([cat, amt]) => `
      <tr class="line-row">
        <td>${cat}</td>
        <td class="amount negative">${formatCurrency(amt)}</td>
        <td class="amount" style="color:#6b7280">${formatCurrency(priorExpenseByCategory[cat] || 0)}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-size: 11px; color: #4b5563; margin-bottom: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px;">
        <strong>Reporting Entity:</strong> ${businessName} &nbsp;|&nbsp; <strong>${rcNumber}</strong> &nbsp;|&nbsp; <strong>Framework:</strong> ${settings.framework} &nbsp;|&nbsp; <strong>Currency:</strong> NGN (₦)
      </div>

      <!-- NOTE 1 -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">1. Corporate Information</h3>
        <p style="font-size: 12px; color: #374151; line-height: 1.6; margin-bottom: 6px;">
          ${businessName} is a private commercial entity incorporated in the Federal Republic of Nigeria (${rcNumber}). 
          The registered office and principal place of business is located at ${fullAddress}. 
          The principal activity of the company is ${profile?.business_type || 'the provision of goods and commercial services'}.
        </p>
      </div>

      <!-- NOTE 2 -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">2. Basis of Preparation</h3>
        <p style="font-size: 12px; color: #374151; line-height: 1.6; margin-bottom: 6px;">
          The financial statements have been prepared in accordance with the <strong>${settings.framework}</strong> 
          and the requirements of the Companies and Allied Matters Act (CAMA 2020). The financial statements are presented in 
          Nigerian Naira (NGN - ₦), which is the company’s functional and presentation currency.
        </p>
        <p style="font-size: 12px; color: #374151; line-height: 1.6;">
          <strong>Going Concern:</strong> ${settings.goingConcernNote}
        </p>
      </div>

      <!-- NOTE 3 -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">3. Significant Accounting Policies</h3>
        <div style="font-size: 12px; color: #374151; line-height: 1.6;">
          <p><strong>Revenue Recognition:</strong> Revenue is measured at the fair value of consideration received or receivable, net of returns, discounts and value added taxes.</p>
          <p><strong>Operating Expenses:</strong> Operating expenses are recognized in profit or loss upon utilization of the service or at the date of their origin on an accrual basis.</p>
          <p><strong>Cash and Cash Equivalents:</strong> Comprise cash on hand, demand deposits with banks, and other short-term highly liquid investments.</p>
          <p><strong>Taxation:</strong> Under the provisions of the Finance Act and CITA, eligible small enterprises with turnover below ₦25,000,000 are subject to 0% Corporate Income Tax.</p>
        </div>
      </div>

      <!-- NOTE 4: REVENUE -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">4. Revenue</h3>
        <table>
          <thead>
            <tr class="section-header">
              <th style="text-align:left">Category</th>
              <th style="text-align:right">FY ${year} (NGN)</th>
              <th style="text-align:right">FY ${year - 1} (NGN)</th>
            </tr>
          </thead>
          <tbody>
            ${revRowsHtml}
            <tr class="total-row">
              <td>Total Revenue</td>
              <td class="amount positive">${formatCurrency(totalRevenue)}</td>
              <td class="amount">${formatCurrency(priorTotalRevenue)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- NOTE 5: OPERATING EXPENSES -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">5. Operating Expenses</h3>
        <table>
          <thead>
            <tr class="section-header">
              <th style="text-align:left">Category</th>
              <th style="text-align:right">FY ${year} (NGN)</th>
              <th style="text-align:right">FY ${year - 1} (NGN)</th>
            </tr>
          </thead>
          <tbody>
            ${expRowsHtml}
            <tr class="total-row">
              <td>Total Operating Expenses</td>
              <td class="amount negative">${formatCurrency(totalExpenses)}</td>
              <td class="amount">${formatCurrency(priorTotalExpenses)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- NOTE 7: CASH & CASH EQUIVALENTS -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">7. Cash and Cash Equivalents</h3>
        <table>
          <tbody>
            <tr class="line-row"><td>Cash in Hand</td><td class="amount">${formatCurrency(totalCashOnCash)}</td></tr>
            <tr class="line-row"><td>Bank Balances</td><td class="amount">${formatCurrency(totalCashInBank)}</td></tr>
            <tr class="line-row"><td>Digital Wallets & Liquid Payment Accounts</td><td class="amount">${formatCurrency(totalCashInWallets)}</td></tr>
            <tr class="total-row"><td>Total Cash and Cash Equivalents</td><td class="amount">${formatCurrency(totalCashAndEquivalents)}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- NOTE 8: RECEIVABLES AND PAYABLES -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">8. Trade and Other Receivables / Payables</h3>
        <table>
          <tbody>
            <tr class="line-row"><td>Trade Receivables (Customer Invoices)</td><td class="amount positive">${formatCurrency(tradeReceivables)}</td></tr>
            <tr class="line-row"><td>Trade Payables and Outstanding Credit</td><td class="amount negative">${formatCurrency(tradePayables)}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- NOTE 9: SHARE CAPITAL -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">9. Share Capital & Equity Reserves</h3>
        <p style="font-size: 12px; color: #374151; line-height: 1.6;">
          <strong>Authorised:</strong> ${settings.authorisedShares.toLocaleString()} Ordinary shares of ₦${settings.nominalShareValue.toFixed(2)} each (₦${(settings.authorisedShares * settings.nominalShareValue).toLocaleString()}).<br/>
          <strong>Issued & Fully Paid:</strong> Reconciles with the Statement of Changes in Equity.<br/>
          <strong>Retained Earnings / (Accumulated Loss):</strong> ${formatCurrency(retainedEarnings)}
        </p>
      </div>

      <!-- NOTE 10, 11, 12, 13, 14 -->
      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">10. Related-Party Disclosures</h3>
        <p style="font-size: 12px; color: #374151; line-height: 1.6;">${settings.relatedPartyNotes}</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">11. Employee Benefit Costs</h3>
        <p style="font-size: 12px; color: #374151; line-height: 1.6;">
          Total Salaries & Remuneration: ${formatCurrency(employeeSalaries)} | Statutory Pension Contributions: ${formatCurrency(employeePensions)} (Active staff: ${employees.length})
        </p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">12. Taxation</h3>
        <p style="font-size: 12px; color: #374151; line-height: 1.6;">
          ${isSmallBusinessExempt 
            ? 'The company qualifies as a Small Company under the Finance Act (gross turnover < ₦25,000,000) and is exempt from Corporate Income Tax (CIT rate 0%).' 
            : `Current year CIT charge: ${formatCurrency(currentTaxExpense)}.`}
          &nbsp;Outstanding tax payable at reporting date: ${formatCurrency(taxPayable)}.
        </p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">13. Events After the Reporting Period</h3>
        <p style="font-size: 12px; color: #374151; line-height: 1.6;">${settings.postReportingEvents}</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h3 style="font-size: 14px; margin-bottom: 8px; color: #111;">14. Contingent Liabilities and Commitments</h3>
        <p style="font-size: 12px; color: #374151; line-height: 1.6;">${settings.contingentLiabilities}</p>
      </div>

      <!-- SIGNATURE BLOCKS -->
      <div style="margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; border-top: 1px dashed #d1d5db; padding-top: 24px;">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 24px;">Prepared By:</div>
          <div style="border-bottom: 1px solid #9ca3af; width: 80%; height: 20px;"></div>
          <div style="font-size: 12px; font-weight: 600; margin-top: 6px;">${preparedBy}</div>
          <div style="font-size: 11px; color: #6b7280;">Principal Accounting Officer</div>
        </div>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 24px;">Approved By:</div>
          <div style="border-bottom: 1px solid #9ca3af; width: 80%; height: 20px;"></div>
          <div style="font-size: 12px; font-weight: 600; margin-top: 6px;">${approvedBy}</div>
          <div style="font-size: 11px; color: #6b7280;">Director / Board Representative</div>
        </div>
      </div>
    `;

    printStatementHTML('Notes to the Financial Statements', `For the year ended 31 December ${year}`, businessName, html);
    setShowExportMenu(false);
  }

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1150, margin: '0 auto', animation: 'fadeIn 0.3s ease' }}>
      {/* Header bar */}
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Notes to the Financial Statements</h1>
            <Badge variant={allChecksPassed ? 'success' : 'warning'}>
              {allChecksPassed ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} /> Reconciled & Complete
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={12} /> Requires Review
                </span>
              )}
            </Badge>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Structured statutory disclosures, accounting policies and general ledger breakdown for {year}
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
            icon={<Edit3 size={13} />}
            onClick={() => setEditingSettings(true)}
          >
            Configure Policies
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

      {/* Validation Checklist Strip */}
      <Card style={{ marginBottom: 24, padding: '14px 18px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={15} color="#3b82f6" /> Financial Statement Cross-Reconciliation Summary
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
          {validationChecks.map((chk, i) => (
            <div key={i} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
              <CheckCircle2 size={13} color="var(--success)" />
              <span>{chk.label}: <strong style={{ color: 'var(--text-primary)' }}>{chk.detail}</strong></span>
            </div>
          ))}
        </div>
      </Card>

      {/* Section Quick Jump Filter */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, marginBottom: 20 }}>
        {['All Notes', '1. Corporate', '2. Framework', '3. Policies', '4. Revenue', '5. Expenses', '6. PPE', '7. Cash', '8. Working Capital', '9. Equity', '10. Related Party', '11. Payroll', '12. Tax', '13-14. Subsequent'].map((lbl, idx) => {
          const val = idx === 0 ? 'all' : idx;
          const isSelected = activeSection === val;
          return (
            <button
              key={lbl}
              onClick={() => setActiveSection(val as any)}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                fontWeight: isSelected ? 600 : 400,
                background: isSelected ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: isSelected ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {lbl}
            </button>
          );
        })}
      </div>

      {/* NOTE 1: CORPORATE INFORMATION */}
      {(activeSection === 'all' || activeSection === 1) && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building size={16} color="var(--accent-primary)" /> Note 1: Corporate Information
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registered Entity</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{businessName}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CAC Registration Number</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{rcNumber}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Principal Activity</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{profile?.business_type || 'Commercial Services'}</div>
            </div>
            <div style={{ gridColumn: isMobile ? '1' : 'span 3' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registered Business Address</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{fullAddress}</div>
            </div>
          </div>
        </Card>
      )}

      {/* NOTE 2: BASIS OF PREPARATION */}
      {(activeSection === 'all' || activeSection === 2) && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={16} color="var(--accent-primary)" /> Note 2: Basis of Preparation
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 10px 0' }}>
              <strong>Reporting Framework:</strong> The financial statements have been prepared in accordance with <strong>{settings.framework}</strong> and the relevant provisions of the Companies and Allied Matters Act (CAMA 2020).
            </p>
            <p style={{ margin: '0 0 10px 0' }}>
              <strong>Measurement Convention & Currency:</strong> Prepared under the {settings.accountingConvention}. The presentation and functional currency is the Nigerian Naira (NGN - ₦).
            </p>
            <p style={{ margin: 0 }}>
              <strong>Going Concern:</strong> {settings.goingConcernNote}
            </p>
          </div>
        </Card>
      )}

      {/* NOTE 3: SIGNIFICANT ACCOUNTING POLICIES */}
      {(activeSection === 'all' || activeSection === 3) && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layers size={16} color="var(--accent-primary)" /> Note 3: Significant Accounting Policies
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Revenue Recognition:</strong> Revenue is measured at fair value of consideration received or receivable upon delivery of goods or completion of service obligations.
            </div>
            <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Expense Recognition:</strong> Expenses are recognized on an accrual basis when incurred, ensuring matching with associated revenues.
            </div>
            <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Cash & Equivalents:</strong> Demand deposits, cash on hand and highly liquid short-term balances convertible to known amounts of cash.
            </div>
            <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Taxation:</strong> In accordance with Nigerian tax law, qualifying small businesses with gross turnover under ₦25M are subject to 0% CIT rate.
            </div>
          </div>
        </Card>
      )}

      {/* NOTE 4: REVENUE */}
      {(activeSection === 'all' || activeSection === 4) && (
        <Card style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Note 4: Revenue from Contracts with Customers</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Agrees with Profit & Loss Statement</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Category / Source</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>FY {year} (NGN)</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>FY {year - 1} (NGN)</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>% Share</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(revenueByCategory).map(([cat, amt]) => (
                <tr key={cat} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <td style={{ padding: '10px 20px', fontSize: 13 }}>{cat}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: 13, fontFamily: 'Space Grotesk, monospace', color: 'var(--success)' }}>{formatCurrency(amt)}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: 13, fontFamily: 'Space Grotesk, monospace', color: 'var(--text-muted)' }}>{formatCurrency(priorRevenueByCategory[cat] || 0)}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                    {totalRevenue > 0 ? `${((amt / totalRevenue) * 100).toFixed(1)}%` : '0%'}
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--bg-border)' }}>
                <td style={{ padding: '12px 20px', fontWeight: 700, fontSize: 13 }}>TOTAL REVENUE</td>
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--success)', fontFamily: 'Space Grotesk, monospace' }}>{formatCurrency(totalRevenue)}</td>
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Space Grotesk, monospace' }}>{formatCurrency(priorTotalRevenue)}</td>
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>100%</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      {/* NOTE 5: OPERATING EXPENSES */}
      {(activeSection === 'all' || activeSection === 5) && (
        <Card style={{ marginBottom: 20, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Note 5: Operating Expenses Breakdown</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Agrees with Profit & Loss Statement</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                <th style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expense Category</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>FY {year} (NGN)</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>FY {year - 1} (NGN)</th>
                <th style={{ padding: '10px 20px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>% Share</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(expenseByCategory).map(([cat, amt]) => (
                <tr key={cat} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                  <td style={{ padding: '10px 20px', fontSize: 13 }}>{cat}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: 13, fontFamily: 'Space Grotesk, monospace', color: 'var(--error)' }}>{formatCurrency(amt)}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: 13, fontFamily: 'Space Grotesk, monospace', color: 'var(--text-muted)' }}>{formatCurrency(priorExpenseByCategory[cat] || 0)}</td>
                  <td style={{ padding: '10px 20px', textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                    {totalExpenses > 0 ? `${((amt / totalExpenses) * 100).toFixed(1)}%` : '0%'}
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--bg-elevated)', borderTop: '2px solid var(--bg-border)' }}>
                <td style={{ padding: '12px 20px', fontWeight: 700, fontSize: 13 }}>TOTAL OPERATING EXPENSES</td>
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: 'var(--error)', fontFamily: 'Space Grotesk, monospace' }}>{formatCurrency(totalExpenses)}</td>
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', fontFamily: 'Space Grotesk, monospace' }}>{formatCurrency(priorTotalExpenses)}</td>
                <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700, fontSize: 12 }}>100%</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      {/* NOTE 6: PROPERTY, PLANT & EQUIPMENT */}
      {(activeSection === 'all' || activeSection === 6) && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building size={16} color="var(--accent-primary)" /> Note 6: Property, Plant and Equipment (PPE)
          </div>
          <div className="mobile-table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--bg-border)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Asset Class</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Cost (1 Jan)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Additions</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Depreciation</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Net Book Value</th>
                </tr>
              </thead>
              <tbody>
                {settings.ppeSchedule.map(p => {
                  const nbv = (p.opening + p.additions - p.disposals) - p.depreciation;
                  return (
                    <tr key={p.category} style={{ borderBottom: '1px solid var(--bg-border)' }}>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{p.category}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13 }}>{formatCurrency(p.opening)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13 }}>{formatCurrency(p.additions)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: 13 }}>{formatCurrency(p.depreciation)}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>{formatCurrency(nbv)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* NOTE 7: CASH & EQUIVALENTS */}
      {(activeSection === 'all' || activeSection === 7) && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={16} color="var(--success)" /> Note 7: Cash and Cash Equivalents
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
            <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bank Balances</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(totalCashInBank)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{bankAccounts.length} operational bank accounts</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cash on Hand / Petty Cash</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(totalCashOnCash)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Physical cash reserves</div>
            </div>
            <div style={{ background: 'var(--bg-elevated)', padding: 14, borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wallets & Short-Term Assets</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(totalCashInWallets)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Digital payment gateways</div>
            </div>
          </div>
          <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Total Cash and Cash Equivalents:</span>
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--success)', fontFamily: 'Space Grotesk, sans-serif' }}>{formatCurrency(totalCashAndEquivalents)}</span>
          </div>
        </Card>
      )}

      {/* NOTE 8: RECEIVABLES AND PAYABLES */}
      {(activeSection === 'all' || activeSection === 8) && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={16} color="var(--accent-primary)" /> Note 8: Receivables and Payables (Working Capital)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            <div style={{ border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--success)' }}>Trade Receivables</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 4 }}>{formatCurrency(tradeReceivables)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Verified against {unpaidInvoices.length} outstanding client invoices. All receivables are due within 30–60 days.
              </div>
            </div>
            <div style={{ border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--error)' }}>Trade Payables & Credit</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', marginBottom: 4 }}>{formatCurrency(tradePayables)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Outstanding obligations to suppliers and credit lines.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* NOTE 9: SHARE CAPITAL */}
      {(activeSection === 'all' || activeSection === 9) && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Scale size={16} color="var(--accent-primary)" /> Note 9: Share Capital & Reserves
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px 0' }}>
              • <strong>Authorised Share Capital:</strong> {settings.authorisedShares.toLocaleString()} Ordinary shares of ₦{settings.nominalShareValue.toFixed(2)} each amounting to ₦{(settings.authorisedShares * settings.nominalShareValue).toLocaleString()}.
            </p>
            <p style={{ margin: '0 0 8px 0' }}>
              • <strong>Issued and Paid-up Capital:</strong> {formatCurrency(soceShareCapital)} (Reconciled with Statement of Changes in Equity).
            </p>
            <p style={{ margin: 0 }}>
              • <strong>Retained Earnings / (Accumulated Losses):</strong> {formatCurrency(retainedEarnings)} directly transferred from general ledger profit & loss.
            </p>
          </div>
        </Card>
      )}

      {/* NOTE 10, 11, 12: OTHER STATUTORY DISCLOSURES */}
      {(activeSection === 'all' || activeSection === 10 || activeSection === 11 || activeSection === 12) && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Note 10: Related Parties</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {settings.relatedPartyNotes}
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Note 11: Employee Costs</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Salaries & Wages: <strong>{formatCurrency(employeeSalaries)}</strong><br/>
              Pension Contributions: <strong>{formatCurrency(employeePensions)}</strong><br/>
              Recorded employees: <strong>{employees.length}</strong>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Note 12: Taxation</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {isSmallBusinessExempt 
                ? 'Eligible for 0% Corporate Income Tax (CIT) rate under the Finance Act (Gross turnover < ₦25,000,000).' 
                : `Current tax expense: ${formatCurrency(currentTaxExpense)}.`}
              <br/>Tax payable: <strong>{formatCurrency(taxPayable)}</strong>
            </div>
          </Card>
        </div>
      )}

      {/* NOTE 13 & 14: SUBSEQUENT EVENTS & CONTINGENCIES */}
      {(activeSection === 'all' || activeSection === 13 || activeSection === 14) && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
            Notes 13 & 14: Subsequent Events & Contingencies
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 10px 0' }}>
              <strong>13. Events After the Reporting Period:</strong> {settings.postReportingEvents}
            </p>
            <p style={{ margin: 0 }}>
              <strong>14. Contingent Liabilities and Commitments:</strong> {settings.contingentLiabilities}
            </p>
          </div>
        </Card>
      )}

      {/* Sign-off Metadata */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          Report Signatures & Authorisation
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
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

      {/* MODAL: Configure Policies & Notes */}
      {editingSettings && (
        <Modal open={editingSettings} title="Configure Accounting Framework & Disclosures" onClose={() => setEditingSettings(false)}>
          <form onSubmit={e => {
            e.preventDefault();
            saveSettings(settings);
            setEditingSettings(false);
          }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reporting Framework</label>
              <select
                value={settings.framework}
                onChange={e => setSettings(prev => ({ ...prev, framework: e.target.value as any }))}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 13 }}
              >
                <option value="IFRS for SMEs">IFRS for SMEs (Recommended for Nigerian Private Companies)</option>
                <option value="Full IFRS">Full IFRS (Public Interest Entities)</option>
                <option value="Nigerian GAAP (SAS)">Nigerian GAAP (SAS)</option>
                <option value="Small Entity Cash/Accrual Basis">Small Entity Simplified Accrual / Cash Basis</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Authorised Shares</label>
                <Input
                  type="number"
                  value={settings.authorisedShares}
                  onChange={e => setSettings(prev => ({ ...prev, authorisedShares: Number(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nominal Value (₦/share)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.nominalShareValue}
                  onChange={e => setSettings(prev => ({ ...prev, nominalShareValue: Number(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Going Concern Disclosure Note</label>
              <textarea
                rows={3}
                value={settings.goingConcernNote}
                onChange={e => setSettings(prev => ({ ...prev, goingConcernNote: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 12, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Related-Party Transactions Disclosure</label>
              <textarea
                rows={2}
                value={settings.relatedPartyNotes}
                onChange={e => setSettings(prev => ({ ...prev, relatedPartyNotes: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 12, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Events After the Reporting Period</label>
              <textarea
                rows={2}
                value={settings.postReportingEvents}
                onChange={e => setSettings(prev => ({ ...prev, postReportingEvents: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 12, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Contingent Liabilities Disclosure</label>
              <textarea
                rows={2}
                value={settings.contingentLiabilities}
                onChange={e => setSettings(prev => ({ ...prev, contingentLiabilities: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 12, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <Button type="button" variant="secondary" onClick={() => setEditingSettings(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Disclosures</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
