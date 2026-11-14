import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, Play, Briefcase, Landmark } from 'lucide-react';
import { supabase, type Employee, type PayrollRun, type Account } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/format';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import EmployeesTab from './EmployeesTab';
import PayrollRunTab from './PayrollRunTab';
import LiabilitiesTab from './LiabilitiesTab';
import ContractorsTab from './ContractorsTab';

type Tab = 'employees' | 'payroll' | 'liabilities' | 'contractors';

export default function PayrollPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(
    location.state?.openCreateModal ? 'payroll' : 'employees'
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [empRes, runRes, accsRes] = await Promise.all([
      supabase.from('employees').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('payroll_runs').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', user!.id).eq('is_active', true),
    ]);
    setEmployees(empRes.data || []);
    setRuns(runRes.data || []);
    setAccounts(accsRes.data || []);
    setLoading(false);
  }

  // Executive summary calculations matching Nigerian Payroll Specification
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);
  const totalGrossPayroll = useMemo(() => activeEmployees.reduce((s, e) => s + (e.gross_salary || 0), 0), [activeEmployees]);
  
  // Calculate total net salaries for current active employees
  const totalNetSalaries = useMemo(() => {
    return activeEmployees.reduce((sum, emp) => {
      const paye = emp.gross_salary * ((emp.paye_rate ?? 7.5) / 100);
      const pension = emp.gross_salary * ((emp.pension_rate ?? 8.0) / 100);
      return sum + (emp.gross_salary - paye - pension);
    }, 0);
  }, [activeEmployees]);

  // Compute pending unremitted statutory liabilities
  const pendingLiabilities = useMemo(() => {
    const unremittedPaye = runs.filter(r => !r.notes?.includes('[PAYE_REMITTED]')).reduce((s, r) => s + (r.total_paye || 0), 0);
    const unremittedPension = runs.filter(r => !r.notes?.includes('[PENSION_REMITTED]')).reduce((s, r) => s + (r.total_pension || 0), 0);
    return unremittedPaye + unremittedPension;
  }, [runs]);

  const latestRun = runs[0];
  const runStatus = latestRun
    ? latestRun.notes?.includes('[SALARY_PAID]')
      ? 'Paid'
      : latestRun.status === 'processed'
      ? 'Approved'
      : 'Draft'
    : 'No Runs';

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'employees', label: 'Employees', icon: Users },
    { key: 'payroll', label: 'Payroll Runs', icon: Play },
    { key: 'liabilities', label: 'Payroll Liabilities', icon: Landmark },
    { key: 'contractors', label: 'Contractors', icon: Briefcase },
  ];

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1120, animation: 'fadeIn 0.3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>Payroll & Compensation</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '4px 0 0' }}>
          Nigerian statutory payroll engine — automated salary expenses, PAYE, Pension (8%), and remittance liabilities
        </p>
      </div>

      {/* Top Executive Summary Cards (Section 7 Architecture) */}
      <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        {/* Total Gross Payroll */}
        <Card style={{ padding: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Gross Payroll
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', marginTop: 6 }}>
            {formatCurrency(totalGrossPayroll)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Recorded as Operating Expense
          </div>
        </Card>

        {/* Net Salaries */}
        <Card style={{ padding: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Net Salaries Payable
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)', marginTop: 6 }}>
            {formatCurrency(totalNetSalaries)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Net employee take-home pay
          </div>
        </Card>

        {/* Active Employees */}
        <Card style={{ padding: 18 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Active Employees
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', marginTop: 6 }}>
            {activeEmployees.length}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            {employees.length} total staff records
          </div>
        </Card>

        {/* Statutory Liabilities / Latest Run */}
        <Card style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Pending Liabilities
            </span>
            <Badge variant={runStatus === 'Paid' ? 'success' : runStatus === 'Approved' ? 'info' : 'warning'}>
              {runStatus}
            </Badge>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: pendingLiabilities > 0 ? 'var(--warning)' : 'var(--text-primary)', marginTop: 6 }}>
            {formatCurrency(pendingLiabilities)}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
            Unremitted PAYE & Pension
          </div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px',
              borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500,
              background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.15s', boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none',
              border: tab === t.key ? '1px solid var(--bg-border)' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 10 }} />)}</div>
      ) : tab === 'employees' ? (
        <EmployeesTab employees={employees} onRefresh={loadData} />
      ) : tab === 'payroll' ? (
        <PayrollRunTab employees={employees} runs={runs} onRefresh={loadData} locationState={location.state} />
      ) : tab === 'liabilities' ? (
        <LiabilitiesTab runs={runs} accounts={accounts} onRefresh={loadData} />
      ) : (
        <ContractorsTab />
      )}
    </div>
  );
}
