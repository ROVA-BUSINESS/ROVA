import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import { 
  TrendingUp, Scale, BookOpen, Layers, Activity, 
  FileSpreadsheet, PieChart, FileText, BookMarked,
  Users, FileMinus2, Repeat, Building2, Target
} from 'lucide-react';

export default function AccountingHubPage() {
  const navigate = useNavigate();

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1100, animation: 'fadeIn 0.3s ease' }}>
      <div className="mobile-col mobile-gap-4" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Accounting Hub</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Core accounting records and financial statements</p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>
          Financial Statements
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
          <Card hoverable onClick={() => navigate('/app/profit-loss')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'var(--success-dim)', borderRadius: 10, flexShrink: 0 }}>
              <TrendingUp size={22} color="var(--success)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Profit & Loss</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Income, expenses & net profit</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/balance-sheet')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'var(--accent-dim)', borderRadius: 10, flexShrink: 0 }}>
              <Scale size={22} color="var(--accent-primary)" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Balance Sheet</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Assets, liabilities & equity</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/changes-in-equity')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(16, 185, 129, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <PieChart size={22} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Changes in Equity</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Share capital, reserves & movements</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/cash-flow')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(234, 179, 8, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <Activity size={22} color="#eab308" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Cash Flow</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Operating, investing & financing</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/financial-notes')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(99, 102, 241, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <FileText size={22} color="#6366f1" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Notes to the Accounts</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Accounting policies & statutory disclosures</div>
            </div>
          </Card>
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: 12 }}>
          General Ledger & Books
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <Card hoverable onClick={() => navigate('/app/trial-balance')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(236, 72, 153, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <FileSpreadsheet size={22} color="#ec4899" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Trial Balance</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Debits vs credits balance</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/ledger')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(59, 130, 246, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <BookOpen size={22} color="#3b82f6" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>General Ledger</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Master record of all accounts</div>
            </div>
          </Card>
          
          <Card hoverable onClick={() => navigate('/app/chart-of-accounts')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(168, 85, 247, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <Layers size={22} color="#a855f7" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Chart of Accounts</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Financial account structure</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/journal-entries')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(20, 184, 166, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <BookMarked size={22} color="#14b8a6" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Journal Entries</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Manual debits and credits adjustments</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/customers')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(14, 165, 233, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <Users size={22} color="#0ea5e9" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Customers &amp; Statements</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Customer directory &amp; PDF Statements of Account</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/credit-notes')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(239, 68, 68, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <FileMinus2 size={22} color="#ef4444" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Credit Notes &amp; Refunds</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sales returns, VAT reversals &amp; customer refunds</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/recurring')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(245, 158, 11, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <Repeat size={22} color="#f59e0b" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Recurring &amp; Overdue Reminders</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Auto-invoices, bills &amp; overdue payment chases</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/fixed-assets')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(139, 92, 246, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <Building2 size={22} color="#8b5cf6" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Fixed Asset Register</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>PPE register, monthly depreciation &amp; disposals</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/budgets')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(34, 197, 94, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <Target size={22} color="#22c55e" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Budgets &amp; Variance</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Monthly/annual budgets, actual vs plan &amp; overspend alerts</div>
            </div>
          </Card>

          <Card hoverable onClick={() => navigate('/app/opening-balances')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(99, 102, 241, 0.12)', borderRadius: 10, flexShrink: 0 }}>
              <Scale size={22} color="#6366f1" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Opening Balances</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Migrate starting assets, liabilities, equity, AR &amp; AP</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
