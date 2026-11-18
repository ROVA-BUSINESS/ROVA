import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, CreditCard, AlertCircle, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { openPaystackPopup } from '../../lib/paystack';
import { supabase } from '../../lib/supabase';

interface PublicLinkData {
  id: string;
  title: string;
  description?: string;
  amount: number | null;
  currency: string;
  allow_custom_amount: boolean;
  payment_url: string;
  status: string;
  merchant_name: string;
  subaccount_code?: string | null;
  settlement_bank?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  expires_at?: string | null;
}

export default function PublicCheckoutPage() {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkData, setLinkData] = useState<PublicLinkData | null>(null);

  // Form inputs
  const [customAmount, setCustomAmount] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{ reference: string; amount: number } | null>(null);

  useEffect(() => {
    if (!slug) {
      setError('Invalid payment link URL.');
      setLoading(false);
      return;
    }

    async function fetchLink() {
      setLoading(true);
      setError(null);

      try {
        // 1. Try public API endpoint first
        const res = await fetch(`/api/payment/links/public?slug=${encodeURIComponent(slug || '')}`);
        if (res.ok) {
          const body = await res.json();
          if (body.success && body.link) {
            if (body.link.expires_at) {
              const exp = new Date(body.link.expires_at);
              exp.setHours(23, 59, 59, 999);
              if (exp < new Date()) {
                setError('This payment link has expired.');
                setLoading(false);
                return;
              }
            }
            setLinkData(body.link);
            if (body.link.amount) setCustomAmount(String(body.link.amount));
            if (body.link.customer_name) setPayerName(body.link.customer_name);
            if (body.link.customer_email) setPayerEmail(body.link.customer_email);
            setLoading(false);
            return;
          }
        }

        // 2. Fallback to direct Supabase query
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug || '');
        let query = supabase.from('payment_links').select('*');
        if (isUUID) {
          query = query.or(`id.eq.${slug},provider_slug.eq.${slug}`);
        } else {
          query = query.eq('provider_slug', slug);
        }

        const { data, error: dbError } = await query.single();
        if (dbError || !data) {
          throw new Error('Payment link not found or inactive.');
        }

        const meta = (data.metadata || {}) as Record<string, any>;
        if (meta.expires_at) {
          const exp = new Date(meta.expires_at);
          exp.setHours(23, 59, 59, 999);
          if (exp < new Date()) {
            throw new Error('This payment link has expired.');
          }
        }

        setLinkData({
          id: data.id,
          title: data.title,
          description: data.description,
          amount: data.amount,
          currency: data.currency || 'NGN',
          allow_custom_amount: data.allow_custom_amount,
          payment_url: data.payment_url,
          status: data.status,
          merchant_name: 'ROVA Business Merchant',
          subaccount_code: meta.subaccount_code || null,
          settlement_bank: meta.settlement_bank || null,
          customer_name: meta.customer_name || null,
          customer_email: meta.customer_email || null,
          customer_phone: meta.customer_phone || null,
          expires_at: meta.expires_at || null,
        });
        if (data.amount) setCustomAmount(String(data.amount));
        if (meta.customer_name) setPayerName(meta.customer_name);
        if (meta.customer_email) setPayerEmail(meta.customer_email);
      } catch (err: any) {
        setError(err.message || 'Payment link not found.');
      } finally {
        setLoading(false);
      }
    }

    fetchLink();
  }, [slug]);

  const payableAmount = linkData?.allow_custom_amount
    ? parseFloat(customAmount || '0')
    : (linkData?.amount || parseFloat(customAmount || '0'));

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!linkData) return;

    if (!payableAmount || payableAmount < 100) {
      alert('Please enter a valid payment amount of at least ₦100.');
      return;
    }

    if (!payerEmail || !payerEmail.includes('@')) {
      alert('Please enter a valid email address to receive your payment receipt.');
      return;
    }

    setPaying(true);
    const reference = `PLK_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    try {
      await openPaystackPopup({
        amountNaira: payableAmount,
        email: payerEmail.trim(),
        reference,
        subaccount: linkData.subaccount_code || undefined,
        metadata: {
          linkId: linkData.id,
          linkTitle: linkData.title,
          payerName: payerName.trim(),
          subaccount: linkData.subaccount_code || undefined,
          via: 'rova_checkout',
        },
        onSuccess: async (verifiedRef) => {
          const finalRef = verifiedRef || reference;
          setPaymentSuccess({ reference: finalRef, amount: payableAmount });

          // Record payment completion
          try {
            await fetch('/api/payment/links/public', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                linkId: linkData.id,
                reference: finalRef,
                amount: payableAmount,
                currency: linkData.currency || 'NGN',
                payerName: payerName.trim(),
                payerEmail: payerEmail.trim(),
              }),
            });
          } catch {
            // Silently continue since Paystack confirmed payment
          }
          setPaying(false);
        },
        onClose: () => {
          setPaying(false);
        },
      });
    } catch (err: any) {
      alert(err.message || 'Unable to open Paystack payment window.');
      setPaying(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#09090b',
        color: '#f4f4f5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: 16,
            color: '#fff',
          }}
        >
          R
        </div>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.5px' }}>ROVA Checkout</span>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#121217',
          border: '1px solid #27272a',
          borderRadius: 16,
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Loading State */}
        {loading && (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 16px', color: '#a855f7' }} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Loading payment details...</h3>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <AlertCircle size={44} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Payment Link Unavailable</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#a1a1aa', lineHeight: 1.5 }}>
              {error}
            </p>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: '#a855f7',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ArrowLeft size={14} /> Go to ROVA Home
            </Link>
          </div>
        )}

        {/* Success State */}
        {!loading && paymentSuccess && linkData && (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px',
              }}
            >
              <CheckCircle2 size={38} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', color: '#f4f4f5' }}>Payment Successful!</h2>
            <p style={{ fontSize: 14, color: '#a1a1aa', margin: '0 0 20px' }}>
              Your payment has been received and verified.
            </p>

            <div
              style={{
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: 12,
                padding: '16px 20px',
                textAlign: 'left',
                marginBottom: 24,
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#a1a1aa' }}>Item:</span>
                <strong style={{ color: '#f4f4f5' }}>{linkData.title}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#a1a1aa' }}>Amount Paid:</span>
                <strong style={{ color: '#22c55e', fontSize: 15 }}>{formatCurrency(paymentSuccess.amount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#a1a1aa' }}>Payment Ref:</span>
                <code style={{ color: '#e4e4e7', fontSize: 11 }}>{paymentSuccess.reference}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#a1a1aa' }}>Merchant:</span>
                <span style={{ color: '#f4f4f5' }}>{linkData.merchant_name}</span>
              </div>
            </div>

            <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>
              A receipt has been issued. You may close this window.
            </p>
          </div>
        )}

        {/* Active Payment Form */}
        {!loading && !error && !paymentSuccess && linkData && (
          <div>
            {/* Merchant Banner */}
            <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid #27272a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#a855f7', fontWeight: 600, marginBottom: 8 }}>
                <Sparkles size={13} />
                <span>{linkData.merchant_name}</span>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 6px', color: '#f4f4f5' }}>
                {linkData.title}
              </h1>
              {linkData.description && (
                <p style={{ fontSize: 13, color: '#a1a1aa', margin: 0, lineHeight: 1.4 }}>
                  {linkData.description}
                </p>
              )}
              {linkData.settlement_bank && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    color: '#22c55e',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.25)',
                    padding: '3px 8px',
                    borderRadius: 6,
                    marginTop: 10,
                  }}
                >
                  <ShieldCheck size={13} />
                  <span>Settles directly into {linkData.settlement_bank} account</span>
                </div>
              )}
            </div>

            {/* Payment Details */}
            <form onSubmit={handlePay} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Amount Display or Custom Input */}
              {linkData.allow_custom_amount ? (
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
                    Enter Amount (₦) *
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="0.01"
                    placeholder="e.g. 5000"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: '#18181b',
                      border: '1px solid #3f3f46',
                      borderRadius: 10,
                      color: '#f4f4f5',
                      fontSize: 18,
                      fontWeight: 700,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ) : (
                <div style={{ background: '#18181b', padding: '14px 18px', borderRadius: 12, border: '1px solid #27272a' }}>
                  <div style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 500 }}>Total Amount Due</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#f4f4f5', marginTop: 2 }}>
                    {formatCurrency(linkData.amount, linkData.currency)}
                  </div>
                </div>
              )}

              {/* Customer Name */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
                  Your Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chukwuma Adebayo"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 10,
                    color: '#f4f4f5',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Customer Email */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
                  Email Address (for receipt) *
                </label>
                <input
                  type="email"
                  placeholder="e.g. yourname@example.com"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: 10,
                    color: '#f4f4f5',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Submit Pay Button */}
              <button
                type="submit"
                disabled={paying}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #7c3aed, #9333ea)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: paying ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)',
                  opacity: paying ? 0.7 : 1,
                  marginTop: 6,
                }}
              >
                {paying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <CreditCard size={16} />
                    <span>Pay {payableAmount ? formatCurrency(payableAmount) : ''} with Paystack</span>
                  </>
                )}
              </button>

              {/* Trust Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: '#71717a',
                  marginTop: 4,
                }}
              >
                <ShieldCheck size={14} style={{ color: '#22c55e' }} />
                <span>Secured by Paystack • Cards, Bank Transfer & USSD accepted</span>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 24, fontSize: 12, color: '#71717a' }}>
        Powered by <strong style={{ color: '#a1a1aa' }}>ROVA Business</strong>
      </div>
    </div>
  );
}

