import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { ShieldCheck, Mail, ArrowLeft, Calendar, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function TermsOfServicePage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const sections = [
    { id: 'agreement', label: '1. Agreement to Terms' },
    { id: 'eligibility', label: '2. Eligibility & Accounts' },
    { id: 'integrations', label: '3. OAuth & Bank Integrations' },
    { id: 'conduct', label: '4. Acceptable Conduct' },
    { id: 'pricing', label: '5. Fees & Commission Models' },
    { id: 'ip', label: '6. Proprietary Rights' },
    { id: 'disclaimer', label: '7. Financial & Advisor Disclaimers' },
    { id: 'limitation', label: '8. Limitation of Liability' },
    { id: 'termination', label: '9. Account Closure' },
    { id: 'jurisdiction', label: '10. Governing Law' }
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
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: 1 }}>Legal Framework</span>
          </div>

          <h1 style={{ fontSize: 'clamp(32px, 4vw, 56px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 16, letterSpacing: '-1.5px' }}>
            Terms of Service
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

            {/* Section 1: Agreement to Terms */}
            <div id="agreement" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                1. Agreement to Terms
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                These Terms of Service ("Terms") constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you", "user", "client") and ROVA Business ("ROVA", "we", "us", or "our"), concerning your access to and use of the ROVA platform and relative bookkeeping/payroll services.
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                Please read these Terms carefully. By accessing or using any part of the Services, you accept, without limitation or qualification, all of the terms and conditions outlined herein. If you do not agree to all of these Terms, you are prohibited from using the Services.
              </p>
            </div>

            {/* Section 2: Eligibility & Accounts */}
            <div id="eligibility" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                2. Eligibility & Account Registration
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                The Services are intended solely for registered small and medium enterprises (SMEs), corporations, and self-employed professionals.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                <p>• <strong>Corporate Authorization:</strong> If you establish an account on behalf of an enterprise, you warrant that you hold explicit legal proxy to bind that corporate body to these Terms.</p>
                <p>• <strong>Accuracy:</strong> You agree to provide true, current, and complete corporate registration and KYC logs, updating them instantly upon any changes.</p>
                <p>• <strong>Security:</strong> You remain strictly responsible for keeping your login credentials confidential and for all administrative actions occurring under your staff portal.</p>
              </div>
            </div>

            {/* Section 3: Integrations & Consents */}
            <div id="integrations" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12, color: 'var(--accent-light)' }}>
                3. OAuth & Bank Synchronization Integrations
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                ROVA utilizes integrations with secure third-party aggregation providers and mail protocols to fulfill its automated features:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ padding: 20, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--bg-border)', borderRadius: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={16} color="var(--accent-primary)" /> A. Bank API Sync (Mono)
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                    By connecting your bank accounts via Mono.co, you grant ROVA a read-only license to fetch and parse transactional listings, history, and balances solely to automate double-entry books and operational charts.
                  </p>
                </div>
                <div style={{ padding: 20, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--bg-border)', borderRadius: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={16} color="var(--accent-primary)" /> B. Google Gmail OAuth Sync
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                    By authorizing Google OAuth, you grant ROVA permissions to access, retrieve, and process emails related to transactional invoices and receipts. You warrant that you have full rights to sync this corporate mailbox.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 4: Acceptable Conduct */}
            <div id="conduct" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                4. Acceptable Conduct
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                You agree not to utilize the ROVA platform for any illicit, fraudulent, or abusive practices, including:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                <p>• Bypassing, disabling, or interfering with security-related components of the system.</p>
                <p>• Providing falsified invoices, tax parameters, or fraudulent payroll calculations.</p>
                <p>• Reverse-engineering, decompiling, or attempting to extract the underlying source code of the ROVA platform or AI assistant.</p>
              </div>
            </div>

            {/* Section 5: Fees & Commission Models */}
            <div id="pricing" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                5. Fees & Commission Models
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                ROVA operates on a premium <strong>commission-based fee structure</strong>:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                <p>• <strong>No Subscriptions:</strong> There are no upfront setup fees or monthly subscription dues.</p>
                <p>• <strong>Processing Fees:</strong> We charge a small, transparent percentage-based commission on payments processed through invoices, payroll transfers, or automated reconciliations as published in our active pricing tables.</p>
              </div>
            </div>

            {/* Section 6: Proprietary Rights */}
            <div id="ip" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                6. Proprietary Rights
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                Except for your corporate transaction logs and synced bank metrics, all software, database architecture, design layouts, logos, copywriting, graphics, and the ROVA AI Assistant engine belong exclusively to ROVA Business and are protected under international copyright and intellectual property treaties.
              </p>
            </div>

            {/* Section 7: Financial & Advisor Disclaimers */}
            <div id="disclaimer" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12, color: '#f59e0b' }}>
                7. Financial & Advisor Disclaimers
              </h2>
              <div style={{
                padding: '24px 20px', background: 'rgba(245, 158, 11, 0.05)',
                border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 16,
                display: 'flex', gap: 16, alignItems: 'flex-start'
              }}>
                <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>Not a Certified Public Accountant (CPA) Service</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                    ROVA is an automated financial operations operating system. Its embedded tools, automated reports, ledger summaries, and AI bookkeeper predictions are designed strictly for administrative efficiency.
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginTop: 8, margin: 0 }}>
                    ROVA **does not** provide certified accounting audits, legal counseling, or official tax preparation services. You are solely responsible for ensuring the accuracy of ledger reporting and tax filings with certified accounting professionals before submitting documents to regulatory bodies.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 8: Limitation of Liability */}
            <div id="limitation" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                8. Limitation of Liability
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                IN NO EVENT WILL ROVA, ITS DIRECTORS, OR ASSOCIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES (INCLUDING BUT NOT LIMITED TO LOST PROFITS, REVENUE DECREASE, DATA INACCURACY, OR BANKING INTERRUPTIONS) ARISING OUT OF YOUR USE OF THE SERVICES, REGARDLESS OF THE LEGAL CLAIM.
              </p>
            </div>

            {/* Section 9: Account Closure */}
            <div id="termination" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                9. Account Closure & Termination
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                We reserve the right to suspend or terminate your portal access at our sole discretion, without liability or prior warning, if you violate these Terms, engage in fraud, or create financial liability risks for the platform.
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                You may close your ROVA account at any time via Settings or by notifying support. Upon termination, all rights granted to you will immediately expire, and read-only integrations (Google/Mono) will be severed.
              </p>
            </div>

            {/* Section 10: Governing Law */}
            <div id="jurisdiction" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
                10. Governing Law & Dispute Resolution
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                These Terms and your use of the platform are governed by and construed in accordance with local commercial regulatory guidelines, without regard to conflict of law principles.
              </p>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15 }}>
                Any claims, controversies, or disputes arising out of these Terms shall first be referred to amicable administrative arbitration prior to escalating to official judicial proceedings.
              </p>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={18} color="var(--accent-primary)" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Email Compliance Team</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>legal@rovabusiness.com</div>
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
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>© 2026 ROVA SOFTWARE LIMITED. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
