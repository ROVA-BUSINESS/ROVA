import { useState } from 'react';
import { Play, ChevronDown, ChevronRight, FileText, AlertCircle } from 'lucide-react';
import { supabase, type Employee, type PayrollRun, type Payslip } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../lib/format';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useMobile } from '../../hooks/useMobile';

interface Props {
  employees: Employee[];
  runs: PayrollRun[];
  onRefresh: () => void;
}

export default function PayrollRunTab({ employees, runs, onRefresh }: Props) {
  const { user } = useAuth();
  const isMobile = useMobile(1024);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [runPayslips, setRunPayslips] = useState<Record<string, Payslip[]>>({});
  const [processing, setProcessing] = useState(false);
  const [period, setPeriod] = useState({
    label: '', start: '', end: '', notes: '',
  });

  const activeEmployees = employees.filter(e => e.status === 'active');

  function calcForEmployee(emp: Employee) {
    const paye = emp.gross_salary * (emp.paye_rate / 100);
    const pension = emp.gross_salary * (emp.pension_rate / 100);
    const net = emp.gross_salary - paye - pension;
    return { paye, pension, net };
  }

  const preview = activeEmployees.map(emp => {
    const { paye, pension, net } = calcForEmployee(emp);
    return { emp, paye, pension, net };
  });
  const previewTotals = preview.reduce((s, p) => ({
    gross: s.gross + p.emp.gross_salary,
    paye: s.paye + p.paye,
    pension: s.pension + p.pension,
    net: s.net + p.net,
  }), { gross: 0, paye: 0, pension: 0, net: 0 });

  async function handleProcess() {
    if (!period.label || !period.start || !period.end || activeEmployees.length === 0) return;
    setProcessing(true);

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
      notes: period.notes,
      processed_at: new Date().toISOString(),
    }).select().maybeSingle();

    if (!error && run) {
      const payslipRows: Record<string, unknown>[] = [];

      for (const emp of activeEmployees) {
        const { paye, pension, net } = calcForEmployee(emp);
        const txDesc = `Salary — ${emp.full_name} (${period.label})`;
        const { data: tx } = await supabase.from('transactions').insert({
          user_id: user!.id,
          amount: emp.gross_salary,
          type: 'expense',
          description: txDesc,
          date: period.end,
          notes: `PAYE: ${formatCurrency(paye)} | Pension: ${formatCurrency(pension)} | Net: ${formatCurrency(net)}`,
        }).select().maybeSingle();

        payslipRows.push({
          payroll_run_id: run.id,
          employee_id: emp.id,
          user_id: user!.id,
          gross_salary: emp.gross_salary,
          paye_deduction: paye,
          pension_deduction: pension,
          other_deductions: 0,
          net_pay: net,
          transaction_id: tx?.id || null,
        });
      }

      await supabase.from('payslips').insert(payslipRows);
      setShowModal(false);
      setPeriod({ label: '', start: '', end: '', notes: '' });
      onRefresh();
    }
    setProcessing(false);
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Payroll Runs</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Process salaries — automatically creates expense transactions</p>
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
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)' }}>No active employees</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Add employees in the Employees tab before running payroll.</div>
            </div>
          </div>
        </Card>
      )}

      {runs.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            <FileText size={32} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p>No payroll runs yet. Process your first payroll above.</p>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {runs.map(run => (
            <Card key={run.id} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                <button onClick={() => toggleExpand(run.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', cursor: 'pointer', flex: 1 }}>
                  {expanded.has(run.id) ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{run.period_label}</span>
                      <Badge variant={run.status === 'processed' ? 'success' : 'warning'}>{run.status}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatDate(run.period_start)} – {formatDate(run.period_end)} · {run.employee_count} employees
                    </div>
                  </div>
                </button>
                <div className="mobile-gap-4" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                  <div className="mobile-hide" style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Gross</div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>{formatCurrency(run.total_gross)}</div>
                  </div>
                  <div className="mobile-hide" style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>PAYE</div>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Space Grotesk', color: 'var(--warning)' }}>{formatCurrency(run.total_paye)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Net Pay</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--success)' }}>{formatCurrency(run.total_net)}</div>
                  </div>
                </div>
              </div>
              {expanded.has(run.id) && runPayslips[run.id] && (
                <div className="mobile-table-container" style={{ borderTop: '1px solid var(--bg-border)' }}>
                  <table className="transaction-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-elevated)' }}>
                        {[
                          { label: 'Employee' },
                          { label: 'Gross' },
                          { label: 'PAYE', hideMobile: true },
                          { label: 'Pension', hideMobile: true },
                          { label: 'Net Pay' }
                        ].map(h => (
                          <th key={h.label} className={h.hideMobile ? 'mobile-hide' : 'mobile-tight-td'} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {runPayslips[run.id].map((slip) => (
                        <tr key={slip.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                          <td className="mobile-tight-td" style={{ padding: '10px 16px' }}>
                            <div className="mobile-desc-text" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(slip.employee as any)?.full_name}</div>
                            <div className="mobile-desc-text" style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(slip.employee as any)?.role}</div>
                          </td>
                          <td className="mobile-tight-td" style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--text-secondary)' }}>{formatCurrency(slip.gross_salary)}</td>
                          <td className="mobile-hide" style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--warning)' }}>{formatCurrency(slip.paye_deduction)}</td>
                          <td className="mobile-hide" style={{ padding: '10px 16px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--info)' }}>{formatCurrency(slip.pension_deduction)}</td>
                          <td className="mobile-tight-td" style={{ padding: '10px 16px', fontSize: 14, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(slip.net_pay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Run Payroll" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <Input label="Period Label" placeholder="January 2026" value={period.label} onChange={e => setPeriod(p => ({ ...p, label: e.target.value }))} required />
            <Input label="Period Start" type="date" value={period.start} onChange={e => setPeriod(p => ({ ...p, start: e.target.value }))} required />
            <Input label="Period End" type="date" value={period.end} onChange={e => setPeriod(p => ({ ...p, end: e.target.value }))} required />
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>Payroll Preview ({activeEmployees.length} active employees)</div>
            <div className="mobile-table-container" style={{ border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)' }}>
              <table className="transaction-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {[
                      { label: 'Employee' },
                      { label: 'Gross' },
                      { label: 'PAYE', hideMobile: true },
                      { label: 'Pension', hideMobile: true },
                      { label: 'Net Pay' }
                    ].map(h => (
                      <th key={h.label} className={h.hideMobile ? 'mobile-hide' : 'mobile-tight-td'} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((p) => (
                    <tr key={p.emp.id} style={{ borderTop: '1px solid var(--bg-border)' }}>
                      <td className="mobile-tight-td" style={{ padding: '9px 14px', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                        <div className="mobile-desc-text" style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.emp.full_name}</div>
                      </td>
                      <td className="mobile-tight-td" style={{ padding: '9px 14px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--text-secondary)' }}>{formatCurrency(p.emp.gross_salary)}</td>
                      <td className="mobile-hide" style={{ padding: '9px 14px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--warning)' }}>{formatCurrency(p.paye)}</td>
                      <td className="mobile-hide" style={{ padding: '9px 14px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--info)' }}>{formatCurrency(p.pension)}</td>
                      <td className="mobile-tight-td" style={{ padding: '9px 14px', fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(p.net)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '2px solid var(--bg-border)', background: 'var(--bg-elevated)' }}>
                    <td className="mobile-tight-td" style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>TOTALS</td>
                    <td className="mobile-tight-td" style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 700 }}>{formatCurrency(previewTotals.gross)}</td>
                    <td className="mobile-hide" style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--warning)' }}>{formatCurrency(previewTotals.paye)}</td>
                    <td className="mobile-hide" style={{ padding: '10px 14px', fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--info)' }}>{formatCurrency(previewTotals.pension)}</td>
                    <td className="mobile-tight-td" style={{ padding: '10px 14px', fontSize: 14, fontFamily: 'Space Grotesk', fontWeight: 800, color: 'var(--success)' }}>{formatCurrency(previewTotals.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--warning-dim)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: 'var(--text-secondary)' }}>
            Processing payroll will automatically create expense transactions for each employee's gross salary, linked to this payroll run.
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={processing} onClick={handleProcess} disabled={!period.label || !period.start || !period.end}>
              Process Payroll
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
