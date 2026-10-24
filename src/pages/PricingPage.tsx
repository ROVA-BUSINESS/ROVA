import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X } from 'lucide-react';
import Button from '../components/ui/Button';

export default function PricingPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [expandedBasic, setExpandedBasic] = useState(false);
  const [expandedBusiness, setExpandedBusiness] = useState(false);

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

  const FAQ = [
    {
      q: 'What is the difference between Basic and Business?',
      a: 'ROVA Basic manages your finances (bookkeeping, invoices, reports, bank sync). ROVA Business manages your finances PLUS helps run the business (WhatsApp AI, payroll, staff accounts & permissions, tax filing).'
    },
    {
      q: 'Can I switch between daily and monthly billing?',
      a: 'Yes. Monthly plans are paid once for 30 days of full access with no automatic renewal. Daily plans renew automatically every day via Paystack until cancelled. You can change plans or cancel anytime from your Billing page.'
    },
    {
      q: 'What is Tax Filing and why is it separate?',
      a: 'Tax Filing is a professional one-time service where ROVA handles your FIRS submission on your behalf. It costs ₦5,000 per filing and can be purchased separately — regardless of your subscription plan — from your Billing page.'
    },
    {
      q: 'Can I have ROVA + Tax Filing?',
      a: 'Yes. They are independent products. You can subscribe to any ROVA plan and separately purchase a Tax Filing service (₦5,000 one-time). The tax filing fee does not recur — you only pay when you need another filing.'
    },
    {
      q: 'Is payment secure?',
      a: 'Yes. All payments are processed by Paystack, Nigeria\'s most trusted payment gateway. Your card details are never stored on our servers.'
    },
  ];

  return (
    <>
      <style>{`
        .prc-root {
          min-height: 100vh;
          background: ${isLight
            ? 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.03) 0%, #f4f4f5 100%)'
            : 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.05) 0%, #09090b 100%)'};
          color: var(--text-primary);
          font-family: 'Roboto', sans-serif;
          overflow-x: hidden;
          position: relative;
          padding-bottom: 100px;
        }
        .prc-nav {
          height: 70px;
          background: ${isLight ? 'rgba(244,244,245,0.6)' : 'rgba(9,9,11,0.5)'};
          backdrop-filter: blur(20px);
          border-bottom: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.06)'};
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
        }
        .prc-nav-inner { width: 100%; max-width: 1200px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; }
        .prc-nav-logo { height: 58px; cursor: pointer; }
        .prc-nav-link { font-size: 14px; font-weight: 600; color: var(--text-secondary); text-decoration: none; transition: color 0.2s; }
        .prc-nav-link:hover { color: var(--text-primary); }
        .prc-container { max-width: 1100px; margin: 0 auto; padding: 60px 20px; position: relative; z-index: 1; }
        .prc-header { text-align: center; max-width: 700px; margin: 0 auto 60px; }
        .prc-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; background: rgba(147,51,234,0.1); border-radius: 100px; margin-bottom: 20px; border: 1px solid rgba(147,51,234,0.25); }
        .prc-badge-text { font-size: 11px; font-weight: 800; color: var(--accent-light); text-transform: uppercase; letter-spacing: 2px; }
        .prc-title { font-size: clamp(32px, 4vw, 52px); font-weight: 800; line-height: 1.15; margin-bottom: 20px; }
        .prc-subtitle { font-size: clamp(15px, 1.8vw, 17px); color: var(--text-secondary); line-height: 1.6; }
        .prc-distinction { background: ${isLight ? 'rgba(255,255,255,0.7)' : 'rgba(20,20,22,0.6)'}; backdrop-filter: blur(20px); border: 1px solid var(--bg-border); border-radius: var(--radius-xl); padding: 20px 28px; max-width: 720px; margin: 0 auto 40px; text-align: center; }
        .prc-plans-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-bottom: 24px; }
        @media (max-width: 768px) { .prc-plans-grid { grid-template-columns: 1fr; } }
        .prc-plan-card { background: ${isLight ? 'rgba(255,255,255,0.7)' : 'rgba(20,20,22,0.6)'}; backdrop-filter: blur(30px); border: 1px solid var(--bg-border); border-radius: var(--radius-xl); padding: 36px 32px; display: flex; flex-direction: column; gap: 0; position: relative; transition: all 0.25s ease; }
        .prc-plan-card.featured { border: 2px solid var(--accent-primary); box-shadow: 0 20px 40px -10px rgba(147,51,234,0.2); }
        .prc-plan-card-badge { position: absolute; top: -14px; right: 24px; background: linear-gradient(135deg, var(--accent-primary), #7c3aed); color: white; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 6px 14px; border-radius: var(--radius-full); box-shadow: 0 4px 12px rgba(147,51,234,0.3); }
        .prc-freq-toggle { display: flex; gap: 8px; margin-bottom: 28px; background: ${isLight ? '#f4f4f5' : 'rgba(255,255,255,0.05)'}; border-radius: var(--radius-lg); padding: 4px; }
        .prc-freq-btn { flex: 1; padding: 8px 12px; border-radius: calc(var(--radius-lg) - 2px); font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; background: transparent; color: var(--text-muted); }
        .prc-freq-btn.active { background: ${isLight ? 'white' : '#27272a'}; color: var(--text-primary); box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        .prc-feature-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px; margin: 24px 0; flex: 1; }
        .prc-table-container { background: ${isLight ? 'rgba(255,255,255,0.7)' : 'rgba(20,20,22,0.6)'}; backdrop-filter: blur(30px); border: 1px solid var(--bg-border); border-radius: var(--radius-xl); overflow: hidden; margin-bottom: 80px; }
        .prc-table { width: 100%; border-collapse: collapse; text-align: left; }
        .prc-th { padding: 20px 24px; font-size: 14px; font-weight: 700; border-bottom: 1px solid var(--bg-border); color: var(--text-primary); }
        .prc-td { padding: 15px 24px; font-size: 13px; border-bottom: 1px solid var(--bg-border); color: var(--text-secondary); }
        .prc-tr:last-child .prc-td { border-bottom: none; }
        .prc-tax-card { background: ${isLight ? 'rgba(255,255,255,0.7)' : 'rgba(20,20,22,0.6)'}; backdrop-filter: blur(30px); border: 1px solid var(--bg-border); border-radius: var(--radius-xl); padding: 40px 36px; text-align: center; margin-bottom: 80px; }
        .prc-faq { max-width: 800px; margin: 0 auto; }
        .prc-faq-title { font-size: 26px; font-weight: 800; text-align: center; margin-bottom: 36px; }
        .prc-faq-item { border-bottom: 1px solid var(--bg-border); padding: 18px 0; }
        .prc-faq-q { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
        .prc-faq-a { color: var(--text-secondary); font-size: 13px; line-height: 1.7; }
        .prc-section-title { font-size: 28px; font-weight: 800; text-align: center; margin-bottom: 12px; }
        .prc-section-sub { text-align: center; color: var(--text-secondary); font-size: 15px; line-height: 1.6; max-width: 560px; margin: 0 auto 40px; }
      `}</style>

      <div className="prc-root">
        {/* Glow */}
        <div style={{ position: 'absolute', top: '10%', left: '-10%', width: 400, height: 400, background: 'rgba(147,51,234,0.08)', filter: 'blur(120px)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '50%', right: '-10%', width: 350, height: 350, background: 'rgba(59,130,246,0.06)', filter: 'blur(120px)', borderRadius: '50%', zIndex: 0, pointerEvents: 'none' }} />

        {/* Nav */}
        <nav className="prc-nav">
          <div className="prc-nav-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontWeight: 600, padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--bg-border)', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                <ArrowLeft size={16} /> Back
              </Link>
              <Link to="/"><img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" className="prc-nav-logo" /></Link>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <Link to="/features" className="prc-nav-link">Features</Link>
              <Link to="/solutions" className="prc-nav-link">Solutions</Link>
              <Link to="/pricing" className="prc-nav-link" style={{ color: 'var(--text-primary)' }}>Pricing</Link>
              <Link to="/company" className="prc-nav-link">Company</Link>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link to="/login" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>Login</Link>
              <Link to="/signup" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)', color: '#fff', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Get Started</Link>
            </div>
          </div>
        </nav>

        <div className="prc-container">
          {/* Header */}
          <header className="prc-header">
            <div className="prc-badge"><span className="prc-badge-text">Simple Pricing</span></div>
            <h1 className="prc-title">
              Two products.{' '}
              <span style={{ background: 'linear-gradient(135deg, #a855f7, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Crystal clear pricing.</span>
            </h1>
            <p className="prc-subtitle">
              ROVA Basic manages your finances. ROVA Business runs your entire operation.
              Tax Filing is a separate one-time professional service — ₦5,000 per filing.
            </p>
          </header>

          {/* Distinction Banner */}
          <div className="prc-distinction">
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>
              Plan Distinction
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6 }}>
              <strong>Basic:</strong> ROVA manages your finances.<br />
              <strong>Business:</strong> ROVA manages your finances + helps run the business.
            </div>
          </div>

          {/* Plan Cards */}
          <section style={{ marginBottom: 80 }}>
            <div className="prc-plans-grid">
              {/* Basic */}
              <div className="prc-plan-card">
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 6 }}>ROVA Basic</div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Financial Records</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    For small business owners who mainly want ROVA to handle their financial records.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 16, margin: '24px 0', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>₦100</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>per day (recurring)</div>
                  </div>
                  <div style={{ paddingBottom: 4, color: 'var(--text-disabled)' }}>or</div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent-light)', lineHeight: 1 }}>₦3,000</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>per month (one-time)</div>
                  </div>
                </div>
                <Link to="/signup" style={{ textDecoration: 'none' }}>
                  <Button variant="secondary" style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}>Get Started — Basic</Button>
                </Link>
                <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)', margin: '24px 0' }} />
                
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#10b981', marginBottom: 8 }}>
                  Includes:
                </div>
                <ul className="prc-feature-list" style={{ margin: 0 }}>
                  {BASIC_INCLUDES.slice(0, 4).map((f, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', alignItems: 'flex-start' }}>
                      <Check size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                      {f}
                    </li>
                  ))}
                  {expandedBasic && (
                    <>
                      {BASIC_INCLUDES.slice(4).map((f, i) => (
                        <li key={`inc_${i}`} style={{ display: 'flex', gap: 10, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', alignItems: 'flex-start' }}>
                          <Check size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                          {f}
                        </li>
                      ))}
                      <li style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginTop: 12, marginBottom: 4 }}>
                        Does not include:
                      </li>
                      {BASIC_EXCLUDES.map((f, i) => (
                        <li key={`exc_${i}`} style={{ display: 'flex', gap: 10, fontSize: 13, fontWeight: 400, color: 'var(--text-disabled)', alignItems: 'flex-start' }}>
                          <X size={15} style={{ color: 'var(--text-disabled)', flexShrink: 0, marginTop: 1, opacity: 0.5 }} />
                          {f}
                        </li>
                      ))}
                    </>
                  )}
                  <li style={{ marginTop: 10 }}>
                    <button
                      onClick={() => setExpandedBasic(!expandedBasic)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'underline' }}
                    >
                      {expandedBasic ? '▲ Show less' : '▼ + More features'}
                    </button>
                  </li>
                </ul>
              </div>

              {/* Business */}
              <div className="prc-plan-card featured">
                <span className="prc-plan-card-badge">Most Popular</span>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-light)', letterSpacing: 1, marginBottom: 6 }}>ROVA Business</div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Full Business Operations</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    For businesses that are growing and need ROVA to manage more of the business operations.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 16, margin: '24px 0', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>₦500</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>per day (recurring)</div>
                  </div>
                  <div style={{ paddingBottom: 4, color: 'var(--text-disabled)' }}>or</div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--accent-light)', lineHeight: 1 }}>₦15,000</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>per month (one-time)</div>
                  </div>
                </div>
                <Link to="/signup" style={{ textDecoration: 'none' }}>
                  <Button variant="primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 0', background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)' }}>Get Started — Business</Button>
                </Link>
                <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)', margin: '24px 0' }} />
                
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#10b981', marginBottom: 8 }}>
                  Includes everything in Basic, plus:
                </div>
                <ul className="prc-feature-list" style={{ margin: 0 }}>
                  {BUSINESS_INCLUDES.slice(0, 3).map((f, i) => (
                    <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', alignItems: 'flex-start' }}>
                      <Check size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                      {f}
                    </li>
                  ))}
                  {expandedBusiness && (
                    BUSINESS_INCLUDES.slice(3).map((f, i) => (
                      <li key={`biz_${i}`} style={{ display: 'flex', gap: 10, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', alignItems: 'flex-start' }}>
                        <Check size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 1 }} />
                        {f}
                      </li>
                    ))
                  )}
                  <li style={{ marginTop: 10 }}>
                    <button
                      onClick={() => setExpandedBusiness(!expandedBusiness)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'underline' }}
                    >
                      {expandedBusiness ? '▲ Show less' : '▼ + More features'}
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
              All payments processed securely by <strong>Paystack</strong> · Cancel anytime · No hidden fees
            </p>
          </section>

          {/* Tax Filing Service Card */}
          <section style={{ marginBottom: 80 }}>
            <h2 className="prc-section-title">Tax Filing — Separate Service</h2>
            <p className="prc-section-sub">
              A standalone professional service. ROVA files your taxes with FIRS on your behalf. Independent of your subscription plan.
            </p>
            <div className="prc-tax-card">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 24 }}>📋</span>
                </div>
              </div>
              <h3 style={{ fontSize: 26, fontWeight: 800, marginBottom: 8 }}>₦5,000</h3>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Per Tax Filing · One-time Payment</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 500, margin: '0 auto 28px' }}>
                VAT returns, PAYE, Company Income Tax (CIT), or Annual Filing.
                ROVA handles the full submission to FIRS. You only pay when you need a filing — it never auto-renews.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 28 }}>
                {['VAT Return', 'PAYE / PIT', 'Company Income Tax', 'Annual Filing'].map(t => (
                  <span key={t} style={{ padding: '6px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 100, fontSize: 12, fontWeight: 600, color: '#10b981' }}>{t}</span>
                ))}
              </div>
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Button variant="primary" style={{ padding: '12px 32px', background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none' }}>
                  Purchase Tax Filing: ₦5,000
                </Button>
              </Link>
            </div>
          </section>

          {/* Feature Comparison Table */}
          <section style={{ marginBottom: 80 }}>
            <h2 className="prc-section-title">Compare Plans</h2>
            <p className="prc-section-sub">See exactly what each plan includes.</p>
            <div className="prc-table-container">
              <table className="prc-table">
                <thead>
                  <tr style={{ background: isLight ? '#f9f9fb' : 'rgba(255,255,255,0.02)' }}>
                    <th className="prc-th" style={{ width: '50%' }}>Feature</th>
                    <th className="prc-th" style={{ width: '25%' }}>Basic</th>
                    <th className="prc-th" style={{ width: '25%', color: 'var(--accent-light)' }}>Business</th>
                  </tr>
                </thead>
                <tbody>
                  {BASIC_INCLUDES.map((f, i) => (
                    <tr key={`inc_${i}`} className="prc-tr">
                      <td className="prc-td" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{f}</td>
                      <td className="prc-td"><Check size={16} style={{ color: '#10b981' }} /></td>
                      <td className="prc-td"><Check size={16} style={{ color: '#10b981' }} /></td>
                    </tr>
                  ))}
                  {BUSINESS_INCLUDES.map((f, i) => (
                    <tr key={`biz_${i}`} className="prc-tr">
                      <td className="prc-td" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{f}</td>
                      <td className="prc-td"><X size={16} style={{ color: 'var(--text-disabled)', opacity: 0.4 }} /></td>
                      <td className="prc-td"><Check size={16} style={{ color: '#10b981' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* FAQ */}
          <section className="prc-faq">
            <h2 className="prc-faq-title">Frequently Asked Questions</h2>
            {FAQ.map((item, i) => (
              <div key={i} className="prc-faq-item">
                <h3 className="prc-faq-q">{item.q}</h3>
                <p className="prc-faq-a">{item.a}</p>
              </div>
            ))}
          </section>

          <footer style={{ marginTop: 60, paddingTop: 28, borderTop: '1px solid var(--bg-border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>© 2026 ROVA SOFTWARE LIMITED. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </>
  );
}
