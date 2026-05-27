import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  BarChart3,
  ShieldCheck,
  Zap,
  ArrowRight,
  Globe,
  Calculator,
  Users2,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  ArrowUpRight,
  Check,
} from 'lucide-react';
import Button from '../components/ui/Button';

export default function LandingPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [activeSimulation, setActiveSimulation] = useState<'runway' | 'invoice' | 'payroll'>('runway');
  const [typingText, setTypingText] = useState('');
  const [simulationResponse, setSimulationResponse] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);

  const simulationData = {
    runway: {
      prompt: "Check my runway and monthly burn rate",
      response: {
        text: "Based on your consolidated balance of ₦4,250,000 and average monthly expenses of ₦850,000, your current runway is approximately 5.0 months.",
        action: { type: "metrics", label: "Analyze Burn Rate", value: "5.0 Months Runway" }
      }
    },
    invoice: {
      prompt: "Create an invoice for Chinedu's Logistics of ₦250,000",
      response: {
        text: "I've drafted invoice #INV-2026-089 for Chinedu's Logistics totaling ₦250,000. Would you like to review and send it?",
        action: { type: "invoice", label: "Review Invoice", client: "Chinedu's Logistics", amount: "₦250,000" }
      }
    },
    payroll: {
      prompt: "Process Chinedu's monthly salary of ₦150,000",
      response: {
        text: "Understood! I've linked the transaction to Chinedu's employee file, processed PAYE (₦11,250) and pension (₦12,000) deductions, and drafted their payslip.",
        action: { type: "payroll", label: "View Payslip", employee: "Chinedu", gross: "₦150,000", net: "₦126,750" }
      }
    }
  };

  useEffect(() => {
    setIsTyping(true);
    setTypingText('');
    setSimulationResponse(null);

    const fullPrompt = simulationData[activeSimulation].prompt;
    let index = 0;
    let accumulated = '';

    const interval = setInterval(() => {
      if (index < fullPrompt.length) {
        accumulated += fullPrompt.charAt(index);
        setTypingText(accumulated);
        index++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsTyping(false);
          setSimulationResponse(simulationData[activeSimulation].response);
        }, 600);
      }
    }, 45);

    return () => clearInterval(interval);
  }, [activeSimulation]);

  return (
    <>
      {/* ── Global landing page responsive styles ── */}
      <style>{`
        .lp-root {
          min-height: 100vh;
          background: ${isLight
            ? 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.03) 0%, #f4f4f5 100%)'
            : 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.05) 0%, #09090b 100%)'};
          color: var(--text-primary);
          font-family: 'Inter', system-ui, sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        /* ── Navbar ── */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; height: 70px;
          background: ${isLight ? 'rgba(244,244,245,0.6)' : 'rgba(9,9,11,0.5)'};
          backdrop-filter: blur(20px);
          border-bottom: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.06)'};
          z-index: 100; display: flex; align-items: center; justify-content: center;
          box-shadow: ${isLight ? '0 4px 30px rgba(0,0,0,0.02)' : '0 4px 30px rgba(0,0,0,0.2)'};
        }
        .lp-nav-inner {
          width: 100%; max-width: 1200px; padding: 0 20px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .lp-nav-logo { height: 58px; cursor: pointer; }
        .lp-nav-links { display: flex; gap: 24px; }
        .lp-nav-link {
          font-size: 14px; font-weight: 600; color: var(--text-secondary);
          text-decoration: none; transition: color 0.2s;
        }
        .lp-nav-link:hover { color: var(--text-primary); }
        .lp-nav-actions { display: flex; gap: 10px; align-items: center; }
        .lp-login-btn {
          text-decoration: none; color: var(--text-primary); font-size: 14px;
          font-weight: 600; padding: 8px 16px; border-radius: var(--radius-md);
          transition: all 0.2s;
        }
        .lp-signup-btn {
          text-decoration: none;
          background: linear-gradient(135deg, var(--accent-primary), #7c3aed);
          color: #fff; font-size: 14px; font-weight: 700;
          padding: 9px 20px; border-radius: var(--radius-md);
          display: flex; align-items: center;
          box-shadow: 0 8px 24px rgba(147,51,234,0.3); transition: transform 0.2s;
        }
        .lp-signup-btn:hover { transform: scale(1.03); }

        /* ── Hero ── */
        .lp-hero {
          padding-top: 110px; padding-bottom: 60px;
          display: flex; flex-direction: column; align-items: center;
          position: relative; z-index: 1;
        }
        .lp-hero-inner {
          max-width: 1200px; width: 100%; padding: 0 20px;
          display: grid; grid-template-columns: 1.1fr 0.9fr;
          gap: 48px; align-items: center;
        }
        .lp-hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 18px; background: rgba(147,51,234,0.1);
          border-radius: 100px; margin-bottom: 20px;
          border: 1px solid rgba(147,51,234,0.25); cursor: default;
        }
        .lp-hero-badge-text {
          font-size: 11px; font-weight: 800; color: var(--accent-light);
          text-transform: uppercase; letter-spacing: 2px;
          font-family: 'Space Grotesk', sans-serif;
        }
        .lp-h1 {
          font-size: clamp(32px, 4.5vw, 64px);
          font-weight: 800; line-height: 1.1; margin-bottom: 20px;
          letter-spacing: -1.5px; font-family: 'Space Grotesk', sans-serif;
        }
        .lp-h1-grad {
          background: linear-gradient(135deg, #a855f7, #3b82f6);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .lp-hero-sub {
          font-size: clamp(15px, 1.8vw, 19px); color: var(--text-secondary);
          line-height: 1.65; margin-bottom: 36px; max-width: 560px;
        }
        .lp-cta-row { display: flex; gap: 14px; flex-wrap: wrap; }
        .lp-cta-primary {
          text-decoration: none;
          background: linear-gradient(135deg, var(--accent-primary), #7c3aed);
          color: #fff; padding: 14px 32px; font-size: 15px; font-weight: 700;
          border-radius: var(--radius-lg); display: flex; align-items: center;
          gap: 10px; box-shadow: 0 10px 30px rgba(147,51,234,0.4); transition: all 0.2s;
        }
        .lp-cta-primary:hover { transform: translateY(-2px); }
        .lp-cta-secondary {
          background: ${isLight ? 'rgba(9,9,11,0.02)' : 'rgba(255,255,255,0.02)'};
          color: var(--text-primary); border: 1px solid ${isLight ? 'rgba(9,9,11,0.1)' : 'rgba(255,255,255,0.1)'};
          padding: 14px 28px; font-size: 15px; font-weight: 700;
          border-radius: var(--radius-lg); cursor: pointer; transition: all 0.2s;
          backdrop-filter: blur(10px);
        }
        .lp-cta-secondary:hover { background: var(--bg-hover); }
        .lp-trust-badges { display: flex; gap: 20px; margin-top: 36px; flex-wrap: wrap; }
        .lp-trust-badge { display: flex; align-items: center; gap: 8px; }
        .lp-trust-dot {
          display: flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 50%;
          background: rgba(34,197,94,0.1); color: #22c55e; flex-shrink: 0;
        }
        .lp-trust-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }

        /* ── AI Simulator Card ── */
        .lp-simulator {
          background: ${isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,22,0.55)'};
          backdrop-filter: blur(30px);
          border: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.08)'};
          border-radius: var(--radius-xl); padding: 20px;
          box-shadow: var(--shadow-lg), 0 20px 50px -12px rgba(147,51,234,0.15);
          position: relative; overflow: hidden;
        }
        .lp-sim-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--bg-border); padding-bottom: 14px;
        }
        .lp-sim-chat { display: flex; flex-direction: column; gap: 12px; min-height: 180px; }
        .lp-sim-buttons { margin-top: 18px; }
        .lp-sim-btn-label {
          font-size: 10px; font-weight: 700; color: var(--text-muted);
          margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .lp-sim-btn-list { display: flex; flex-direction: column; gap: 7px; }

        /* ── Stats Bar ── */
        .lp-stats {
          padding: 50px 20px;
          background: ${isLight ? 'rgba(9,9,11,0.02)' : 'rgba(255,255,255,0.01)'};
          border-top: 1px solid var(--bg-border);
          border-bottom: 1px solid var(--bg-border);
          position: relative; z-index: 1;
        }
        .lp-stats-grid {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
        }
        .lp-stat-card {
          text-align: center; padding: 22px 16px; border-radius: var(--radius-lg);
          background: ${isLight ? 'rgba(255,255,255,0.6)' : 'rgba(20,20,24,0.3)'};
          border: 1px solid var(--bg-border); backdrop-filter: blur(10px);
        }
        .lp-stat-value {
          font-size: clamp(22px, 3vw, 36px); font-weight: 800;
          background: linear-gradient(135deg, var(--text-primary), var(--text-secondary));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin-bottom: 4px; font-family: 'Space Grotesk', sans-serif;
        }
        .lp-stat-label { font-size: 12px; font-weight: 700; color: var(--accent-light); margin-bottom: 6px; }
        .lp-stat-sub { font-size: 10px; color: var(--text-muted); line-height: 1.4; }

        /* ── Features ── */
        .lp-features { padding: 100px 20px; display: flex; justify-content: center; position: relative; z-index: 1; }
        .lp-features-inner { max-width: 1200px; width: 100%; }
        .lp-section-title {
          text-align: center; margin-bottom: 64px;
        }
        .lp-h2 {
          font-size: clamp(26px, 4vw, 42px); font-weight: 800; margin-bottom: 14px;
          font-family: 'Space Grotesk', sans-serif;
        }
        .lp-h2-sub { font-size: 15px; color: var(--text-secondary); max-width: 560px; margin-inline: auto; line-height: 1.6; }
        .lp-features-grid {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;
        }
        .lp-feature-card {
          padding: 28px; border-radius: var(--radius-xl);
          background: ${isLight ? 'rgba(255,255,255,0.4)' : 'rgba(20,20,24,0.3)'};
          border: 1px solid ${isLight ? 'rgba(9,9,11,0.06)' : 'rgba(255,255,255,0.06)'};
          backdrop-filter: blur(20px); transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
          cursor: default; display: flex; flex-direction: column; gap: 14px;
        }
        .lp-feature-card:hover {
          transform: translateY(-5px);
          border-color: var(--accent-border);
          box-shadow: 0 12px 30px -10px rgba(147,51,234,0.15);
        }

        /* ── Financials Overview ── */
        .lp-overview { padding: 80px 20px; position: relative; overflow: hidden; z-index: 1; }
        .lp-overview-inner {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr; gap: 64px; align-items: center;
        }
        .lp-overview-panel {
          background: ${isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,24,0.4)'};
          border: 1px solid var(--bg-border); border-radius: var(--radius-xl);
          padding: 24px; backdrop-filter: blur(20px); box-shadow: var(--shadow-lg);
        }

        /* ── CTA ── */
        .lp-cta-section { padding: 60px 20px; position: relative; z-index: 1; }
        .lp-cta-inner {
          max-width: 1200px; margin: 0 auto; padding: 60px 32px;
          background: ${isLight
            ? 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 50%, #9333ea 100%)'
            : 'linear-gradient(135deg, #6d28d9 0%, #1e40af 50%, #7e22ce 100%)'};
          border-radius: 28px; position: relative; overflow: hidden;
          text-align: center; box-shadow: 0 40px 120px -20px rgba(147,51,234,0.35);
        }

        /* ── Footer ── */
        .lp-footer {
          padding: 64px 20px;
          border-top: 1px solid var(--bg-border);
          background: ${isLight ? '#ffffff' : '#000000'};
          position: relative; z-index: 1;
        }
        .lp-footer-inner { max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 48px; }
        .lp-footer-top { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 48px; }
        .lp-footer-links { display: flex; gap: 48px; flex-wrap: wrap; }

        /* ═══════════════════════════
           RESPONSIVE BREAKPOINTS
        ═══════════════════════════ */

        /* Tablet / small laptop */
        @media (max-width: 1024px) {
          .lp-hero-inner { grid-template-columns: 1fr; gap: 40px; }
          .lp-hero-left { text-align: center; }
          .lp-hero-sub { margin-inline: auto; }
          .lp-trust-badges { justify-content: center; }
          .lp-cta-row { justify-content: center; }
          .lp-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .lp-overview-inner { grid-template-columns: 1fr; gap: 40px; }
          .lp-nav-links { display: none; }
        }

        /* Mobile */
        @media (max-width: 640px) {
          .lp-nav { height: 60px; }
          .lp-nav-logo { height: 46px; }
          .lp-login-btn { display: none; }
          .lp-signup-btn { padding: 8px 14px; font-size: 13px; }

          .lp-hero { padding-top: 86px; padding-bottom: 40px; }
          .lp-hero-inner { padding: 0 16px; }
          .lp-h1 { font-size: clamp(28px, 8vw, 40px); letter-spacing: -1px; }
          .lp-hero-badge { padding: 6px 14px; }
          .lp-hero-badge-text { font-size: 10px; letter-spacing: 1.5px; }
          .lp-hero-sub { font-size: 14px; margin-bottom: 28px; }
          .lp-cta-primary { padding: 13px 24px; font-size: 14px; width: 100%; justify-content: center; }
          .lp-cta-secondary { padding: 13px 24px; font-size: 14px; width: 100%; }
          .lp-cta-row { flex-direction: column; }

          .lp-simulator { padding: 16px; }
          .lp-sim-chat { min-height: 150px; }

          .lp-stats { padding: 36px 16px; }
          .lp-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .lp-stat-card { padding: 16px 12px; }
          .lp-stat-value { font-size: clamp(20px, 6vw, 28px); }
          .lp-stat-sub { font-size: 9px; }

          .lp-features { padding: 60px 16px; }
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-section-title { margin-bottom: 40px; }
          .lp-h2 { font-size: clamp(22px, 6vw, 32px); }

          .lp-overview { padding: 50px 16px; }
          .lp-overview-inner { gap: 28px; }
          .lp-overview-panel { padding: 16px; }

          .lp-cta-section { padding: 40px 16px; }
          .lp-cta-inner { padding: 40px 20px; border-radius: 20px; }

          .lp-footer { padding: 48px 16px; }
          .lp-footer-top { flex-direction: column; gap: 32px; }
          .lp-footer-links { gap: 32px; }
        }

        /* Extra small (< 380px) */
        @media (max-width: 380px) {
          .lp-stats-grid { grid-template-columns: 1fr; }
          .lp-h1 { font-size: 26px; }
          .lp-stat-value { font-size: 22px; }
        }
      `}</style>

      <div className="lp-root">
        {/* Background glowing blobs */}
        <div style={{
          position: 'absolute', top: '10%', left: '-10%', width: 400, height: 400,
          background: 'rgba(147,51,234,0.12)', filter: 'blur(120px)', borderRadius: '50%',
          zIndex: 0, pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', top: '45%', right: '-10%', width: 500, height: 500,
          background: 'rgba(59,130,246,0.08)', filter: 'blur(140px)', borderRadius: '50%',
          zIndex: 0, pointerEvents: 'none'
        }} />

        {/* ── Navbar ── */}
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" className="lp-nav-logo" />
            <div className="lp-nav-links">
              <Link to="/features" className="lp-nav-link">Features</Link>
              <Link to="/solutions" className="lp-nav-link">Solutions</Link>
              <Link to="/pricing" className="lp-nav-link">Pricing</Link>
              <Link to="/company" className="lp-nav-link">Company</Link>
            </div>
            <div className="lp-nav-actions">
              <Link to="/login" className="lp-login-btn">Login</Link>
              <Link to="/signup" className="lp-signup-btn">Get Started</Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <header className="lp-hero">
          <div className="lp-hero-inner">
            {/* Left: Value Proposition */}
            <div className="lp-hero-left animate-scaleIn">
              <div className="lp-hero-badge">
                <Sparkles size={13} color="var(--accent-light)" className="animate-float" />
                <span className="lp-hero-badge-text">The Financial Engine Built For Scale</span>
              </div>

              <h1 className="lp-h1">
                The financial OS <br />
                for <span className="lp-h1-grad">high-growth SMEs.</span>
              </h1>

              <p className="lp-hero-sub">
                Autonomous accounting, real-time banking consolidation, and deep conversational insights. Built to scale with your business dynamically, securely, and at near-zero overhead.
              </p>

              <div className="lp-cta-row">
                <Link to="/signup" className="lp-cta-primary">
                  Start for Free <ArrowRight size={17} />
                </Link>
                <a href="#features" style={{ textDecoration: 'none' }}>
                  <button className="lp-cta-secondary">Explore Platform</button>
                </a>
              </div>

              <div className="lp-trust-badges">
                {['Proprietary AI Ledger', 'Direct Bank Sync', 'No Monthly Fees'].map(label => (
                  <div key={label} className="lp-trust-badge">
                    <div className="lp-trust-dot"><Check size={13} /></div>
                    <span className="lp-trust-label">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: AI Simulator */}
            <div className="animate-scaleIn">
              <div className="lp-simulator">
                {/* Simulator Header */}
                <div className="lp-sim-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 9,
                      background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(147,51,234,0.2)'
                    }}>
                      <Sparkles size={15} color="#fff" />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>ROVA AI Co-pilot</div>
                      <div style={{ fontSize: 10, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                        Deployed &amp; Live
                      </div>
                    </div>
                  </div>
                  <div style={{
                    background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                    padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700
                  }}>
                    ROVA AI
                  </div>
                </div>

                {/* Chat Window */}
                <div className="lp-sim-chat">
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      background: 'var(--accent-primary)', color: '#fff',
                      padding: '10px 13px', borderRadius: '16px 16px 4px 16px',
                      fontSize: 12, fontWeight: 500, maxWidth: '88%'
                    }}>
                      {typingText}
                      {isTyping && <span style={{ width: 2, height: 13, background: '#fff', display: 'inline-block', marginLeft: 2, animation: 'pulse 1s infinite' }} />}
                    </div>
                  </div>

                  {simulationResponse && (
                    <div style={{ display: 'flex', gap: 8, animation: 'fadeIn 0.4s ease' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <Sparkles size={10} color="#fff" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: '88%' }}>
                        <div style={{
                          background: isLight ? '#f9f9fb' : 'var(--bg-elevated)',
                          border: '1px solid var(--bg-border)', color: 'var(--text-primary)',
                          padding: '10px 13px', borderRadius: '4px 16px 16px 16px',
                          fontSize: 12, lineHeight: 1.5
                        }}>
                          {simulationResponse.text}
                        </div>

                        {simulationResponse.action && (
                          <div style={{
                            background: 'rgba(147,51,234,0.06)',
                            border: '1px solid rgba(147,51,234,0.18)',
                            borderRadius: 'var(--radius-lg)', padding: 10,
                            animation: 'slideUpFade 0.3s ease'
                          }}>
                            {simulationResponse.action.type === 'metrics' && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>PROJECTED METRIC</div>
                                  <div style={{ fontSize: 12, fontWeight: 700 }}>{simulationResponse.action.value}</div>
                                </div>
                                <div style={{ background: '#10b981', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>Healthy</div>
                              </div>
                            )}
                            {simulationResponse.action.type === 'invoice' && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>CLIENT INVOICE DRAFT</div>
                                  <div style={{ fontSize: 12, fontWeight: 700 }}>{simulationResponse.action.client}</div>
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 800 }}>{simulationResponse.action.amount}</span>
                              </div>
                            )}
                            {simulationResponse.action.type === 'payroll' && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>PAYROLL DISBURSEMENT LINK</div>
                                  <div style={{ fontSize: 12, fontWeight: 700 }}>{simulationResponse.action.employee}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 11, fontWeight: 700 }}>{simulationResponse.action.net}</div>
                                  <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>Net Pay</div>
                                </div>
                              </div>
                            )}
                            <button style={{
                              width: '100%', marginTop: 8, padding: '6px 10px',
                              background: 'var(--accent-primary)', color: '#fff', border: 'none',
                              borderRadius: 7, fontSize: 11, fontWeight: 700,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: 'pointer'
                            }}>
                              {simulationResponse.action.label} <ArrowUpRight size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Simulation Selector */}
                <div className="lp-sim-buttons">
                  <div className="lp-sim-btn-label">Click to Ask ROVA AI</div>
                  <div className="lp-sim-btn-list">
                    {[
                      { key: 'runway', label: 'Check Runway & Burn' },
                      { key: 'invoice', label: 'Draft Client Invoice' },
                      { key: 'payroll', label: 'Process Employee Salary' }
                    ].map((btn) => (
                      <button
                        key={btn.key}
                        onClick={() => !isTyping && setActiveSimulation(btn.key as any)}
                        style={{
                          padding: '9px 13px', borderRadius: 11, fontSize: 12, fontWeight: 600,
                          border: '1px solid',
                          background: activeSimulation === btn.key ? 'rgba(147,51,234,0.1)' : 'rgba(255,255,255,0.02)',
                          borderColor: activeSimulation === btn.key ? 'rgba(147,51,234,0.35)' : 'var(--bg-border)',
                          color: activeSimulation === btn.key ? 'var(--accent-light)' : 'var(--text-secondary)',
                          textAlign: 'left', cursor: isTyping ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                      >
                        <span>{btn.label}</span>
                        <MessageSquare size={12} style={{ opacity: activeSimulation === btn.key ? 1 : 0.4 }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Stats Bar ── */}
        <section className="lp-stats">
          <div className="lp-stats-grid">
            {[
              { label: 'Transaction Capacity', value: '50M+', sub: 'Autonomous pipeline capability' },
              { label: 'Active Businesses Scale', value: '10,000+', sub: 'Optimised PostgreSQL architecture' },
              { label: 'Platform Uptime', value: '99.99%', sub: 'Zero-downtime serverless SLA' },
              { label: 'LLM Gateway Latency', value: '< 250ms', sub: 'Highly indexed Edge Functions' }
            ].map((s, i) => (
              <div key={i} className="lp-stat-card">
                <div className="lp-stat-value">{s.value}</div>
                <div className="lp-stat-label">{s.label}</div>
                <div className="lp-stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="lp-features">
          <div className="lp-features-inner">
            <div className="lp-section-title">
              <h2 className="lp-h2">Features engineered for massive operations</h2>
              <p className="lp-h2-sub">All components are housed in a unified, secured double-entry ledger to drive business intelligence.</p>
            </div>

            <div className="lp-features-grid">
              {[
                {
                  title: 'Secure Bank Sync',
                  desc: 'Consolidate multiple financial accounts globally in one dashboard. Exchanged bank tokens support secure real-time bank statement synchronisation.',
                  icon: <Globe size={20} color="#3b82f6" />, badge: "Open Banking Sync"
                },
                {
                  title: 'ROVA Autonomous Classifier',
                  desc: 'Raw bank descriptions are fed into the proprietary AI engine. It extracts intents (salaries, stock purchase, invoices) with strict confidence validation.',
                  icon: <Zap size={20} color="#a855f7" />, badge: "AI Categorization"
                },
                {
                  title: 'Double-Entry Bookkeeping Ledger',
                  desc: 'GAAP-compliant financial records. Each transaction auto-generates balanced double-entry ledger rows, updating cash flow, balance sheets & Trial Balance.',
                  icon: <Calculator size={20} color="#10b981" />, badge: "GAAP Compliant"
                },
                {
                  title: 'Payroll & Statutory Deductions',
                  desc: 'Run payroll for team members easily. Compute progressive PAYE income tax brackets (7% to 24%) and automatic pension contribution limits under local rules.',
                  icon: <Users2 size={20} color="#f59e0b" />, badge: "Regulatory Automations"
                },
                {
                  title: 'Tax Compliance Hub',
                  desc: 'Ensure compliance with FIRS guidelines. Track corporate liabilities (CIT, VAT at 7.5%, and CGT at 10%) automatically based on operational transaction books.',
                  icon: <ShieldCheck size={20} color="#ef4444" />, badge: "Tax Reporting"
                },
                {
                  title: 'Connected Inventory & COGS',
                  desc: 'Link stock quantities and SKUs to vendor transaction expenses. Calculates cost of goods sold (COGS) automatically and issues warning notifications.',
                  icon: <BarChart3 size={20} color="var(--accent-primary)" />, badge: "Stock Controller"
                }
              ].map((f, i) => (
                <div key={i} className="lp-feature-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 11,
                      background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {f.icon}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{f.badge}</span>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>{f.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 13 }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Financials Overview ── */}
        <section className="lp-overview">
          <div className="lp-overview-inner">
            <div className="lp-overview-panel animate-float">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Real-time Profit &amp; Loss Ledger</span>
                <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}>
                  <ArrowUpRight size={13} /> +12.4% Net Margin
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Asset Class Accounts Inflow', val: '₦4,850,000', prc: 85, color: '#10b981' },
                  { label: 'Operational Salaries & COGS Outflow', val: '₦1,240,000', prc: 32, color: '#ef4444' },
                  { label: 'Statutory FIRS Tax Reserve', val: '₦363,750', prc: 18, color: '#3b82f6' }
                ].map((stat, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 }}>
                      <span>{stat.label}</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{stat.val}</strong>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-hover)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${stat.prc}%`, height: '100%', background: stat.color, borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 800, marginBottom: 20, lineHeight: 1.15, fontFamily: "'Space Grotesk', sans-serif" }}>
                Consolidated financials. <br />
                <span style={{ background: 'linear-gradient(135deg, var(--accent-light), #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Zero guesswork.
                </span>
              </h2>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 28 }}>
                Connecting bank APIs or transaction emails automatically updates the double-entry accounting lines, managing statements, inventory logs, and FIRS tax files autonomously.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  'Unified multi-bank accounts tracking in one centralised hub',
                  'FIRS tax filing compliance records (VAT, PIT/PAYE, CIT)',
                  'AI Intent Handler: updates catalogs, payroll runs and invoices',
                  'Designed for rapid, zero-overhead business scale'
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
                    <CheckCircle2 size={17} color="#10b981" style={{ flexShrink: 0 }} /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="lp-cta-section">
          <div className="lp-cta-inner">
            <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, background: 'rgba(255,255,255,0.06)', borderRadius: '50%', filter: 'blur(30px)' }} />
            <div style={{ position: 'absolute', bottom: -120, left: -120, width: 380, height: 380, background: 'rgba(0,0,0,0.12)', borderRadius: '50%', filter: 'blur(35px)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h2 style={{ fontSize: 'clamp(26px, 5vw, 52px)', fontWeight: 800, color: '#fff', marginBottom: 16, lineHeight: 1.1, letterSpacing: '-1px', fontFamily: "'Space Grotesk', sans-serif" }}>
                Scale your business financials today.
              </h2>
              <p style={{ fontSize: 'clamp(14px, 1.6vw, 18px)', color: 'rgba(255,255,255,0.92)', marginBottom: 36, maxWidth: 580, marginInline: 'auto', fontWeight: 500, lineHeight: 1.65 }}>
                Join forward-thinking businesses and founders driving scale on ROVA. Connect banking APIs and automate your financial records.
              </p>
              <Link to="/signup" style={{
                textDecoration: 'none', background: '#fff', color: '#7c3aed',
                padding: '14px 40px', fontSize: 15, fontWeight: 800, borderRadius: 'var(--radius-lg)',
                boxShadow: '0 8px 20px rgba(0,0,0,0.06)', display: 'inline-flex', alignItems: 'center', transition: 'transform 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                Get Started for Free
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="lp-footer">
          <div className="lp-footer-inner">
            <div className="lp-footer-top">
              <div style={{ maxWidth: 340 }}>
                <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" style={{ height: 52, marginBottom: 18 }} />
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 14, marginBottom: 20 }}>
                  The intelligent financial operating system for African SMEs.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="email"
                    placeholder="Join our newsletter"
                    style={{
                      flex: 1, padding: '10px 13px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--bg-border)',
                      background: isLight ? '#f9f9f9' : 'rgba(255,255,255,0.02)',
                      color: 'var(--text-primary)', fontSize: 13, minWidth: 0
                    }}
                  />
                  <Button variant="primary" style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', fontSize: 13, flexShrink: 0 }}>Join</Button>
                </div>
              </div>

              <div className="lp-footer-links">
                {[
                  { title: 'Solutions', items: ['Banking', 'Accounting', 'Payroll', 'Invoicing', 'Tax Compliance'] },
                  { title: 'Resources', items: ['Documentation', 'Help Center', 'Blog', 'API Status', 'Security'] },
                  { title: 'Company', items: ['About Us', 'Contact', 'Privacy', 'Terms'] },
                ].map(col => (
                  <div key={col.title}>
                    <h4 style={{ fontWeight: 800, marginBottom: 20, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{col.title}</h4>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                      {col.items.map(item => {
                        const isRouterLink = item === 'Privacy' || item === 'Terms' || item === 'About Us' || col.title === 'Solutions';
                        let path = '#';
                        if (item === 'Privacy') path = '/privacy';
                        else if (item === 'Terms') path = '/terms';
                        else if (item === 'About Us') path = '/company';
                        else if (col.title === 'Solutions') path = '/solutions';

                        return (
                          <li key={item}>
                            {isRouterLink
                              ? <Link to={path} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>{item}</Link>
                              : <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}>{item}</a>
                            }
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ paddingTop: 28, borderTop: '1px solid var(--bg-border)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>© 2026 ROVA Business. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
