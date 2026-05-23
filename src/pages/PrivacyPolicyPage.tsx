import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { ShieldCheck, Mail, ArrowLeft, Calendar, FileText, CheckCircle2, Lock } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const sections = [
    { id: 'introduction', label: '1. Introduction' },
    { id: 'collection', label: '2. Information We Collect' },
    { id: 'google-disclosure', label: '3. Google API & OAuth Disclosures' },
    { id: 'mono-disclosure', label: '4. Bank Sync Disclosures' },
    { id: 'use-of-data', label: '5. How We Use Your Data' },
    { id: 'sharing', label: '6. Data Sharing & Third Parties' },
    { id: 'security', label: '7. Data Security' },
    { id: 'rights', label: '8. Your Choices & Rights' },
    { id: 'contact', label: '9. Contact Us' }
  ];

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
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" style={{ height: 56 }} />
          </Link>

          <Link to="/" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600,
            padding: '10px 16px', borderRadius: 10, transition: 'all 0.2s',
            border: '1px solid var(--bg-border)', background: 'var(--bg-card)'
          }}>
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </nav>

      {/* --- Hero Header Section --- */}
      <header style={{
        paddingTop: 160, paddingBottom: 60,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', position: 'relative'
      }}>
        {/* Background Mesh Overlay */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', height: 500, background: 'radial-gradient(circle at 50% 20%, rgba(147,51,234,0.08) 0%, transparent 70%)',
          zIndex: 0, pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: 800, padding: '0 24px', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px',
            background: 'rgba(147,51,234,0.1)', borderRadius: 100, marginBottom: 24,
            border: '1px solid rgba(147,51,234,0.2)'
          }}>
            <ShieldCheck size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: 1 }}>Trust & Safety</span>
          </div>

          <h1 style={{ fontSize: 'clamp(32px, 4vw, 56px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 16, letterSpacing: '-1.5px' }}>
            Privacy Policy
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, color: 'var(--text-muted)', fontSize: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} /> Last Updated: May 23, 2026
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={14} /> Version 1.0.0
            </span>
          </div>
        </div>
      </header>

      {/* --- Main Content Section --- */}
      <section style={{ padding: '0 24px 120px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          maxWidth: 1200, width: '100%',
          display: 'grid', gridTemplateColumns: '280px 1fr', gap: 48,
          alignItems: 'start'
        }} className="mobile-grid-1">
          
          {/* Quick Index Sidebar (Sticky) */}
          <aside className="mobile-hide" style={{
            position: 'sticky', top: 110,
            background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
            borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 16
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Sections
            </div>
            {sections.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                style={{
                  fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)',
                  textDecoration: 'none', transition: 'color 0.2s',
                  display: 'block', lineHeight: 1.4
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-light)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                {s.label}
              </a>
            ))}
          </aside>

          {/* Legal Text Area */}
          <main style={{
            background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
            borderRadius: 28, padding: '48px 40px',
            boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: 40
          }} className="mobile-p-4">
            
            {/* Section 1: Introduction */}
            <div id="introduction" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                1. Introduction
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                Welcome to ROVA ("ROVA", "we", "our", or "us"). We are committed to protecting your business and personal data. This Privacy Policy explain how we collect, use, share, and protect your information when you use our financial operating system, including our web portal, mobile application, bank synchronization features, and integrations with third-party software ("Services").
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                By accessing or using the Services, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree to the terms herein, please do not use the Services.
              </p>
            </div>

            {/* Section 2: Information We Collect */}
            <div id="collection" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                2. Information We Collect
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                We collect several different types of information to provide and improve our Services, ensure transaction security, and maintain regulatory compliance.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                <div style={{ padding: 20, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--bg-border)', borderRadius: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Lock size={16} color="var(--accent-primary)" /> A. Personal & Registration Data
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                    Full name, corporate email address, password, physical business address, phone number, corporate tax identification numbers (TIN), and verification documents to fulfill legally mandated Know-Your-Customer (KYC) requirements.
                  </p>
                </div>
                <div style={{ padding: 20, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--bg-border)', borderRadius: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={16} color="var(--accent-primary)" /> B. Financial Operations Data
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                    Bank account details, ledger entries, records of invoices raised or paid, payroll registers (names, bank coordinates, and salaries of employees), and vendor receipt documents uploaded directly or fetched via integrations.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Google API & OAuth Disclosures */}
            <div id="google-disclosure" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12, color: '#f59e0b' }}>
                3. Google API & OAuth Disclosures
              </h2>
              <div style={{
                padding: '24px 20px', background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 16,
                display: 'flex', flexDirection: 'column', gap: 14
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b', margin: 0 }}>
                  Gmail OAuth Synchronization Scopes & Security
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                  ROVA offers an optional feature that synchronizes with your Google account via OAuth. By linking your Google Account, you grant ROVA permission to read emails matching specific transaction patterns (such as receipt conformations, bank alerts, and invoices) from your designated corporate mailbox.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <CheckCircle2 size={16} color="#f59e0b" style={{ marginTop: 3, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                      <strong>Minimal Scope Access:</strong> We request the minimum OAuth scopes necessary to locate transaction alerts and attachment invoices.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <CheckCircle2 size={16} color="#f59e0b" style={{ marginTop: 3, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                      <strong>Limited Use Compliance:</strong> ROVA's use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy#key-requirements" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)', textDecoration: 'underline' }}>Google API Services User Data Policy</a>, including the Limited Use requirements.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <CheckCircle2 size={16} color="#f59e0b" style={{ marginTop: 3, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                      <strong>No Third-Party Distribution:</strong> We strictly do not share, sell, or rent any data fetched from Google APIs with marketing channels, ad networks, or data brokers.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <CheckCircle2 size={16} color="#f59e0b" style={{ marginTop: 3, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                      <strong>Revocability:</strong> You can completely disconnect your Google Account inside the settings panel of the ROVA app or revoke access directly via Google's Third-party Apps permissions page at any time.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Bank Sync Disclosures */}
            <div id="mono-disclosure" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                4. Bank Sync Disclosures (Mono Integration)
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                To display a unified operational dashboard, ROVA integrates with bank aggregation protocols (such as Mono.co).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 12 }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
                  • <strong>Read-Only Transaction Pulls:</strong> Bank credentials are never saved or stored directly by ROVA. All connections are routed through the secure, licensed aggregation partner (Mono), which provides read-only token keys.
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>
                  • <strong>Bookkeeping Automation:</strong> Synced banking data is solely used to automate double-entry bookkeeping ledger logs, map profit and loss charts, and flag pending invoices.
                </p>
              </div>
            </div>

            {/* Section 5: How We Use Your Data */}
            <div id="use-of-data" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                5. How We Use Your Data
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                ROVA utilizes your collected operational information solely to power business productivity:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }} className="mobile-grid-1">
                {[
                  { title: 'Core Functionality', desc: 'To compile balances, generate financial ledger updates, and run monthly team payroll registers.' },
                  { title: 'AI Bookkeeper Assistant', desc: 'To provide conversational data extraction (e.g. asking the assistant for transaction digests).' },
                  { title: 'Security & Compliance', desc: 'To detect fraudulent bank activity, enforce MFA protection, and satisfy statutory tax reports.' },
                  { title: 'Support & Communication', desc: 'To dispatch critical platform invoices, account warnings, and security verification links.' }
                ].map((item, idx) => (
                  <div key={idx} style={{ padding: 18, border: '1px solid var(--bg-border)', background: 'rgba(255,255,255,0.01)', borderRadius: 14 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: 'var(--accent-light)' }}>{item.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 6: Data Sharing & Third Parties */}
            <div id="sharing" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                6. Data Sharing & Third Parties
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                We believe your financial data belongs strictly to you. We do not sell or lease your business or customer records. We only share data with essential third parties under rigid privacy conditions:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                <p>• <strong>Cloud Infrastructure:</strong> Core database and media assets are stored via secure, ISO-certified hosting servers (e.g. Supabase, AWS).</p>
                <p>• <strong>Legal Demands:</strong> In exceptionally rare cases, where mandated by governing authorities under court order or valid statutory compliance laws.</p>
                <p>• <strong>Business Consolidation:</strong> In the event of a merger, acquisition, or sale of assets, standard commercial privacy covenants continue to govern all user records.</p>
              </div>
            </div>

            {/* Section 7: Data Security */}
            <div id="security" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                7. Data Security
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                ROVA utilizes bank-grade defensive protocols to ensure files and transaction database records are highly guarded.
              </p>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: 20, background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 16 }}>
                <Lock size={20} color="var(--success)" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>End-to-End Encryption Standards</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                    We encrypt all database records in transit utilizing Transport Layer Security (TLS 1.3) and at rest utilizing Advanced Encryption Standard (AES-256). Customer accounts are fully isolated to ensure access only by authorized team administrators.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 8: Your Choices & Rights */}
            <div id="rights" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                8. Your Choices & Rights
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                You control how your enterprise coordinates its profile and syncs statements:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                <p>• <strong>Export:</strong> Download ledger books, spreadsheets, and tax assessments directly from the in-app reporting boards.</p>
                <p>• <strong>Revocation:</strong> De-link Google accounts or specific bank syncing pipelines directly under Settings.</p>
                <p>• <strong>Account Erasure:</strong> Request the termination of your client account and erasure of all associated database entries by sending an instruction to our privacy team.</p>
              </div>
            </div>

            {/* Section 9: Contact Us */}
            <div id="contact" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                9. Contact Us
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                If you have questions regarding this Privacy Policy or ROVA's data-security processes, feel free to contact us:
              </p>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={18} color="var(--accent-primary)" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Email Privacy Desk</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>privacy@rova.co</div>
                </div>
              </div>
            </div>

          </main>

        </div>
      </section>

      {/* --- Footer --- */}
      <footer style={{ padding: '80px 24px', borderTop: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'center', background: isLight ? '#ffffff' : '#000000' }}>
        <div style={{ maxWidth: 1200, width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
          <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA" style={{ height: 48 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>© 2026 ROVA Business. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
