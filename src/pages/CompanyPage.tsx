import { useTheme } from '../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, ArrowRight, ShieldCheck, Cpu, Code2, HeartHandshake } from 'lucide-react';

export default function CompanyPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <>
      <style>{`
        .com-root {
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
        .com-nav {
          height: 70px;
          background: ${isLight ? 'rgba(244,244,245,0.6)' : 'rgba(9,9,11,0.5)'};
          backdrop-filter: blur(20px);
          border-bottom: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.06)'};
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
        }
        .com-nav-inner {
          width: 100%; max-width: 1200px; padding: 0 20px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .com-nav-logo { height: 58px; cursor: pointer; }
        .com-nav-links { display: flex; gap: 24px; }
        .com-nav-link {
          font-size: 14px; font-weight: 600; color: var(--text-secondary);
          text-decoration: none; transition: color 0.2s;
        }
        .com-nav-link:hover { color: var(--text-primary); }
        .com-container {
          max-width: 1200px; margin: 0 auto; padding: 60px 20px;
          position: relative; z-index: 1;
        }
        .com-header {
          text-align: center; max-width: 700px; margin: 0 auto 60px;
        }
        .com-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 18px; background: rgba(147,51,234,0.1);
          border-radius: 100px; margin-bottom: 20px;
          border: 1px solid rgba(147,51,234,0.25);
        }
        .com-badge-text {
          font-size: 11px; font-weight: 800; color: var(--accent-light);
          text-transform: uppercase; letter-spacing: 2px;
          font-family: 'Roboto', sans-serif;
        }
        .com-title {
          font-size: clamp(32px, 4vw, 56px); font-weight: 800; line-height: 1.15;
          margin-bottom: 20px; font-family: 'Roboto', sans-serif;
        }
        .com-subtitle {
          font-size: clamp(15px, 1.8vw, 18px); color: var(--text-secondary); line-height: 1.6;
        }
        .com-about-section {
          display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center;
          margin-bottom: 80px;
        }
        @media (max-width: 1024px) {
          .com-about-section { grid-template-columns: 1fr; gap: 32px; }
        }
        .com-about-title {
          font-size: 28px; font-weight: 800; margin-bottom: 18px; font-family: 'Roboto', sans-serif;
        }
        .com-about-p {
          color: var(--text-secondary); line-height: 1.7; font-size: 14px; margin-bottom: 16px;
        }
        .com-values-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;
          margin-bottom: 80px;
        }
        .com-value-card {
          background: ${isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,22,0.55)'};
          backdrop-filter: blur(30px);
          border: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.08)'};
          border-radius: var(--radius-xl); padding: 28px;
          display: flex; flex-direction: column; gap: 14px;
        }
        .com-value-icon {
          width: 42px; height: 42px; border-radius: 10px;
          background: ${isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'};
          display: flex; align-items: center; justify-content: center;
        }
        .com-value-title {
          font-size: 18px; font-weight: 800; font-family: 'Roboto', sans-serif;
        }
        .com-value-desc {
          color: var(--text-secondary); line-height: 1.6; font-size: 13px;
        }
      `}</style>

      <div className="com-root">
        {/* Glow */}
        <div style={{
          position: 'absolute', top: '10%', right: '-10%', width: 450, height: 450,
          background: 'rgba(59,130,246,0.08)', filter: 'blur(130px)', borderRadius: '50%',
          zIndex: 0, pointerEvents: 'none'
        }} />

        {/* Navbar */}
        <nav className="com-nav">
          <div className="com-nav-inner">
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
                <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" className="com-nav-logo" />
              </Link>
            </div>
            <div className="com-nav-links">
              <Link to="/features" className="com-nav-link">Features</Link>
              <Link to="/solutions" className="sol-nav-link">Solutions</Link>
              <Link to="/pricing" className="sol-nav-link">Pricing</Link>
              <Link to="/company" className="sol-nav-link" style={{ color: 'var(--text-primary)' }}>Company</Link>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link to="/login" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>Login</Link>
              <Link to="/signup" className="sol-nav-link" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)', color: '#fff', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>Get Started</Link>
            </div>
          </div>
        </nav>

        {/* Container */}
        <div className="com-container">


          <header className="com-header">
            <div className="com-badge">
              <Sparkles size={13} color="var(--accent-light)" />
              <span className="com-badge-text">Mission &amp; Vision</span>
            </div>
            <h1 className="com-title">
              Democratising corporate <br />
              accounting <span style={{ background: 'linear-gradient(135deg, #a855f7, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>for African scale</span>
            </h1>
            <p className="com-subtitle">
              ROVA is designed by engineers and financial experts to arm founders with robust, autonomous GAAP ledger capacity at fractional overheads.
            </p>
          </header>

          <div className="com-about-section">
            <div>
              <h2 className="com-about-title">Headquartered in Lagos, Nigeria</h2>
              <p className="com-about-p">
                African founders and growing companies deserve a class of tools that keep up with their rapid execution. Traditional banking systems, offline ledger uploads, and slow administrative loops shouldn't limit growth.
              </p>
              <p className="com-about-p">
                ROVA was founded with one clear mission: to automate corporate double-entry accounting operations completely. By wiring direct open banking protocols and email bank alert syncing to advanced financial LLM classification gateways, we consolidate multi-bank statement ledgers in complete real-time.
              </p>
              <p className="com-about-p">
                Today, ROVA supports teams across Sub-Saharan Africa, powering invoice processing, GAAP ledger audit safety, FIRS statutory deductions, and inventory COGS management on autopilot.
              </p>
            </div>
            <div style={{
              background: 'rgba(147,51,234,0.03)', border: '1px solid rgba(147,51,234,0.12)',
              borderRadius: 'var(--radius-xl)', padding: 36, display: 'flex', flexDirection: 'column', gap: 24
            }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent-light)', marginBottom: 4, fontFamily: "'Roboto', sans-serif" }}>₦50B+</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Autonomous transaction pipeline capacity</div>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)' }} />
              <div>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#3b82f6', marginBottom: 4, fontFamily: "'Roboto', sans-serif" }}>100%</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Statutory compliance calculations precision (FIRS rules)</div>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)' }} />
              <div>
                <div style={{ fontSize: 36, fontWeight: 800, color: '#10b981', marginBottom: 4, fontFamily: "'Roboto', sans-serif" }}>250ms</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Average ledger query indexing latency</div>
              </div>
            </div>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, textAlign: 'center', marginBottom: 36, fontFamily: "'Roboto', sans-serif" }}>Our Engineering Principles</h2>

          <div className="com-values-grid">
            <div className="com-value-card">
              <div className="com-value-icon">
                <ShieldCheck size={18} color="#ef4444" />
              </div>
              <h3 className="com-value-title">Zero Trust Security</h3>
              <p className="com-value-desc">
                We implement bank-grade token exchanges, secure credential encryptions, and strict double-entry checks to preserve transaction history and account records.
              </p>
            </div>

            <div className="com-value-card">
              <div className="com-value-icon">
                <Cpu size={18} color="#a855f7" />
              </div>
              <h3 className="com-value-title">Autonomous Autopilot</h3>
              <p className="com-value-desc">
                If the AI confidence exceeds threshold limits, your books reconcile themselves. No manuals, no data dumps, and zero monthly administration friction.
              </p>
            </div>

            <div className="com-value-card">
              <div className="com-value-icon">
                <Code2 size={18} color="#3b82f6" />
              </div>
              <h3 className="com-value-title">Open Infrastructure</h3>
              <p className="com-value-desc">
                Our code is highly modularized and integrated with standard banking webhooks, Mono feeds, and transactional APIs to enable seamless modular scaling.
              </p>
            </div>

            <div className="com-value-card">
              <div className="com-value-icon">
                <HeartHandshake size={18} color="#10b981" />
              </div>
              <h3 className="com-value-title">True SME Alignment</h3>
              <p className="com-value-desc">
                We believe in simple, transparent, usage-based transaction fees that scale strictly as your company grows, aligning our incentives directly with yours.
              </p>
            </div>
          </div>

          {/* CTA Footer */}
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-primary) 0%, #3b82f6 100%)',
            borderRadius: 'var(--radius-xl)', padding: '50px 40px', textAlign: 'center',
            boxShadow: '0 20px 40px rgba(147,51,234,0.25)', position: 'relative', overflow: 'hidden'
          }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: 'white', marginBottom: 12, fontFamily: "'Roboto', sans-serif" }}>Automate your financials with complete confidence</h2>
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, marginBottom: 28, maxWidth: 580, marginInline: 'auto' }}>
              Consolidate your multi-bank ledgers, automate client invoicing, and compute compliance runs on ROVA AI today.
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
