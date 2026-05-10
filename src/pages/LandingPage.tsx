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
  TrendingUp,
  DollarSign,
  Activity,
  ChevronRight,
  Layout,
  Sparkles
} from 'lucide-react';
import Button from '../components/ui/Button';

// --- Sub-component: Floating Product Fragments ---
const FloatingMockups = ({ isLight }: { isLight: boolean }) => (
  <div style={{ position: 'relative', width: '100%', height: 600, overflow: 'hidden' }}>
    {/* Main "Dashboard" Central Piece */}
    <div className="animate-float" style={{
      position: 'absolute', top: '15%', left: '10%', right: '10%', height: 'auto', minHeight: 400,
      background: isLight ? '#fff' : 'rgba(20,20,20,0.8)',
      borderRadius: 32, border: '1px solid', borderColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',
      boxShadow: '0 40px 100px -20px rgba(0,0,0,0.2)',
      padding: 32, backdropFilter: 'blur(20px)', zIndex: 5
    }}>
      {/* Dashboard Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layout size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Company Overview</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Updated 2m ago</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-border)', border: '2px solid var(--bg-base)' }} />
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(147,51,234,0.1)', border: '2px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', fontSize: 10, fontWeight: 800 }}>AI</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 32 }}>
        {[
          { label: 'Total Revenue', value: '₦4.2M', trend: '+12.5%', color: '#10b981', icon: <BarChart3 size={14} /> },
          { label: 'Total Expenses', value: '₦1.8M', trend: '-2.4%', color: '#ef4444', icon: <Activity size={14} /> },
          { label: 'Net Balance', value: '₦2.4M', trend: '+8.1%', color: '#3b82f6', icon: <ShieldCheck size={14} /> }
        ].map((item, i) => (
          <div key={i} style={{
            padding: 20, background: isLight ? '#f9f9fb' : 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px solid var(--bg-border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ color: item.color, background: `${item.color}15`, padding: 8, borderRadius: 10 }}>{item.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: item.color }}>{item.trend}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Main Content Area: Chart + Transactions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24 }}>
        {/* Visual Chart Placeholder */}
        <div style={{ padding: 20, background: 'rgba(147,51,234,0.03)', borderRadius: 20, border: '1px solid rgba(147,51,234,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Weekly Performance</div>
            <Sparkles size={14} color="var(--accent-primary)" />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 100, gap: 8 }}>
            {[40, 70, 45, 90, 65, 85, 55].map((h, i) => (
              <div key={i} style={{
                flex: 1, height: `${h}%`, background: i === 3 ? 'var(--accent-primary)' : 'rgba(147,51,234,0.2)',
                borderRadius: '4px 4px 0 0', transition: 'all 0.3s ease'
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            {['M','T','W','T','F','S','S'].map(d => <span key={d} style={{ fontSize: 9, color: 'var(--text-muted)' }}>{d}</span>)}
          </div>
        </div>

        {/* Transactions Mini-list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Recent Activity</div>
          {[
            { name: 'Mono / Bank Sync', amt: '+₦450k', status: 'Success' },
            { name: 'Payroll / Staff', amt: '-₦1.2M', status: 'Pending' },
            { name: 'Invoice #042', amt: '+₦85k', status: 'Success' }
          ].map((t, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--bg-border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                <div style={{ fontSize: 9, color: t.status === 'Success' ? '#10b981' : '#f59e0b' }}>{t.status}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.amt.startsWith('+') ? '#10b981' : 'var(--text-primary)' }}>{t.amt}</div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Floating Bits */}
    <div className="animate-float-delayed" style={{
      position: 'absolute', top: '10%', right: '5%', width: 220, padding: 20,
      background: isLight ? '#fff' : 'rgba(147,51,234,0.1)',
      borderRadius: 20, border: '1px solid rgba(147,51,234,0.2)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)', zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <TrendingUp size={16} color="var(--accent-primary)" />
        <span style={{ fontSize: 12, fontWeight: 700 }}>Growth Insight</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-primary)' }}>+32.4%</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>vs previous month</div>
    </div>

    <div className="animate-float" style={{
      position: 'absolute', bottom: '15%', left: '5%', width: 200, padding: 16,
      background: isLight ? '#fff' : 'rgba(34,197,94,0.1)',
      borderRadius: 20, border: '1px solid rgba(34,197,94,0.2)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.1)', zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DollarSign size={16} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Payment Received</div>
          <div style={{ fontSize: 11, color: '#22c55e' }}>₦1,250,000.00</div>
        </div>
      </div>
    </div>
  </div>
);

export default function LandingPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: 'Inter, system-ui, sans-serif',
      overflowX: 'hidden'
    }}>
      {/* --- Sticky Navbar --- */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 80,
        background: 'rgba(var(--bg-base-rgb), 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--bg-border)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ width: '100%', maxWidth: 1200, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA" style={{ height: 72 }} />

          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            <div className="mobile-hide" style={{ display: 'flex', gap: 24 }}>
              {['Features', 'Solutions', 'Pricing', 'Company'].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`} style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', textDecoration: 'none' }}>{item}</a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link to="/login" style={{
                textDecoration: 'none', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
                padding: '10px 20px', borderRadius: 10, transition: 'all 0.2s', display: 'flex', alignItems: 'center'
              }}>
                Login
              </Link>
              <Link to="/signup" style={{
                textDecoration: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: 14, fontWeight: 600,
                padding: '10px 24px', borderRadius: 10, display: 'flex', alignItems: 'center',
                boxShadow: '0 4px 12px rgba(147,51,234,0.3)'
              }}>
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* --- Hero Section --- */}
      <header style={{
        paddingTop: 120, paddingBottom: 80,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', position: 'relative'
      }}>
        {/* Background Mesh */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', height: 800, background: 'radial-gradient(circle at 50% 20%, rgba(147,51,234,0.08) 0%, transparent 70%)',
          zIndex: 0, pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: 900, padding: '0 24px', position: 'relative', zIndex: 1 }}>
          <div className="animate-scaleIn" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px',
            background: 'rgba(147,51,234,0.1)', borderRadius: 100, marginBottom: 32,
            border: '1px solid rgba(147,51,234,0.3)',
            cursor: 'default'
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', animation: 'pulse 2s infinite' }} />
            <span style={{
              fontSize: 13, fontWeight: 800, color: 'var(--accent-primary)',
              textTransform: 'uppercase', letterSpacing: 2,
              fontFamily: "'Space Grotesk', sans-serif"
            }}>
              The Future of Fintech is Here
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(36px, 5vw, 72px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 24, letterSpacing: '-2px' }}>
            The financial OS for <br />
            <span style={{
              background: 'linear-gradient(135deg, #9333ea, #3b82f6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>ambitious SMEs.</span>
          </h1>

          <p style={{ fontSize: 'clamp(18px, 2vw, 22px)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 48, maxWidth: 800, marginInline: 'auto' }}>
            Consolidate your entire financial ecosystem in one place. No subscription fees, commission-based, and built for seamless scale at near-zero cost.
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <Link to="/signup" style={{
              textDecoration: 'none', background: 'var(--accent-primary)', color: '#fff',
              padding: '16px 32px', fontSize: 18, fontWeight: 700, borderRadius: 14,
              display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 30px rgba(147,51,234,0.3)'
            }}>
              Get Started for Free <ArrowRight size={20} />
            </Link>
            <Link to="/features" style={{ textDecoration: 'none' }}>
              <button style={{
                background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--bg-border)',
                padding: '16px 32px', fontSize: 18, fontWeight: 700, borderRadius: 14, cursor: 'pointer'
              }}>
                Explore Features
              </button>
            </Link>
          </div>

          {/* Interactive Mockup Container */}
          <div style={{ marginTop: 80 }}>
            <FloatingMockups isLight={isLight} />
          </div>
        </div>
      </header>

      {/* --- Features Grid (Advertising) --- */}
      <section id="features" style={{ padding: '100px 24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: 1200, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 80 }}>
            <h2 style={{ fontSize: 40, fontWeight: 800, marginBottom: 16 }}>Everything you need to scale</h2>
            <p style={{ fontSize: 18, color: 'var(--text-secondary)' }}>Powerful tools designed to work together seamlessly.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            {[
              {
                title: 'Unified Banking',
                desc: 'Connect over 50+ Nigerian banks and see all your balances in real-time.',
                icon: <Globe size={24} color="#3b82f6" />
              },
              {
                title: 'Smart Accounting',
                desc: 'Automated ledger entries and real-time P&L statements at your fingertips.',
                icon: <Calculator size={24} color="#9333ea" />
              },
              {
                title: 'Team Management',
                desc: 'Onboard employees, manage roles, and run payroll in minutes.',
                icon: <Users2 size={24} color="#10b981" />
              },
              {
                title: 'Advanced Analytics',
                desc: 'Predictive cash flow insights to help you make better business decisions.',
                icon: <BarChart3 size={24} color="#f59e0b" />
              },
              {
                title: 'Bank-grade Security',
                desc: '256-bit encryption and multi-factor authentication for total peace of mind.',
                icon: <ShieldCheck size={24} color="#ef4444" />
              },
              {
                title: 'Real-time Alerts',
                desc: 'Stay informed with instant notifications for every transaction.',
                icon: <Activity size={24} color="var(--accent-primary)" />
              }
            ].map((f, i) => (
              <div key={i} style={{
                padding: 40, borderRadius: 24, border: '1px solid var(--bg-border)',
                background: 'var(--bg-card)', transition: 'transform 0.3s ease',
                cursor: 'default'
              }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-10px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{f.title}</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
                <Link to="/signup" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24, textDecoration: 'none', color: 'var(--accent-primary)', fontWeight: 600, fontSize: 14 }}>
                  Learn more <ChevronRight size={16} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Trust / Proof Section --- */}
      <section style={{ padding: '80px 24px', background: 'rgba(147,51,234,0.03)', borderTop: '1px solid var(--bg-border)', borderBottom: '1px solid var(--bg-border)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 80 }}>
          {[
            { label: 'Transactions Processed', value: '₦500M+' },
            { label: 'Active Businesses', value: '5,000+' },
            { label: 'Platform Uptime', value: '99.99%' },
            { label: 'Support Response', value: '< 2 mins' }
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>{s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* --- Creative Financial Visibility Section --- */}
      <section style={{ padding: '100px 24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 80, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 400, height: 400, background: 'radial-gradient(circle, rgba(147,51,234,0.1) 0%, transparent 70%)',
                filter: 'blur(40px)', zIndex: 0
              }} />

              {/* Central Visibility Hub Graphic */}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: 120, height: 120, borderRadius: 32, background: 'var(--accent-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 20px 40px rgba(147,51,234,0.4)',
                  animation: 'float 4s ease-in-out infinite'
                }}>
                  <Activity size={48} color="#fff" />
                </div>

                {/* Orbital Metrics - Adjusted for better distribution */}
                {[
                  { label: 'Bank Sync', icon: <Globe size={16} />, pos: { top: -60, left: -80 } },
                  { label: 'Tax Auto', icon: <Calculator size={16} />, pos: { top: -60, right: -80 } },
                  { label: 'Live P&L', icon: <TrendingUp size={16} />, pos: { bottom: -60, left: -80 } },
                  { label: 'ROVA AI', icon: <Zap size={16} />, pos: { bottom: -60, right: -80 } },
                  { label: 'Smart Insights', icon: <Activity size={16} />, pos: { top: 30, right: -120 } }
                ].map((m, i) => (
                  <div key={i} className="animate-float-delayed" style={{
                    position: 'absolute', ...m.pos,
                    padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
                    borderRadius: 16, display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: 'var(--shadow-lg)', zIndex: 2
                  }}>
                    <div style={{ color: m.label === 'ROVA AI' ? '#f59e0b' : 'var(--accent-primary)' }}>{m.icon}</div>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 style={{ fontSize: 48, fontWeight: 800, marginBottom: 24, lineHeight: 1.1 }}>
                Full Financial <br />
                <span style={{ color: 'var(--accent-primary)' }}>Observability.</span>
              </h2>
              <p style={{ fontSize: 18, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
                Stop flying blind. ROVA gives you a 360-degree view of your entire financial ecosystem, powered by an advanced AI assistant that handles the heavy lifting.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  'Unified multi-bank visibility in one dashboard',
                  'AI Assistant: Navigate the app, generate ledgers & full overviews',
                  'Predictive Future: Trends analysis & smart financial advice',
                  'Commission-based scale: No subscription, low cost',
                  'Built for SMBs looking to consolidate operations'
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 600 }}>
                    <CheckCircle2 size={20} color={item.includes('AI') ? '#f59e0b' : '#10b981'} /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* --- Final CTA Section --- */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '100px 40px',
          background: isLight
            ? 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 50%, #9333ea 100%)'
            : 'linear-gradient(135deg, #6d28d9 0%, #1e40af 50%, #7e22ce 100%)',
          borderRadius: 48, position: 'relative', overflow: 'hidden',
          textAlign: 'center', boxShadow: '0 40px 120px -20px rgba(147,51,234,0.4)'
        }}>
          {/* Animated decorative blobs */}
          <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', bottom: -150, left: -150, width: 500, height: 500, background: 'rgba(0,0,0,0.1)', borderRadius: '50%', filter: 'blur(40px)' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, color: '#fff', marginBottom: 24, lineHeight: 1.05, letterSpacing: '-2px' }}>
              Scale your business <br /> without the complexity.
            </h2>
            <p style={{ fontSize: 'clamp(18px, 1.5vw, 22px)', color: 'rgba(255,255,255,0.9)', marginBottom: 48, maxWidth: 640, marginInline: 'auto', fontWeight: 500, lineHeight: 1.6 }}>
              Join 5,000+ businesses and founders who trust ROVA to manage their financial operations. Scale with zero subscription fees today.
            </p>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/signup" style={{
                textDecoration: 'none', background: '#fff', color: '#7c3aed',
                padding: '20px 56px', fontSize: 20, fontWeight: 800, borderRadius: 16,
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center'
              }}>
                Get Started
              </Link>
              <Link to="/features" style={{ textDecoration: 'none' }}>
                <button style={{
                  background: 'transparent', color: '#fff', fontSize: 18, fontWeight: 700,
                  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 16, padding: '18px 32px', cursor: 'pointer'
                }}>
                  View All Features
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- Footer --- */}
      <footer style={{ padding: '120px 24px', borderTop: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'center', background: isLight ? '#ffffff' : '#000000' }}>
        <div style={{ maxWidth: 1200, width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 60 }}>
          <div style={{ maxWidth: 380 }}>
            <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA" style={{ height: 64, marginBottom: 24 }} />
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, fontSize: 16, marginBottom: 32 }}>
              The unified operating system for African business finances. Built for founders, by founders.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <input
                type="email"
                placeholder="Join our newsletter"
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--bg-border)',
                  background: isLight ? '#f9f9f9' : 'rgba(255,255,255,0.03)', color: 'var(--text-primary)'
                }}
              />
              <Button variant="primary" style={{ padding: '12px 20px', borderRadius: 10 }}>Join</Button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 80, flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ fontWeight: 800, marginBottom: 32, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Solutions</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {['Banking', 'Accounting', 'Payroll', 'Invoicing', 'Tax Compliance'].map(item => (
                  <li key={item}><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 style={{ fontWeight: 800, marginBottom: 32, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Resources</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {['Documentation', 'Help Center', 'Blog', 'API Status', 'Security'].map(item => (
                  <li key={item}><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>{item}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 style={{ fontWeight: 800, marginBottom: 32, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>Company</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {['About Us', 'Contact', 'Privacy', 'Terms'].map(item => (
                  <li key={item}><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>{item}</a></li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1200, width: '100%', marginTop: 80, paddingTop: 40, borderTop: '1px solid var(--bg-border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>© 2026 ROVA Business. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
