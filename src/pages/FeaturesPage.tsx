import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  BarChart3, ShieldCheck, Zap, Globe, Calculator, Users2,
  TrendingUp, Activity, Sparkles, Layout, CreditCard,
  ArrowRight, CheckCircle2, ChevronRight, MessageSquare, LineChart
} from 'lucide-react';
import Button from '../components/ui/Button';

const FeatureCard = ({ icon, title, desc, details }: { icon: React.ReactNode, title: string, desc: string, details: string[] }) => (
  <div style={{
    padding: 40, borderRadius: 24, border: '1px solid var(--bg-border)',
    background: 'var(--bg-card)', position: 'relative', overflow: 'hidden'
  }}>
    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(147,51,234,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
      {icon}
    </div>
    <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>{title}</h3>
    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24, fontSize: 16 }}>{desc}</p>
    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {details.map((d, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--text-muted)' }}>
          <CheckCircle2 size={16} color="#10b981" /> {d}
        </li>
      ))}
    </ul>
  </div>
);

export default function FeaturesPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', overflowX: 'hidden' }}>
      {/* Navigation Re-used */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 80,
        background: 'rgba(var(--bg-base-rgb), 0.8)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--bg-border)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ width: '100%', maxWidth: 1200, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to="/">
            <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA" style={{ height: 56 }} />
          </Link>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link to="/login" style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600, padding: '10px 20px' }}>Login</Link>
            <Link to="/signup" style={{
              textDecoration: 'none', background: 'var(--accent-primary)', color: '#fff', fontSize: 14, fontWeight: 600,
              padding: '10px 24px', borderRadius: 10, boxShadow: '0 4px 12px rgba(147,51,234,0.3)'
            }}>Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <header style={{ paddingTop: 160, paddingBottom: 80, textAlign: 'center', position: 'relative' }}>
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', height: 600, background: 'radial-gradient(circle at 50% 20%, rgba(147,51,234,0.1) 0%, transparent 70%)',
          zIndex: 0, pointerEvents: 'none'
        }} />
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px',
            background: 'rgba(147,51,234,0.1)', borderRadius: 100, marginBottom: 24, border: '1px solid rgba(147,51,234,0.2)'
          }}>
            <Sparkles size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: 1 }}>Platform Features</span>
          </div>
          <h1 style={{ fontSize: 'clamp(40px, 5vw, 64px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 24, letterSpacing: '-2px' }}>
            Built for the <span style={{ color: 'var(--accent-primary)' }}>Modern Business</span>
          </h1>
          <p style={{ fontSize: 20, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 40 }}>
            Every tool you need to run your business finances, integrated into one seamless platform. No complexity, no hidden fees.
          </p>
        </div>
      </header>

      {/* Features Grid */}
      <section style={{ padding: '0 24px 100px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: 1200, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 32 }}>

          <FeatureCard
            icon={<Sparkles size={24} color="#9333ea" />}
            title="Next-Gen AI Assistant"
            desc="Your personal financial controller that lives inside the app. Navigate, analyze, and predict with natural language."
            details={[
              "Voice & Text App Navigation",
              "Future Cash Flow Projections",
              "Smart Financial Advice & Trends",
              "Automated Ledger Generation",
              "Full Business Overview on Demand"
            ]}
          />

          <FeatureCard
            icon={<Globe size={24} color="#3b82f6" />}
            title="Unified Banking"
            desc="Connect all your corporate and personal bank accounts to see a single source of truth."
            details={[
              "Real-time Multi-bank Sync",
              "Direct Transaction Categorization",
              "Historical Data Import",
              "Global Balance Consolidation",
              "Instant Account Verification"
            ]}
          />

          <FeatureCard
            icon={<Calculator size={24} color="#10b981" />}
            title="Smart Accounting"
            desc="Ditch the spreadsheets. ROVA automates your bookkeeping from the moment a transaction occurs."
            details={[
              "Automated Double-entry Ledger",
              "Live Profit & Loss Tracking",
              "Dynamic Balance Sheets",
              "Tax Liability Projections",
              "One-click Financial Audits"
            ]}
          />

          <FeatureCard
            icon={<Receipt size={24} color="#f59e0b" />}
            title="Invoicing & Payments"
            desc="Get paid faster with professional invoicing and integrated payment collection."
            details={[
              "Custom Professional Invoices",
              "Automated Payment Reminders",
              "Direct Bank Transfer Integration",
              "Recurring Billing & Subscriptions",
              "Instant Payment Confirmation"
            ]}
          />

          <FeatureCard
            icon={<Users2 size={24} color="#ef4444" />}
            title="Payroll & Teams"
            desc="Manage your workforce and their access to sensitive financial data with surgical precision."
            details={[
              "Automated Monthly Payroll",
              "Team Role-based Access Control",
              "Expense Reimbursement Flow",
              "Staff Visibility Thresholds",
              "Employee Self-service Portal"
            ]}
          />

          <FeatureCard
            icon={<ShieldCheck size={24} color="#10b981" />}
            title="Security & Compliance"
            desc="Your data is protected by the same security standards used by global financial institutions."
            details={[
              "Bank-grade 256-bit Encryption",
              "Multi-factor Authentication (MFA)",
              "Regular Security Audits",
              "Automated Data Backups",
              "GDPR & Local Data Compliance"
            ]}
          />
        </div>
      </section>

      {/* Pricing Section (Advertisement) */}
      <section style={{ padding: '100px 24px', background: 'rgba(147,51,234,0.03)', borderTop: '1px solid var(--bg-border)', textAlign: 'center' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, marginBottom: 24 }}>Simple, Commission-Based Pricing</h2>
          <p style={{ fontSize: 20, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 40 }}>
            No monthly subscription fees. No setup costs. We only win when you grow. Pay a tiny commission only on what you process.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <Link to="/signup" style={{
              textDecoration: 'none', background: 'var(--accent-primary)', color: '#fff',
              padding: '16px 40px', fontSize: 18, fontWeight: 700, borderRadius: 14, boxShadow: '0 10px 30px rgba(147,51,234,0.3)'
            }}>Join ROVA Today</Link>
          </div>
        </div>
      </section>

      {/* Simple Footer Re-used */}
      <footer style={{ padding: '80px 24px', borderTop: '1px solid var(--bg-border)', textAlign: 'center' }}>
        <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA" style={{ height: 40, marginBottom: 24 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>© 2026 ROVA Business. All rights reserved.</p>
      </footer>
    </div>
  );
}

// Simple Receipt icon replacement since it was missing in imports
const Receipt = ({ size, color }: { size: number, color: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
    <path d="M12 17.5V6.5" />
  </svg>
);
