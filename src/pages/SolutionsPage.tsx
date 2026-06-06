import { useTheme } from '../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import { Globe, Calculator, ShieldCheck, ArrowLeft, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export default function SolutionsPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <>
      <style>{`
        .sol-root {
          min-height: 100vh;
          background: ${isLight
            ? 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.03) 0%, #f4f4f5 100%)'
            : 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.05) 0%, #09090b 100%)'};
          color: var(--text-primary);
          font-family: 'Roboto', sans-serif;
          overflow-x: hidden;
          position: relative;
          padding-bottom: 80px;
        }
        .sol-nav {
          height: 70px;
          background: ${isLight ? 'rgba(244,244,245,0.6)' : 'rgba(9,9,11,0.5)'};
          backdrop-filter: blur(20px);
          border-bottom: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.06)'};
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
        }
        .sol-nav-inner {
          width: 100%; max-width: 1200px; padding: 0 20px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .sol-nav-logo { height: 58px; cursor: pointer; }
        .sol-nav-links { display: flex; gap: 24px; }
        .sol-nav-link {
          font-size: 14px; font-weight: 600; color: var(--text-secondary);
          text-decoration: none; transition: color 0.2s;
        }
        .sol-nav-link:hover { color: var(--text-primary); }
        .sol-container {
          max-width: 1200px; margin: 0 auto; padding: 60px 20px;
          position: relative; z-index: 1;
        }
        .sol-header {
          text-align: center; max-width: 700px; margin: 0 auto 60px;
        }
        .sol-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 18px; background: rgba(147,51,234,0.1);
          border-radius: 100px; margin-bottom: 20px;
          border: 1px solid rgba(147,51,234,0.25);
        }
        .sol-badge-text {
          font-size: 11px; font-weight: 800; color: var(--accent-light);
          text-transform: uppercase; letter-spacing: 2px;
          font-family: 'Roboto', sans-serif;
        }
        .sol-title {
          font-size: clamp(32px, 4vw, 56px); font-weight: 800; line-height: 1.15;
          margin-bottom: 20px; font-family: 'Roboto', sans-serif;
        }
        .sol-subtitle {
          font-size: clamp(15px, 1.8vw, 18px); color: var(--text-secondary); line-height: 1.6;
        }
        .sol-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 80px;
        }
        @media (max-width: 1024px) {
          .sol-grid { grid-template-columns: 1fr; }
        }
        .sol-card {
          background: ${isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,22,0.55)'};
          backdrop-filter: blur(30px);
          border: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.08)'};
          border-radius: var(--radius-xl); padding: 36px;
          box-shadow: var(--shadow-lg);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex; flex-direction: column; gap: 20px;
        }
        .sol-card:hover {
          transform: translateY(-4px);
          border-color: var(--accent-border);
        }
        .sol-card-icon {
          width: 48px; height: 48px; borderRadius: 12px;
          background: ${isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'};
          display: flex; align-items: center; justify-content: center;
        }
        .sol-card-title {
          font-size: 22px; font-weight: 800; font-family: 'Roboto', sans-serif;
        }
        .sol-card-desc {
          color: var(--text-secondary); line-height: 1.65; fontSize: 14px;
        }
        .sol-check-list {
          list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px;
        }
        .sol-check-item {
          display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600;
        }
      `}</style>

      <div className="sol-root">
        {/* Glow */}
        <div style={{
          position: 'absolute', top: '10%', left: '-10%', width: 400, height: 400,
          background: 'rgba(147,51,234,0.12)', filter: 'blur(120px)', borderRadius: '50%',
          zIndex: 0, pointerEvents: 'none'
        }} />

        {/* Navbar */}
        <nav className="sol-nav">
          <div className="sol-nav-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <Link to="/" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                color: 'var(--text-secondary)', textDecoration: 'none',
                fontSize: 14, fontWeight: 600, padding: '8px 16px',
                borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--bg-border)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              >
                <ArrowLeft size={16} /> Back to Home
              </Link>
              <Link to="/">
                <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" className="sol-nav-logo" />
              </Link>
            </div>
            <div className="sol-nav-links">
              <Link to="/features" className="sol-nav-link">Features</Link>
              <Link to="/solutions" className="sol-nav-link" style={{ color: 'var(--text-primary)' }}>Solutions</Link>
              <Link to="/pricing" className="sol-nav-link">Pricing</Link>
              <Link to="/company" className="sol-nav-link">Company</Link>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link to="/login" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>Login</Link>
              <Link to="/signup" className="sol-nav-link" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)', color: '#fff', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>Get Started</Link>
            </div>
          </div>
        </nav>

        {/* Content Container */}
        <div className="sol-container">


          <header className="sol-header">
            <div className="sol-badge">
              <span className="sol-badge-text">Proprietary Capabilities</span>
            </div>
            <h1 className="sol-title">
              Financial intelligence <br />
              built for <span style={{ background: 'linear-gradient(135deg, #a855f7, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>autonomous growth</span>
            </h1>
            <p className="sol-subtitle">
              ROVA replaces disjointed accounting tools, manual spreadsheets, and slow bank downloads with a highly responsive, single ledger co-pilot.
            </p>
          </header>

          <div className="sol-grid">
            {/* Solution 1 */}
            <div className="sol-card">
              <div className="sol-card-icon">
                <Globe size={22} color="#3b82f6" />
              </div>
              <h2 className="sol-card-title">Real-Time Open Banking</h2>
              <p className="sol-card-desc">
                Never wait for end-of-month statements again. ROVA connects directly to Nigerian banking endpoints and secure Gmail parsing structures, keeping your cash flow fully live.
              </p>
              <ul className="sol-check-list">
                {[
                  'Automated Gmail & SMS transaction alert stream feeds',
                  'Exchange-secured Mono bank token handshakes',
                  'Instant ledger inflow/outflow reconciliation logs',
                  'No manual file uploads or CSV parser configurations'
                ].map((item, i) => (
                  <li key={i} className="sol-check-item">
                    <CheckCircle2 size={16} color="#10b981" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Solution 2 */}
            <div className="sol-card">
              <div className="sol-card-icon">
                <Zap size={22} color="#a855f7" />
              </div>
              <h2 className="sol-card-title">ROVA Autonomous Classifier</h2>
              <p className="sol-card-desc">
                Raw bank alert texts are parsed by our proprietary financial AI model. The co-pilot intelligently categorises the intent and takes balanced accounting actions automatically.
              </p>
              <ul className="sol-check-list">
                {[
                  'Identifies salaries, inventory purchases, and invoice payments',
                  'Assigns confidence thresholds to safeguard statement safety',
                  'Handles vagueness with interactive Clarification request loops',
                  'Bypasses slow accountants to record GAAP rows instantly'
                ].map((item, i) => (
                  <li key={i} className="sol-check-item">
                    <CheckCircle2 size={16} color="#10b981" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Solution 3 */}
            <div className="sol-card">
              <div className="sol-card-icon">
                <Calculator size={22} color="#10b981" />
              </div>
              <h2 className="sol-card-title">Double-Entry Ledger Engine</h2>
              <p className="sol-card-desc">
                A solid compliance ledger is key to corporate scale. Every operational expense or sales receipt automatically maps to credit and debit rows, keeping records fully GAAP-ready.
              </p>
              <ul className="sol-check-list">
                {[
                  'Balanced double-entry journal logs on autopilot',
                  'Automated Profit & Loss, Balance Sheet, and Trial Balance',
                  'Fully structured Chart of Accounts tailored for Nigerian SMEs',
                  'Full audit logs and historical trace reports'
                ].map((item, i) => (
                  <li key={i} className="sol-check-item">
                    <CheckCircle2 size={16} color="#10b981" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Solution 4 */}
            <div className="sol-card">
              <div className="sol-card-icon">
                <ShieldCheck size={22} color="#ef4444" />
              </div>
              <h2 className="sol-card-title">Compliance & Payroll Hub</h2>
              <p className="sol-card-desc">
                ROVA ensures that your payroll runs, contractor invoicing, and statutory FIRS taxes remain compliant without hiring expensive legal or auditing advisors.
              </p>
              <ul className="sol-check-list">
                {[
                  'Progressive PAYE income tax tax-bracket assessments (7%-24%)',
                  'Integrated Pension Fund deductions limits calculated automatically',
                  'Estimated VAT (7.5%), CIT (30%), and CGT (10%) reserve trackers',
                  'Consolidated tax summaries ready for FIRS filings'
                ].map((item, i) => (
                  <li key={i} className="sol-check-item">
                    <CheckCircle2 size={16} color="#10b981" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA Footer */}
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #3b82f6 100%)',
            borderRadius: 'var(--radius-xl)', padding: '50px 40px', textAlign: 'center',
            boxShadow: '0 20px 40px rgba(147,51,234,0.25)', position: 'relative', overflow: 'hidden'
          }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: 'white', marginBottom: 12, fontFamily: "'Roboto', sans-serif" }}>Take absolute control of your business numbers</h2>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, marginBottom: 28, maxWidth: 580, marginInline: 'auto' }}>
              Scale your accounting, direct bank feeds, and invoice operations autonomously with ROVA AI.
            </p>
            <Link to="/signup" style={{
              textDecoration: 'none', background: 'white', color: 'var(--accent-primary)',
              padding: '12px 36px', fontSize: 15, fontWeight: 800, borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 16px rgba(0,0,0,0.06)', display: 'inline-flex', alignItems: 'center', gap: 8
            }}>
              Get Started for Free <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
