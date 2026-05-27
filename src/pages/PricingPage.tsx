import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, Check, Zap } from 'lucide-react';
import Button from '../components/ui/Button';

export default function PricingPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Interactive Fee Calculator State
  const [txCount, setTxCount] = useState(30);

  const flatFeePerTx = 1000;
  const rovaMonthlyCost = txCount * flatFeePerTx;
  const accountantMonthlyCost = 250000; // Flat ₦250,000
  const savings = accountantMonthlyCost - rovaMonthlyCost;

  return (
    <>
      <style>{`
        .prc-root {
          min-height: 100vh;
          background: ${isLight
            ? 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.03) 0%, #f4f4f5 100%)'
            : 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.05) 0%, #09090b 100%)'};
          color: var(--text-primary);
          font-family: 'Inter', system-ui, sans-serif;
          overflow-x: hidden;
          position: relative;
          padding-bottom: 80px;
        }
        .prc-nav {
          height: 70px;
          background: ${isLight ? 'rgba(244,244,245,0.6)' : 'rgba(9,9,11,0.5)'};
          backdrop-filter: blur(20px);
          border-bottom: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.06)'};
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
        }
        .prc-nav-inner {
          width: 100%; max-width: 1200px; padding: 0 20px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .prc-nav-logo { height: 58px; cursor: pointer; }
        .prc-nav-links { display: flex; gap: 24px; }
        .prc-nav-link {
          font-size: 14px; font-weight: 600; color: var(--text-secondary);
          text-decoration: none; transition: color 0.2s;
        }
        .prc-nav-link:hover { color: var(--text-primary); }
        .prc-container {
          max-width: 1200px; margin: 0 auto; padding: 60px 20px;
          position: relative; z-index: 1;
        }
        .prc-header {
          text-align: center; max-width: 700px; margin: 0 auto 60px;
        }
        .prc-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 18px; background: rgba(147,51,234,0.1);
          border-radius: 100px; margin-bottom: 20px;
          border: 1px solid rgba(147,51,234,0.25);
        }
        .prc-badge-text {
          font-size: 11px; font-weight: 800; color: var(--accent-light);
          text-transform: uppercase; letter-spacing: 2px;
          font-family: 'Space Grotesk', sans-serif;
        }
        .prc-title {
          font-size: clamp(32px, 4vw, 56px); font-weight: 800; line-height: 1.15;
          margin-bottom: 20px; font-family: 'Space Grotesk', sans-serif;
        }
        .prc-subtitle {
          font-size: clamp(15px, 1.8vw, 18px); color: var(--text-secondary); line-height: 1.6;
        }
        
        /* Pricing Plan Section */
        .prc-plans {
          display: grid; grid-template-columns: 1fr 1.2fr; gap: 40px; align-items: start; margin-bottom: 80px;
        }
        @media (max-width: 1024px) {
          .prc-plans { grid-template-columns: 1fr; }
        }

        .prc-plan-card {
          background: ${isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,22,0.55)'};
          backdrop-filter: blur(30px);
          border: 2px solid var(--accent-border);
          border-radius: var(--radius-xl); padding: 40px;
          box-shadow: var(--shadow-lg), 0 20px 45px -10px rgba(147,51,234,0.12);
          display: flex; flex-direction: column; gap: 24px;
          position: relative;
        }
        .prc-plan-badge {
          position: absolute; top: -14px; right: 28px;
          background: linear-gradient(135deg, var(--accent-primary), #7c3aed);
          color: white; font-size: 10px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 1px; padding: 6px 14px; border-radius: var(--radius-full);
          box-shadow: 0 4px 12px rgba(147,51,234,0.3);
        }
        .prc-plan-name { font-size: 24px; font-weight: 800; font-family: 'Space Grotesk, sans-serif'; }
        .prc-plan-price { font-size: 40px; font-weight: 800; font-family: 'Space Grotesk, sans-serif'; }
        .prc-plan-price span { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
        
        .prc-features-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 14px; }
        .prc-feature-item { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; font-weight: 600; line-height: 1.5; }
        .prc-check-icon {
          display: flex; align-items: center; justify-content: center;
          width: 20px; height: 20px; border-radius: 50%;
          background: rgba(34,197,94,0.1); color: #22c55e; flex-shrink: 0;
        }

        /* Calculator Card */
        .prc-calc-card {
          background: ${isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,22,0.55)'};
          backdrop-filter: blur(30px);
          border: 1px solid var(--bg-border);
          border-radius: var(--radius-xl); padding: 40px;
          box-shadow: var(--shadow-lg);
          display: flex; flex-direction: column; gap: 28px;
        }
        .prc-calc-title {
          font-size: 20px; font-weight: 800; font-family: 'Space Grotesk, sans-serif';
          display: flex; alignItems: center; gap: 8px;
        }
        .prc-slider {
          -webkit-appearance: none; width: 100%; height: 6px; border-radius: 3px;
          background: var(--bg-hover); outline: none; cursor: pointer;
        }
        .prc-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%;
          background: var(--accent-primary); cursor: pointer;
          box-shadow: 0 0 10px rgba(147,51,234,0.4);
          transition: transform 0.15s;
        }
        .prc-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }

        .prc-metric-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) {
          .prc-metric-row { grid-template-columns: 1fr; }
        }
        .prc-metric-box {
          border: 1px solid var(--bg-border); border-radius: var(--radius-lg);
          padding: 16px; background: ${isLight ? '#f9f9fb' : 'rgba(255,255,255,0.01)'};
        }
        .prc-metric-num { font-size: 22px; font-weight: 800; margin-bottom: 2px; font-family: 'Space Grotesk, sans-serif'; }

        /* FAQ Section */
        .prc-faq {
          max-width: 800px; margin: 0 auto 60px;
        }
        .prc-faq-title {
          font-size: 26px; font-weight: 800; text-align: center; margin-bottom: 36px;
          font-family: 'Space Grotesk', sans-serif;
        }
        .prc-faq-item {
          border-bottom: 1px solid var(--bg-border); padding: 18px 0;
          display: flex; flex-direction: column; gap: 8px;
        }
        .prc-faq-q { font-size: 15px; font-weight: 700; }
        .prc-faq-a { color: var(--text-secondary); font-size: 13px; line-height: 1.6; }
      `}</style>

      <div className="prc-root">
        {/* Glow */}
        <div style={{
          position: 'absolute', top: '10%', left: '-10%', width: 400, height: 400,
          background: 'rgba(147,51,234,0.12)', filter: 'blur(120px)', borderRadius: '50%',
          zIndex: 0, pointerEvents: 'none'
        }} />

        {/* Navbar */}
        <nav className="prc-nav">
          <div className="prc-nav-inner">
            <Link to="/">
              <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" className="prc-nav-logo" />
            </Link>
            <div className="prc-nav-links">
              <Link to="/features" className="prc-nav-link">Features</Link>
              <Link to="/solutions" className="sol-nav-link">Solutions</Link>
              <Link to="/pricing" className="sol-nav-link" style={{ color: 'var(--text-primary)' }}>Pricing</Link>
              <Link to="/company" className="sol-nav-link">Company</Link>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link to="/login" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>Login</Link>
              <Link to="/signup" className="sol-nav-link" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)', color: '#fff', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>Get Started</Link>
            </div>
          </div>
        </nav>

        {/* Container */}
        <div className="prc-container">
          <div style={{ marginBottom: 20 }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textDecoration: 'none' }}>
              <ArrowLeft size={14} /> Back to Home
            </Link>
          </div>

          <header className="prc-header">
            <div className="prc-badge">
              <Sparkles size={13} color="var(--accent-light)" />
              <span className="prc-badge-text">Transparent Pricing</span>
            </div>
            <h1 className="prc-title">
              Simple, usage-based <br />
              pricing that <span style={{ background: 'linear-gradient(135deg, #a855f7, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>scales as you grow</span>
            </h1>
            <p className="prc-subtitle">
              ROVA eliminates rigid monthly subscription fees that penalise growing startups. You pay a low flat rate strictly based on transaction volume processed by the AI engine.
            </p>
          </header>

          <div className="prc-plans">
            {/* The Main Plan */}
            <div className="prc-plan-card">
              <span className="prc-plan-badge">Scale-As-You-Grow</span>
              <div>
                <h2 className="prc-plan-name">Autonomous OS</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Full GAAP Ledger access on autopilot.</p>
              </div>
              <div className="prc-plan-price">
                ₦1,000<span>/ transaction sync &amp; classify</span>
              </div>
              
              <Link to="/signup" style={{ textDecoration: 'none' }}>
                <Button variant="primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}>Get Started for Free</Button>
              </Link>

              <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)' }} />

              <ul className="prc-features-list">
                {[
                  '₦0 Core Platform fee (Always free core ledgers!)',
                  'Direct open-banking connection endpoints integrated',
                  'Autonomous email-alert alert parser and synchronizer',
                  'Unlimited Draft client invoices and receipts logging',
                  'Unlimited Payroll employees processing and deduction calculators',
                  'Profit & Loss, Balance Sheet, and Trial Balance statements',
                  'Unlimited AI Co-pilot assistant queries and chat actions',
                  'Full team onboarding invite logs'
                ].map((item, i) => (
                  <li key={i} className="prc-feature-item">
                    <div className="prc-check-icon"><Check size={12} /></div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Interactive Calculator */}
            <div className="prc-calc-card">
              <div>
                <h2 className="prc-calc-title">
                  <Zap size={18} color="var(--accent-light)" />
                  Savings Calculator
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                  Compare the monthly usage fee of ROVA against a traditional accountant in Nigeria.
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  <span>Estimated Bank Sync Transactions Processed</span>
                  <span style={{ color: 'var(--accent-light)', fontSize: 14 }}>{txCount} transactions</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="5"
                  value={txCount}
                  onChange={e => setTxCount(Number(e.target.value))}
                  className="prc-slider"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-disabled)', marginTop: 6, fontWeight: 600 }}>
                  <span>0 Transactions (₦0 fee)</span>
                  <span>75 Tx (₦75k/mo)</span>
                  <span>150 Transactions (₦150k/mo)</span>
                </div>
              </div>

              <div className="prc-metric-row">
                <div className="prc-metric-box">
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>ROVA Cost</div>
                  <div className="prc-metric-num" style={{ color: 'var(--accent-light)' }}>
                    ₦{rovaMonthlyCost.toLocaleString()}
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>/ month</span>
                  </div>
                </div>

                <div className="prc-metric-box">
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Accountant Cost</div>
                  <div className="prc-metric-num" style={{ color: 'var(--text-primary)', textDecoration: 'line-through', opacity: 0.6 }}>
                    ₦{accountantMonthlyCost.toLocaleString()}
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>/ month</span>
                  </div>
                </div>
              </div>

              <div style={{
                background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)',
                borderRadius: 'var(--radius-lg)', padding: '16px 20px', textAlign: 'center',
                boxShadow: '0 0 16px rgba(34,197,94,0.08)'
              }}>
                <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Net Monthly Savings</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#22c55e', fontFamily: 'Space Grotesk, sans-serif' }}>
                  ₦{savings.toLocaleString()}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e', opacity: 0.8 }}> / month saved</span>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <section className="prc-faq">
            <h2 className="prc-faq-title">Pricing Frequently Asked Questions</h2>
            
            <div className="prc-faq-item">
              <h3 className="prc-faq-q">What exactly is a "processed transaction"?</h3>
              <p className="prc-faq-a">
                A processed transaction is a raw bank feed narration (e.g. from Gmail parsing or bank webhooks) that is automatically categorized by our proprietary financial AI model, matched to payroll/stock metrics, and logged into your balanced general ledger. Transactions you enter manually are 100% free.
              </p>
            </div>

            <div className="prc-faq-item">
              <h3 className="prc-faq-q">Is the core platform really free?</h3>
              <p className="prc-faq-a">
                Yes! We do not charge a base subscription fee. Access to the dashboard, visual charts, reports generation (Profit &amp; Loss, Balance Sheet), direct invoicing drafts, and payroll setup calculators is always free.
              </p>
            </div>

            <div className="prc-faq-item">
              <h3 className="prc-faq-q">Are there any hidden costs?</h3>
              <p className="prc-faq-a">
                None at all. All features operate under the single flat rate of ₦1,000 per transaction sync. Invoicing modules, team onboarding invites, and co-pilot conversational queries carry zero monthly overhead.
              </p>
            </div>

            <div className="prc-faq-item">
              <h3 className="prc-faq-q">How am I billed?</h3>
              <p className="prc-faq-a">
                ROVA operates a prepaid credit wallet model. You deposit funds securely into your billing wallet, and transaction syncs deduct credits automatically. If your wallet balances are empty, automated syncs pause safely, while core dashboard tools remain open.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
