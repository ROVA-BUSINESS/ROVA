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

  // --- State for Interactive AI Playground Simulation ---
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
    <div style={{
      minHeight: '100vh',
      background: isLight 
        ? 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.03) 0%, #f4f4f5 100%)' 
        : 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.05) 0%, #09090b 100%)',
      color: 'var(--text-primary)',
      fontFamily: 'Inter, system-ui, sans-serif',
      overflowX: 'hidden',
      position: 'relative'
    }}>
      {/* Dynamic Background Glowing Blobs */}
      <div style={{
        position: 'absolute', top: '10%', left: '-10%', width: 500, height: 500,
        background: 'rgba(147,51,234,0.12)', filter: 'blur(120px)', borderRadius: '50%',
        zIndex: 0, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '40%', right: '-10%', width: 600, height: 600,
        background: 'rgba(59,130,246,0.08)', filter: 'blur(140px)', borderRadius: '50%',
        zIndex: 0, pointerEvents: 'none'
      }} />

      {/* --- Sticky Glassmorphic Navbar --- */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 80,
        background: isLight ? 'rgba(244,244,245,0.6)' : 'rgba(9,9,11,0.5)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid',
        borderColor: isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.06)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isLight ? '0 4px 30px rgba(0,0,0,0.02)' : '0 4px 30px rgba(0,0,0,0.2)'
      }}>
        <div style={{ width: '100%', maxWidth: 1200, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" style={{ height: 72, cursor: 'pointer' }} />

          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            <div className="mobile-hide" style={{ display: 'flex', gap: 24 }}>
              {['Features', 'Solutions', 'Pricing', 'Company'].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} style={{
                  fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)',
                  textDecoration: 'none', transition: 'color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                >{item}</a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link to="/login" style={{
                textDecoration: 'none', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
                padding: '10px 20px', borderRadius: 'var(--radius-md)', transition: 'all 0.2s', display: 'flex', alignItems: 'center'
              }}>
                Login
              </Link>
              <Link to="/signup" style={{
                textDecoration: 'none', background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                padding: '10px 24px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center',
                boxShadow: '0 8px 24px rgba(147,51,234,0.3)', transition: 'transform 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <header style={{
        paddingTop: 140, paddingBottom: 80,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        position: 'relative', zIndex: 1
      }}>
        <div style={{ maxWidth: 1200, padding: '0 24px', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 48, alignItems: 'center' }} className="mobile-col">
          {/* Left Column: Heading and Value Proposition */}
          <div style={{ textAlign: 'left' }}>
            <div className="animate-scaleIn" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px',
              background: 'rgba(147,51,234,0.1)', borderRadius: 100, marginBottom: 24,
              border: '1px solid rgba(147,51,234,0.25)',
              cursor: 'default'
            }}>
              <Sparkles size={14} color="var(--accent-light)" className="animate-float" />
              <span style={{
                fontSize: 12, fontWeight: 800, color: 'var(--accent-light)',
                textTransform: 'uppercase', letterSpacing: 2,
                fontFamily: "'Space Grotesk', sans-serif"
              }}>
                The Financial Engine Built For Scale
              </span>
            </div>

            <h1 style={{ 
              fontSize: 'clamp(38px, 4.5vw, 64px)', 
              fontWeight: 800, 
              lineHeight: 1.1, 
              marginBottom: 24, 
              letterSpacing: '-2px',
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              The financial OS <br />
              for <span style={{
                background: 'linear-gradient(135deg, #a855f7, #3b82f6)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
              }}>high-growth SMEs.</span>
            </h1>

            <p style={{ 
              fontSize: 'clamp(16px, 1.8vw, 20px)', 
              color: 'var(--text-secondary)', 
              lineHeight: 1.6, 
              marginBottom: 40,
              maxWidth: 600
            }}>
              Autonomous accounting, real-time banking consolidation, and deep conversational insights. Built to scale with your business dynamically, securely, and at near-zero overhead.
            </p>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Link to="/signup" style={{
                textDecoration: 'none', background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                color: '#fff', padding: '16px 36px', fontSize: 16, fontWeight: 700, borderRadius: 'var(--radius-lg)',
                display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 10px 30px rgba(147,51,234,0.4)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                Start for Free <ArrowRight size={18} />
              </Link>
              <a href="#features" style={{ textDecoration: 'none' }}>
                <button style={{
                  background: isLight ? 'rgba(9,9,11,0.02)' : 'rgba(255,255,255,0.02)', 
                  color: 'var(--text-primary)', 
                  border: '1px solid',
                  borderColor: isLight ? 'rgba(9,9,11,0.1)' : 'rgba(255,255,255,0.1)',
                  padding: '16px 32px', fontSize: 16, fontWeight: 700, borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  Explore Platform
                </button>
              </a>
            </div>

            {/* Micro badges showing technology features */}
            <div style={{ display: 'flex', gap: 24, marginTop: 48, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                  <Check size={14} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Proprietary AI Ledger</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                  <Check size={14} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Direct Bank Sync</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                  <Check size={14} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No Monthly Fees</span>
              </div>
            </div>
          </div>

          {/* Right Column: Premium Glassmorphic AI Chat Simulator Playground */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="animate-scaleIn">
            <div style={{
              background: isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,22,0.55)',
              backdropFilter: 'blur(30px)',
              border: '1px solid',
              borderColor: isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.08)',
              borderRadius: 'var(--radius-xl)',
              padding: 24,
              boxShadow: 'var(--shadow-lg), 0 20px 50px -12px rgba(147,51,234,0.15)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Header inside simulator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--bg-border)', paddingBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(147,51,234,0.2)'
                  }}>
                    <Sparkles size={16} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>ROVA AI Co-pilot</div>
                    <div style={{ fontSize: 10, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} /> Deployed & Live
                    </div>
                  </div>
                </div>
                <div style={{ background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>
                  ROVA AI
                </div>
              </div>

              {/* Chat Window Container */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 210 }}>
                {/* User message simulating input typing */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    padding: '10px 14px',
                    borderRadius: '16px 16px 4px 16px',
                    fontSize: 12.5,
                    fontWeight: 500,
                    maxWidth: '85%'
                  }}>
                    {typingText}
                    {isTyping && <span style={{ width: 2, height: 14, background: '#fff', display: 'inline-block', marginLeft: 2, animation: 'pulse 1s infinite' }} />}
                  </div>
                </div>

                {/* AI response simulated printout */}
                {simulationResponse && (
                  <div style={{ display: 'flex', gap: 8, animation: 'fadeIn 0.4s ease' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <Sparkles size={11} color="#fff" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: '85%' }}>
                      <div style={{
                        background: isLight ? '#f9f9fb' : 'var(--bg-elevated)',
                        border: '1px solid var(--bg-border)',
                        color: 'var(--text-primary)',
                        padding: '12px 14px',
                        borderRadius: '4px 16px 16px 16px',
                        fontSize: 12.5,
                        lineHeight: 1.5
                      }}>
                        {simulationResponse.text}
                      </div>

                      {/* AI Structured Intent Render Output */}
                      {simulationResponse.action && (
                        <div style={{
                          background: 'rgba(147,51,234,0.06)',
                          border: '1px solid rgba(147,51,234,0.18)',
                          borderRadius: 'var(--radius-lg)',
                          padding: 12,
                          animation: 'slideUpFade 0.3s ease'
                        }}>
                          {simulationResponse.action.type === 'metrics' && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PROJECTED METRIC</div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{simulationResponse.action.value}</div>
                              </div>
                              <div style={{ background: '#10b981', color: '#fff', padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700 }}>Healthy</div>
                            </div>
                          )}
                          {simulationResponse.action.type === 'invoice' && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>CLIENT INVOICE DRAFT</div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{simulationResponse.action.client}</div>
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 800 }}>{simulationResponse.action.amount}</span>
                            </div>
                          )}
                          {simulationResponse.action.type === 'payroll' && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>PAYROLL DISBURSEMENT LINK</div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{simulationResponse.action.employee}</div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 11, fontWeight: 700 }}>{simulationResponse.action.net}</div>
                                <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>Net Pay</div>
                              </div>
                            </div>
                          )}
                          <button style={{
                            width: '100%', marginTop: 8, padding: '6px 12px', background: 'var(--accent-primary)',
                            color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer'
                          }}>
                            {simulationResponse.action.label} <ArrowUpRight size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Interaction Simulator Buttons Selector */}
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Click to Ask ROVA AI
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { key: 'runway', label: 'Check Runway & Burn' },
                    { key: 'invoice', label: 'Draft Client Invoice' },
                    { key: 'payroll', label: 'Process Employee Salary' }
                  ].map((btn) => (
                    <button
                      key={btn.key}
                      onClick={() => !isTyping && setActiveSimulation(btn.key as any)}
                      style={{
                        padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                        border: '1px solid',
                        background: activeSimulation === btn.key 
                          ? 'rgba(147,51,234,0.1)' 
                          : 'rgba(255,255,255,0.02)',
                        borderColor: activeSimulation === btn.key 
                          ? 'rgba(147,51,234,0.35)' 
                          : 'var(--bg-border)',
                        color: activeSimulation === btn.key 
                          ? 'var(--accent-light)' 
                          : 'var(--text-secondary)',
                        textAlign: 'left',
                        cursor: isTyping ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{btn.label}</span>
                      <MessageSquare size={13} style={{ opacity: activeSimulation === btn.key ? 1 : 0.4 }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- High Capacity Metrics Section (Requested Upgrades) --- */}
      <section style={{ 
        padding: '60px 24px', 
        background: isLight ? 'rgba(9,9,11,0.02)' : 'rgba(255,255,255,0.01)',
        borderTop: '1px solid var(--bg-border)',
        borderBottom: '1px solid var(--bg-border)',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 32 }} className="mobile-grid-2">
          {[
            { label: 'Transaction Capacity', value: '50M+', sub: 'Autonomous pipeline capability' },
            { label: 'Active Businesses Scale', value: '10,000+', sub: 'Optimized PostgreSQL architecture' },
            { label: 'Platform Uptime', value: '99.99%', sub: 'Zero-downtime serverless SLA' },
            { label: 'LLM Gateway Latency', value: '< 250ms', sub: 'Highly indexed Edge Functions' }
          ].map((s, i) => (
            <div key={i} style={{ 
              textAlign: 'center', 
              padding: 24, 
              borderRadius: 'var(--radius-lg)',
              background: isLight ? 'rgba(255,255,255,0.6)' : 'rgba(20,20,24,0.3)',
              border: '1px solid var(--bg-border)',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ 
                fontSize: 'clamp(24px, 3vw, 36px)', 
                fontWeight: 800, 
                background: 'linear-gradient(135deg, var(--text-primary), var(--text-secondary))',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                marginBottom: 6,
                fontFamily: "'Space Grotesk', sans-serif"
              }} className="mobile-stat-value">{s.value}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-light)', marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* --- Features Grid (Glassmorphism Upgrade) --- */}
      <section id="features" style={{ padding: '120px 24px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1200, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <h2 style={{ fontSize: 40, fontWeight: 800, marginBottom: 16, fontFamily: "'Space Grotesk', sans-serif" }}>Features engineered for massive operations</h2>
            <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 600, marginInline: 'auto' }}>All components are housed in a unified, secured double-entry ledger to drive business intelligence.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {[
              {
                title: 'Secure Bank Sync',
                desc: 'Consolidate multiple financial accounts globally in one dashboard. Exchanged bank tokens support secure real-time bank statement synchronization.',
                icon: <Globe size={20} color="#3b82f6" />,
                badge: "Open Banking Sync"
              },
              {
                title: 'ROVA Autonomous Classifier',
                desc: 'Raw bank descriptions are fed into the proprietary AI engine. It extracts intents (salaries, stock purchase, invoices) with strict confidence validation.',
                icon: <Zap size={20} color="#a855f7" />,
                badge: "AI Categorization"
              },
              {
                title: 'Double-Entry Bookkeeping Ledger',
                desc: 'GAAP-compliant financial records. Each transaction auto-generates balanced double-entry ledger rows, updating cash flow, balance sheets & Trial Balance.',
                icon: <Calculator size={20} color="#10b981" />,
                badge: "GAAP Compliant"
              },
              {
                title: 'Payroll & Statutory Deductions',
                desc: 'Run payroll for team members easily. Compute progress PAYE income tax brackets (7% to 24%) and automatic pension contribution limits under local rules.',
                icon: <Users2 size={20} color="#f59e0b" />,
                badge: "Regulatory Automations"
              },
              {
                title: 'Tax Compliance Hub',
                desc: 'Ensure compliance with FIRS guidelines. Track corporate liabilities (CIT, VAT at 7.5%, and CGT at 10%) automatically based on operational transaction books.',
                icon: <ShieldCheck size={20} color="#ef4444" />,
                badge: "Tax Reporting"
              },
              {
                title: 'Connected Inventory & COGS',
                desc: 'Link stock quantities and SKUs to vendor transaction expenses. Calculates cost of goods sold (COGS) automatically and issues warning notifications.',
                icon: <BarChart3 size={20} color="var(--accent-primary)" />,
                badge: "Stock Controller"
              }
            ].map((f, i) => (
              <div key={i} style={{
                padding: 32, borderRadius: 'var(--radius-xl)', 
                background: isLight ? 'rgba(255,255,255,0.4)' : 'rgba(20,20,24,0.3)',
                border: '1px solid',
                borderColor: isLight ? 'rgba(9,9,11,0.06)' : 'rgba(255,255,255,0.06)',
                backdropFilter: 'blur(20px)',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                cursor: 'default',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }} 
              className="hover-card"
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.borderColor = 'var(--accent-border)';
                e.currentTarget.style.boxShadow = '0 12px 30px -10px rgba(147,51,234,0.15)';
              }} 
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = isLight ? 'rgba(9,9,11,0.06)' : 'rgba(255,255,255,0.06)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {f.icon}
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{f.badge}</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, fontFamily: "'Space Grotesk', sans-serif" }}>{f.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 13.5 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Interactive Data Visualizations Overview Section --- */}
      <section style={{ padding: '100px 24px', position: 'relative', overflow: 'hidden', zIndex: 1 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 80, alignItems: 'center' }} className="mobile-col">
            <div style={{ position: 'relative' }}>
              {/* Glassmorphic simulated overview display panel */}
              <div style={{
                background: isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,24,0.4)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-xl)',
                padding: 24,
                backdropFilter: 'blur(20px)',
                boxShadow: 'var(--shadow-lg)'
              }} className="animate-float">
                {/* Financial Statement Overview Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>Real-time Profit & Loss Ledger</span>
                  <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}>
                    <ArrowUpRight size={14} /> +12.4% Net Margin
                  </div>
                </div>

                {/* Progress bar metrics layout */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {[
                    { label: 'Asset Class Accounts Inflow', val: '₦4,850,000', prc: 85, color: '#10b981' },
                    { label: 'Operational Salaries & COGS Outflow', val: '₦1,240,000', prc: 32, color: '#ef4444' },
                    { label: 'Statutory FIRS Tax Reserve', val: '₦363,750', prc: 18, color: '#3b82f6' }
                  ].map((stat, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
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
            </div>

            <div>
              <h2 style={{ fontSize: 40, fontWeight: 800, marginBottom: 24, lineHeight: 1.1, fontFamily: "'Space Grotesk', sans-serif" }}>
                Consolidated financials. <br />
                <span style={{
                  background: 'linear-gradient(135deg, var(--accent-light), #3b82f6)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                }}>Zero guesswork.</span>
              </h2>
              <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
                Connecting bank APIs or transaction emails automatically updates the double-entry accounting lines, managing statements, inventory logs, and FIRS tax files autonomously.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  'Unified multi-bank accounts tracking in one centralized hub',
                  'FIRS tax filing compliance records (VAT, PIT/PAYE, CIT)',
                  'AI Intent Handler: updates catalogs, payroll runs and invoices',
                  'Designed for rapid, zero-overhead business scale'
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600 }}>
                    <CheckCircle2 size={18} color="#10b981" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* --- Final Call-to-Action Section --- */}
      <section style={{ padding: '80px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '80px 40px',
          background: isLight
            ? 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 50%, #9333ea 100%)'
            : 'linear-gradient(135deg, #6d28d9 0%, #1e40af 50%, #7e22ce 100%)',
          borderRadius: 36, position: 'relative', overflow: 'hidden',
          textAlign: 'center', boxShadow: '0 40px 120px -20px rgba(147,51,234,0.35)'
        }}>
          {/* Internal decorative glass bubbles */}
          <div style={{ position: 'absolute', top: -100, right: -100, width: 350, height: 350, background: 'rgba(255,255,255,0.06)', borderRadius: '50%', filter: 'blur(30px)' }} />
          <div style={{ position: 'absolute', bottom: -150, left: -150, width: 450, height: 450, background: 'rgba(0,0,0,0.12)', borderRadius: '50%', filter: 'blur(35px)' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, color: '#fff', marginBottom: 20, lineHeight: 1.1, letterSpacing: '-1.5px', fontFamily: "'Space Grotesk', sans-serif" }}>
              Scale your business financials today.
            </h2>
            <p style={{ fontSize: 'clamp(16px, 1.6vw, 20px)', color: 'rgba(255,255,255,0.95)', marginBottom: 40, maxWidth: 640, marginInline: 'auto', fontWeight: 500, lineHeight: 1.6 }}>
              Join forward-thinking businesses and founders driving scale on ROVA. Connect banking APIs and automate your financial records.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/signup" style={{
                textDecoration: 'none', background: '#fff', color: '#7c3aed',
                padding: '16px 44px', fontSize: 16, fontWeight: 800, borderRadius: 'var(--radius-lg)',
                boxShadow: '0 8px 20px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', transition: 'transform 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                Get Started for Free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer style={{ padding: '80px 24px', borderTop: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'center', background: isLight ? '#ffffff' : '#000000', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1200, width: '100%', display: 'flex', flexDirection: 'column', gap: 64 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 60 }}>
            <div style={{ maxWidth: 360 }}>
              <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" style={{ height: 60, marginBottom: 20 }} />
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 14.5, marginBottom: 24 }}>
                The intelligent financial operating system for African SMEs.
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="email"
                  placeholder="Join our newsletter"
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)',
                    background: isLight ? '#f9f9f9' : 'rgba(255,255,255,0.02)', color: 'var(--text-primary)', fontSize: 13
                  }}
                />
                <Button variant="primary" style={{ padding: '10px 18px', borderRadius: 'var(--radius-md)', fontSize: 13 }}>Join</Button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
              <div>
                <h4 style={{ fontWeight: 800, marginBottom: 24, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Solutions</h4>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {['Banking', 'Accounting', 'Payroll', 'Invoicing', 'Tax Compliance'].map(item => (
                    <li key={item}><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{item}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ fontWeight: 800, marginBottom: 24, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Resources</h4>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {['Documentation', 'Help Center', 'Blog', 'API Status', 'Security'].map(item => (
                    <li key={item}><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{item}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 style={{ fontWeight: 800, marginBottom: 24, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>Company</h4>
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {['About Us', 'Contact', 'Privacy', 'Terms'].map(item => {
                    const isRouterLink = item === 'Privacy' || item === 'Terms';
                    const targetPath = item === 'Privacy' ? '/privacy' : '/terms';
                    return (
                      <li key={item}>
                        {isRouterLink ? (
                          <Link to={targetPath} style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{item}</Link>
                        ) : (
                          <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 14, fontWeight: 500 }}>{item}</a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
          <div style={{ paddingTop: 32, borderTop: '1px solid var(--bg-border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>© 2026 ROVA Business. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
