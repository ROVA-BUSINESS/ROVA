import { useNavigate } from 'react-router-dom';
import { CreditCard, Zap, Shield, BarChart2, FileText, Sparkles } from 'lucide-react';
import Button from '../../components/ui/Button';

const HIGHLIGHTS = [
  { icon: Zap, label: 'AI Bookkeeping', desc: 'Record transactions automatically via AI' },
  { icon: BarChart2, label: 'Financial Reports', desc: 'P&L, balance sheet, cash flow — always ready' },
  { icon: FileText, label: 'Invoicing', desc: 'Professional invoices sent in seconds' },
  { icon: Shield, label: 'Secure & Compliant', desc: 'FIRS-compliant tax tracking built-in' },
];

export default function NoSubscriptionPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', background: 'var(--bg-base)',
    }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72, margin: '0 auto 24px',
          background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
          borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(147,51,234,0.3)',
        }}>
          <Sparkles size={32} color="white" />
        </div>

        {/* Heading */}
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
          Activate Your ROVA Subscription
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 32 }}>
          Your workspace is ready. Subscribe to unlock the full ROVA platform and start managing your finances like a pro.
        </p>

        {/* Feature highlights */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
          {HIGHLIGHTS.map(({ icon: Icon, label, desc }) => (
            <div key={label} style={{
              padding: '16px', borderRadius: 'var(--radius-lg)', textAlign: 'left',
              background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon size={15} color="var(--accent-light)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* Pricing summary */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap', justifyContent: 'center',
        }}>
          <div style={{ padding: '12px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--bg-border)', textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Basic</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>₦100<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>/day</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>or ₦3,000/month</div>
          </div>
          <div style={{ padding: '12px 20px', borderRadius: 'var(--radius-lg)', background: 'var(--accent-dim)', border: '2px solid var(--accent-border)', textAlign: 'left' }}>
            <div style={{ fontSize: 11, color: 'var(--accent-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Business ★</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>₦500<span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>/day</span></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>or ₦15,000/month</div>
          </div>
        </div>

        <Button
          variant="primary"
          style={{ width: '100%', maxWidth: 340, margin: '0 auto', justifyContent: 'center', padding: '14px 0', fontSize: 15, fontWeight: 700, borderRadius: 'var(--radius-lg)' }}
          icon={<CreditCard size={18} />}
          onClick={() => navigate('/app/billing')}
        >
          View Plans & Subscribe
        </Button>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
          Secured by Paystack · Cancel anytime
        </p>
      </div>
    </div>
  );
}
