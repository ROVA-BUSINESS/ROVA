import { useState, type FormEvent } from 'react';
import { LifeBuoy, Mail, Send, CheckCircle2, Clock, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useMobile } from '../hooks/useMobile';
import { startProductTour } from '../components/onboarding/ProductOnboardingTour';
import OnboardingReplayPanel from '../components/onboarding/OnboardingReplayPanel';

const SUPPORT_EMAILS = {
  primary: 'Officialrovabusiness@gmail.com',
  cc: 'davidomoniyi33@gmail.com,seguneri955@gmail.com',
};

const CATEGORIES = [
  'Technical Issue / Bug',
  'Billing & Subscription',
  'Bank Sync & Transactions',
  'Inventory & Stock Audit',
  'Tax & Compliance',
  'Feature Request / Feedback',
  'General Inquiry',
];

export default function SupportPage() {
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isMobile = useMobile(900);

  const [name, setName] = useState(profile?.full_name || user?.email?.split('@')[0] || '');
  const [email, setEmail] = useState(user?.email || '');
  const [businessName, setBusinessName] = useState(profile?.business_name || '');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const colors = {
    cardBg: isDark ? '#141417' : '#ffffff',
    cardBorder: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.07)',
    cardShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 2px 14px rgba(0,0,0,0.03)',
    inputBg: isDark ? '#1c1c20' : '#ffffff',
    inputBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : '#d1d5db',
    textPrimary: isDark ? '#fafafa' : '#111827',
    textSecondary: isDark ? '#a1a1aa' : '#64748b',
    textMuted: isDark ? '#71717a' : '#94a3b8',
    pillBg: isDark ? '#1f1f23' : '#f4f5f7',
    pillBorder: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
    primaryBtnBg: isDark ? '#ffffff' : '#111827',
    primaryBtnText: isDark ? '#111827' : '#ffffff',
  };

  function buildMailtoHref() {
    const mailSubject = encodeURIComponent(`[ROVA Support · ${category}] ${subject || 'Support Request'}`);
    const mailBody = encodeURIComponent(
      `Name: ${name}\nBusiness: ${businessName || 'N/A'}\nEmail: ${email}\nCategory: ${category}\n\n${message}`
    );
    return `mailto:${SUPPORT_EMAILS.primary}?cc=${SUPPORT_EMAILS.cc}&subject=${mailSubject}&body=${mailBody}`;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      setError('Please enter both a subject and a message.');
      return;
    }

    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/support/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'ROVA User',
          email: email.trim(),
          businessName: businessName.trim(),
          category,
          subject: subject.trim(),
          message: message.trim(),
          userId: user?.id || '',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Could not send support message right now.');
      }

      setSent(true);
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setError(err.message || 'Failed to send message. You can also use the direct email button below.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', padding: isMobile ? '16px 14px 100px' : '24px 20px 100px', animation: 'fadeIn 0.25s ease' }}>
      {/* Ambient Hero Banner matching Billing & Tax Pages */}
      <div style={{
        borderRadius: 22,
        padding: isMobile ? '28px 20px' : '36px 36px',
        marginBottom: 28,
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.16) 0%, rgba(16, 185, 129, 0.10) 60%, rgba(59, 130, 246, 0.10) 100%), #141417'
          : 'linear-gradient(135deg, #f3e8ff 0%, #eff6ff 50%, #ecfdf5 100%)',
        border: colors.cardBorder,
        boxShadow: colors.cardShadow,
      }}>
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
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 14,
            background: isDark ? 'rgba(147, 51, 234, 0.2)' : 'rgba(124, 58, 237, 0.1)',
            color: isDark ? '#c084fc' : '#7c3aed',
            fontSize: 11.5, fontWeight: 700, marginBottom: 10,
          }}>
            <LifeBuoy size={13} /> RovaFlow Help &amp; Support
          </div>
          <h1 style={{
            fontSize: isMobile ? 28 : 34,
            fontWeight: 800,
            color: colors.textPrimary,
            letterSpacing: '-0.03em',
            margin: '0 0 8px',
            lineHeight: 1.15,
          }}>
            How can we help you?
          </h1>
          <p style={{
            fontSize: 14,
            color: colors.textSecondary,
            margin: 0,
            lineHeight: 1.55,
            fontWeight: 500,
          }}>
            Send a message directly to the ROVA support team. Every request is routed immediately to our support &amp; engineering inbox.
          </p>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1.65fr 1fr',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* Left: Support Message Form */}
        <div style={{
          background: colors.cardBg,
          borderRadius: 20,
          border: colors.cardBorder,
          boxShadow: colors.cardShadow,
          padding: isMobile ? '22px 18px' : '28px 30px',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary, margin: '0 0 6px' }}>
            Send a Support Message
          </h2>
          <p style={{ fontSize: 12.5, color: colors.textMuted, margin: '0 0 22px' }}>
            Tell us what you need help with and we will respond to your email as soon as possible.
          </p>

          {sent ? (
            <div style={{
              padding: '28px 20px',
              borderRadius: 16,
              background: isDark ? 'rgba(34,197,94,0.1)' : '#ecfdf5',
              border: `1px solid ${isDark ? 'rgba(34,197,94,0.3)' : '#bbf7d0'}`,
              textAlign: 'center',
            }}>
              <CheckCircle2 size={40} color={isDark ? '#4ade80' : '#16a34a'} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary, marginBottom: 6 }}>
                Message Sent Successfully!
              </div>
              <p style={{ fontSize: 13, color: colors.textSecondary, margin: '0 0 18px', lineHeight: 1.55 }}>
                Your support message has been delivered to the ROVA team. We will get back to you at <strong>{email || 'your email'}</strong>.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 10,
                  background: colors.primaryBtnBg,
                  color: colors.primaryBtnText,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textPrimary, marginBottom: 6 }}>
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    required
                    style={{
                      width: '100%', height: 42, padding: '0 12px', borderRadius: 10,
                      background: colors.inputBg, border: `1px solid ${colors.inputBorder}`,
                      color: colors.textPrimary, fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textPrimary, marginBottom: 6 }}>
                    Your Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    style={{
                      width: '100%', height: 42, padding: '0 12px', borderRadius: 10,
                      background: colors.inputBg, border: `1px solid ${colors.inputBorder}`,
                      color: colors.textPrimary, fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textPrimary, marginBottom: 6 }}>
                    Business Name (optional)
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your business name"
                    style={{
                      width: '100%', height: 42, padding: '0 12px', borderRadius: 10,
                      background: colors.inputBg, border: `1px solid ${colors.inputBorder}`,
                      color: colors.textPrimary, fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textPrimary, marginBottom: 6 }}>
                    Topic / Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                      width: '100%', height: 42, padding: '0 12px', borderRadius: 10,
                      background: colors.inputBg, border: `1px solid ${colors.inputBorder}`,
                      color: colors.textPrimary, fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
                    }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textPrimary, marginBottom: 6 }}>
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your issue or question"
                  required
                  style={{
                    width: '100%', height: 42, padding: '0 12px', borderRadius: 10,
                    background: colors.inputBg, border: `1px solid ${colors.inputBorder}`,
                    color: colors.textPrimary, fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: colors.textPrimary, marginBottom: 6 }}>
                  Message
                </label>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your question or issue in detail..."
                  required
                  style={{
                    width: '100%', padding: '12px', borderRadius: 10,
                    background: colors.inputBg, border: `1px solid ${colors.inputBorder}`,
                    color: colors.textPrimary, fontSize: 13.5, outline: 'none',
                    resize: 'vertical', lineHeight: 1.55, boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: isDark ? 'rgba(239,68,68,0.12)' : '#fef2f2',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={sending}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '11px 24px', borderRadius: 12,
                    background: colors.primaryBtnBg, color: colors.primaryBtnText,
                    border: 'none', fontSize: 13.5, fontWeight: 700,
                    cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.7 : 1,
                  }}
                >
                  <Send size={14} />
                  <span>{sending ? 'Sending...' : 'Send Message'}</span>
                </button>

                <a
                  href={buildMailtoHref()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '10px 16px', borderRadius: 12,
                    background: colors.pillBg, border: colors.pillBorder,
                    color: colors.textPrimary, fontSize: 12.5, fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  <Mail size={14} />
                  <span>Open in Email App</span>
                </a>
              </div>
            </form>
          )}
        </div>

        {/* Right: Direct Contact Info & Response Guarantees */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: colors.cardBg,
            borderRadius: 20,
            border: colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '22px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: isDark ? 'rgba(147,51,234,0.16)' : '#f3e8ff',
                color: isDark ? '#c084fc' : '#7c3aed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Mail size={17} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary }}>Direct Email</div>
                <div style={{ fontSize: 11.5, color: colors.textMuted }}>Reach our team anytime</div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: colors.textSecondary, margin: '0 0 14px', lineHeight: 1.55 }}>
              Messages submitted here are automatically delivered to ROVA Business Support and our founders so nothing slips through the cracks.
            </p>
            <a
              href={`mailto:${SUPPORT_EMAILS.primary}?cc=${SUPPORT_EMAILS.cc}`}
              style={{
                display: 'block',
                padding: '10px 12px',
                borderRadius: 10,
                background: colors.pillBg,
                border: colors.pillBorder,
                color: colors.textPrimary,
                fontSize: 12.5,
                fontWeight: 600,
                textDecoration: 'none',
                wordBreak: 'break-all',
              }}
            >
              {SUPPORT_EMAILS.primary}
            </a>
          </div>

          <div style={{
            background: colors.cardBg,
            borderRadius: 20,
            border: colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Clock size={16} color={isDark ? '#60a5fa' : '#2563eb'} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>Fast Response Time</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 1.5 }}>
                  Most inquiries receive a reply within a few business hours (Mon–Sat, 8 AM – 7 PM WAT).
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <ShieldCheck size={16} color={isDark ? '#4ade80' : '#16a34a'} style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>Billing &amp; Account Priority</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 1.5 }}>
                  Having trouble with Paystack payments, bank sync, or tax filing? Select the matching topic for priority handling.
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: colors.cardBg,
            borderRadius: 20,
            border: colors.cardBorder,
            boxShadow: colors.cardShadow,
            padding: '22px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: isDark ? 'rgba(147,51,234,0.16)' : '#f3e8ff',
                color: isDark ? '#c084fc' : '#7c3aed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={17} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: colors.textPrimary }}>Contextual Feature Tours</div>
                <div style={{ fontSize: 11.5, color: colors.textMuted }}>Need a refresher on RovaFlow?</div>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: colors.textSecondary, margin: '0 0 12px', lineHeight: 1.55 }}>
              Replay any interactive walkthrough to learn how each section of RovaFlow works.
            </p>
            <button
              type="button"
              onClick={() => startProductTour('dashboard')}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 10,
                background: colors.primaryBtnBg,
                color: colors.primaryBtnText,
                border: 'none',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: 14,
              }}
            >
              Replay Dashboard Tour
            </button>
            <OnboardingReplayPanel compact />
          </div>
        </div>
      </div>
    </div>
  );
}
