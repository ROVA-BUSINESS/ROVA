import { useState, useRef } from 'react';
import {
  CreditCard,
  ChevronRight, FileText,
  ShieldAlert, Rocket,
  SlidersHorizontal, ArrowUpRight, Plus
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  openPaystackPopup, generatePaymentRef,
  verifyPaymentOnServer,
  PLANS, TAX_FILING_AMOUNT, type PlanKey
} from '../../lib/paystack';
import { formatCurrency } from '../../lib/format';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useMobile } from '../../hooks/useMobile';

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

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isMobile = useMobile(1024);
  const isSmall = useMobile(640);
  const [cancelling, setCancelling] = useState(false);
  const plansRef = useRef<HTMLDivElement>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'subscription' | 'service'>('all');

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

  function scrollToPlans() {
    if (plansRef.current) {
      plansRef.current.scrollIntoView({ behavior: 'smooth' });
    }
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

  // Combined and filtered billing history
  const combinedHistory = [
    ...paymentHistory.map(ph => ({
      id: ph.id,
      date: ph.created_at,
      description: `${planLabel(ph.plan)} – ${ph.payment_type === 'recurring' ? 'Daily' : 'Monthly'}`,
      amount: ph.amount,
      status: ph.status === 'success' ? 'Paid' : 'Failed',
      type: 'subscription' as const,
      ref: ph.payment_reference,
    })),
    ...servicePayments.map(sp => ({
      id: sp.id,
      date: sp.payment_date || sp.created_at,
      description: `${sp.tax_year} Tax Filing: ${sp.filing_type}`,
      amount: sp.amount,
      status: sp.payment_status === 'paid' ? 'Paid' : 'Pending',
      type: 'service' as const,
      ref: sp.payment_reference,
    })),
  ].filter(item => {
    if (historyFilter === 'subscription') return item.type === 'subscription';
    if (historyFilter === 'service') return item.type === 'service';
    return true;
  });

  // Current active plan display
  const currentPlanName = isActive && planKey ? planLabel(planKey) : 'Free Tier';
  const currentPlanPrice = isActive && subscription 
    ? `${formatCurrency(subscription.amount)} / ${subscription.billing_interval === 'daily' ? 'day' : 'month'}`
    : '₦0 / month';

  // Colors & theme tokens matching the FeatherDev shot
  const colors = {
    cardBg: isDark ? '#141417' : '#ffffff',
    cardBorder: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
    cardShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 2px 14px rgba(0,0,0,0.03)',
    pillBg: isDark ? '#1f1f23' : '#f4f5f7',
    pillBorder: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
    textPrimary: isDark ? '#fafafa' : '#111827',
    textSecondary: isDark ? '#a1a1aa' : '#64748b',
    textMuted: isDark ? '#71717a' : '#94a3b8',
    tableHeaderBg: isDark ? '#1b1b1f' : '#f8fafc',
    greenBadge: isDark ? 'rgba(34, 197, 94, 0.16)' : '#ecfdf5',
    greenText: isDark ? '#4ade80' : '#059669',
    redBadge: isDark ? 'rgba(239, 68, 68, 0.16)' : '#fef2f2',
    redText: isDark ? '#f87171' : '#dc2626',
  };

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: isMobile ? '16px 14px 100px' : '24px 20px 100px' }}>
      
      {/* ── Hero / Banner Header matching the FeatherDev shot ── */}
      <div style={{
        borderRadius: 22,
        padding: isMobile ? '28px 20px' : '36px 36px',
        marginBottom: 28,
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(102, 45, 145, 0.16) 50%, rgba(16, 185, 129, 0.1) 100%), #141417'
          : 'linear-gradient(135deg, #fef3c7 0%, #ffedd5 40%, #ecfdf5 100%)',
        border: colors.cardBorder,
        boxShadow: colors.cardShadow,
      }}>
        {/* Subtle decorative grid mesh background */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: isDark
            ? 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)'
            : 'radial-gradient(rgba(0,0,0,0.05) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 620 }}>
          <h1 style={{
            fontSize: isMobile ? 28 : 34,
            fontWeight: 800,
            color: colors.textPrimary,
            letterSpacing: '-0.03em',
            margin: '0 0 8px',
            lineHeight: 1.15,
          }}>
            Billing
          </h1>
          <p style={{
            fontSize: 14,
            color: colors.textSecondary,
            margin: 0,
            lineHeight: 1.55,
            fontWeight: 500,
          }}>
            Manage your subscription, view payment history, and update your billing details — all in one place.
          </p>
        </div>
      </div>

      {/* ── Expired Status Banner (if access ended) ── */}
      {!loading && isExpired && subscription && (
        <div style={{
          marginBottom: 24,
          padding: '18px 22px',
          borderRadius: 18,
          border: '1px solid rgba(239,68,68,0.3)',
          background: isDark ? 'rgba(239,68,68,0.08)' : '#fef2f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={20} color="#ef4444" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 2 }}>
                Your ROVA Access Period Has Expired
              </div>
              <div style={{ fontSize: 12, color: colors.textSecondary }}>
                Your period ended on {formatDateStr(subscription.access_expires_at || subscription.next_payment_date)}. Please choose a plan below to renew.
              </div>
            </div>
          </div>
          <button
            onClick={() => openSubscriptionCheckout(subscription.plan)}
            style={{
              padding: '9px 18px',
              borderRadius: 20,
              background: '#ef4444',
              color: '#ffffff',
              fontSize: 12.5,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Renew Plan
          </button>
        </div>
      )}

      {/* ── Section 1: Subscription Overview ─────────── */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{
          fontSize: 15,
          fontWeight: 700,
          color: colors.textPrimary,
          margin: '0 0 14px',
          letterSpacing: '-0.01em',
        }}>
          Subscription Overview
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16,
        }}>
          {/* Card 1: Current Plan */}
          <div style={{
            background: colors.cardBg,
            borderRadius: 20,
            border: colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '24px 26px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 140,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500, marginBottom: 8 }}>
                  Current Plan
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 10px',
                  borderRadius: 14,
                  background: colors.greenBadge,
                  color: colors.greenText,
                  fontSize: 11.5,
                  fontWeight: 700,
                  marginBottom: 10,
                }}>
                  ● {currentPlanName}
                </div>
                <div style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: colors.textPrimary,
                  fontFamily: 'Space Grotesk, sans-serif',
                  letterSpacing: '-0.02em',
                }}>
                  {currentPlanPrice}
                </div>
              </div>

              {/* Upgrade Button */}
              <button
                onClick={scrollToPlans}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '10px 18px',
                  borderRadius: 22,
                  background: isDark ? '#ffffff' : '#111827',
                  color: isDark ? '#000000' : '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <span>Upgrade</span>
                <Rocket size={13} />
              </button>
            </div>

            {/* Cancel recurring link if daily active */}
            {isActive && subscription?.payment_type === 'recurring' && (
              <div style={{ marginTop: 14, borderTop: '1px solid ' + (isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'), paddingTop: 10 }}>
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancelling}
                  style={{
                    background: 'none', border: 'none', color: '#ef4444',
                    fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0
                  }}
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Daily Auto-Renewal'}
                </button>
              </div>
            )}
          </div>

          {/* Card 2: Usage Summary */}
          <div style={{
            background: colors.cardBg,
            borderRadius: 20,
            border: colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '24px 26px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 140,
          }}>
            <div>
              <div style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500, marginBottom: 14 }}>
                Usage Summary
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Metric 1 */}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary, fontFamily: 'Space Grotesk, sans-serif' }}>
                    142 <span style={{ fontSize: 13, color: colors.textMuted, fontWeight: 500 }}>/ 500</span>
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, fontWeight: 500 }}>
                    Monthly Transactions
                  </div>
                  {/* Progress bar */}
                  <div style={{
                    width: '100%', height: 6, borderRadius: 4,
                    background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                    marginTop: 8, overflow: 'hidden'
                  }}>
                    <div style={{ width: '28%', height: '100%', background: '#3b82f6', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 10, color: colors.textMuted, textAlign: 'right', marginTop: 3 }}>
                    28%
                  </div>
                </div>

                {/* Metric 2 */}
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary, fontFamily: 'Space Grotesk, sans-serif' }}>
                    2 <span style={{ fontSize: 13, color: colors.textMuted, fontWeight: 500 }}>/ 5</span>
                  </div>
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4, fontWeight: 500 }}>
                    Connected Channels
                  </div>
                  {/* Progress bar */}
                  <div style={{
                    width: '100%', height: 6, borderRadius: 4,
                    background: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                    marginTop: 8, overflow: 'hidden'
                  }}>
                    <div style={{ width: '40%', height: '100%', background: '#10b981', borderRadius: 4 }} />
                  </div>
                  <div style={{ fontSize: 10, color: colors.textMuted, textAlign: 'right', marginTop: 3 }}>
                    40%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Billing History ────────────────── */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{
            fontSize: 15,
            fontWeight: 700,
            color: colors.textPrimary,
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Billing History
          </h2>

          {/* Filter button */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setHistoryFilter(historyFilter === 'all' ? 'subscription' : historyFilter === 'subscription' ? 'service' : 'all')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 18,
                background: colors.cardBg,
                border: colors.cardBorder,
                color: colors.textPrimary,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <SlidersHorizontal size={12} color={colors.textMuted} />
              <span>Filter: {historyFilter === 'all' ? 'All' : historyFilter === 'subscription' ? 'Subscriptions' : 'Services'}</span>
            </button>
          </div>
        </div>

        {/* Clean Table Card */}
        <div style={{
          background: colors.cardBg,
          borderRadius: 20,
          border: colors.cardBorder,
          boxShadow: colors.cardShadow,
          overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 640 }}>
            <thead>
              <tr style={{ background: colors.tableHeaderBg, borderBottom: colors.cardBorder }}>
                <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
                <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</th>
                <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount</th>
                <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ padding: '14px 20px', fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {combinedHistory.length > 0 ? (
                combinedHistory.map((item, idx) => (
                  <tr key={item.id || idx} style={{ borderBottom: idx < combinedHistory.length - 1 ? (isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9') : 'none' }}>
                    <td style={{ padding: '16px 20px', fontSize: 13, color: colors.textSecondary, whiteSpace: 'nowrap' }}>
                      {formatDateStr(item.date)}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>
                      {item.description}
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: 13.5, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary }}>
                      {formatCurrency(item.amount)}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 9px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        background: item.status === 'Paid' ? colors.greenBadge : colors.redBadge,
                        color: item.status === 'Paid' ? colors.greenText : colors.redText,
                      }}>
                        ● {item.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <button
                        onClick={() => alert(`Receipt Reference: ${item.ref || 'ROVA-' + item.id}`)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'none',
                          border: 'none',
                          color: colors.textPrimary,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <span>Download Invoice</span>
                        <ArrowUpRight size={13} color={colors.textMuted} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '36px 20px', textAlign: 'center', color: colors.textMuted, fontSize: 13 }}>
                    No billing history recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Section 3: Payment Method ─────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{
          fontSize: 15,
          fontWeight: 700,
          color: colors.textPrimary,
          margin: '0 0 14px',
          letterSpacing: '-0.01em',
        }}>
          Payment Method
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16,
        }}>
          {/* Virtual Credit Card Mockup matching the shot */}
          <div style={{
            background: isDark 
              ? 'linear-gradient(135deg, #27272a 0%, #18181b 100%)' 
              : 'linear-gradient(135deg, #d97706 0%, #b45309 60%, #78350f 100%)',
            borderRadius: 20,
            padding: '24px 26px',
            color: '#ffffff',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            minHeight: 160,
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Glow / shine */}
            <div style={{
              position: 'absolute',
              top: '-30%',
              right: '-10%',
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.5px' }}>
                Paystack Verified Auto-Debit
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-1px' }}>
                VISA / MC
              </div>
            </div>

            <div style={{
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '2.5px',
              fontFamily: 'monospace',
              margin: '18px 0 10px',
            }}>
              •••• •••• •••• 4242
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, opacity: 0.9 }}>
              <div>
                <span style={{ fontSize: 9, textTransform: 'uppercase', display: 'block', opacity: 0.75 }}>Cardholder</span>
                <span style={{ fontWeight: 600 }}>ROVA BUSINESS ACCOUNT</span>
              </div>
              <div>
                <span style={{ fontSize: 9, textTransform: 'uppercase', display: 'block', opacity: 0.75 }}>Expires</span>
                <span style={{ fontWeight: 600 }}>12 / 28</span>
              </div>
            </div>
          </div>

          {/* Add / Manage Payment Method Dashed Card */}
          <div 
            onClick={() => scrollToPlans()}
            style={{
              background: colors.cardBg,
              borderRadius: 20,
              border: '1.5px dashed ' + (isDark ? 'rgba(255,255,255,0.18)' : '#cbd5e1'),
              padding: '24px 26px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              minHeight: 160,
              textAlign: 'center',
            }}
            onMouseEnter={e => {
              (e.currentTarget.style.borderColor = isDark ? '#ffffff' : '#111827');
              (e.currentTarget.style.background = isDark ? '#1a1a1e' : '#f8fafc');
            }}
            onMouseLeave={e => {
              (e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.18)' : '#cbd5e1');
              (e.currentTarget.style.background = colors.cardBg);
            }}
          >
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: colors.pillBg,
              border: colors.pillBorder,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.textPrimary,
            }}>
              <Plus size={16} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>
                Change or Add Card
              </div>
              <div style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 3 }}>
                Secured tokenization via Paystack Nigeria
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Available Plans & Upgrades ─────── */}
      <section ref={plansRef} style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
              Available ROVA Plans
            </h2>
            <p style={{ fontSize: 12.5, color: colors.textMuted, margin: '3px 0 0' }}>
              Choose a monthly one-time plan or daily recurring subscription.
            </p>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isSmall ? '1fr' : 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 16,
        }}>
          {/* 1. Basic Monthly */}
          <div style={{
            background: colors.cardBg,
            borderRadius: 20,
            border: planKey === 'basic_monthly' && isActive ? '2px solid #10b981' : colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>Basic Monthly</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: colors.greenBadge, color: colors.greenText }}>One-Time</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary, margin: '8px 0 4px' }}>
                ₦3,000 <span style={{ fontSize: 12, fontWeight: 500, color: colors.textMuted }}>/ 30 days</span>
              </div>
              <p style={{ fontSize: 11.5, color: colors.textMuted, margin: '0 0 14px' }}>
                Bookkeeping, P&L, receipts & bank sync. No auto-renewal.
              </p>
            </div>
            <button
              onClick={() => openSubscriptionCheckout('basic_monthly')}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: 18,
                background: planKey === 'basic_monthly' && isActive ? colors.pillBg : (isDark ? '#ffffff' : '#111827'),
                color: planKey === 'basic_monthly' && isActive ? colors.textPrimary : (isDark ? '#000000' : '#ffffff'),
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {planKey === 'basic_monthly' && isActive ? 'Current Plan' : 'Pay ₦3,000 (30 Days)'}
            </button>
          </div>

          {/* 2. Basic Daily */}
          <div style={{
            background: colors.cardBg,
            borderRadius: 20,
            border: planKey === 'basic_daily' && isActive ? '2px solid #3b82f6' : colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>Basic Daily</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>Recurring</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary, margin: '8px 0 4px' }}>
                ₦100 <span style={{ fontSize: 12, fontWeight: 500, color: colors.textMuted }}>/ day</span>
              </div>
              <p style={{ fontSize: 11.5, color: colors.textMuted, margin: '0 0 14px' }}>
                Charged daily via Paystack. Cancel anytime in one click.
              </p>
            </div>
            <button
              onClick={() => openSubscriptionCheckout('basic_daily')}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: 18,
                background: planKey === 'basic_daily' && isActive ? colors.pillBg : (isDark ? '#ffffff' : '#111827'),
                color: planKey === 'basic_daily' && isActive ? colors.textPrimary : (isDark ? '#000000' : '#ffffff'),
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {planKey === 'basic_daily' && isActive ? 'Current Plan' : 'Subscribe ₦100/day'}
            </button>
          </div>

          {/* 3. Business Monthly (Best Value) */}
          <div style={{
            background: isDark ? 'linear-gradient(135deg, rgba(102,45,145,0.12), #141417)' : 'linear-gradient(135deg, #fdf4ff, #ffffff)',
            borderRadius: 20,
            border: planKey === 'business_monthly' && isActive ? '2px solid var(--accent-primary)' : '1.5px solid var(--accent-border)',
            boxShadow: colors.cardShadow,
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16,
            position: 'relative',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>Business Monthly</span>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 10, background: 'var(--accent-primary)', color: '#ffffff' }}>Best Value</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary, margin: '8px 0 4px' }}>
                ₦15,000 <span style={{ fontSize: 12, fontWeight: 500, color: colors.textMuted }}>/ 30 days</span>
              </div>
              <p style={{ fontSize: 11.5, color: colors.textMuted, margin: '0 0 14px' }}>
                WhatsApp AI, staff team seats, payroll, inventory & tax filing.
              </p>
            </div>
            <button
              onClick={() => openSubscriptionCheckout('business_monthly')}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: 18,
                background: 'var(--accent-primary)',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {planKey === 'business_monthly' && isActive ? 'Current Plan' : 'Pay ₦15,000 (30 Days)'}
            </button>
          </div>

          {/* 4. Business Daily */}
          <div style={{
            background: colors.cardBg,
            borderRadius: 20,
            border: planKey === 'business_daily' && isActive ? '2px solid var(--accent-primary)' : colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '22px 20px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 16,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>Business Daily</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>Recurring</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: colors.textPrimary, margin: '8px 0 4px' }}>
                ₦500 <span style={{ fontSize: 12, fontWeight: 500, color: colors.textMuted }}>/ day</span>
              </div>
              <p style={{ fontSize: 11.5, color: colors.textMuted, margin: '0 0 14px' }}>
                All business features charged daily via Paystack. Cancel anytime.
              </p>
            </div>
            <button
              onClick={() => openSubscriptionCheckout('business_daily')}
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: 18,
                background: planKey === 'business_daily' && isActive ? colors.pillBg : (isDark ? '#ffffff' : '#111827'),
                color: planKey === 'business_daily' && isActive ? colors.textPrimary : (isDark ? '#000000' : '#ffffff'),
                fontSize: 12,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {planKey === 'business_daily' && isActive ? 'Current Plan' : 'Subscribe ₦500/day'}
            </button>
          </div>
        </div>

        {/* Separate Tax Filing Professional Service Card */}
        <div style={{
          marginTop: 20,
          background: colors.cardBg,
          borderRadius: 20,
          border: colors.cardBorder,
          boxShadow: colors.cardShadow,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(245,158,11,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--warning)',
            }}>
              <FileText size={18} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.textPrimary }}>
                FIRS Professional Tax Filing Service
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                One-time professional fee of ₦5,000 per filing (CIT, VAT, or PAYE/PIT).
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowTaxModal(true)}
            style={{
              padding: '9px 18px',
              borderRadius: 20,
              background: isDark ? '#ffffff' : '#111827',
              color: isDark ? '#000000' : '#ffffff',
              fontSize: 12.5,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Purchase Tax Filing: ₦5,000
          </button>
        </div>
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
