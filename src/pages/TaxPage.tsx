import { useEffect, useState, type FormEvent } from 'react';
import { Plus, FileText, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Clock, Info, X, Download } from 'lucide-react';
import { supabase, type TaxRecord, type Transaction } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate } from '../lib/format';
import { downloadCSV } from '../lib/export';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import { useMobile } from '../hooks/useMobile';

const NGN_TAX_TYPES = [
  {
    value: 'VAT',
    name: 'Value Added Tax',
    short: 'VAT — 7.5%',
    description: 'Charged on goods and services supplied in Nigeria. Businesses with annual turnover ≥ ₦25M must register for VAT. File monthly returns by 21st of the following month.',
    rate: '7.5%',
    authority: 'FIRS',
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
    short: 'CIT — 0% / 20% / 30%',
    description: 'Tax on company profits. Small companies (turnover < ₦25M) pay 0%. Medium (₦25M–₦100M) pay 20%. Large (> ₦100M) pay 30%. File annually within 6 months of year-end.',
    rate: '0% / 20% / 30% (tiered)',
    authority: 'FIRS',
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
    authority: 'FIRS',
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

function calcCIT(income: number): number {
  if (income < 25_000_000) return 0;
  if (income < 100_000_000) return income * 0.20;
  return income * 0.30;
}

function citLabel(income: number): string {
  if (income < 25_000_000) return 'Small Company (0%)';
  if (income < 100_000_000) return 'Medium Company (20%)';
  return 'Large Company (30%)';
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

const statusBadge: Record<TaxRecord['status'], 'warning' | 'success' | 'error' | 'info'> = {
  pending: 'warning', filed: 'info', paid: 'success', overdue: 'error',
};

export default function TaxPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [saving, setSaving] = useState(false);
  const isMobile = useMobile(1024);
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
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [taxRes, txRes] = await Promise.all([
      supabase.from('tax_records').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('transactions').select('*').eq('user_id', user!.id),
    ]);
    setRecords(taxRes.data || []);
    setTransactions(txRes.data || []);
    setLoading(false);
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const estimatedCIT = calcCIT(totalIncome);
  const outstandingLiability = records.filter(r => r.status === 'pending' || r.status === 'overdue').reduce((s, r) => s + r.calculated_tax - r.paid_tax, 0);

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

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1000, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: isMobile ? 16 : 24 }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Tax & Compliance</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nigerian business tax calculations — FIRS compliant</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <Button variant="secondary" icon={<Info size={14} />} onClick={() => setShowGuide(true)} style={{ flex: isMobile ? 1 : 'none', minWidth: 'fit-content' }}>
            Tax Guide
          </Button>
          <Button variant="secondary" icon={<Download size={14} />} onClick={() => {
            const rows = records.map(r => [r.period_start, r.period_end, r.tax_type, r.gross_income, r.deductions, r.taxable_income, r.calculated_tax, r.paid_tax, r.status, r.due_date || '']);
            downloadCSV(`tax-records-${new Date().getFullYear()}.csv`, ['Period Start', 'Period End', 'Tax Type', 'Gross Income', 'Deductions', 'Taxable Income', 'Calculated Tax', 'Paid Tax', 'Status', 'Due Date'], rows);
          }} style={{ flex: isMobile ? 1 : 'none', minWidth: 'fit-content' }}>
            Export CSV
          </Button>
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowModal(true)} style={{ flex: isMobile ? '100%' : 'none', minWidth: 'fit-content' }}>
            New Tax Record
          </Button>
        </div>
      </div>

      <div className="mobile-grid-2 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card style={{ border: '1px solid var(--accent-border)', background: 'var(--accent-dim)' }}>
          <div style={{ fontSize: 11, color: 'var(--accent-light)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Revenue</div>
          <div className="mobile-stat-value" style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', marginBottom: 4 }}>
            {formatCurrency(totalIncome)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>From transactions</div>
        </Card>
        <Card style={{ border: '1px solid rgba(34,197,94,0.3)', background: 'var(--success-dim)' }}>
          <div style={{ fontSize: 11, color: 'var(--success)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Profit</div>
          <div className="mobile-stat-value" style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: netProfit >= 0 ? 'var(--success)' : 'var(--error)', marginBottom: 4 }}>
            {formatCurrency(Math.abs(netProfit))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{netProfit >= 0 ? 'Surplus' : 'Deficit'}</div>
        </Card>
        <Card style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'var(--error-dim)' }}>
          <div style={{ fontSize: 11, color: 'var(--error)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unpaid Tax</div>
          <div className="mobile-stat-value" style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', marginBottom: 4 }}>
            {formatCurrency(outstandingLiability)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unpaid tax records</div>
        </Card>
        <Card style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'var(--warning-dim)' }}>
          <div style={{ fontSize: 11, color: 'var(--warning)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estimated CIT</div>
          <div className="mobile-stat-value" style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', marginBottom: 4 }}>
            {formatCurrency(estimatedCIT)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{citLabel(totalIncome)}</div>
        </Card>
      </div>

      <Card style={{ marginBottom: 20, padding: '14px 16px', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <AlertCircle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 2 }}>Disclaimer</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Tax estimates are for planning purposes only, based on FIRS guidelines and Finance Act 2021. Always consult a qualified tax professional or FIRS-accredited accountant for official filings.
          </div>
        </div>
      </Card>

      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Tax Records</h2>

      {loading ? (
        <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12 }} />)}</div>
      ) : records.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '48px 20px' }}>
          <FileText size={32} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No tax records yet</p>
          <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4 }}>Create your first tax record to track compliance</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {records.map(r => {
            const taxInfo = NGN_TAX_TYPES.find(t => t.value === r.tax_type);
            return (
              <Card key={r.id} hoverable>
                <div className="mobile-hide" style={{ display: isMobile ? 'none' : 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-md)',
                    background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <FileText size={20} color="var(--accent-light)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{taxInfo?.name || r.tax_type}</span>
                      <Badge variant={statusBadge[r.status]}>{r.status}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatDate(r.period_start)} — {formatDate(r.period_end)}
                      {taxInfo && <span style={{ marginLeft: 8, color: 'var(--accent-light)' }}>· {taxInfo.rate} · {taxInfo.authority}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'left', minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Calculated Tax</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                      {formatCurrency(r.calculated_tax)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'left', minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Taxable Income</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {formatCurrency(r.taxable_income)}
                    </div>
                  </div>
                  {r.due_date && (
                    <div style={{ textAlign: 'left', minWidth: 100 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Due</div>
                      <div style={{ fontSize: 12, color: new Date(r.due_date) < new Date() && r.status !== 'paid' ? 'var(--error)' : 'var(--text-secondary)' }}>
                        {formatDate(r.due_date)}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, alignSelf: 'flex-start' }}>
                    {r.status !== 'paid' && (
                      <button
                        onClick={() => updateStatus(r.id, 'paid')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                          background: 'var(--success-dim)', color: 'var(--success)',
                          borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 500,
                          border: '1px solid rgba(34,197,94,0.2)',
                        }}
                      >
                        <CheckCircle size={11} /> Mark Paid
                      </button>
                    )}
                    {r.status === 'pending' && (
                      <button
                        onClick={() => updateStatus(r.id, 'filed')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                          background: 'var(--info-dim)', color: 'var(--info)',
                          borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 500,
                          border: '1px solid rgba(59,130,246,0.2)',
                        }}
                      >
                        <Clock size={11} /> Mark Filed
                      </button>
                    )}
                  </div>
                </div>

                <div className="mobile-only" style={{ display: isMobile ? 'block' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={18} color="var(--accent-light)" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taxInfo?.name || r.tax_type}</span>
                          <Badge variant={statusBadge[r.status]}>{r.status}</Badge>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {formatDate(r.period_start)} — {formatDate(r.period_end)}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 12, background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Calculated Tax</div>
                        <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>{formatCurrency(r.calculated_tax)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Taxable Income</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{formatCurrency(r.taxable_income)}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {taxInfo && <span>Rate: <strong style={{ color: 'var(--text-primary)' }}>{taxInfo.rate}</strong></span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {r.status !== 'paid' && (
                          <button onClick={() => updateStatus(r.id, 'paid')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'var(--success-dim)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 500, border: '1px solid rgba(34,197,94,0.2)' }}>
                            <CheckCircle size={11} /> Mark Paid
                          </button>
                        )}
                        {r.status === 'pending' && (
                          <button onClick={() => updateStatus(r.id, 'filed')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'var(--info-dim)', color: 'var(--info)', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 500, border: '1px solid rgba(59,130,246,0.2)' }}>
                            <Clock size={11} /> Mark Filed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

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
            Source: Finance Act 2021, FIRS guidelines. Rates are current as of 2024. Always verify with FIRS or a certified tax consultant before filing.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" icon={<X size={14} />} onClick={() => setShowGuide(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
