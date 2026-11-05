import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import { TrendingUp, Scale, BookOpen, Layers, Activity, FileSpreadsheet } from 'lucide-react';

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

        <Card hoverable onClick={() => navigate('/app/cash-flow')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(234, 179, 8, 0.12)', borderRadius: 10, flexShrink: 0 }}>
            <Activity size={22} color="#eab308" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Cash Flow</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Operating, investing & financing</div>
          </div>
        </Card>

        <Card hoverable onClick={() => navigate('/app/trial-balance')} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'rgba(236, 72, 153, 0.12)', borderRadius: 10, flexShrink: 0 }}>
            <FileSpreadsheet size={22} color="#ec4899" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Trial Balance</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Debits vs credits balance</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
