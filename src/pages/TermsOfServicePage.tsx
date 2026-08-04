import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfServicePage() {
  const navigate = useNavigate();

  const sections = [
    {
      number: '1',
      title: 'Agreement',
      content: (
        <>
          <p>Welcome to ROVA. These Terms of Service ("Terms") govern your access to and use of the ROVA website, mobile applications, APIs, and related services (collectively, the "Services").</p>
          <p style={{ marginTop: 12 }}>By creating an account or using the Services, you agree to these Terms.</p>
          <p style={{ marginTop: 12, fontWeight: 600, color: 'var(--error)' }}>If you do not agree, do not use the Services.</p>
        </>
      ),
    },
    {
      number: '2',
      title: 'Eligibility',
      content: (
        <>
          <p>You must be at least 18 years old or otherwise legally capable of entering into a binding contract to use ROVA.</p>
          <p style={{ marginTop: 12 }}>If you are using ROVA on behalf of a business, you confirm that you are authorized to act on behalf of that business.</p>
        </>
      ),
    },
    {
      number: '3',
      title: 'Our Services',
      content: (
        <>
          <p>ROVA provides software that helps businesses:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {[
              'Record income and expenses',
              'Manage inventory',
              'Create invoices and receipts',
              'Generate accounting reports',
              'Monitor cash flow',
              'Use AI-powered bookkeeping features',
              'Connect with approved third-party financial services',
            ].map(item => (
              <li key={item} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{item}</li>
            ))}
          </ul>
          <p style={{ marginTop: 14, fontWeight: 600, color: 'var(--accent-primary)' }}>
            ROVA provides software tools only. Unless expressly stated, ROVA is not a bank, payment processor, investment adviser, tax adviser, or accounting firm.
          </p>
        </>
      ),
    },
    {
      number: '4',
      title: 'User Accounts',
      content: (
        <>
          <p>You are responsible for:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {[
              'Providing accurate information',
              'Keeping your password secure',
              'Maintaining the confidentiality of your account',
              'Promptly notifying ROVA of unauthorized access',
            ].map(item => (
              <li key={item} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{item}</li>
            ))}
          </ul>
          <p style={{ marginTop: 14 }}>You are responsible for all activity that occurs under your account.</p>
        </>
      ),
    },
    {
      number: '5',
      title: 'Subscription and Payments',
      content: (
        <>
          <p>Some features require a paid subscription. By purchasing a subscription, you authorize the applicable payment provider to charge the selected payment method.</p>
          <p style={{ marginTop: 12 }}>Subscription fees are non-refundable except where required by law or where ROVA expressly states otherwise.</p>
          <p style={{ marginTop: 12 }}>ROVA may change pricing with reasonable notice before the changes take effect.</p>
        </>
      ),
    },
    {
      number: '6',
      title: 'Third-Party Services',
      content: (
        <>
          <p>ROVA integrates with third-party providers such as payment processors, banks, and open banking services. Your use of those services is subject to their own terms and privacy policies.</p>
          <p style={{ marginTop: 12 }}>ROVA is not responsible for the availability, security, or performance of third-party services.</p>
        </>
      ),
    },
    {
      number: '7',
      title: 'AI Features',
      content: (
        <>
          <p>ROVA may use artificial intelligence to categorize transactions, generate reports, summarize financial information, and provide recommendations.</p>
          <p style={{ marginTop: 12 }}>AI-generated outputs are provided for informational purposes and should be reviewed before making financial, legal, or tax decisions.</p>
          <p style={{ marginTop: 12, fontWeight: 600, color: 'var(--accent-primary)' }}>You remain responsible for verifying the accuracy of your records.</p>
        </>
      ),
    },
    {
      number: '8',
      title: 'Acceptable Use',
      content: (
        <>
          <p>You agree not to:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
            {[
              'Use ROVA for unlawful activities.',
              'Upload malicious software.',
              'Attempt unauthorized access to our systems.',
              'Reverse engineer or copy the platform except where permitted by law.',
              "Use the Services to commit fraud or infringe another person's rights.",
            ].map(item => (
              <li key={item} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{item}</li>
            ))}
          </ul>
          <p style={{ marginTop: 14, fontWeight: 600, color: 'var(--error)' }}>
            ROVA may suspend or terminate accounts that violate these Terms.
          </p>
        </>
      ),
    },
    {
      number: '9',
      title: 'Your Data',
      content: (
        <>
          <p>You retain ownership of the information you upload to ROVA.</p>
          <p style={{ marginTop: 12 }}>You grant ROVA a limited license to process, store, and use your data solely to provide, improve, secure, and support the Services.</p>
          <p style={{ marginTop: 12 }}>ROVA will handle personal information in accordance with its <a href="/privacy" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>Privacy Policy</a>.</p>
        </>
      ),
    },
    {
      number: '10',
      title: 'Intellectual Property',
      content: (
        <>
          <p>The ROVA platform, software, trademarks, logos, designs, and content are owned by ROVA Software Ltd. or its licensors and are protected by applicable intellectual property laws.</p>
          <p style={{ marginTop: 12 }}>These Terms do not grant you ownership of ROVA's intellectual property.</p>
        </>
      ),
    },
    {
      number: '11',
      title: 'Service Availability',
      content: (
        <>
          <p>We aim to provide reliable Services but do not guarantee uninterrupted or error-free operation.</p>
          <p style={{ marginTop: 12 }}>We may perform maintenance, upgrades, or emergency work that temporarily affects availability.</p>
        </>
      ),
    },
    {
      number: '12',
      title: 'Disclaimer',
      content: (
        <p>The Services are provided on an "as is" and "as available" basis to the extent permitted by applicable law. ROVA does not guarantee that the Services will meet every business requirement or that all AI-generated results will be error-free.</p>
      ),
    },
    {
      number: '13',
      title: 'Limitation of Liability',
      content: (
        <p>To the maximum extent permitted by law, ROVA Software Ltd., its directors, employees, and partners will not be liable for indirect, incidental, special, consequential, or punitive damages arising from your use of the Services.</p>
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
          📄 Terms of Service
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 12, letterSpacing: '-0.5px' }}>
          ROVA Terms of Service
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Effective Date: <strong>August 4, 2026</strong>
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
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
              <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                {section.content}
              </div>
            </div>
          ))}

          {/* Contact / Footer */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(147,51,234,0.1) 0%, rgba(79,70,229,0.06) 100%)',
            border: '1px solid var(--accent-border)',
            borderRadius: 16,
            padding: '28px 32px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Questions about these Terms? Contact us at:
            </p>
            <a
              href="mailto:Officialrovabusiness@gmail.com"
              style={{
                color: 'var(--accent-primary)', fontWeight: 700, fontSize: 15,
                textDecoration: 'none', display: 'inline-block', marginBottom: 8,
              }}
            >
              📧 Officialrovabusiness@gmail.com
            </a>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>
              ROVA Software Ltd.
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center', marginTop: 48,
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          © 2026 ROVA Software Ltd. All rights reserved. · <a href="/privacy" style={{ color: 'var(--text-muted)' }}>Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
