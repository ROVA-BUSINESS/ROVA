import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();

  const sections = [
    {
      number: '1',
      title: 'Introduction',
      content: (
        <>
          <p>Welcome to ROVA. ROVA is an AI-powered accounting and business management platform designed to help businesses manage invoices, inventory, expenses, payments, and financial records.</p>
          <p style={{ marginTop: 12 }}>Your privacy is important to us. This Privacy Policy explains how we collect, use, store, and protect your information.</p>
        </>
      ),
    },
    {
      number: '2',
      title: 'Information We Collect',
      content: (
        <>
          <p>We may collect:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {[
              'Full name', 'Email address', 'Phone number', 'Business name', 'Business address',
              'User account credentials', 'Accounting records', 'Sales and purchase transactions',
              'Inventory information', 'Invoice and receipt data', 'Device information',
              'IP address', 'Browser information', 'Usage analytics',
            ].map(item => (
              <li key={item} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{item}</li>
            ))}
          </ul>
          <p style={{ marginTop: 14 }}>With your permission, we may also receive financial transaction information through secure third-party providers such as open banking services.</p>
          <p style={{ marginTop: 10, fontWeight: 600, color: 'var(--accent-primary)' }}>ROVA does not collect your online banking passwords.</p>
        </>
      ),
    },
    {
      number: '3',
      title: 'How We Use Your Information',
      content: (
        <>
          <p>We use your information to:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {[
              'Create and manage your account',
              'Generate invoices and receipts',
              'Maintain accounting records',
              'Produce financial reports',
              'Provide AI-powered bookkeeping assistance',
              'Improve our services',
              'Prevent fraud',
              'Protect user accounts',
              'Comply with legal obligations',
            ].map(item => (
              <li key={item} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{item}</li>
            ))}
          </ul>
        </>
      ),
    },
    {
      number: '4',
      title: 'Sharing Information',
      content: (
        <>
          <p style={{ fontWeight: 600 }}>We do not sell your personal information.</p>
          <p style={{ marginTop: 10 }}>We may share information with:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {[
              'Payment service providers',
              'Banking integration partners',
              'Cloud hosting providers',
              'Analytics providers',
              'Government authorities where legally required',
            ].map(item => (
              <li key={item} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{item}</li>
            ))}
          </ul>
          <p style={{ marginTop: 12 }}>All partners are expected to maintain appropriate security standards.</p>
        </>
      ),
    },
    {
      number: '5',
      title: 'Data Security',
      content: (
        <>
          <p>We use reasonable technical and organizational measures to protect your information, including:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {[
              'Encryption where appropriate',
              'Secure authentication',
              'Access controls',
              'Secure cloud infrastructure',
              'Continuous monitoring',
            ].map(item => (
              <li key={item} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{item}</li>
            ))}
          </ul>
          <p style={{ marginTop: 12 }}>No system is completely secure, but we continuously improve our security practices.</p>
        </>
      ),
    },
    {
      number: '6',
      title: 'Data Retention',
      content: (
        <p>We retain your information only as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements.</p>
      ),
    },
    {
      number: '7',
      title: 'Your Rights',
      content: (
        <>
          <p>Depending on applicable law, you may have the right to:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {[
              'Access your information',
              'Correct inaccurate information',
              'Request deletion of your information',
              'Withdraw consent where applicable',
              'Request a copy of your data',
            ].map(item => (
              <li key={item} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{item}</li>
            ))}
          </ul>
        </>
      ),
    },
    {
      number: '8',
      title: 'Cookies',
      content: (
        <p>ROVA uses cookies and similar technologies to improve user experience, maintain secure sessions, analyze website performance, and remember preferences.</p>
      ),
    },
    {
      number: '9',
      title: "Children's Privacy",
      content: (
        <p>ROVA is intended for businesses and individuals who are legally permitted to use our services. We do not knowingly collect personal information from children.</p>
      ),
    },
    {
      number: '10',
      title: 'Changes to this Policy',
      content: (
        <p>We may update this Privacy Policy from time to time. Significant changes will be communicated through our website or application.</p>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--bg-border)',
        background: 'var(--bg-card)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500,
              padding: '6px 12px', borderRadius: 8,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/rova.png" alt="ROVA" style={{ height: 28 }} />
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>ROVA</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(147,51,234,0.12) 0%, rgba(79,70,229,0.08) 100%)',
        borderBottom: '1px solid var(--bg-border)',
        padding: '60px 24px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
          borderRadius: 100, padding: '6px 16px', marginBottom: 20, fontSize: 12,
          fontWeight: 600, color: 'var(--accent-primary)',
        }}>
          🔒 Privacy Policy
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.5px' }}>
          ROVA Privacy Policy
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Effective Date: <strong>August 4, 2026</strong>
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          {sections.map(section => (
            <div key={section.number} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--bg-border)',
              borderRadius: 16,
              padding: '28px 32px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: 'var(--accent-primary)', flexShrink: 0,
                }}>
                  {section.number}
                </div>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                  {section.title}
                </h2>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-secondary)' }}>
                {section.content}
              </div>
            </div>
          ))}

          {/* Contact Section */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(147,51,234,0.1) 0%, rgba(79,70,229,0.06) 100%)',
            border: '1px solid var(--accent-border)',
            borderRadius: 16,
            padding: '28px 32px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, color: 'var(--accent-primary)', flexShrink: 0,
              }}>
                11
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Contact Us</h2>
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 20 }}>
              If you have questions about this Privacy Policy or our handling of personal information, contact us at:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a
                href="mailto:Officialrovabusiness@gmail.com"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  color: 'var(--accent-primary)', fontWeight: 700, fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                📧 Officialrovabusiness@gmail.com
              </a>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
                ROVA Software Ltd.
              </p>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center', marginTop: 48,
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          © 2026 ROVA Software Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
