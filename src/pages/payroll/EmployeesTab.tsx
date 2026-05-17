import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { supabase, type Employee } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/format';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useMobile } from '../../hooks/useMobile';

const EMPTY_FORM = {
  full_name: '', email: '', phone: '', role: '', department: '',
  employment_type: 'full_time' as Employee['employment_type'],
  start_date: new Date().toISOString().split('T')[0],
  gross_salary: '', paye_rate: '7.5', pension_rate: '8.0',
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
    setForm({
      full_name: emp.full_name, email: emp.email, phone: emp.phone,
      role: emp.role, department: emp.department,
      employment_type: emp.employment_type,
      start_date: emp.start_date,
      gross_salary: String(emp.gross_salary), paye_rate: String(emp.paye_rate),
      pension_rate: String(emp.pension_rate), bank_name: emp.bank_name,
      bank_account: emp.bank_account, notes: emp.notes,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      gross_salary: Number(form.gross_salary),
      paye_rate: Number(form.paye_rate),
      pension_rate: Number(form.pension_rate),
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
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>{activeCount}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Payroll</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent-light)' }}>{formatCurrency(totalPayroll)}</div>
        </Card>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Employee Records</h3>
        <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>Add Employee</Button>
      </div>

      {employees.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Users size={36} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No employees yet</p>
            <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4, marginBottom: 16 }}>Add your first employee to start processing payroll</p>
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
                    { label: 'Gross Salary' },
                    { label: 'PAYE', hideMobile: true },
                    { label: 'Pension', hideMobile: true },
                    { label: 'Status' },
                    { label: '' }
                  ].map(h => (
                    <th key={h.label} className={h.hideMobile ? 'mobile-hide' : 'mobile-tight-td'} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => {
                  const paye = emp.gross_salary * (emp.paye_rate / 100);
                  const pension = emp.gross_salary * (emp.pension_rate / 100);
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
                      <td className="mobile-tight-td" style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {formatCurrency(emp.gross_salary)}
                      </td>
                      <td className="mobile-hide" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--warning)' }}>{formatCurrency(paye)}</td>
                      <td className="mobile-hide" style={{ padding: '12px 16px', fontSize: 12, color: 'var(--info)' }}>{formatCurrency(pension)}</td>
                      <td className="mobile-tight-td" style={{ padding: '12px 16px' }}>
                        <Badge variant={STATUS_VARIANT[emp.status]}>{emp.status}</Badge>
                      </td>
                      <td className="mobile-tight-td" style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => openEdit(emp)}
                            style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                          ><Pencil size={12} /></button>
                          <button onClick={() => handleDelete(emp.id)}
                            style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--error-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--error)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                          ><Trash2 size={12} /></button>
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Employee' : 'Add Employee'} size="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Input label="Full Name" placeholder="John Doe" value={form.full_name} onChange={f('full_name')} required />
            <Input label="Email" type="email" placeholder="john@company.com" value={form.email} onChange={f('email')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <Input label="Phone" placeholder="+234..." value={form.phone} onChange={f('phone')} />
            <Input label="Role / Title" placeholder="Software Engineer" value={form.role} onChange={f('role')} />
            <Input label="Department" placeholder="Engineering" value={form.department} onChange={f('department')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Employment Type</label>
              <select value={form.employment_type} onChange={f('employment_type')}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
              </select>
            </div>
            <Input label="Start Date" type="date" value={form.start_date} onChange={f('start_date')} required />
            <Input label="Gross Monthly Salary (₦)" type="number" min="0" step="0.01" placeholder="0.00" value={form.gross_salary} onChange={f('gross_salary')} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Input label="PAYE Rate (%)" type="number" min="0" max="100" step="0.1" value={form.paye_rate} onChange={f('paye_rate')} />
            <Input label="Pension Rate (%)" type="number" min="0" max="100" step="0.1" value={form.pension_rate} onChange={f('pension_rate')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Input label="Bank Name" placeholder="First Bank" value={form.bank_name} onChange={f('bank_name')} />
            <Input label="Bank Account Number" placeholder="0123456789" value={form.bank_account} onChange={f('bank_account')} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">{editing ? 'Save Changes' : 'Add Employee'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
