import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Clock, Info, X, Download, Landmark, Code, ArrowUpRight } from 'lucide-react';
import { supabase, type Employee, type FixedAssetRecord, type Invoice, type TaxRecord, type Transaction, type WhtCreditNoteRecord } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency, formatDate } from '../lib/format';
import { downloadCSV } from '../lib/export';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { useMobile } from '../hooks/useMobile';
import { runTaxSavingsFinder } from '../lib/taxSavingsFinder';
import { TaxSavingsFinderPanel } from '../components/tax/TaxSavingsFinderPanel';

const NGN_TAX_TYPES = [
  {
    value: 'VAT',
    name: 'Value Added Tax',
    short: 'VAT — 7.5%',
    description: 'Charged on goods and services supplied in Nigeria. Businesses with annual turnover ≥ ₦25M must register for VAT. File monthly returns by 21st of the following month.',
    rate: '7.5%',
    authority: 'NRS',
    deadline: '21st of following month',
  },
  {
    value: 'PIT',
    name: 'Personal Income Tax (PAYE)',
    short: 'PIT / PAYE — Progressive 7–24%',
    description: 'Tax on individuals and employees. Employers must deduct PAYE from employee salaries and remit monthly. Rate is progressive: 7% on first ₦300k up to 24% above ₦3.2M.',
    rate: 'Progressive 7–24%',
    authority: 'SIRS / FIRS',
    deadline: '10th of following month (PAYE)',
  },
  {
    value: 'CIT',
    name: 'Company Income Tax',
    short: 'CIT — 0% / 27.5% + 4% Dev Levy',
    description: 'Tax on company profits under NTA 2025. Qualifying small companies (turnover ≤ ₦100M and gross fixed assets ≤ ₦250M, excluding professional firms) pay 0%. Standard companies pay 27.5% CIT + 4% Harmonized Development Levy. File annually within 6 months of year-end.',
    rate: '0% / 27.5% + 4% Levy',
    authority: 'NRS',
    deadline: '6 months after year-end',
  },
  {
    value: 'WHT',
    name: 'Withholding Tax',
    short: 'WHT — 5–10%',
    description: 'Deducted at source when making payments to suppliers/contractors. 5% on rent, 10% on dividends/interest/royalties, 5–10% on contracts. Remit by 21st of following month.',
    rate: '5–10%',
    authority: 'FIRS / SIRS',
    deadline: '21st of following month',
  },
  {
    value: 'CGT',
    name: 'Capital Gains Tax',
    short: 'CGT — 10%',
    description: 'Charged at 10% on gains from disposal of capital assets including land, buildings, and shares. File and pay within 30 days of asset disposal.',
    rate: '10%',
    authority: 'NRS',
    deadline: '30 days after disposal',
  },
  {
    value: 'other',
    name: 'Stamp Duty / NITDA Levy / Other',
    short: 'Other Levies',
    description: 'Includes Stamp Duty on documents and electronic transactions, NITDA levy (1% of profit after tax for eligible companies), and other regulatory levies.',
    rate: 'Varies',
    authority: 'FIRS / CBN',
    deadline: 'Varies',
  },
];

const PIT_BRACKETS = [
  { min: 0, max: 300000, rate: 0.07 },
  { min: 300000, max: 600000, rate: 0.11 },
  { min: 600000, max: 1100000, rate: 0.15 },
  { min: 1100000, max: 1600000, rate: 0.19 },
  { min: 1600000, max: 3200000, rate: 0.21 },
  { min: 3200000, max: Infinity, rate: 0.24 },
];

function calcPIT(income: number): number {
  let tax = 0;
  let remaining = income;
  for (const b of PIT_BRACKETS) {
    if (remaining <= 0) break;
    const taxable = Math.min(remaining, b.max - b.min);
    tax += taxable * b.rate;
    remaining -= taxable;
  }
  return tax;
}

function calcCIT(taxableProfit: number, turnover?: number): number {
  if ((turnover ?? taxableProfit) <= 100_000_000) return 0;
  return Math.max(0, taxableProfit) * 0.275 + Math.max(0, taxableProfit) * 0.04;
}

function citLabel(income: number): string {
  if (income <= 100_000_000) return 'Small Company (0% · NTA 2025)';
  return 'Standard (27.5% CIT + 4% Dev Levy)';
}

function computeTax(grossIncome: number, deductions: number, taxType: TaxRecord['tax_type']): { taxable: number; tax: number } {
  const taxable = Math.max(0, grossIncome - deductions);
  switch (taxType) {
    case 'PIT': return { taxable, tax: calcPIT(taxable) };
    case 'VAT': return { taxable: grossIncome, tax: grossIncome * 0.075 };
    case 'CIT': return { taxable, tax: calcCIT(taxable) };
    case 'WHT': return { taxable: grossIncome, tax: grossIncome * 0.10 };
    case 'CGT': return { taxable, tax: taxable * 0.10 };
    default: return { taxable, tax: 0 };
  }
}

export default function TaxPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isMobile = useMobile(1024);
  const isSmall = useMobile(640);

  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAssetRecord[]>([]);
  const [whtNotes, setWhtNotes] = useState<WhtCreditNoteRecord[]>([]);
  const [showSavingsFinder, setShowSavingsFinder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tax_type: 'VAT' as TaxRecord['tax_type'],
    period_start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    period_end: new Date().toISOString().split('T')[0],
    gross_income: '',
    deductions: '0',
    due_date: '',
    notes: '',
  });

  useEffect(() => {
    if (user?.id) loadData();
  }, [user?.id]);

  async function loadData() {
    setLoading(true);
    const [taxRes, txRes, invRes, empRes, faRes, whtRes] = await Promise.all([
      supabase.from('tax_records').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('transactions').select('*, category:categories(*)').eq('user_id', user!.id),
      supabase.from('invoices').select('*').eq('user_id', user!.id),
      supabase.from('employees').select('*').eq('user_id', user!.id),
      supabase.from('fixed_assets').select('*').eq('user_id', user!.id),
      supabase.from('wht_credit_notes').select('*').eq('user_id', user!.id),
    ]);
    setRecords(taxRes.data || []);
    setTransactions(txRes.data || []);
    setInvoices(invRes.data || []);
    setEmployees(empRes.data || []);
    setFixedAssets(faRes.data || []);
    setWhtNotes(whtRes.data || []);
    setLoading(false);
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const estimatedCIT = calcCIT(Math.max(0, netProfit), totalIncome);
  const outstandingLiability = records.filter(r => r.status === 'pending' || r.status === 'overdue').reduce((s, r) => s + r.calculated_tax - r.paid_tax, 0);

  const taxSavingsReport = useMemo(() => {
    return runTaxSavingsFinder({
      transactions,
      invoices,
      employees,
      fixedAssets,
      whtCreditNotes: whtNotes,
      turnover: totalIncome,
      grossFixedAssets: fixedAssets.reduce((s, a) => s + (Number(a.historical_cost) || 0), 0),
      pbt: netProfit,
    });
  }, [transactions, invoices, employees, fixedAssets, whtNotes, totalIncome, netProfit]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const gross = Number(form.gross_income) || totalIncome;
    const deductions = Number(form.deductions) || 0;
    const { taxable, tax } = computeTax(gross, deductions, form.tax_type);
    const { error } = await supabase.from('tax_records').insert({
      user_id: user!.id,
      tax_type: form.tax_type,
      period_start: form.period_start,
      period_end: form.period_end,
      gross_income: gross,
      deductions,
      taxable_income: taxable,
      calculated_tax: tax,
      paid_tax: 0,
      due_date: form.due_date || null,
      notes: form.notes,
      status: 'pending',
    });
    setSaving(false);
    if (!error) { setShowModal(false); loadData(); }
  }

  async function updateStatus(id: string, status: TaxRecord['status']) {
    await supabase.from('tax_records').update({ status }).eq('id', id);
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  }

  const selectedTaxInfo = NGN_TAX_TYPES.find(t => t.value === form.tax_type);
  const previewGross = Number(form.gross_income) || 0;
  const previewTax = previewGross > 0 ? computeTax(previewGross, Number(form.deductions) || 0, form.tax_type).tax : null;

  // Color tokens matching BillingPage aesthetic
  const colors = {
    cardBg: isDark ? '#141417' : '#ffffff',
    cardBorder: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.07)',
    cardShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 14px rgba(0,0,0,0.03)',
    pillBg: isDark ? '#1f1f23' : '#f4f5f7',
    pillBorder: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
    textPrimary: isDark ? '#fafafa' : '#111827',
    textSecondary: isDark ? '#a1a1aa' : '#64748b',
    textMuted: isDark ? '#71717a' : '#94a3b8',
    tableHeaderBg: isDark ? '#1b1b1f' : '#f8fafc',
    purpleBadge: isDark ? 'rgba(147, 51, 234, 0.16)' : '#f3e8ff',
    purpleText: isDark ? '#c084fc' : '#7c3aed',
    greenBadge: isDark ? 'rgba(34, 197, 94, 0.16)' : '#ecfdf5',
    greenText: isDark ? '#4ade80' : '#059669',
    redBadge: isDark ? 'rgba(239, 68, 68, 0.16)' : '#fef2f2',
    redText: isDark ? '#f87171' : '#dc2626',
    amberBadge: isDark ? 'rgba(245, 158, 11, 0.16)' : '#fffbeb',
    amberText: isDark ? '#fbbf24' : '#d97706',
    blueBadge: isDark ? 'rgba(59, 130, 246, 0.16)' : '#eff6ff',
    blueText: isDark ? '#60a5fa' : '#2563eb',
    primaryBtnBg: isDark ? '#ffffff' : '#111827',
    primaryBtnText: isDark ? '#111827' : '#ffffff',
  };

  function getStatusStyle(status: TaxRecord['status']) {
    if (status === 'paid') return { bg: colors.greenBadge, color: colors.greenText };
    if (status === 'filed') return { bg: colors.blueBadge, color: colors.blueText };
    if (status === 'overdue') return { bg: colors.redBadge, color: colors.redText };
    return { bg: colors.amberBadge, color: colors.amberText };
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: isMobile ? '16px 14px 100px' : '24px 20px 100px', animation: 'fadeIn 0.25s ease' }}>
      
      {/* ── Hero / Banner Header matching BillingPage ── */}
      <div style={{
        borderRadius: 22,
        padding: isMobile ? '28px 20px' : '36px 36px',
        marginBottom: 28,
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(102, 45, 145, 0.18) 50%, rgba(16, 185, 129, 0.10) 100%), #141417'
          : 'linear-gradient(135deg, #fef3c7 0%, #ffedd5 40%, #ecfdf5 100%)',
        border: colors.cardBorder,
        boxShadow: colors.cardShadow,
      }}>
        {/* Subtle decorative grid mesh background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: isDark
            ? 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)'
            : 'radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'flex-end', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ maxWidth: 560 }}>
            <h1 style={{
              fontSize: isMobile ? 28 : 34,
              fontWeight: 800,
              color: colors.textPrimary,
              letterSpacing: '-0.03em',
              margin: '0 0 8px',
              lineHeight: 1.15,
            }}>
              Tax &amp; Compliance
            </h1>
            <p style={{
              fontSize: 14,
              color: colors.textSecondary,
              margin: 0,
              lineHeight: 1.55,
              fontWeight: 500,
            }}>
              Nigeria Tax Act 2025 (NTA 2025) &amp; NRS self-filing compliance — calculate, track, and file all in one place.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
            <button
              type="button"
              onClick={() => setShowGuide(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 12,
                background: isDark ? 'rgba(20,20,23,0.75)' : 'rgba(255,255,255,0.85)',
                border: colors.cardBorder, color: colors.textPrimary,
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(6px)',
              }}
            >
              <Info size={14} /> Tax Guide
            </button>

            <button
              type="button"
              onClick={() => navigate('/app/tax/automation-studio')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 12,
                background: isDark ? 'rgba(20,20,23,0.75)' : 'rgba(255,255,255,0.85)',
                border: colors.cardBorder, color: colors.textPrimary,
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(6px)',
              }}
            >
              <Code size={14} /> Tax Auto-Filer
            </button>

            <button
              type="button"
              onClick={() => {
                const rows = records.map(r => [r.period_start, r.period_end, r.tax_type, r.gross_income, r.deductions, r.taxable_income, r.calculated_tax, r.paid_tax, r.status, r.due_date || '']);
                downloadCSV(`tax-records-${new Date().getFullYear()}.csv`, ['Period Start', 'Period End', 'Tax Type', 'Gross Income', 'Deductions', 'Taxable Income', 'Calculated Tax', 'Paid Tax', 'Status', 'Due Date'], rows);
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', borderRadius: 12,
                background: isDark ? 'rgba(20,20,23,0.75)' : 'rgba(255,255,255,0.85)',
                border: colors.cardBorder, color: colors.textPrimary,
                fontSize: 12.5, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(6px)',
              }}
            >
              <Download size={14} /> Export CSV
            </button>

            <button
              type="button"
              onClick={() => setShowModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 12,
                background: colors.primaryBtnBg, color: colors.primaryBtnText,
                border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Plus size={14} /> New Tax Record
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 1: Tax Summary Overview ─────────── */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{
          fontSize: 15,
          fontWeight: 700,
          color: colors.textPrimary,
          margin: '0 0 14px',
          letterSpacing: '-0.01em',
        }}>
          Tax Summary Overview
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isSmall ? '1fr' : isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: 14,
        }}>
          <div style={{
            background: colors.cardBg,
            borderRadius: 18,
            border: colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>Total Revenue</span>
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 700, background: colors.purpleBadge, color: colors.purpleText }}>Ledger</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary, marginBottom: 4 }}>
              {formatCurrency(totalIncome)}
            </div>
            <div style={{ fontSize: 11.5, color: colors.textMuted }}>From ledger transactions</div>
          </div>

          <div style={{
            background: colors.cardBg,
            borderRadius: 18,
            border: colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>Net Profit</span>
              <span style={{
                padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 700,
                background: netProfit >= 0 ? colors.greenBadge : colors.redBadge,
                color: netProfit >= 0 ? colors.greenText : colors.redText,
              }}>
                {netProfit >= 0 ? 'Surplus' : 'Deficit'}
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: netProfit >= 0 ? colors.greenText : colors.redText, marginBottom: 4 }}>
              {formatCurrency(Math.abs(netProfit))}
            </div>
            <div style={{ fontSize: 11.5, color: colors.textMuted }}>Revenue minus expenses</div>
          </div>

          <div style={{
            background: colors.cardBg,
            borderRadius: 18,
            border: colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>Unpaid Tax</span>
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 700, background: colors.redBadge, color: colors.redText }}>Due</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary, marginBottom: 4 }}>
              {formatCurrency(outstandingLiability)}
            </div>
            <div style={{ fontSize: 11.5, color: colors.textMuted }}>Unpaid tax records</div>
          </div>

          <div style={{
            background: colors.cardBg,
            borderRadius: 18,
            border: colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary }}>Estimated CIT</span>
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 700, background: colors.amberBadge, color: colors.amberText }}>NTA 2025</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary, marginBottom: 4 }}>
              {formatCurrency(estimatedCIT)}
            </div>
            <div style={{ fontSize: 11.5, color: colors.textMuted }}>{citLabel(totalIncome)}</div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Self-Filing Gateways (Billing Overview 2-Col Style) ── */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{
          fontSize: 15,
          fontWeight: 700,
          color: colors.textPrimary,
          margin: '0 0 14px',
          letterSpacing: '-0.01em',
        }}>
          Self-Filing Gateways
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16,
        }}>
          {/* CIT Gateway Card */}
          <div style={{
            background: colors.cardBg,
            borderRadius: 20,
            border: colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '24px 26px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                  background: colors.purpleBadge, color: colors.purpleText,
                }}>
                  Limited Liability Companies (NRS)
                </span>
                <FileText size={18} color={colors.purpleText} />
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary, margin: '0 0 8px' }}>
                Companies Income Tax (CIT)
              </h3>
              <p style={{ fontSize: 13, color: colors.textSecondary, margin: '0 0 22px', lineHeight: 1.55 }}>
                Prepare and self-file company annual tax returns, deductions, and tax computations under Nigeria Tax Act 2025.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate('/app/tax/cit/new')}
                style={{
                  flex: 1,
                  minWidth: 'fit-content',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '10px 18px', borderRadius: 12,
                  background: colors.primaryBtnBg, color: colors.primaryBtnText,
                  border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <span>Start CIT Filing</span>
                <ArrowUpRight size={15} />
              </button>

              <button
                type="button"
                onClick={() => setShowSavingsFinder(v => !v)}
                style={{
                  padding: '10px 16px', borderRadius: 12,
                  background: colors.pillBg, color: colors.textPrimary,
                  border: colors.pillBorder, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {showSavingsFinder ? 'Hide Savings' : `Tax Savings (${taxSavingsReport.opportunities.length})`}
              </button>
            </div>
          </div>

          {/* PIT Gateway Card */}
          <div style={{
            background: colors.cardBg,
            borderRadius: 20,
            border: colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '24px 26px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                  background: colors.blueBadge, color: colors.blueText,
                }}>
                  Individuals &amp; CAC Business Names
                </span>
                <Landmark size={18} color={colors.blueText} />
              </div>

              <h3 style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary, margin: '0 0 8px' }}>
                Personal Income Tax (PIT)
              </h3>
              <p style={{ fontSize: 13, color: colors.textSecondary, margin: '0 0 22px', lineHeight: 1.55 }}>
                State tax filing for individuals, employees, and sole proprietors (Lagos, Kano, FCT Abuja &amp; Rivers State).
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate('/app/tax/pit/new')}
                style={{
                  flex: 1,
                  minWidth: 'fit-content',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '10px 18px', borderRadius: 12,
                  background: colors.primaryBtnBg, color: colors.primaryBtnText,
                  border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                <span>Start PIT Filing</span>
                <ArrowUpRight size={15} />
              </button>

              <button
                type="button"
                onClick={() => navigate('/app/tax/pit/admin')}
                style={{
                  padding: '10px 16px', borderRadius: 12,
                  background: colors.pillBg, color: colors.textPrimary,
                  border: colors.pillBorder, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Jurisdictions
              </button>
            </div>
          </div>
        </div>
      </section>

      {showSavingsFinder && (
        <div style={{ marginBottom: 28 }}>
          <TaxSavingsFinderPanel report={taxSavingsReport} />
        </div>
      )}

      {/* ── Official Compliance Notice ────────────────── */}
      <div style={{
        marginBottom: 32,
        padding: '16px 20px',
        borderRadius: 18,
        border: `1px solid ${isDark ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.35)'}`,
        background: isDark ? 'rgba(245,158,11,0.08)' : '#fffbeb',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}>
        <AlertCircle size={18} color={colors.amberText} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.amberText, marginBottom: 3 }}>
            Official Compliance Notice
          </div>
          <div style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 1.55 }}>
            Tax estimates are calculated strictly in accordance with Nigeria Tax Act 2025 (NTA 2025) and Nigeria Revenue Service (NRS) guidelines. Always consult a qualified tax professional for statutory certifications.
          </div>
        </div>
      </div>

      {/* ── Section 3: Tax Records (Matching Billing History Table) ── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{
            fontSize: 15,
            fontWeight: 700,
            color: colors.textPrimary,
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Tax Records
          </h2>
          <span style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500 }}>
            {records.length} record{records.length === 1 ? '' : 's'}
          </span>
        </div>

        <div style={{
          background: colors.cardBg,
          borderRadius: 20,
          border: colors.cardBorder,
          boxShadow: colors.cardShadow,
          overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: 20 }}>
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10, marginBottom: 10 }} />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <FileText size={32} color={colors.textMuted} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
              <div style={{ fontSize: 14.5, fontWeight: 700, color: colors.textPrimary }}>No tax records yet</div>
              <p style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 4 }}>
                Create your first tax record to track compliance and filing deadlines.
              </p>
            </div>
          ) : !isMobile ? (
            /* Desktop Clean Table matching Billing History */
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: colors.tableHeaderBg, borderBottom: colors.cardBorder }}>
                    <th style={{ padding: '14px 20px', fontSize: 11.5, fontWeight: 600, color: colors.textSecondary }}>Tax Type &amp; Period</th>
                    <th style={{ padding: '14px 16px', fontSize: 11.5, fontWeight: 600, color: colors.textSecondary }}>Taxable Income</th>
                    <th style={{ padding: '14px 16px', fontSize: 11.5, fontWeight: 600, color: colors.textSecondary }}>Calculated Tax</th>
                    <th style={{ padding: '14px 16px', fontSize: 11.5, fontWeight: 600, color: colors.textSecondary }}>Due Date</th>
                    <th style={{ padding: '14px 16px', fontSize: 11.5, fontWeight: 600, color: colors.textSecondary }}>Status</th>
                    <th style={{ padding: '14px 20px', fontSize: 11.5, fontWeight: 600, color: colors.textSecondary, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, idx) => {
                    const taxInfo = NGN_TAX_TYPES.find(t => t.value === r.tax_type);
                    const st = getStatusStyle(r.status);
                    return (
                      <tr
                        key={r.id}
                        style={{
                          borderBottom: idx < records.length - 1 ? colors.cardBorder : 'none',
                          transition: 'background 0.15s',
                        }}
                      >
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>
                            {taxInfo?.name || r.tax_type}
                          </div>
                          <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
                            {formatDate(r.period_start)} — {formatDate(r.period_end)}
                            {taxInfo && <span style={{ marginLeft: 6, color: colors.purpleText }}>· {taxInfo.rate} · {taxInfo.authority}</span>}
                          </div>
                        </td>
                        <td style={{ padding: '16px 16px', fontSize: 13.5, fontWeight: 600, color: colors.textSecondary }}>
                          {formatCurrency(r.taxable_income)}
                        </td>
                        <td style={{ padding: '16px 16px', fontSize: 14, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary }}>
                          {formatCurrency(r.calculated_tax)}
                        </td>
                        <td style={{ padding: '16px 16px', fontSize: 12.5, color: r.due_date && new Date(r.due_date) < new Date() && r.status !== 'paid' ? colors.redText : colors.textSecondary }}>
                          {r.due_date ? formatDate(r.due_date) : '—'}
                        </td>
                        <td style={{ padding: '16px 16px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 10px', borderRadius: 20,
                            background: st.bg, color: st.color,
                            fontSize: 11.5, fontWeight: 700, textTransform: 'capitalize',
                          }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {r.status !== 'paid' && (
                              <button
                                onClick={() => updateStatus(r.id, 'paid')}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '6px 11px', borderRadius: 8,
                                  background: colors.greenBadge, color: colors.greenText,
                                  fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                                }}
                              >
                                <CheckCircle size={12} /> Mark Paid
                              </button>
                            )}
                            {r.status === 'pending' && (
                              <button
                                onClick={() => updateStatus(r.id, 'filed')}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '6px 11px', borderRadius: 8,
                                  background: colors.blueBadge, color: colors.blueText,
                                  fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                                }}
                              >
                                <Clock size={12} /> Mark Filed
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Mobile Clean List */
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {records.map((r, idx) => {
                const taxInfo = NGN_TAX_TYPES.find(t => t.value === r.tax_type);
                const st = getStatusStyle(r.status);
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: '16px 18px',
                      borderBottom: idx < records.length - 1 ? colors.cardBorder : 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>{taxInfo?.name || r.tax_type}</div>
                        <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>
                          {formatDate(r.period_start)} — {formatDate(r.period_end)}
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20,
                        background: st.bg, color: st.color,
                        fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                      }}>
                        {r.status}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 12, background: colors.pillBg, borderRadius: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>Calculated Tax</div>
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary }}>
                          {formatCurrency(r.calculated_tax)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 2 }}>Taxable Income</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: colors.textSecondary }}>
                          {formatCurrency(r.taxable_income)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: 11.5, color: colors.textMuted }}>
                        {taxInfo && <span>Rate: <strong style={{ color: colors.textPrimary }}>{taxInfo.rate}</strong></span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {r.status !== 'paid' && (
                          <button
                            onClick={() => updateStatus(r.id, 'paid')}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '6px 12px', borderRadius: 8,
                              background: colors.greenBadge, color: colors.greenText,
                              fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                            }}
                          >
                            <CheckCircle size={11} /> Mark Paid
                          </button>
                        )}
                        {r.status === 'pending' && (
                          <button
                            onClick={() => updateStatus(r.id, 'filed')}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              padding: '6px 12px', borderRadius: 8,
                              background: colors.blueBadge, color: colors.blueText,
                              fontSize: 11.5, fontWeight: 600, border: 'none', cursor: 'pointer',
                            }}
                          >
                            <Clock size={11} /> Mark Filed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Create Tax Record Modal ────────────────────── */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create Tax Record">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Tax Type</label>
            <select
              value={form.tax_type}
              onChange={e => setForm(p => ({ ...p, tax_type: e.target.value as TaxRecord['tax_type'] }))}
              style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}
            >
              {NGN_TAX_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.short}</option>
              ))}
            </select>
            {selectedTaxInfo && (
              <div style={{ padding: '9px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{selectedTaxInfo.authority}</span>
                {' · Deadline: '}<span style={{ color: 'var(--warning)' }}>{selectedTaxInfo.deadline}</span>
                <br />{selectedTaxInfo.description}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Input label="Period Start" type="date" value={form.period_start} onChange={e => setForm(p => ({ ...p, period_start: e.target.value }))} required />
            <Input label="Period End" type="date" value={form.period_end} onChange={e => setForm(p => ({ ...p, period_end: e.target.value }))} required />
          </div>

          <Input
            label={`Gross Income (₦) — leave blank to use ${formatCurrency(totalIncome)}`}
            type="number" min="0" step="0.01"
            placeholder={String(totalIncome)}
            value={form.gross_income}
            onChange={e => setForm(p => ({ ...p, gross_income: e.target.value }))}
          />

          {form.tax_type !== 'VAT' && (
            <Input
              label="Deductions (₦)"
              type="number" min="0" step="0.01"
              value={form.deductions}
              onChange={e => setForm(p => ({ ...p, deductions: e.target.value }))}
            />
          )}

          <Input label="Due Date" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />

          {previewTax !== null && (
            <div style={{ padding: '12px', background: 'var(--accent-dim)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Estimated Tax</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent-light)' }}>
                {formatCurrency(previewTax)}
              </div>
              {form.tax_type === 'CIT' && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{citLabel(Number(form.gross_income))}</div>
              )}
            </div>
          )}

          <Input
            label="Notes (optional)"
            placeholder="Additional notes..."
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">Create Record</Button>
          </div>
        </form>
      </Modal>

      {/* ── Nigerian Business Tax Guide Modal ─────────── */}
      <Modal open={showGuide} onClose={() => setShowGuide(false)} title="Nigerian Business Tax Guide" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {NGN_TAX_TYPES.map(t => (
            <div key={t.value} style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Badge variant="default">{t.rate}</Badge>
                  <Badge variant="info">{t.authority}</Badge>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 6 }}>{t.description}</div>
              <div style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 500 }}>Filing deadline: {t.deadline}</div>
            </div>
          ))}
          <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.07)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Source: Nigeria Tax Act 2025 (NTA 2025) and NRS guidelines. Always verify with a certified tax consultant before statutory filing.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" icon={<X size={14} />} onClick={() => setShowGuide(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
