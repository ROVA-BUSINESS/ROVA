import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, Play } from 'lucide-react';
import { supabase, type Employee, type PayrollRun } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import EmployeesTab from './EmployeesTab';
import PayrollRunTab from './PayrollRunTab';

type Tab = 'employees' | 'payroll';

export default function PayrollPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(location.state?.openCreateModal ? 'payroll' : 'employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [empRes, runRes] = await Promise.all([
      supabase.from('employees').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('payroll_runs').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
    ]);
    setEmployees(empRes.data || []);
    setRuns(runRes.data || []);
    setLoading(false);
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'employees', label: 'Employees', icon: Users },
    { key: 'payroll', label: 'Payroll Runs', icon: Play },
  ];

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1100, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Payroll & Staff</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Manage employees, process salaries, and track deductions</p>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 24, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px',
              borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500,
              background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.15s', boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none',
              border: tab === t.key ? '1px solid var(--bg-border)' : '1px solid transparent',
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
      ) : (
        <PayrollRunTab employees={employees} runs={runs} onRefresh={loadData} locationState={location.state} />
      )}
    </div>
  );
}
