import { useState, useMemo } from 'react';
import { Landmark } from 'lucide-react';
import { supabase, type PayrollRun, type Account } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate } from '../../lib/format';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

interface Props {
  runs: PayrollRun[];
  accounts: Account[];
  onRefresh: () => void;
}

export default function LiabilitiesTab({ runs, accounts, onRefresh }: Props) {
  const { user } = useAuth();
  const [remitType, setRemitType] = useState<'paye' | 'pension' | 'salary' | null>(null);
  const [remitAmount, setRemitAmount] = useState('');
  const [remitAgency, setRemitAgency] = useState('');
  const [remitAccountId, setRemitAccountId] = useState('');
  const [remitDate, setRemitDate] = useState(new Date().toISOString().split('T')[0]);
  const [remitRef, setRemitRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Compute accumulated liabilities
  const totalPayeAccumulated = useMemo(() => runs.reduce((s, r) => s + (r.total_paye || 0), 0), [runs]);
  const totalPensionAccumulated = useMemo(() => runs.reduce((s, r) => s + (r.total_pension || 0), 0), [runs]);
  const totalNetAccumulated = useMemo(() => runs.reduce((s, r) => s + (r.total_net || 0), 0), [runs]);

  // Compute remitted amounts from notes or transactions
  // Any run with [PAYE_REMITTED], [PENSION_REMITTED], [SALARY_PAID] is cleared
  const remittedPaye = useMemo(() => {
    return runs.filter(r => r.notes?.includes('[PAYE_REMITTED]')).reduce((s, r) => s + (r.total_paye || 0), 0);
  }, [runs]);

  const remittedPension = useMemo(() => {
    return runs.filter(r => r.notes?.includes('[PENSION_REMITTED]')).reduce((s, r) => s + (r.total_pension || 0), 0);
  }, [runs]);

  const paidSalaries = useMemo(() => {
    return runs.filter(r => r.status === 'processed' && (r.notes?.includes('[SALARY_PAID]') || !r.notes?.includes('[SALARY_UNPAID]'))).reduce((s, r) => s + (r.total_net || 0), 0);
  }, [runs]);

  const pendingPaye = Math.max(0, totalPayeAccumulated - remittedPaye);
  const pendingPension = Math.max(0, totalPensionAccumulated - remittedPension);
  const pendingSalaries = Math.max(0, totalNetAccumulated - paidSalaries);

  function openRemitModal(type: 'paye' | 'pension' | 'salary') {
    setRemitType(type);
    if (type === 'paye') {
      setRemitAmount(String(pendingPaye || 0));
      setRemitAgency('State Internal Revenue Service (LIRS / FIRS)');
    } else if (type === 'pension') {
      setRemitAmount(String(pendingPension || 0));
      setRemitAgency('Pension Fund Administrator (PFA)');
    } else {
      setRemitAmount(String(pendingSalaries || 0));
      setRemitAgency('Employee Bank Accounts');
    }
    setRemitAccountId(accounts[0]?.id || '');
    setRemitDate(new Date().toISOString().split('T')[0]);
    setRemitRef('');
  }

  async function handleRecordRemittance() {
    if (!remitType || !remitAmount || Number(remitAmount) <= 0 || !user) return;
    setSubmitting(true);
    try {
      const amt = Number(remitAmount);
      let desc = '';
      let catName = 'Salaries & Wages';

      if (remitType === 'paye') {
        desc = `PAYE Tax Remittance — ${remitAgency} (${formatDate(remitDate)})`;
        catName = 'Taxes & Compliance';
      } else if (remitType === 'pension') {
        desc = `Staff Pension Remittance (8%) — ${remitAgency} (${formatDate(remitDate)})`;
        catName = 'Salaries & Wages';
      } else {
        desc = `Net Salary Disbursement to Employees (${formatDate(remitDate)})`;
        catName = 'Salaries & Wages';
      }

      // Find matching category
      const { data: catData } = await supabase.from('categories').select('id').eq('name', catName).maybeSingle();

      // Record bank outflow transaction
      await supabase.from('transactions').insert({
        user_id: user.id,
        amount: amt,
        type: 'expense',
        description: desc,
        date: remitDate,
        account_id: remitAccountId || null,
        category_id: catData?.id || null,
        notes: `[Payroll Remittance: ${remitType.toUpperCase()} | Ref: ${remitRef || 'Bank Transfer'}]`,
      });

      // Update latest unremitted runs to mark them remitted
      const tag = remitType === 'paye' ? '[PAYE_REMITTED]' : remitType === 'pension' ? '[PENSION_REMITTED]' : '[SALARY_PAID]';
      for (const run of runs) {
        if (!run.notes?.includes(tag)) {
          const updatedNotes = run.notes ? `${run.notes} ${tag}` : tag;
          await supabase.from('payroll_runs').update({ notes: updatedNotes }).eq('id', run.id);
        }
      }

      setRemitType(null);
      onRefresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Overview Header Memo */}
      <Card style={{ padding: '16px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-dim)', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Landmark size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
              Payroll Statutory Liabilities & Remittances
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
              In accordance with Section 5 of the Nigerian Payroll Standard, your business records gross salaries as an operating expense upon approval. Deductions (PAYE &amp; Pension) remain current liabilities on your Balance Sheet until remitted to tax authorities and PFAs.
            </p>
          </div>
        </div>
      </Card>

      {/* 3 Main Liability Gateway Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* PAYE Tax Liability */}
        <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--warning)' }}>
                PAYE Withholding Tax
              </span>
              <Badge variant={pendingPaye > 0 ? 'warning' : 'success'}>
                {pendingPaye > 0 ? 'Awaiting Remittance' : 'Remitted / Cleared'}
              </Badge>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', marginBottom: 6 }}>
              {formatCurrency(pendingPaye)}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
              Due monthly by the 10th day to State Internal Revenue Services (e.g. LIRS, FCT-IRS, OGIRS).
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openRemitModal('paye')}
            disabled={pendingPaye <= 0}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Record PAYE Remittance
          </Button>
        </Card>

        {/* Employee Pension Liability */}
        <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--info)' }}>
                Employee Pension (8%)
              </span>
              <Badge variant={pendingPension > 0 ? 'info' : 'success'}>
                {pendingPension > 0 ? 'Pending PFA Transfer' : 'Fully Funded'}
              </Badge>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', marginBottom: 6 }}>
              {formatCurrency(pendingPension)}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
              Statutory pension contributions under Pension Reform Act 2014. Due within 7 days of salary payment.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openRemitModal('pension')}
            disabled={pendingPension <= 0}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Record Pension Remittance
          </Button>
        </Card>

        {/* Salaries Payable */}
        <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--success)' }}>
                Net Salaries Payable
              </span>
              <Badge variant={pendingSalaries > 0 ? 'default' : 'success'}>
                {pendingSalaries > 0 ? 'Awaiting Payout' : 'All Paid'}
              </Badge>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', marginBottom: 6 }}>
              {formatCurrency(pendingSalaries)}
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>
              Actual take-home salaries owed to staff for approved runs before bank transfers are executed.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => openRemitModal('salary')}
            disabled={pendingSalaries <= 0}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Record Salary Disbursement
          </Button>
        </Card>
      </div>

      {/* Double Entry Accounting Explanation Banner */}
      <Card style={{ padding: 18, border: '1px solid rgba(102, 45, 145, 0.25)', background: 'linear-gradient(135deg, rgba(102, 45, 145, 0.05), var(--bg-card))' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          ROVA Automated Journal Entry Mapping:
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, fontSize: 12 }}>
          <div style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
            <strong>1. Upon Approval:</strong>
            <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
              • Debit: Salary Expense (Gross)<br />
              • Credit: PAYE Payable<br />
              • Credit: Pension Payable<br />
              • Credit: Salaries Payable (Net)
            </div>
          </div>
          <div style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
            <strong>2. When Salaries Are Paid:</strong>
            <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
              • Debit: Salaries Payable (Net)<br />
              • Credit: Bank / Cash Account
            </div>
          </div>
          <div style={{ padding: 10, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
            <strong>3. When Remittances Are Executed:</strong>
            <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
              • Debit: PAYE / Pension Payable<br />
              • Credit: Bank Account
            </div>
          </div>
        </div>
      </Card>

      {/* Record Remittance / Settlement Modal */}
      <Modal
        open={!!remitType}
        onClose={() => setRemitType(null)}
        title={remitType === 'paye' ? 'Record PAYE Remittance' : remitType === 'pension' ? 'Record Pension Remittance' : 'Record Salary Payout'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input
            label="Payment Amount (₦)"
            type="number"
            value={remitAmount}
            onChange={e => setRemitAmount(e.target.value)}
            required
          />
          <Input
            label="Beneficiary / Agency Name"
            value={remitAgency}
            onChange={e => setRemitAgency(e.target.value)}
            placeholder="e.g. Lagos State Internal Revenue Service"
            required
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Input
              label="Payment Date"
              type="date"
              value={remitDate}
              onChange={e => setRemitDate(e.target.value)}
              required
            />
            <Input
              label="Reference / Receipt #"
              placeholder="e.g. LIRS-REC-94812"
              value={remitRef}
              onChange={e => setRemitRef(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Paying Bank Account</label>
            <select
              value={remitAccountId}
              onChange={e => setRemitAccountId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--bg-border)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
            <Button variant="secondary" onClick={() => setRemitType(null)}>Cancel</Button>
            <Button variant="primary" loading={submitting} onClick={handleRecordRemittance}>
              Record &amp; Post to Books
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
