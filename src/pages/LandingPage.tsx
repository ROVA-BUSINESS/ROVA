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
  ChevronRight
} from 'lucide-react';
import Button from '../components/ui/Button';

// --- Sub-component: Floating Product Fragments ---
const FloatingMockups = ({ isLight }: { isLight: boolean }) => (
  <div style={{ position: 'relative', width: '100%', height: 600, overflow: 'hidden' }}>
    {/* Main "Dashboard" Central Piece */}
    <div className="animate-float" style={{
      position: 'absolute', top: '15%', left: '10%', right: '10%', height: 400,
      background: isLight ? '#fff' : 'rgba(255,255,255,0.03)',
      borderRadius: 32, border: '1px solid', borderColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.1)',
      boxShadow: '0 40px 100px -20px rgba(0,0,0,0.15)',
      padding: 32, backdropFilter: 'blur(10px)', zIndex: 5
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ width: 120, height: 12, background: 'var(--bg-border)', borderRadius: 6 }} />
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-border)' }} />
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-border)' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
        {[
          { label: 'Revenue', value: '₦4.2M', color: '#10b981', icon: <BarChart3 size={12} /> },
          { label: 'Expenses', value: '₦1.8M', color: '#ef4444', icon: <Activity size={12} /> },
          { label: 'Balance', value: '₦2.4M', color: '#3b82f6', icon: <ShieldCheck size={12} /> }
        ].map((item, i) => (
          <div key={i} style={{ 
            padding: 16, background: 'rgba(0,0,0,0.02)', borderRadius: 16, border: '1px solid var(--bg-border)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center'
          }}>
            <div style={{ color: item.color, marginBottom: 8 }}>{item.icon}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{ 
        marginTop: 32, height: 120, background: 'rgba(147,51,234,0.03)', borderRadius: 16, border: '1px solid rgba(147,51,234,0.1)',
        padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12
      }}>
        <div style={{ width: '60%', height: 8, background: 'var(--bg-border)', borderRadius: 4 }} />
        <div style={{ width: '80%', height: 8, background: 'var(--bg-border)', borderRadius: 4 }} />
        <div style={{ width: '40%', height: 8, background: 'var(--accent-primary)', opacity: 0.3, borderRadius: 4 }} />
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
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Button variant="ghost" style={{ fontSize: 14, fontWeight: 600 }}>Login</Button>
              </Link>
              <Link to="/signup" style={{ textDecoration: 'none' }}>
                <Button variant="primary" style={{ fontSize: 14, fontWeight: 600, padding: '10px 20px', borderRadius: 10 }}>Get Started</Button>
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
          
          <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 24, letterSpacing: '-2px' }}>
            One platform. All your <br />
            <span style={{ 
              background: 'linear-gradient(135deg, #9333ea, #3b82f6)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>business finances.</span>
          </h1>
          
          <p style={{ fontSize: 'clamp(18px, 2vw, 22px)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 48, maxWidth: 700, marginInline: 'auto' }}>
            Connect your banks, automate your accounting, and manage payroll in one unified workspace. Built for modern African businesses.
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <Link to="/signup" style={{ textDecoration: 'none' }}>
              <Button variant="primary" style={{ padding: '16px 32px', fontSize: 18, fontWeight: 700, borderRadius: 14 }}>
                Get Started for Free <ArrowRight size={20} style={{ marginLeft: 12 }} />
              </Button>
            </Link>
            <Button variant="outline" style={{ padding: '16px 32px', fontSize: 18, fontWeight: 700, borderRadius: 14 }}>
              Book a Demo
            </Button>
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
      <section style={{ padding: '80px 24px', background: 'rgba(147,51,234,0.03)', borderY: '1px solid var(--bg-border)' }}>
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
                
                {/* Orbital Metrics - Adjusted for containment */}
                {[
                  { label: 'Bank Sync', icon: <Globe size={16} />, pos: { top: -40, left: -40 } },
                  { label: 'Tax Auto', icon: <Calculator size={16} />, pos: { top: -40, right: -40 } },
                  { label: 'Live P&L', icon: <TrendingUp size={16} />, pos: { bottom: -40, left: -40 } },
                  { label: 'ROVA AI', icon: <Zap size={16} />, pos: { bottom: -40, right: -40 } },
                  { label: 'Smart Insights', icon: <Activity size={16} />, pos: { top: 120, right: -20 } }
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
                Stop flying blind. ROVA gives you a 360-degree view of your entire financial ecosystem, powered by advanced AI and real-time data sync.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  'Unified multi-bank visibility in one dashboard',
                  'ROVA AI: Predictive cash flow and smart tax insights',
                  'Automated accounting ledger that never sleeps',
                  'Instant global transaction tracking'
                ].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 600 }}>
                    <CheckCircle2 size={20} color={item.includes('ROVA AI') ? '#f59e0b' : '#10b981'} /> {item}
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
              Join 5,000+ businesses and founders who trust ROVA to manage their financial operations. Start your 14-day free trial today.
            </p>
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/signup" style={{ textDecoration: 'none' }}>
                <Button style={{ background: '#fff', color: '#7c3aed', padding: '20px 56px', fontSize: 20, fontWeight: 800, borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                  Start Free Trial
                </Button>
              </Link>
              <Button variant="ghost" style={{ color: '#fff', fontSize: 18, fontWeight: 700, border: '1px solid rgba(255,255,255,0.3)', borderRadius: 16, padding: '18px 32px' }}>
                View All Features
              </Button>
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
      </footer>
    </div>
  );
}
