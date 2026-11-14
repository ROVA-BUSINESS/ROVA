import { useState, useEffect } from 'react';
import {
  Play,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertCircle,
  Share2,
  CheckCircle2,
  Printer,
  Info
} from 'lucide-react';
import { supabase, type Employee, type PayrollRun, type Payslip } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../lib/format';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useMobile } from '../../hooks/useMobile';
import {
  calculateEmployeePayroll,
  calculatePayrollRunTotals,
  parseSalaryBreakdown,
  formatPayslipWhatsApp,
  type EmployeePayrollCalc
} from '../../lib/payrollService';

interface Props {
  employees: Employee[];
  runs: PayrollRun[];
  onRefresh: () => void;
  locationState?: any;
}

export default function PayrollRunTab({ employees, runs, onRefresh, locationState }: Props) {
  const { user } = useAuth();
  const isMobile = useMobile(1024);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [runPayslips, setRunPayslips] = useState<Record<string, Payslip[]>>({});
  const [processing, setProcessing] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [activePayslip, setActivePayslip] = useState<{ slip: Payslip; emp: Employee; run: PayrollRun } | null>(null);

  const [period, setPeriod] = useState({
    label: '',
    start: '',
    end: '',
    notes: '',
  });

  useEffect(() => {
    if (locationState?.openCreateModal) {
      const payload = locationState.payload || {};
      const now = new Date();
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthLabel = payload.month_label || `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      setPeriod({
        label: monthLabel,
        start: payload.start_date || firstDay,
        end: payload.end_date || lastDay,
        notes: payload.notes || 'Run generated via ROVA Payroll Engine',
      });
      setShowModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [locationState]);

  const activeEmployees = employees.filter(e => e.status === 'active');

  // Compute calculation lines for all active employees
  const previewCalcs: EmployeePayrollCalc[] = activeEmployees.map(emp => calculateEmployeePayroll(emp));
  const previewTotals = calculatePayrollRunTotals(activeEmployees);

  async function handleProcess() {
    if (!period.label || !period.start || !period.end || activeEmployees.length === 0) return;
    setProcessing(true);

    try {
      // 1. Create the Payroll Run row (Approved / Processed status)
      const { data: run, error } = await supabase.from('payroll_runs').insert({
        user_id: user!.id,
        period_label: period.label,
        period_start: period.start,
        period_end: period.end,
        status: 'processed',
        total_gross: previewTotals.gross,
        total_paye: previewTotals.paye,
        total_pension: previewTotals.pension,
        total_net: previewTotals.net,
        employee_count: activeEmployees.length,
        notes: period.notes ? `${period.notes} [SALARY_UNPAID]` : '[SALARY_UNPAID]',
        processed_at: new Date().toISOString(),
      }).select().maybeSingle();

      if (!error && run) {
        const payslipRows: Record<string, unknown>[] = [];

        // Find or create 'Salaries & Wages' category
        const { data: catData } = await supabase.from('categories').select('id').eq('name', 'Salaries & Wages').maybeSingle();

        // 2. Automated Accounting: Record Gross Salary Expense in General Ledger
        // Debit: Salary Expense (Gross) = ₦previewTotals.gross
        // Notice: This records the entire gross salary expense in P&L, preventing omission of payroll costs
        for (const calc of previewCalcs) {
          const txDesc = `Salary Expense — ${calc.emp.full_name} (${period.label})`;
          const { data: tx } = await supabase.from('transactions').insert({
            user_id: user!.id,
            amount: calc.gross,
            type: 'expense',
            description: txDesc,
            date: period.end,
            category_id: catData?.id || null,
            notes: `[Payroll: ${period.label}] Gross: ${formatCurrency(calc.gross)} | PAYE: ${formatCurrency(calc.paye)} | Pension: ${formatCurrency(calc.pension)} | Net Payable: ${formatCurrency(calc.netPay)}`,
          }).select().maybeSingle();

          payslipRows.push({
            payroll_run_id: run.id,
            employee_id: calc.emp.id,
            user_id: user!.id,
            gross_salary: calc.gross,
            paye_deduction: calc.paye,
            pension_deduction: calc.pension,
            other_deductions: calc.otherDeductions || 0,
            net_pay: calc.netPay,
            transaction_id: tx?.id || null,
          });
        }

        // 3. Insert individual payslips
        await supabase.from('payslips').insert(payslipRows);
        setShowModal(false);
        setPeriod({ label: '', start: '', end: '', notes: '' });
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to process payroll run:', err);
    } finally {
      setProcessing(false);
    }
  }

  async function handleMarkPaid(run: PayrollRun) {
    if (!confirm(`Mark salaries for ${run.period_label} as paid to employees? This updates salary status and records cash disbursement.`)) return;
    setMarkingPaid(run.id);
    try {
      const cleanNotes = (run.notes || '').replace('[SALARY_UNPAID]', '').trim();
      const updatedNotes = `${cleanNotes} [SALARY_PAID]`.trim();

      await supabase.from('payroll_runs').update({
        notes: updatedNotes,
      }).eq('id', run.id);

      onRefresh();
    } catch (err) {
      console.error('Failed to mark payroll paid:', err);
    } finally {
      setMarkingPaid(null);
    }
  }

  async function loadPayslips(runId: string) {
    const { data } = await supabase.from('payslips').select('*, employee:employees(*)').eq('payroll_run_id', runId);
    setRunPayslips(prev => ({ ...prev, [runId]: data || [] }));
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); loadPayslips(id); }
      return next;
    });
  }

  function openPayslipModal(slip: Payslip, run: PayrollRun) {
    const emp = slip.employee as unknown as Employee;
    if (emp) {
      setActivePayslip({ slip, emp, run });
    }
  }

  function sharePayslipWhatsApp(slip: Payslip, emp: Employee, run: PayrollRun) {
    const companyName = (user?.user_metadata as any)?.company_name || 'ROVA Business';
    const message = formatPayslipWhatsApp(run, { ...slip, employee: emp }, companyName);
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Payroll Calculation & Runs</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Draft, approve, and disburse monthly employee payrolls with automated P&L expense records
          </p>
        </div>
        <Button variant="primary" icon={<Play size={14} />} onClick={() => setShowModal(true)} disabled={activeEmployees.length === 0}>
          Run Payroll
        </Button>
      </div>

      {activeEmployees.length === 0 && (
        <Card style={{ marginBottom: 16, border: '1px solid rgba(245,158,11,0.3)', background: 'var(--warning-dim)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertCircle size={16} color="var(--warning)" style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>No active employees found</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Add your employees in the <strong>Employees</strong> tab before calculating payroll.
              </div>
            </div>
          </div>
        </Card>
      )}

      {runs.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            <FileText size={32} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p>No payroll runs processed yet. Click &quot;Run Payroll&quot; above to calculate your monthly payroll.</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {runs.map(run => {
            const isPaid = run.notes?.includes('[SALARY_PAID]');
            const isApproved = run.status === 'processed' && !isPaid;

            return (
              <Card key={run.id} style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', flexWrap: 'wrap', gap: 12 }}>
                  <button onClick={() => toggleExpand(run.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    {expanded.has(run.id) ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{run.period_label}</span>
                        {isPaid ? (
                          <Badge variant="success">Paid & Disbursed</Badge>
                        ) : isApproved ? (
                          <Badge variant="info">Approved</Badge>
                        ) : (
                          <Badge variant="warning">Draft</Badge>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {formatDate(run.period_start)} – {formatDate(run.period_end)} · {run.employee_count} employees
                      </div>
                    </div>
                  </button>

                  <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="mobile-hide" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gross Expense</div>
                      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>{formatCurrency(run.total_gross)}</div>
                    </div>
                    <div className="mobile-hide" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PAYE Withheld</div>
                      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Space Grotesk', color: 'var(--warning)' }}>{formatCurrency(run.total_paye)}</div>
                    </div>
                    <div className="mobile-hide" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pension (8%)</div>
                      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Space Grotesk', color: 'var(--info)' }}>{formatCurrency(run.total_pension)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net Salaries</div>
                      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--success)' }}>{formatCurrency(run.total_net)}</div>
                    </div>

                    {!isPaid && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={markingPaid === run.id}
                        onClick={() => handleMarkPaid(run)}
                        icon={<CheckCircle2 size={13} color="var(--success)" />}
                      >
                        Mark as Paid
                      </Button>
                    )}
                  </div>
                </div>

                {/* EXPANDED EMPLOYEE PAYSLIP BREAKDOWN TABLE */}
                {expanded.has(run.id) && runPayslips[run.id] && (
                  <div className="mobile-table-container" style={{ borderTop: '1px solid var(--bg-border)' }}>
                    <table className="transaction-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-elevated)' }}>
                          {[
                            { label: 'Employee' },
                            { label: 'Gross Salary' },
                            { label: 'PAYE Deducted', hideMobile: true },
                            { label: 'Pension (8%)', hideMobile: true },
                            { label: 'Net Take-Home' },
                            { label: 'Payslip' }
                          ].map(h => (
                            <th key={h.label} className={h.hideMobile ? 'mobile-hide' : 'mobile-tight-td'} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {runPayslips[run.id].map((slip) => {
                          const emp = slip.employee as unknown as Employee;
                          return (
                            <tr key={slip.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                              <td className="mobile-tight-td" style={{ padding: '10px 16px' }}>
                                <div className="mobile-desc-text" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {emp?.full_name || 'Staff Member'}
                                </div>
                                <div className="mobile-desc-text" style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {emp?.role || 'Employee'}
                                </div>
                              </td>
                              <td className="mobile-tight-td" style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--text-secondary)' }}>
                                {formatCurrency(slip.gross_salary)}
                              </td>
                              <td className="mobile-hide" style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--warning)' }}>
                                {formatCurrency(slip.paye_deduction)}
                              </td>
                              <td className="mobile-hide" style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--info)' }}>
                                {formatCurrency(slip.pension_deduction)}
                              </td>
                              <td className="mobile-tight-td" style={{ padding: '10px 16px', fontSize: 13.5, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--success)' }}>
                                {formatCurrency(slip.net_pay)}
                              </td>
                              <td className="mobile-tight-td" style={{ padding: '10px 16px' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    onClick={() => openPayslipModal(slip, run)}
                                    title="View Detailed Payslip"
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: 'var(--radius-sm)',
                                      background: 'var(--bg-elevated)',
                                      border: '1px solid var(--bg-border)',
                                      color: 'var(--text-primary)',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <FileText size={12} />
                                    Payslip
                                  </button>
                                  {emp && (
                                    <button
                                      onClick={() => sharePayslipWhatsApp(slip, emp, run)}
                                      title="Share via WhatsApp"
                                      style={{
                                        padding: '4px 8px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(37, 211, 102, 0.1)',
                                        border: '1px solid rgba(37, 211, 102, 0.25)',
                                        color: '#25D366',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Share2 size={12} />
                                      WhatsApp
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
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL: RUN PAYROLL WORKFLOW */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Calculate & Run Monthly Payroll" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <Input label="Period Label *" placeholder="e.g. November 2026" value={period.label} onChange={e => setPeriod(p => ({ ...p, label: e.target.value }))} required />
            <Input label="Period Start Date *" type="date" value={period.start} onChange={e => setPeriod(p => ({ ...p, start: e.target.value }))} required />
            <Input label="Period End Date *" type="date" value={period.end} onChange={e => setPeriod(p => ({ ...p, end: e.target.value }))} required />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Nigerian Statutory Payroll Breakdown ({activeEmployees.length} active staff)
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Gross = Basic + Housing + Transport + Other
              </span>
            </div>

            <div className="mobile-table-container" style={{ border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
              <table className="transaction-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {[
                      { label: 'Employee' },
                      { label: 'Salary Components' },
                      { label: 'Gross Pay' },
                      { label: 'PAYE Deducted', hideMobile: true },
                      { label: 'Pension (8%)', hideMobile: true },
                      { label: 'Net Take-Home' }
                    ].map(h => (
                      <th key={h.label} className={h.hideMobile ? 'mobile-hide' : 'mobile-tight-td'} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewCalcs.map((p) => (
                    <tr key={p.emp.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                      <td className="mobile-tight-td" style={{ padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>
                        <div className="mobile-desc-text" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.emp.full_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.emp.role}</div>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
                        <div>B: {formatCurrency(p.breakdown.basic)} · H: {formatCurrency(p.breakdown.housing)}</div>
                        <div>T: {formatCurrency(p.breakdown.transport)}{p.breakdown.other > 0 ? ` · O: ${formatCurrency(p.breakdown.other)}` : ''}</div>
                      </td>
                      <td className="mobile-tight-td" style={{ padding: '9px 12px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(p.gross)}</td>
                      <td className="mobile-hide" style={{ padding: '9px 12px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--warning)' }}>{formatCurrency(p.paye)}</td>
                      <td className="mobile-hide" style={{ padding: '9px 12px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--info)' }}>{formatCurrency(p.pension)}</td>
                      <td className="mobile-tight-td" style={{ padding: '9px 12px', fontSize: 13.5, fontFamily: 'Space Grotesk', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(p.netPay)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--bg-border)', background: 'var(--bg-elevated)' }}>
                    <td className="mobile-tight-td" style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>TOTALS</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)' }}>{activeEmployees.length} Employees</td>
                    <td className="mobile-tight-td" style={{ padding: '10px 12px', fontSize: 13.5, fontFamily: 'Space Grotesk', fontWeight: 800 }}>{formatCurrency(previewTotals.gross)}</td>
                    <td className="mobile-hide" style={{ padding: '10px 12px', fontSize: 13.5, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--warning)' }}>{formatCurrency(previewTotals.paye)}</td>
                    <td className="mobile-hide" style={{ padding: '10px 12px', fontSize: 13.5, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--info)' }}>{formatCurrency(previewTotals.pension)}</td>
                    <td className="mobile-tight-td" style={{ padding: '10px 12px', fontSize: 14, fontFamily: 'Space Grotesk', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(previewTotals.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(102, 45, 145, 0.08)', border: '1px solid rgba(102, 45, 145, 0.2)', fontSize: 12, color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--accent-primary)', marginBottom: 4 }}>
              <Info size={14} />
              Automated Accounting Treatment
            </div>
            When approved, ROVA debits <strong>Salary Expense (Gross: {formatCurrency(previewTotals.gross)})</strong> to your Profit & Loss statement, and credits <strong>PAYE ({formatCurrency(previewTotals.paye)})</strong> and <strong>Pension ({formatCurrency(previewTotals.pension)})</strong> to your Statutory Liabilities until remitted to tax authorities.
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={processing} onClick={handleProcess} disabled={!period.label || !period.start || !period.end}>
              Approve & Run Payroll
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: INDIVIDUAL OFFICIAL PAYSLIP VIEWER */}
      <Modal open={!!activePayslip} onClose={() => setActivePayslip(null)} title="Official Employee Payslip" size="md">
        {activePayslip && (() => {
          const { slip, emp, run } = activePayslip;
          const breakdown = parseSalaryBreakdown(emp.notes, slip.gross_salary);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Payslip Header */}
              <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>{emp.full_name}</h2>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{emp.role || 'Staff Member'} · {emp.department || 'Operations'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Badge variant="success">{run.period_label}</Badge>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {formatDate(run.period_start)} – {formatDate(run.period_end)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Earnings Breakdown */}
              <div style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  Earnings (Salary Components)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Basic Salary</span>
                    <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600 }}>{formatCurrency(breakdown.basic)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Housing Allowance</span>
                    <span style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(breakdown.housing)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Transport Allowance</span>
                    <span style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(breakdown.transport)}</span>
                  </div>
                  {breakdown.other > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Other Allowances / Bonuses</span>
                      <span style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(breakdown.other)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--bg-border)', fontWeight: 700 }}>
                    <span>Total Gross Earnings</span>
                    <span style={{ fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>{formatCurrency(slip.gross_salary)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions Breakdown */}
              <div style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  Statutory & Other Deductions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>PAYE Withholding Tax</span>
                    <span style={{ fontFamily: 'Space Grotesk', color: 'var(--warning)', fontWeight: 600 }}>- {formatCurrency(slip.paye_deduction)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Employee Pension (8%)</span>
                    <span style={{ fontFamily: 'Space Grotesk', color: 'var(--info)', fontWeight: 600 }}>- {formatCurrency(slip.pension_deduction)}</span>
                  </div>
                  {slip.other_deductions > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Salary Advances / Other</span>
                      <span style={{ fontFamily: 'Space Grotesk', color: 'var(--text-muted)' }}>- {formatCurrency(slip.other_deductions)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--bg-border)', fontWeight: 700 }}>
                    <span>Total Deductions</span>
                    <span style={{ fontFamily: 'Space Grotesk', color: 'var(--warning)' }}>- {formatCurrency(slip.paye_deduction + slip.pension_deduction + (slip.other_deductions || 0))}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay Box */}
              <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Net Take-Home Pay</span>
                  <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk', color: 'var(--success)', marginTop: 2 }}>
                    {formatCurrency(slip.net_pay)}
                  </div>
                </div>
                {emp.bank_name && (
                  <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                    <div>Disbursed to:</div>
                    <strong style={{ color: 'var(--text-primary)' }}>{emp.bank_name}</strong>
                    <div>{emp.bank_account}</div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
                <Button
                  variant="secondary"
                  icon={<Share2 size={14} />}
                  onClick={() => sharePayslipWhatsApp(slip, emp, run)}
                >
                  Share via WhatsApp
                </Button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="secondary" onClick={() => window.print()} icon={<Printer size={14} />}>
                    Print
                  </Button>
                  <Button variant="primary" onClick={() => setActivePayslip(null)}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
