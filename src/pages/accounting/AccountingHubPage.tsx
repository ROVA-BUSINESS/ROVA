import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';

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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
        <Card hoverable onClick={() => navigate('/app/general-ledger')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>General Ledger</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Master record of all accounts</div>
          </div>
        </Card>
        
        <Card hoverable onClick={() => navigate('/app/chart-of-accounts')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Chart of Accounts</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Financial account structure</div>
          </div>
        </Card>

        <Card hoverable onClick={() => navigate('/app/balance-sheet')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Balance Sheet</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Assets & Liabilities</div>
          </div>
        </Card>

        <Card hoverable onClick={() => navigate('/app/cash-flow')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Cash Flow</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Money in & out</div>
          </div>
        </Card>

        <Card hoverable onClick={() => navigate('/app/trial-balance')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Trial Balance</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Accounts overview</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
