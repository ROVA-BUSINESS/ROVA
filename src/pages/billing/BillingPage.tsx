import { useState, useEffect } from 'react';
import {
  CreditCard, CheckCircle, Clock, AlertCircle,
  ChevronRight, FileText, Zap, Star, Check,
  Sparkles, Receipt, X
} from 'lucide-react';
import { supabase, type RovaSubscription, type RovaServicePayment } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import {
  openPaystackPopup, generatePaymentRef, getNextPaymentDate,
  PLANS, TAX_FILING_AMOUNT, type PlanKey
} from '../../lib/paystack';
import { formatCurrency } from '../../lib/format';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useMobile } from '../../hooks/useMobile';

// ─── Plan feature definitions ────────────────────────────────
const BASIC_INCLUDES = [
  'AI bookkeeping',
  'Income and expense recording',
  'P&L and financial reports',
  'Receipts and invoices',
  'Basic inventory',
  'Bank connection / Mono',
  'Financial records and ledger',
  'Basic business insights',
];

const BASIC_EXCLUDES = [
  'WhatsApp ROVA',
  'Payroll',
  'Staff accounts and permissions',
  'Advanced inventory',
  'Tax filing',
];

const BUSINESS_INCLUDES = [
  'WhatsApp ROVA',
  'Multiple staff accounts',
  'Staff roles and permissions',
  'Advanced inventory management',
  'Payroll',
  'Advanced reports and insights',
  'Tax filing',
  'Higher usage limits',
  'Priority support',
];

const TAX_FILING_TYPES = [
  'VAT Return',
  'PAYE / PIT Return',
  'Company Income Tax (CIT)',
  'Annual Filing',
  'Other',
];

// ─── Status helpers ──────────────────────────────────────────
function planLabel(plan: PlanKey): string {
  return PLANS[plan]?.label ?? plan;
}

function filingStatusBadge(status: RovaServicePayment['filing_status']): 'warning' | 'info' | 'success' | 'error' {
  if (status === 'pending') return 'warning';
  if (status === 'processing') return 'info';
  if (status === 'filed') return 'success';
  return 'error';
}

function paymentStatusBadge(status: RovaServicePayment['payment_status']): 'warning' | 'info' | 'success' | 'error' {
  if (status === 'unpaid') return 'warning';
  if (status === 'processing') return 'info';
  if (status === 'paid' || status === 'filed') return 'success';
  return 'error';
}

function formatDateStr(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Checkout confirmation modal ─────────────────────────────
interface CheckoutProps {
  type: 'subscription' | 'tax_filing';
  planKey?: PlanKey;
  taxYear?: number;
  filingType?: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CheckoutModal({ type, planKey, taxYear, filingType, open, onClose, onSuccess }: CheckoutProps) {
  const { user, profile } = useAuth();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const plan = planKey ? PLANS[planKey] : null;
  const amount = type === 'subscription' ? (plan?.amountNaira ?? 0) : TAX_FILING_AMOUNT;
  const label = type === 'subscription'
    ? plan?.label
    : `${taxYear} Tax Filing: ${filingType}`;

  async function handlePay() {
    if (!user?.email) return;
    setPaying(true);
    setError('');
    const ref = generatePaymentRef(type === 'subscription' ? 'SUB' : 'TAX');
    const pendingPayment = {
      reference: ref,
      userId: user.id,
      type,
      planKey,
      taxYear,
      filingType,
      amount,
      timestamp: Date.now(),
    };
    localStorage.setItem('rova_pending_payment', JSON.stringify(pendingPayment));

    try {
      await openPaystackPopup({
        email: user.email,
        amountNaira: amount,
        reference: ref,
        metadata: { type, planKey, taxYear, filingType, userId: user.id },
        onSuccess: async (reference) => {
          try {
            if (type === 'subscription') {
              // Cancel any existing active subscriptions
              await supabase
                .from('rova_subscriptions')
                .update({ status: 'cancelled' })
                .eq('user_id', user.id)
                .eq('status', 'active');
              // Insert new subscription
              await supabase.from('rova_subscriptions').insert({
                user_id: user.id,
                business_name: profile?.business_name || profile?.full_name || null,
                plan: planKey!,
                amount,
                status: 'active',
                payment_reference: reference,
                paystack_transaction_id: reference,
                payment_date: new Date().toISOString(),
                start_date: new Date().toISOString().split('T')[0],
                next_payment_date: getNextPaymentDate(planKey!),
              });
            } else {
              await supabase.from('rova_service_payments').insert({
                user_id: user.id,
                business_name: profile?.business_name || profile?.full_name || null,
                service_type: 'tax_filing',
                service_name: `${taxYear} Tax Filing`,
                tax_year: taxYear,
                filing_type: filingType,
                amount,
                payment_reference: reference,
                paystack_transaction_id: reference,
                payment_date: new Date().toISOString(),
                payment_status: 'paid',
                filing_status: 'processing',
              });
            }
            onSuccess();
            onClose();
          } catch (err: any) {
            setError('Payment was successful but we could not record it. Please contact support with ref: ' + reference);
          } finally {
            setPaying(false);
          }
        },
        onClose: () => {
          setPaying(false);
        },
      });
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
      setPaying(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Confirm Payment">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Summary */}
        <div style={{
          padding: '20px 24px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-border)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {type === 'subscription' ? 'ROVA Subscription' : 'Tax Filing Service'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
            {formatCurrency(amount)}
            {type === 'subscription' && plan && (
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>
                {' '}/ {plan.frequency === 'daily' ? 'day' : 'month'}
              </span>
            )}
          </div>
          {type === 'subscription' && plan && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              Next renewal: {new Date(getNextPaymentDate(planKey!)).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
          {type === 'tax_filing' && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              One-time payment · FIRS compliant filing
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            style={{ flex: 2, justifyContent: 'center', background: 'var(--text-primary)', border: 'none', color: 'var(--bg-base)', fontWeight: 700 }}
            loading={paying}
            icon={<CreditCard size={16} />}
            onClick={handlePay}
          >
            Pay with Paystack
          </Button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          Secured by Paystack · SSL encrypted · Payments in NGN
        </p>
      </div>
    </Modal>
  );
}

// ─── Tax Filing purchase modal ────────────────────────────────
interface TaxFilingModalProps {
  open: boolean;
  onClose: () => void;
  onProceed: (year: number, type: string) => void;
}
function TaxFilingModal({ open, onClose, onProceed }: TaxFilingModalProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [type, setType] = useState(TAX_FILING_TYPES[0]);

  return (
    <Modal open={open} onClose={onClose} title="Purchase Tax Filing Service">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          ROVA will handle your tax filing with FIRS on your behalf. A one-time fee of <strong style={{ color: 'var(--text-primary)' }}>₦5,000</strong> applies per filing.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Tax Year</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
          >
            {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Filing Type</label>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 14, outline: 'none' }}
          >
            {TAX_FILING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button variant="secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</Button>
          <Button variant="primary" style={{ flex: 2, justifyContent: 'center' }} icon={<ChevronRight size={16} />} onClick={() => onProceed(year, type)}>
            Continue to Payment
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main BillingPage ────────────────────────────────────────
export default function BillingPage() {
  const { user } = useAuth();
  const { subscription, servicePayments, loading, isActive, planKey, refresh } = useSubscription();
  const isMobile = useMobile(1024);

  // Dropdown states for plan features
  const [expandedBasic, setExpandedBasic] = useState(false);
  const [expandedBusiness, setExpandedBusiness] = useState(false);

  // Subscription history (all records, not just active)
  const [allSubscriptions, setAllSubscriptions] = useState<RovaSubscription[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Checkout modal state
  const [checkout, setCheckout] = useState<{
    open: boolean;
    type: 'subscription' | 'tax_filing';
    planKey?: PlanKey;
    taxYear?: number;
    filingType?: string;
  }>({ open: false, type: 'subscription' });

  // Tax filing modal
  const [showTaxModal, setShowTaxModal] = useState(false);

  useEffect(() => {
    if (user) loadHistory();
  }, [user]);

  async function loadHistory() {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('rova_subscriptions')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    setAllSubscriptions(data ?? []);
    setLoadingHistory(false);
  }

  async function handleSuccess() {
    await refresh();
    await loadHistory();
  }

  function openSubscriptionCheckout(pk: PlanKey) {
    setCheckout({ open: true, type: 'subscription', planKey: pk });
  }

  function openTaxCheckout(year: number, type: string) {
    setShowTaxModal(false);
    setCheckout({ open: true, type: 'tax_filing', taxYear: year, filingType: type });
  }

  async function cancelSubscription() {
    if (!subscription) return;
    if (!window.confirm('Are you sure you want to cancel your ROVA subscription?')) return;
    await supabase.from('rova_subscriptions').update({ status: 'cancelled' }).eq('id', subscription.id);
    await handleSuccess();
  }

  // All payments combined for history section
  return (
    <div style={{ padding: isMobile ? 16 : 28, maxWidth: 960, animation: 'fadeIn 0.3s ease' }}>
      <style>{`
        .bil-section-title {
          font-size: 17px; font-weight: 700; margin: 0 0 16px;
          display: flex; align-items: center; gap: 10px;
        }
        .bil-plan-card {
          border: 2px solid var(--bg-border);
          border-radius: var(--radius-xl); padding: 28px;
          display: flex; flex-direction: column; gap: 20px;
          position: relative; transition: all 0.2s ease;
          cursor: pointer; background: var(--bg-card);
        }
        .bil-plan-card:hover { border-color: var(--text-primary); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.15); }
        .bil-plan-card.selected { border-color: var(--text-primary); box-shadow: 0 0 0 3px rgba(0,0,0,0.12); }
        .bil-plan-card.featured { border-color: var(--text-primary); }
        .bil-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 700px) { .bil-grid-2 { grid-template-columns: 1fr; } }
        .bil-status-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 100px;
          font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .bil-history-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 0; border-bottom: 1px solid var(--bg-border); gap: 12px;
        }
        .bil-history-row:last-child { border-bottom: none; }
        .bil-freq-btn {
          flex: 1; padding: 10px; border: 2px solid var(--bg-border);
          border-radius: var(--radius-md); cursor: pointer; text-align: center;
          font-size: 13px; font-weight: 600; transition: all 0.15s;
          background: var(--bg-elevated); color: var(--text-secondary);
        }
        .bil-freq-btn.active {
          border-color: var(--text-primary); background: var(--bg-hover);
          color: var(--text-primary);
        }
        .step-dot {
          width: 10px; height: 10px; border-radius: 50%; background: var(--bg-border); flex-shrink: 0;
        }
        .step-dot.done { background: #10b981; }
        .step-dot.active { background: var(--text-primary); box-shadow: 0 0 0 3px rgba(0,0,0,0.15); }
      `}</style>

      {/* ── Header ─────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Billing & Subscription</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Manage your ROVA subscription and professional services.
        </p>
      </div>

      {/* ── Developer Test Account Banner ───────── */}
      {!loading && isDeveloper && (
        <Card style={{ marginBottom: 24, padding: '16px 20px', border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              Developer Test Account: Full Business Access (Free)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              Whitelisted developer account or secret bypass code active. All ROVA Business features are unlocked for system testing.
            </div>
          </div>
        </Card>
      )}
      {/* ── Current Subscription Status Banner ──── */}
      {!loading && isActive && subscription && (
        <Card style={{ marginBottom: 24, padding: '20px 24px', border: '1px solid rgba(16,185,129,0.3)', background: 'linear-gradient(135deg, rgba(16,185,129,0.07), var(--bg-elevated))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={22} color="#10b981" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {planLabel(subscription.plan)}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    <strong style={{ color: '#10b981' }}>{formatCurrency(subscription.amount)}</strong>
                    {PLANS[subscription.plan]?.frequency === 'daily' ? ' / day' : ' / month'}
                  </span>
                  {subscription.next_payment_date && (
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Next renewal: <strong style={{ color: 'var(--text-primary)' }}>{formatDateStr(subscription.next_payment_date)}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={cancelSubscription}
                style={{ fontSize: 12, color: 'var(--error)', background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '6px 14px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancel Plan
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Section 1: Choose / Change Plan ──────── */}
      <section style={{ marginBottom: 40 }}>
        <h2 className="bil-section-title">
          <CreditCard size={18} color="var(--text-primary)" />
          {isActive ? 'Change Plan' : 'Choose Your ROVA Plan'}
        </h2>

        {/* Distinction Banner */}
        <div style={{
          marginBottom: 24, padding: '16px 20px',
          background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', gap: 6
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
            Plan Distinction
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>
            <strong>Basic:</strong> ROVA manages your finances.<br />
            <strong>Business:</strong> ROVA manages your finances + helps run the business.
          </div>
        </div>

        {/* Basic Plan */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 2 }}>
              ROVA Basic: Financial Records
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              For small business owners who mainly want ROVA to handle their financial records.
            </p>
          </div>
          <div className="bil-grid-2">
            {/* Basic Daily */}
            <div className={`bil-plan-card${planKey === 'basic_daily' ? ' selected' : ''}`} onClick={() => openSubscriptionCheckout('basic_daily')}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Daily</span>
                  {planKey === 'basic_daily' && <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100 }}>Active</span>}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                  ₦100<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>/day</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {BASIC_INCLUDES.slice(0, 4).map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                  </li>
                ))}
                {expandedBasic && (
                  <>
                    {BASIC_INCLUDES.slice(4).map((f, i) => (
                      <li key={`inc_${i}`} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                        <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                      </li>
                    ))}
                    <li style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 6, marginBottom: 2 }}>Does not include:</li>
                    {BASIC_EXCLUDES.map((f, i) => (
                      <li key={`exc_${i}`} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-disabled)', fontWeight: 400 }}>
                        <X size={13} style={{ color: 'var(--text-disabled)', flexShrink: 0, marginTop: 1, opacity: 0.6 }} /> {f}
                      </li>
                    ))}
                  </>
                )}
                <li>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedBasic(!expandedBasic); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2, textDecoration: 'underline' }}
                  >
                    {expandedBasic ? '▲ Show less' : '▼ + More features'}
                  </button>
                </li>
              </ul>
              <Button variant={planKey === 'basic_daily' ? 'secondary' : 'primary'} style={{ width: '100%', justifyContent: 'center', background: planKey === 'basic_daily' ? undefined : 'var(--text-primary)', border: 'none', color: 'var(--bg-base)', fontWeight: 800 }} icon={<CreditCard size={14} />}>
                {planKey === 'basic_daily' ? 'Renew Plan' : 'Subscribe ₦100/day'}
              </Button>
            </div>

            {/* Basic Monthly */}
            <div className={`bil-plan-card${planKey === 'basic_monthly' ? ' selected' : ''}`} onClick={() => openSubscriptionCheckout('basic_monthly')}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Monthly</span>
                  {planKey === 'basic_monthly' && <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100 }}>Active</span>}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                  ₦3,000<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>/month</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {BASIC_INCLUDES.slice(0, 4).map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                  </li>
                ))}
                {expandedBasic && (
                  <>
                    {BASIC_INCLUDES.slice(4).map((f, i) => (
                      <li key={`inc_${i}`} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                        <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                      </li>
                    ))}
                    <li style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 6, marginBottom: 2 }}>Does not include:</li>
                    {BASIC_EXCLUDES.map((f, i) => (
                      <li key={`exc_${i}`} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-disabled)', fontWeight: 400 }}>
                        <X size={13} style={{ color: 'var(--text-disabled)', flexShrink: 0, marginTop: 1, opacity: 0.6 }} /> {f}
                      </li>
                    ))}
                  </>
                )}
                <li>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedBasic(!expandedBasic); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2, textDecoration: 'underline' }}
                  >
                    {expandedBasic ? '▲ Show less' : '▼ + More features'}
                  </button>
                </li>
              </ul>
              <Button variant={planKey === 'basic_monthly' ? 'secondary' : 'primary'} style={{ width: '100%', justifyContent: 'center', background: planKey === 'basic_monthly' ? undefined : 'var(--text-primary)', border: 'none', color: 'var(--bg-base)', fontWeight: 800 }} icon={<CreditCard size={14} />}>
                {planKey === 'basic_monthly' ? 'Renew Plan' : 'Subscribe ₦3,000/month'}
              </Button>
            </div>
          </div>
        </div>

        {/* Business Plan */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
                ROVA Business: Full Business Operations
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100, border: '1px solid var(--bg-border)' }}>
                ★ Recommended
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              For businesses that are growing and need ROVA to manage more of the business operations.
            </p>
          </div>
          <div className="bil-grid-2">
            {/* Business Daily */}
            <div className={`bil-plan-card featured${planKey === 'business_daily' ? ' selected' : ''}`} onClick={() => openSubscriptionCheckout('business_daily')}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Daily</span>
                  {planKey === 'business_daily' && <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100 }}>Active</span>}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                  ₦500<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>/day</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <li style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> Everything in Basic, plus:
                </li>
                {BUSINESS_INCLUDES.slice(0, 3).map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                  </li>
                ))}
                {expandedBusiness && (
                  BUSINESS_INCLUDES.slice(3).map((f, i) => (
                    <li key={`biz_${i}`} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                    </li>
                  ))
                )}
                <li>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedBusiness(!expandedBusiness); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2, textDecoration: 'underline' }}
                  >
                    {expandedBusiness ? '▲ Show less' : '▼ + More features'}
                  </button>
                </li>
              </ul>
              <Button variant="primary" style={{ width: '100%', justifyContent: 'center', background: 'var(--text-primary)', border: 'none', color: 'var(--bg-base)', fontWeight: 800 }} icon={<Star size={14} />}>
                {planKey === 'business_daily' ? 'Renew Plan' : 'Subscribe ₦500/day'}
              </Button>
            </div>

            {/* Business Monthly */}
            <div className={`bil-plan-card featured${planKey === 'business_monthly' ? ' selected' : ''}`} onClick={() => openSubscriptionCheckout('business_monthly')}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Monthly</span>
                  {planKey === 'business_monthly'
                    ? <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100 }}>Active</span>
                    : <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100 }}>Best Value</span>
                  }
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                  ₦15,000<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>/month</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                <li style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> Everything in Basic, plus:
                </li>
                {BUSINESS_INCLUDES.slice(0, 3).map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                  </li>
                ))}
                {expandedBusiness && (
                  BUSINESS_INCLUDES.slice(3).map((f, i) => (
                    <li key={`biz_${i}`} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                    </li>
                  ))
                )}
                <li>
                  <button
                    onClick={(e) => { e.stopPropagation(); setExpandedBusiness(!expandedBusiness); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2, textDecoration: 'underline' }}
                  >
                    {expandedBusiness ? '▲ Show less' : '▼ + More features'}
                  </button>
                </li>
              </ul>
              <Button variant="primary" style={{ width: '100%', justifyContent: 'center', background: 'var(--text-primary)', border: 'none', color: 'var(--bg-base)', fontWeight: 800 }} icon={<Star size={14} />}>
                {planKey === 'business_monthly' ? 'Renew Plan' : 'Subscribe ₦15,000/month'}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)', marginBottom: 36 }} />

      {/* ── Section 2: Tax Filing ─────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h2 className="bil-section-title" style={{ marginBottom: 0 }}>
            <FileText size={18} color="var(--text-primary)" />
            Tax Filing Service
          </h2>
          <Button
            variant="primary"
            icon={<Receipt size={14} />}
            onClick={() => setShowTaxModal(true)}
            style={{ background: 'var(--text-primary)', border: 'none', color: 'var(--bg-base)', fontWeight: 800 }}
          >
            Purchase Tax Filing: ₦5,000
          </Button>
        </div>

        <Card style={{ marginBottom: 16, padding: '14px 18px', border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Tax Filing is a <strong>separate one-time professional service</strong>. ROVA handles your FIRS filing on your behalf. ₦5,000 per filing — does not repeat unless you purchase another.
          </div>
        </Card>

        {servicePayments.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '36px 20px' }}>
            <FileText size={28} color="var(--text-disabled)" style={{ margin: '0 auto 10px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600 }}>No tax filings yet</p>
            <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4 }}>Purchase a tax filing service above to get started.</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {servicePayments.map(sp => (
              <Card key={sp.id} style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={18} color="#10b981" />
                  </div>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{sp.tax_year} Tax Filing</span>
                      <Badge variant={paymentStatusBadge(sp.payment_status)}>{sp.payment_status}</Badge>
                      <Badge variant={filingStatusBadge(sp.filing_status)}>Filing: {sp.filing_status}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {sp.filing_type} · {formatDateStr(sp.payment_date)}
                      {sp.payment_reference && <> · Ref: <code style={{ fontSize: 11 }}>{sp.payment_reference}</code></>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                      {formatCurrency(sp.amount)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>one-time</div>
                  </div>
                </div>

                {/* Status pipeline */}
                <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {(['unpaid', 'paid', 'processing', 'filed'] as const).map((s, i) => {
                    const steps = ['unpaid', 'paid', 'processing', 'filed'];
                    const currentIdx = steps.indexOf(sp.payment_status);
                    const isDone = i < currentIdx;
                    const isActive2 = i === currentIdx;
                    return (
                      <>
                        <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div className={`step-dot${isDone ? ' done' : isActive2 ? ' active' : ''}`} />
                          <span style={{ fontSize: 10, color: isActive2 ? 'var(--text-primary)' : isDone ? '#10b981' : 'var(--text-disabled)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {s}
                          </span>
                        </div>
                        {i < 3 && <div style={{ flex: 1, height: 1, background: isDone ? '#10b981' : 'var(--bg-border)', marginBottom: 12 }} />}
                      </>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)', marginBottom: 36 }} />

      {/* ── Section 3: Payment History ────────────── */}
      <section>
        <h2 className="bil-section-title">
          <Clock size={18} color="var(--text-primary)" />
          Payment History
        </h2>

        {loadingHistory ? (
          <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 64, marginBottom: 10 }} />)}</div>
        ) : (
          <Card style={{ padding: '0 20px' }}>
            {/* Subscription payments */}
            {allSubscriptions.map(sub => (
              <div key={sub.id} className="bil-history-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={15} color="var(--text-primary)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {planLabel(sub.plan)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatDateStr(sub.payment_date || sub.created_at)}
                      {sub.payment_reference && <> · {sub.payment_reference}</>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <Badge variant={sub.status === 'active' ? 'success' : sub.status === 'cancelled' ? 'error' : 'warning'}>
                    {sub.status}
                  </Badge>
                  <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                    {formatCurrency(sub.amount)}
                  </span>
                </div>
              </div>
            ))}

            {/* Tax filing payments */}
            {servicePayments.map(sp => (
              <div key={sp.id} className="bil-history-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={15} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {sp.tax_year} Tax Filing: {sp.filing_type}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatDateStr(sp.payment_date || sp.created_at)}
                      {sp.payment_reference && <> · {sp.payment_reference}</>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <Badge variant={paymentStatusBadge(sp.payment_status)}>{sp.payment_status}</Badge>
                  <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                    {formatCurrency(sp.amount)}
                  </span>
                </div>
              </div>
            ))}

            {allSubscriptions.length === 0 && servicePayments.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                No payment history yet.
              </div>
            )}
          </Card>
        )}
      </section>

      {/* ── Modals ───────────────────────────────── */}
      <TaxFilingModal open={showTaxModal} onClose={() => setShowTaxModal(false)} onProceed={openTaxCheckout} />

      <CheckoutModal
        open={checkout.open}
        type={checkout.type}
        planKey={checkout.planKey}
        taxYear={checkout.taxYear}
        filingType={checkout.filingType}
        onClose={() => setCheckout(c => ({ ...c, open: false }))}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
