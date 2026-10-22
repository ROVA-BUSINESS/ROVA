import { useState } from 'react';
import {
  CreditCard, CheckCircle, Clock, AlertCircle,
  ChevronRight, FileText, Zap, Star, Check,
  Receipt, ShieldAlert, RefreshCw
} from 'lucide-react';
import { type RovaServicePayment } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import {
  openPaystackPopup, generatePaymentRef,
  verifyPaymentOnServer,
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

function formatDateStr(d: string | null | undefined): string {
  if (!d) return '';
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
  const { user } = useAuth();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);

  if (!open) return null;

  const plan = planKey ? PLANS[planKey] : null;
  const isDailyRecurring = type === 'subscription' && plan?.paymentType === 'recurring';
  const isMonthlyOneTime = type === 'subscription' && plan?.paymentType === 'one_time';
  const amount = type === 'subscription' ? (plan?.amountNaira ?? 0) : TAX_FILING_AMOUNT;
  const label = type === 'subscription'
    ? plan?.label
    : `${taxYear} Tax Filing: ${filingType}`;

  async function handlePay() {
    if (!user?.email) return;

    // Daily plan strictly requires explicit consent before checkout
    if (isDailyRecurring && !consentGiven) {
      setError('Please acknowledge and consent to daily recurring billing before proceeding.');
      return;
    }

    setPaying(true);
    setError('');
    const ref = generatePaymentRef(type === 'subscription' ? 'SUB' : 'TAX');

    // Save pending payment metadata locally for recovery
    const pendingPayment = {
      reference: ref,
      userId: user.id,
      type,
      planKey,
      taxYear,
      filingType,
      amount,
      consentGiven: isDailyRecurring ? consentGiven : undefined,
      timestamp: Date.now(),
    };
    localStorage.setItem('rova_pending_payment', JSON.stringify(pendingPayment));

    try {
      await openPaystackPopup({
        email: user.email,
        amountNaira: amount,
        reference: ref,
        planKey: type === 'subscription' ? planKey : undefined,
        metadata: {
          type,
          planKey,
          taxYear,
          filingType,
          userId: user.id,
          consentGiven: isDailyRecurring ? consentGiven : undefined,
        },
        onSuccess: async (reference) => {
          try {
            // CRITICAL: Verify payment server-side before granting any access
            const verifyResult = await verifyPaymentOnServer({
              reference,
              planKey,
              serviceType: type,
              taxYear,
              filingType,
              consentGiven: isDailyRecurring ? consentGiven : undefined,
            });

            if (!verifyResult.success) {
              throw new Error(verifyResult.error || 'Server payment verification failed.');
            }

            localStorage.removeItem('rova_pending_payment');
            onSuccess();
            onClose();
          } catch (err: any) {
            setError('Payment was completed, but server verification returned: ' + (err.message || 'Error recording payment') + '. Reference: ' + reference);
          } finally {
            setPaying(false);
          }
        },
        onClose: () => {
          setPaying(false);
        },
      });
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed. Please try again.');
      setPaying(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Confirm Payment">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Summary Card */}
        <div style={{
          padding: '20px 24px',
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--bg-border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              {type === 'subscription' ? 'ROVA Subscription' : 'Tax Filing Service'}
            </span>
            {isDailyRecurring && (
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: 'rgba(59,130,246,0.15)', color: '#3b82f6', padding: '3px 8px', borderRadius: 100, border: '1px solid rgba(59,130,246,0.3)' }}>
                Daily Recurring
              </span>
            )}
            {isMonthlyOneTime && (
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '3px 8px', borderRadius: 100, border: '1px solid rgba(16,185,129,0.3)' }}>
                One-Time Payment
              </span>
            )}
          </div>

          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>

          <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
            {formatCurrency(amount)}
            {isDailyRecurring && (
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}> / day (renews daily)</span>
            )}
            {isMonthlyOneTime && (
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}> for 30 days access</span>
            )}
          </div>

          {/* Transparent Terms Disclosure */}
          {isMonthlyOneTime && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
              🔒 <strong>One-time payment:</strong> You will be charged once for 30 days of access. There is <strong>no automatic renewal</strong> and no recurring charge. When your 30-day period expires, you can pay again to continue.
            </div>
          )}

          {isDailyRecurring && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, lineHeight: 1.5, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
              🔄 <strong>Automatic Daily Renewal:</strong> Charged <strong>{formatCurrency(amount)} daily</strong> via Paystack automatic billing until cancelled. You can cancel anytime from your Billing page in 1 click without penalty.
            </div>
          )}

          {type === 'tax_filing' && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
              One-time payment · FIRS compliant professional filing
            </div>
          )}
        </div>

        {/* Explicit Consent Checkbox for Daily Recurring Plans */}
        {isDailyRecurring && (
          <div style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: consentGiven ? 'rgba(59,130,246,0.06)' : 'var(--bg-elevated)',
            border: consentGiven ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--bg-border)',
            display: 'flex', gap: 12, alignItems: 'flex-start'
          }}>
            <input
              type="checkbox"
              id="daily-consent"
              checked={consentGiven}
              onChange={(e) => {
                setConsentGiven(e.target.checked);
                if (error) setError('');
              }}
              style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="daily-consent" style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, cursor: 'pointer' }}>
              <strong>I authorize automatic daily recurring billing:</strong> I agree to be charged <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(amount)} every day</strong> via Paystack until I cancel. I understand I can cancel anytime from my Billing page without penalty.
            </label>
          </div>
        )}

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
            style={{
              flex: 2, justifyContent: 'center',
              background: 'var(--text-primary)', border: 'none',
              color: 'var(--bg-base)', fontWeight: 700,
              opacity: (isDailyRecurring && !consentGiven) ? 0.6 : 1,
            }}
            loading={paying}
            disabled={paying || (isDailyRecurring && !consentGiven)}
            icon={<CreditCard size={16} />}
            onClick={handlePay}
          >
            {isMonthlyOneTime
              ? `Pay ${formatCurrency(amount)} Once`
              : isDailyRecurring
                ? `Authorize & Pay ${formatCurrency(amount)}/day`
                : 'Pay with Paystack'}
          </Button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
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
  const {
    subscription,
    servicePayments,
    paymentHistory,
    loading,
    isActive,
    isExpired,
    planKey,
    refresh,
    cancelCurrentSubscription
  } = useSubscription();

  const isMobile = useMobile(1024);
  const [cancelling, setCancelling] = useState(false);

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

  async function handleSuccess() {
    await refresh();
  }

  function openSubscriptionCheckout(pk: PlanKey) {
    setCheckout({ open: true, type: 'subscription', planKey: pk });
  }

  function openTaxCheckout(year: number, type: string) {
    setShowTaxModal(false);
    setCheckout({ open: true, type: 'tax_filing', taxYear: year, filingType: type });
  }

  async function handleCancelSubscription() {
    if (!subscription) return;
    const isDaily = subscription.payment_type === 'recurring' || subscription.billing_interval === 'daily';

    const confirmMsg = isDaily
      ? 'Are you sure you want to cancel your daily recurring subscription? Future automatic daily charges will stop immediately.'
      : 'Are you sure you want to cancel? Your access will continue until the end of your 30-day period.';

    if (!window.confirm(confirmMsg)) return;

    setCancelling(true);
    const res = await cancelCurrentSubscription();
    setCancelling(false);

    if (res.success) {
      alert(res.message || 'Subscription cancelled successfully.');
    } else {
      alert('Failed to cancel: ' + res.error);
    }
  }

  return (
    <div style={{ padding: isMobile ? 16 : 28, maxWidth: 960, animation: 'fadeIn 0.3s ease' }}>
      <style>{`
        .bil-section-title {
          font-size: 17px; font-weight: 700; margin: 0 0 16px;
          display: flex; align-items: center; gap: 10px;
        }
        .bil-plan-card {
          border: 2px solid var(--bg-border);
          border-radius: var(--radius-xl); padding: 26px;
          display: flex; flex-direction: column; gap: 18px;
          position: relative; transition: all 0.2s ease;
          cursor: pointer; background: var(--bg-card);
        }
        .bil-plan-card:hover { border-color: var(--text-primary); box-shadow: 0 8px 24px -8px rgba(0,0,0,0.15); }
        .bil-plan-card.selected { border-color: var(--text-primary); box-shadow: 0 0 0 3px rgba(0,0,0,0.12); }
        .bil-plan-card.featured { border-color: var(--text-primary); }
        .bil-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        @media (max-width: 700px) { .bil-grid-2 { grid-template-columns: 1fr; } }
        .bil-history-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 0; border-bottom: 1px solid var(--bg-border); gap: 12px;
        }
        .bil-history-row:last-child { border-bottom: none; }
        .step-dot {
          width: 10px; height: 10px; border-radius: 50%; background: var(--bg-border); flex-shrink: 0;
        }
        .step-dot.done { background: #10b981; }
        .step-dot.active { background: var(--text-primary); box-shadow: 0 0 0 3px rgba(0,0,0,0.15); }
        .bil-type-pill {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 100px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
        }
      `}</style>

      {/* ── Header ─────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Billing & Subscription</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          Manage your ROVA subscriptions, view payment history, and purchase professional services.
        </p>
      </div>

      {/* ── Expired Status Banner (if access ended) ── */}
      {!loading && isExpired && subscription && (
        <Card style={{ marginBottom: 24, padding: '18px 22px', border: '1px solid rgba(239,68,68,0.3)', background: 'linear-gradient(135deg, rgba(239,68,68,0.08), var(--bg-elevated))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={22} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--error)', marginBottom: 2 }}>
                  Your ROVA Access Period Has Expired
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Your previous {subscription.billing_interval === 'monthly' ? 'monthly one-time' : 'daily'} period ended on {formatDateStr(subscription.access_expires_at || subscription.next_payment_date)}. Please choose a plan below to renew.
                </div>
              </div>
            </div>
            <Button variant="primary" onClick={() => openSubscriptionCheckout(subscription.plan)}>
              Renew Plan
            </Button>
          </div>
        </Card>
      )}

      {/* ── Active Subscription Status Banner ──── */}
      {!loading && isActive && subscription && (
        <Card style={{ marginBottom: 24, padding: '20px 24px', border: '1px solid rgba(16,185,129,0.3)', background: 'linear-gradient(135deg, rgba(16,185,129,0.07), var(--bg-elevated))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={22} color="#10b981" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {planLabel(subscription.plan)}
                  </span>
                  {subscription.payment_type === 'recurring' ? (
                    <span className="bil-type-pill" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
                      Daily Recurring Auto-Renewal
                    </span>
                  ) : (
                    <span className="bil-type-pill" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                      One-Time Payment (30 Days)
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>
                    Price: <strong style={{ color: '#10b981' }}>{formatCurrency(subscription.amount)}</strong>
                    {subscription.billing_interval === 'daily' ? ' / day' : ' / 30 days'}
                  </span>

                  {subscription.access_expires_at && (
                    <span>
                      Access Valid Until: <strong style={{ color: 'var(--text-primary)' }}>{formatDateStr(subscription.access_expires_at)}</strong>
                    </span>
                  )}

                  {subscription.payment_type === 'recurring' && subscription.next_payment_date && (
                    <span>
                      Next Auto-Renewal: <strong style={{ color: 'var(--text-primary)' }}>{formatDateStr(subscription.next_payment_date)}</strong>
                    </span>
                  )}
                </div>

                {subscription.payment_type === 'one_time' ? (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
                    ℹ️ Charged once. <strong>No automatic renewal</strong> will occur. You will be prompted to renew when access expires.
                  </p>
                ) : (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
                    ℹ️ Renews daily automatically via Paystack. You can cancel at any time below.
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {subscription.payment_type === 'recurring' && (
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  style={{
                    fontSize: 12, color: 'var(--error)', background: 'transparent',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)',
                    padding: '8px 14px', cursor: 'pointer', fontWeight: 600
                  }}
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Daily Auto-Renewal'}
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Section 1: Choose / Change Plan ──────── */}
      <section style={{ marginBottom: 40 }}>
        <h2 className="bil-section-title">
          <CreditCard size={18} color="var(--text-primary)" />
          {isActive ? 'Available ROVA Plans' : 'Choose Your ROVA Plan'}
        </h2>

        {/* Clear Policy Banner */}
        <div style={{
          marginBottom: 24, padding: '16px 20px',
          background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--bg-border)', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#10b981', marginBottom: 4 }}>
              📅 Monthly Plan (One-Time Payment)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Pay once for 30 days of platform access. <strong>No automatic charges or renewals.</strong> When your period expires, simply make another payment to continue.
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#3b82f6', marginBottom: 4 }}>
              ⚡ Daily Plan (Automatic Recurring)
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Charged daily via Paystack automatic billing until cancelled. <strong>Cancel anytime in one click</strong> directly from this Billing page without penalty.
            </div>
          </div>
        </div>

        {/* ── ROVA Basic ── */}
        <div style={{ marginBottom: 30 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 2 }}>
              ROVA Basic: Financial Records
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              For small business owners who mainly want ROVA to handle bookkeeping and financial records.
            </p>
          </div>
          <div className="bil-grid-2">
            {/* Basic Daily (Recurring) */}
            <div className={`bil-plan-card${planKey === 'basic_daily' ? ' selected' : ''}`} onClick={() => openSubscriptionCheckout('basic_daily')}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Daily</span>
                    <span className="bil-type-pill" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontSize: 10, border: '1px solid rgba(59,130,246,0.25)' }}>
                      Recurring
                    </span>
                  </div>
                  {planKey === 'basic_daily' && isActive && (
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100 }}>Active</span>
                  )}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                  ₦100<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>/day</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Auto-renews daily · Cancel anytime
                </div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 7, margin: 0 }}>
                {BASIC_INCLUDES.slice(0, 4).map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                  </li>
                ))}
              </ul>

              <Button
                variant={planKey === 'basic_daily' && isActive ? 'secondary' : 'primary'}
                style={{ width: '100%', justifyContent: 'center', fontWeight: 800 }}
                icon={<RefreshCw size={14} />}
              >
                {planKey === 'basic_daily' && isActive ? 'Current Plan' : 'Subscribe ₦100/day (Recurring)'}
              </Button>
            </div>

            {/* Basic Monthly (One-Time) */}
            <div className={`bil-plan-card${planKey === 'basic_monthly' ? ' selected' : ''}`} onClick={() => openSubscriptionCheckout('basic_monthly')}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Monthly</span>
                    <span className="bil-type-pill" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 10, border: '1px solid rgba(16,185,129,0.25)' }}>
                      One-Time
                    </span>
                  </div>
                  {planKey === 'basic_monthly' && isActive && (
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100 }}>Active</span>
                  )}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                  ₦3,000<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}> / 30 days</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  One-time charge · No automatic renewal
                </div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 7, margin: 0 }}>
                {BASIC_INCLUDES.slice(0, 4).map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                  </li>
                ))}
              </ul>

              <Button
                variant={planKey === 'basic_monthly' && isActive ? 'secondary' : 'primary'}
                style={{ width: '100%', justifyContent: 'center', fontWeight: 800 }}
                icon={<CreditCard size={14} />}
              >
                {planKey === 'basic_monthly' && isActive ? 'Current Plan' : 'Pay ₦3,000 Once (30 Days)'}
              </Button>
            </div>
          </div>
        </div>

        {/* ── ROVA Business ── */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>
                ROVA Business: Full Business Operations
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100 }}>
                ★ Recommended
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
              For growing businesses that need ROVA to manage operations, WhatsApp AI, and team access.
            </p>
          </div>

          <div className="bil-grid-2">
            {/* Business Daily (Recurring) */}
            <div className={`bil-plan-card featured${planKey === 'business_daily' ? ' selected' : ''}`} onClick={() => openSubscriptionCheckout('business_daily')}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Daily</span>
                    <span className="bil-type-pill" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontSize: 10, border: '1px solid rgba(59,130,246,0.25)' }}>
                      Recurring
                    </span>
                  </div>
                  {planKey === 'business_daily' && isActive && (
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100 }}>Active</span>
                  )}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                  ₦500<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>/day</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Auto-renews daily · Cancel anytime
                </div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 7, margin: 0 }}>
                <li style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> Everything in Basic, plus:
                </li>
                {BUSINESS_INCLUDES.slice(0, 3).map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                  </li>
                ))}
              </ul>

              <Button
                variant={planKey === 'business_daily' && isActive ? 'secondary' : 'primary'}
                style={{ width: '100%', justifyContent: 'center', fontWeight: 800 }}
                icon={<Star size={14} />}
              >
                {planKey === 'business_daily' && isActive ? 'Current Plan' : 'Subscribe ₦500/day (Recurring)'}
              </Button>
            </div>

            {/* Business Monthly (One-Time) */}
            <div className={`bil-plan-card featured${planKey === 'business_monthly' ? ' selected' : ''}`} onClick={() => openSubscriptionCheckout('business_monthly')}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Monthly</span>
                    <span className="bil-type-pill" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 10, border: '1px solid rgba(16,185,129,0.25)' }}>
                      One-Time
                    </span>
                  </div>
                  {planKey === 'business_monthly' && isActive ? (
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100 }}>Active</span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-border)', padding: '3px 10px', borderRadius: 100 }}>Best Value</span>
                  )}
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                  ₦15,000<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}> / 30 days</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  One-time charge · No automatic renewal
                </div>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 7, margin: 0 }}>
                <li style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> Everything in Basic, plus:
                </li>
                {BUSINESS_INCLUDES.slice(0, 3).map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                    <Check size={13} style={{ color: 'var(--text-primary)', flexShrink: 0, marginTop: 1 }} /> {f}
                  </li>
                ))}
              </ul>

              <Button
                variant={planKey === 'business_monthly' && isActive ? 'secondary' : 'primary'}
                style={{ width: '100%', justifyContent: 'center', fontWeight: 800 }}
                icon={<CreditCard size={14} />}
              >
                {planKey === 'business_monthly' && isActive ? 'Current Plan' : 'Pay ₦15,000 Once (30 Days)'}
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
              </Card>
            ))}
          </div>
        )}
      </section>

      <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)', marginBottom: 36 }} />

      {/* ── Section 3: Payment & Renewal History ─────── */}
      <section>
        <h2 className="bil-section-title">
          <Clock size={18} color="var(--text-primary)" />
          Payment & Billing History
        </h2>

        {loading ? (
          <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 64, marginBottom: 10 }} />)}</div>
        ) : (
          <Card style={{ padding: '0 20px' }}>
            {/* Payment history from dedicated idempotency audit table */}
            {paymentHistory.map(ph => (
              <div key={ph.id} className="bil-history-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-md)',
                    background: ph.payment_type === 'recurring' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    {ph.payment_type === 'recurring' ? (
                      <RefreshCw size={15} color="#3b82f6" />
                    ) : (
                      <Zap size={15} color="#10b981" />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {planLabel(ph.plan)}
                      <span className="bil-type-pill" style={{
                        marginLeft: 8,
                        background: ph.payment_type === 'recurring' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                        color: ph.payment_type === 'recurring' ? '#3b82f6' : '#10b981',
                        fontSize: 10
                      }}>
                        {ph.payment_type === 'recurring' ? 'Daily Renewal' : 'One-Time (Monthly)'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Date: {formatDateStr(ph.created_at)}
                      {ph.period_end && <> · Access valid through {formatDateStr(ph.period_end)}</>}
                      {ph.payment_reference && <> · Ref: <code style={{ fontSize: 10 }}>{ph.payment_reference}</code></>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <Badge variant={ph.status === 'success' ? 'success' : 'error'}>
                    {ph.status}
                  </Badge>
                  <span style={{ fontSize: 15, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
                    {formatCurrency(ph.amount)}
                  </span>
                </div>
              </div>
            ))}

            {/* Fallback to Service Payments if any */}
            {servicePayments.map(sp => (
              <div key={sp.id} className="bil-history-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={15} color="#10b981" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {sp.tax_year} Tax Filing: {sp.filing_type}
                      <span className="bil-type-pill" style={{ marginLeft: 8, background: 'rgba(245,158,11,0.12)', color: 'var(--warning)', fontSize: 10 }}>
                        Professional Service
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {formatDateStr(sp.payment_date || sp.created_at)}
                      {sp.payment_reference && <> · Ref: <code style={{ fontSize: 10 }}>{sp.payment_reference}</code></>}
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

            {paymentHistory.length === 0 && servicePayments.length === 0 && (
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
