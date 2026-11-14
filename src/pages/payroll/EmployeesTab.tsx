import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Users, Layers, ShieldCheck } from 'lucide-react';
import { supabase, type Employee } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/format';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useMobile } from '../../hooks/useMobile';
import { parseSalaryBreakdown, encodeSalaryBreakdown } from '../../lib/payrollService';

const EMPTY_FORM = {
  full_name: '', email: '', phone: '', role: '', department: '',
  employment_type: 'full_time' as Employee['employment_type'],
  start_date: new Date().toISOString().split('T')[0],
  basic_salary: '',
  housing_allowance: '',
  transport_allowance: '',
  other_allowance: '',
  gross_salary: '',
  paye_rate: '7.5',
  pension_rate: '8.0',
  bank_name: '', bank_account: '', notes: '',
};

const STATUS_VARIANT: Record<Employee['status'], 'success' | 'warning' | 'error'> = {
  active: 'success', inactive: 'warning', terminated: 'error',
};

interface Props {
  employees: Employee[];
  onRefresh: () => void;
}

export default function EmployeesTab({ employees, onRefresh }: Props) {
  const { user } = useAuth();
  const isMobile = useMobile(1024);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    const breakdown = parseSalaryBreakdown(emp.notes, emp.gross_salary);
    setForm({
      full_name: emp.full_name,
      email: emp.email,
      phone: emp.phone,
      role: emp.role,
      department: emp.department,
      employment_type: emp.employment_type,
      start_date: emp.start_date,
      basic_salary: String(breakdown.basic || ''),
      housing_allowance: String(breakdown.housing || ''),
      transport_allowance: String(breakdown.transport || ''),
      other_allowance: String(breakdown.other || ''),
      gross_salary: String(emp.gross_salary),
      paye_rate: String(emp.paye_rate),
      pension_rate: String(emp.pension_rate),
      bank_name: emp.bank_name,
      bank_account: emp.bank_account,
      notes: emp.notes,
    });
    setShowModal(true);
  }

  // Update gross whenever breakdown components change
  function handleAllowanceChange(field: 'basic_salary' | 'housing_allowance' | 'transport_allowance' | 'other_allowance', val: string) {
    setForm(prev => {
      const updated = { ...prev, [field]: val };
      const basic = Number(updated.basic_salary) || 0;
      const housing = Number(updated.housing_allowance) || 0;
      const transport = Number(updated.transport_allowance) || 0;
      const other = Number(updated.other_allowance) || 0;
      const total = basic + housing + transport + other;
      return {
        ...updated,
        gross_salary: total > 0 ? String(total) : prev.gross_salary,
      };
    });
  }

  // If user enters gross salary directly, split by Nigerian statutory standard (60/25/15)
  function handleGrossChange(val: string) {
    const grossNum = Number(val) || 0;
    if (grossNum > 0) {
      const basic = Math.round(grossNum * 0.6);
      const housing = Math.round(grossNum * 0.25);
      const transport = Math.round(grossNum * 0.15);
      setForm(prev => ({
        ...prev,
        gross_salary: val,
        basic_salary: String(basic),
        housing_allowance: String(housing),
        transport_allowance: String(transport),
        other_allowance: '0',
      }));
    } else {
      setForm(prev => ({ ...prev, gross_salary: val }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    const basic = Number(form.basic_salary) || 0;
    const housing = Number(form.housing_allowance) || 0;
    const transport = Number(form.transport_allowance) || 0;
    const other = Number(form.other_allowance) || 0;
    const gross = Number(form.gross_salary) || (basic + housing + transport + other);

    // Encode breakdown into notes
    const updatedNotes = encodeSalaryBreakdown(
      { basic, housing, transport, other },
      form.notes
    );

    const payload = {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      role: form.role,
      department: form.department,
      employment_type: form.employment_type,
      start_date: form.start_date,
      gross_salary: gross,
      paye_rate: Number(form.paye_rate) || 0,
      pension_rate: Number(form.pension_rate) || 0,
      bank_name: form.bank_name,
      bank_account: form.bank_account,
      notes: updatedNotes,
      user_id: user!.id,
    };

    if (editing) {
      await supabase.from('employees').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('employees').insert(payload);
    }
    setSaving(false);
    setShowModal(false);
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this employee?')) return;
    await supabase.from('employees').delete().eq('id', id);
    onRefresh();
  }

  function f(field: keyof typeof EMPTY_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));
  }

  const activeCount = employees.filter(e => e.status === 'active').length;
  const totalPayroll = employees.filter(e => e.status === 'active').reduce((s, e) => s + e.gross_salary, 0);

  return (
    <div>
      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Staff</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>{employees.length}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Employees</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>{activeCount}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Gross Payroll</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>{formatCurrency(totalPayroll)}</div>
        </Card>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Employee Salary & Records</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>Configure employee contracts, salary allowances, and statutory deduction rates</p>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>Add Employee</Button>
      </div>

      {employees.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Users size={36} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No employees yet</p>
            <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4, marginBottom: 16 }}>Add your first employee to set up salary components and deductions</p>
            <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>Add Employee</Button>
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div className="mobile-table-container">
            <table className="transaction-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {[
                    { label: 'Name' },
                    { label: 'Role / Dept', hideMobile: true },
                    { label: 'Type', hideMobile: true },
                    { label: 'Salary Breakdown' },
                    { label: 'Gross Salary' },
                    { label: 'PAYE Tax', hideMobile: true },
                    { label: 'Pension (8%)', hideMobile: true },
                    { label: 'Status' },
                    { label: '' }
                  ].map(h => (
                    <th key={h.label} className={h.hideMobile ? 'mobile-hide' : 'mobile-tight-td'} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => {
                  const breakdown = parseSalaryBreakdown(emp.notes, emp.gross_salary);
                  const paye = emp.gross_salary * (emp.paye_rate / 100);
                  const pensionBase = breakdown.basic + breakdown.housing + breakdown.transport;
                  const pension = pensionBase * (emp.pension_rate / 100);

                  return (
                    <tr key={emp.id} style={{ borderTop: i > 0 ? '1px solid var(--bg-border)' : 'none' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <td className="mobile-tight-td" style={{ padding: '12px 16px' }}>
                        <div className="mobile-desc-text" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.full_name}</div>
                        <div className="mobile-desc-text" style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.email}</div>
                      </td>
                      <td className="mobile-hide" style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{emp.role || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.department || '—'}</div>
                      </td>
                      <td className="mobile-hide" style={{ padding: '12px 16px' }}>
                        <Badge variant="default">{emp.employment_type.replace('_', ' ')}</Badge>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span>Basic: <strong>{formatCurrency(breakdown.basic)}</strong></span>
                          <span>Housing: {formatCurrency(breakdown.housing)} · Transport: {formatCurrency(breakdown.transport)}</span>
                          {breakdown.other > 0 && <span>Other: {formatCurrency(breakdown.other)}</span>}
                        </div>
                      </td>
                      <td className="mobile-tight-td" style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', fontWeight: 700 }}>
                        {formatCurrency(emp.gross_salary)}
                      </td>
                      <td className="mobile-hide" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--warning)', fontFamily: 'Space Grotesk' }}>
                        {formatCurrency(paye)} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({emp.paye_rate}%)</span>
                      </td>
                      <td className="mobile-hide" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--info)', fontFamily: 'Space Grotesk' }}>
                        {formatCurrency(pension)} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({emp.pension_rate}%)</span>
                      </td>
                      <td className="mobile-tight-td" style={{ padding: '12px 16px' }}>
                        <Badge variant={STATUS_VARIANT[emp.status]}>{emp.status}</Badge>
                      </td>
                      <td className="mobile-tight-td" style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => openEdit(emp)}
                            title="Edit Employee"
                            style={{ padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                          ><Pencil size={13} /></button>
                          <button onClick={() => handleDelete(emp.id)}
                            title="Delete Employee"
                            style={{ padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--error-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--error)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                          ><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL: ADD / EDIT EMPLOYEE */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Employee Details' : 'Add New Employee'} size="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Personal Details */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Input label="Full Name *" placeholder="e.g. John Doe" value={form.full_name} onChange={f('full_name')} required />
            <Input label="Work Email" type="email" placeholder="john@company.com" value={form.email} onChange={f('email')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <Input label="Phone Number" placeholder="+234 801 234 5678" value={form.phone} onChange={f('phone')} />
            <Input label="Job Title / Role" placeholder="e.g. Account Manager" value={form.role} onChange={f('role')} />
            <Input label="Department" placeholder="e.g. Finance" value={form.department} onChange={f('department')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Employment Type</label>
              <select value={form.employment_type} onChange={f('employment_type')}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <Input label="Employment Start Date" type="date" value={form.start_date} onChange={f('start_date')} required />
          </div>

          {/* Salary Breakdown (Nigerian Standard) */}
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={14} color="var(--accent-primary)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Salary Components (Nigerian Structure)</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sums automatically to Total Gross Salary</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
              <Input
                label="Basic Salary (₦) *"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 100000"
                value={form.basic_salary}
                onChange={e => handleAllowanceChange('basic_salary', e.target.value)}
                required
              />
              <Input
                label="Housing Allowance (₦)"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 25000"
                value={form.housing_allowance}
                onChange={e => handleAllowanceChange('housing_allowance', e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginTop: 8 }}>
              <Input
                label="Transport Allowance (₦)"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 15000"
                value={form.transport_allowance}
                onChange={e => handleAllowanceChange('transport_allowance', e.target.value)}
              />
              <Input
                label="Other Allowances / Bonuses (₦)"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 10000"
                value={form.other_allowance}
                onChange={e => handleAllowanceChange('other_allowance', e.target.value)}
              />
            </div>

            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Total Gross Salary:</span>
              <div style={{ width: 220 }}>
                <Input
                  label=""
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Gross Total"
                  value={form.gross_salary}
                  onChange={e => handleGrossChange(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Statutory Deductions */}
          <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <ShieldCheck size={14} color="var(--warning)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Statutory Deduction Rates</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
              <Input
                label="PAYE Tax Rate (%)"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.paye_rate}
                onChange={f('paye_rate')}
              />
              <Input
                label="Pension Contribution Rate (%)"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.pension_rate}
                onChange={f('pension_rate')}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0' }}>
              Statutory standard: Pension Reform Act requires 8% employee contribution calculated on (Basic + Housing + Transport).
            </p>
          </div>

          {/* Bank Details */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Input label="Bank Name" placeholder="e.g. Zenith Bank / GTBank" value={form.bank_name} onChange={f('bank_name')} />
            <Input label="Bank Account Number" placeholder="10-digit NUBAN" value={form.bank_account} onChange={f('bank_account')} />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8 }}>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">{editing ? 'Save Changes' : 'Save Employee'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
