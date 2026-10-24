import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowDown,
  Menu,
  X,
  Receipt,
  TrendingUp,
  TrendingDown,
  Bot,
  Bell,
  Search,
  Sun,
  Plus,
  Wifi,
} from 'lucide-react';
import './LandingPage.css';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="site-frame">
      {/* ── Site Header ── */}
      <header className="site-header">
        <Link to="/" className="brand" aria-label="ROVA Home">
          <img src="/rova-mark.jpg" alt="ROVA Logo" className="brand-logo" />
          <span>rova</span>
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#product">The platform</a>
          <a href="#how-it-works">How it works</a>
          <a href="#app">The app</a>
          <a href="#specs">Capabilities</a>
          <a href="#faq">Questions</a>
        </nav>

        <div className="header-actions">
          <Link to="/signup" className="header-link">
            Get started
          </Link>
          <Link to="/login" className="button dark">
            Sign in <ArrowUpRight size={16} />
          </Link>
          <button
            className="menu-toggle"
            aria-label="Toggle navigation menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* ── Mobile Menu Dropdown ── */}
      {mobileMenuOpen && (
        <div
          style={{
            background: 'var(--lp-bg-card)',
            borderBottom: '1px solid var(--lp-border-line)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            zIndex: 49,
            position: 'sticky',
            top: '65px',
          }}
        >
          <a
            href="#product"
            onClick={() => setMobileMenuOpen(false)}
            style={{ textDecoration: 'none', color: 'var(--lp-text-main)', fontWeight: 500 }}
          >
            The platform
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            style={{ textDecoration: 'none', color: 'var(--lp-text-main)', fontWeight: 500 }}
          >
            How it works
          </a>
          <a
            href="#app"
            onClick={() => setMobileMenuOpen(false)}
            style={{ textDecoration: 'none', color: 'var(--lp-text-main)', fontWeight: 500 }}
          >
            The app
          </a>
          <a
            href="#specs"
            onClick={() => setMobileMenuOpen(false)}
            style={{ textDecoration: 'none', color: 'var(--lp-text-main)', fontWeight: 500 }}
          >
            Capabilities
          </a>
          <a
            href="#faq"
            onClick={() => setMobileMenuOpen(false)}
            style={{ textDecoration: 'none', color: 'var(--lp-text-main)', fontWeight: 500 }}
          >
            Questions
          </a>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <Link
              to="/login"
              className="button light"
              style={{ flex: 1 }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="button dark"
              style={{ flex: 1 }}
              onClick={() => setMobileMenuOpen(false)}
            >
              Get started
            </Link>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <div id="main-content">
        <main>
          {/* ── Hero Stage ── */}
          <section className="hero-stage" id="product">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="status-dot" /> MEET ROVA. KNOW YOUR NUMBERS.
              </div>
              <h1>
                Know your numbers.
                <br />
                <span className="purple-gradient-text">Grow your business.</span>
              </h1>
              <p>
                Your business, made clearer. Meet rova the AI financial assistant and operating
                system that helps your business feel its best.
              </p>
              <div className="hero-actions">
                <Link to="/signup" className="button dark">
                  Start with ROVA <ArrowUpRight size={16} />
                </Link>
                <a href="#how-it-works" className="text-link">
                  A breath of fresh insight <ArrowDown size={15} />
                </a>
              </div>
            </div>

            <div className="hero-visual">
              <div className="visual-index">
                <span>01 / ROVA INTELLIGENCE</span>
                <span>DESIGNED TO FIT IN. BUILT TO EMPOWER.</span>
              </div>

              <div className="hero-mockup-frame">
                <div className="hero-card-display">
                  <div className="hero-callout">
                    <span className="callout-line" />
                    <span>
                      Small workflow.
                      <br />A whole new perspective.
                    </span>
                  </div>

                  <div className="sample-reading">
                    <span className="sample-heading">
                      <span className="status-dot" /> YOUR BUSINESS, AT A GLANCE
                    </span>
                    <div>
                      <strong>₦1,420,000</strong>
                      <small>Net Revenue</small>
                    </div>
                    <p>Tax-ready, audited, and updated live via WhatsApp.</p>
                    <span className="sample-label">Illustrative live pulse</span>
                  </div>
                </div>
              </div>

              <div className="visual-index" style={{ borderTop: '1px solid var(--lp-border-line)', paddingTop: '16px' }}>
                <span>EVERY TRANSACTION TRACKED. EVERY REPORT READY.</span>
                <span>NIGERIA</span>
              </div>
            </div>

            <div className="hero-bottom">
              <span>
                Transaction Tracking <i /> Invoicing <i /> WhatsApp AI <i /> Automated Ledger
              </span>
              <span>
                One small step towards effortless business. <ArrowDown size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </span>
            </div>
          </section>

          {/* ── Section 01: Measurements / Pillars ── */}
          <section id="how-it-works" className="measurements section-rail">
            <div className="section-heading">
              <span className="eyebrow">01 — THE INVISIBLE, MADE VISIBLE</span>
              <div>
                <h2>
                  There’s more to your business
                  <br />
                  than meets the eye.
                </h2>
                <p>
                  Sales. Receipts. Operating expenses. Just running your company.
                  <br className="desktop-break" />
                  ROVA connects the dots between your daily hustle and your bottom line.
                </p>
              </div>
            </div>

            <div className="measurement-grid">
              {/* Pillar 01 */}
              <article className="measurement">
                <div>
                  <div className="measurement-top">
                    <Receipt size={24} strokeWidth={1.4} />
                    <span>01</span>
                  </div>
                  <h3>Invoicing &amp; Receipts</h3>
                  <h4>Instant clarity on every deal.</h4>
                  <p>
                    Issue branded receipts and professional invoices right from WhatsApp or web
                    in under 15 seconds. Customers pay faster, cashflow stays predictable.
                  </p>
                </div>
                <div className="measurement-reading">
                  <strong>
                    100<small>%</small>
                  </strong>
                  <span>
                    Reconciled <ArrowUpRight size={14} />
                  </span>
                </div>
              </article>

              {/* Pillar 02 */}
              <article className="measurement">
                <div>
                  <div className="measurement-top">
                    <TrendingUp size={24} strokeWidth={1.4} />
                    <span>02</span>
                  </div>
                  <h3>Transaction Tracking</h3>
                  <h4>Every kobo accounted for.</h4>
                  <p>
                    Log, categorize, and monitor income and expenses automatically as they happen.
                    Stay in complete control of your cashflow with real-time tracking and zero guesswork.
                  </p>
                </div>
                <div className="measurement-reading">
                  <strong>
                    100<small>%</small>
                  </strong>
                  <span>
                    Live tracking <ArrowUpRight size={14} />
                  </span>
                </div>
              </article>

              {/* Pillar 03 */}
              <article className="measurement">
                <div>
                  <div className="measurement-top">
                    <Bot size={24} strokeWidth={1.4} />
                    <span>03</span>
                  </div>
                  <h3>WhatsApp AI Bookkeeper</h3>
                  <h4>See the full picture.</h4>
                  <p>
                    Snap photos of physical paper receipts, text daily sales, or send voice notes.
                    ROVA logs, categorizes, and balances the books 24/7.
                  </p>
                </div>
                <div className="measurement-reading">
                  <strong>
                    24<small>/7</small>
                  </strong>
                  <span>
                    Coming soon <ArrowUpRight size={14} />
                  </span>
                </div>
              </article>
            </div>

            <p className="fine-print">
              Readings and calculations shown are illustrative. ROVA securely coordinates with your
              accounting ledger, double-entry balance sheets, and tax compliance rules.
            </p>
          </section>

          {/* ── Section 02: Living / Operations ── */}
          <section className="living-section">
            <div className="living-photo">
              <div className="living-card-visual">
                <div className="living-stat-box">
                  <span>Daily Pulse</span>
                  <strong>₦3,850,000 Settled</strong>
                  <p style={{ fontSize: '13px', color: 'var(--lp-text-muted)', marginTop: '4px' }}>
                    18 customer invoices reconciled today via WhatsApp
                  </p>
                </div>

                <div className="living-stat-box" style={{ background: 'var(--lp-bg-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--lp-accent-purple, #863bff)', fontWeight: 700 }}>CIT PROVISION</span>
                    <span style={{ color: 'var(--lp-text-faint)', fontSize: '11px' }}>AUTOMATED</span>
                  </div>
                  <strong style={{ fontSize: '17px', lineHeight: 1.4, color: 'var(--lp-text-main)', fontWeight: 600 }}>
                    Your CIT provision, done automatically. Zero discrepancy.
                  </strong>
                </div>
              </div>
              <span className="image-caption">02 / BUILT FOR REAL-WORLD OPERATIONS</span>
            </div>

            <div className="living-copy">
              <span className="eyebrow">LESS GUESSING. MORE LIVING.</span>
              <h2>
                Quietly there.
                <br />
                Always aware.
              </h2>
              <p>
                No complicated dashboards. No intimidating tax jargon. Just the exact numbers you
                need, in an operating system you’ll actually want to use every day.
              </p>

              <div className="living-points">
                <div>
                  <span>01</span>
                  <p>
                    <strong>Connect in seconds. Breathe out.</strong>
                    <br />
                    Simple WhatsApp setup. Start recording transactions without installing another
                    bulky app.
                  </p>
                </div>
                <div>
                  <span>02</span>
                  <p>
                    <strong>A glance is all it takes.</strong>
                    <br />
                    A crystal-clear dashboard brings your revenue, costs, and profits into instant
                    focus.
                  </p>
                </div>
                <div>
                  <span>03</span>
                  <p>
                    <strong>Made for your everyday.</strong>
                    <br />
                    From the warehouse floor to supplier meetings, stay in total control anywhere
                    you are.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 03: The App Demo ── */}
          <section id="app" className="app-section">
            <div className="app-copy">
              <span className="eyebrow">02 — THE ROVA PLATFORM</span>
              <h2>
                Your business.
                <br />
                The bigger picture.
              </h2>
              <p>
                Turn everyday transactions into real understanding. See patterns, get a little
                nudge when things change, and find what makes your business thrive.
              </p>

              <ul>
                <li>
                  <span>01</span> Your whole enterprise, in one place
                </li>
                <li>
                  <span>02</span> Trends that tell a story
                </li>
                <li>
                  <span>03</span> Helpful, timely insights
                </li>
              </ul>

              <div className="platforms">
                <span>Designed for Web &amp; WhatsApp</span>
                <ArrowUpRight size={16} />
              </div>

              <p className="fine-print">Interactive app preview. Live sync with Supabase ledger.</p>
            </div>

            <div className="app-demo">
              <div className="phone">
                {/* Device Status Bar */}
                <div className="phone-status">
                  <span>21:37</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: '#9CA3AF' }}>4G+</span>
                    <Wifi size={12} color="#9CA3AF" />
                    <span className="battery" />
                    <span style={{ fontSize: '10px', color: '#9CA3AF' }}>71%</span>
                  </div>
                </div>

                {/* ROVA Mobile App Bar */}
                <div className="phone-app-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Menu size={18} color="#D1D5DB" />
                    <div className="phone-app-logo">
                      <span>R</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="phone-wa-badge">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                    </div>
                    <Bell size={15} color="#9CA3AF" />
                    <Search size={15} color="#9CA3AF" />
                    <Sun size={15} color="#9CA3AF" />
                    <div className="phone-avatar">D</div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="phone-action-buttons">
                  <button className="phone-btn-invoice">New Invoice</button>
                  <button className="phone-btn-add">
                    <Plus size={14} /> Add Transaction
                  </button>
                </div>

                {/* Real Dashboard Cards */}
                <div className="phone-cards-scroll">
                  {/* Card 1: Total Revenue */}
                  <div className="phone-metric-card">
                    <div className="phone-card-top">
                      <div className="phone-card-icon-wrap icon-green">
                        <TrendingUp size={14} color="#10B981" />
                      </div>
                      <span className="phone-card-title">Total Revenue</span>
                    </div>
                    <strong className="phone-card-val">₦304,500.06</strong>
                    <span className="phone-card-trend trend-green">↗ +100.0% from last month</span>
                  </div>

                  {/* Card 2: Expenses */}
                  <div className="phone-metric-card">
                    <div className="phone-card-top">
                      <div className="phone-card-icon-wrap icon-red">
                        <TrendingDown size={14} color="#EF4444" />
                      </div>
                      <span className="phone-card-title">Expenses</span>
                    </div>
                    <strong className="phone-card-val">₦50,000.00</strong>
                    <span className="phone-card-trend trend-red">↗ +100.0% from last month</span>
                  </div>

                  {/* Card 3: Net Cashflow */}
                  <div className="phone-metric-card">
                    <div className="phone-card-top">
                      <div className="phone-card-icon-wrap icon-green">
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#10B981' }}>₦</span>
                      </div>
                      <span className="phone-card-title">Net Cashflow</span>
                    </div>
                    <strong className="phone-card-val">₦254,500.06</strong>
                    <span className="phone-card-trend" style={{ color: '#6B7280' }}>Current period profitability</span>
                  </div>
                </div>

                {/* Android System Nav */}
                <div className="phone-android-nav">
                  <span>|||</span>
                  <span>◻</span>
                  <span>&lt;</span>
                </div>
              </div>

              <div className="app-note">
                <span>
                  ALL THE INSIGHT.
                  <br />
                  NONE OF THE NOISE.
                </span>
                <span>↖</span>
              </div>

              <span className="demo-caption">INTERACTIVE APP PREVIEW · REAL-TIME DATA</span>
            </div>
          </section>

          {/* ── Section 04: Specs & Capabilities ── */}
          <section id="specs" className="specs-section section-rail">
            <div>
              <span className="eyebrow">03 — SMALL DETAILS. THOUGHT THROUGH.</span>
              <h2>
                Considered outside.
                <br />
                Capable inside.
              </h2>
              <p>
                A compact footprint.
                <br />
                A comprehensive view of your finances.
              </p>
              <span className="spec-label">
                TARGET SPECIFICATIONS
                <br />
                Engineered for Nigerian &amp; global enterprises
              </span>
            </div>

            <dl>
              <div>
                <dt>Bookkeeping Engine</dt>
                <dd>Automated double-entry ledger, P&amp;L, Balance Sheet</dd>
              </div>
              <div>
                <dt>Tax Automation</dt>
                <dd>2026 CIT Schedules, NRS filing export, capital allowances</dd>
              </div>
              <div>
                <dt>Invoicing &amp; Receipts</dt>
                <dd>Instant PDF generator, WhatsApp dispatch, custom logo</dd>
              </div>
              <div>
                <dt>Connectivity</dt>
                <dd>Official WhatsApp Cloud API, REST webhooks, Supabase</dd>
              </div>
              <div>
                <dt>Security &amp; Encryption</dt>
                <dd>Every record protected. Every role controlled.</dd>
              </div>
              <div>
                <dt>Export Formats</dt>
                <dd>Excel (.xlsx), PDF receipts, NRS tax schedules</dd>
              </div>
              <div>
                <dt>Supported Devices</dt>
                <dd>iOS, Android, macOS, Windows (PWA + WhatsApp)</dd>
              </div>
              <div>
                <dt>In the package</dt>
                <dd>ROVA Platform, WhatsApp Bot, multi-seat team access</dd>
              </div>
            </dl>
          </section>

          {/* ── Section 05: Press & Story ── */}
          <section className="press-section">
            <div>
              <span className="eyebrow">FROM LAGOS, TO THE WORLD</span>
              <h2>
                A fresh perspective.
                <br />
                An emerging story.
              </h2>
            </div>

            <div>
              <p>
                We’re building a more thoughtful relationship between African business owners and
                their finances.
                <br />
                Our launch is just beginning — join the next generation of founders.
              </p>
              <a href="mailto:hello@rovalabs.com" className="text-link">
                Media &amp; enterprise enquiries <ArrowUpRight size={17} />
              </a>
            </div>

            <span className="press-stamp">
              ROVA
              <br />
              PRESS ROOM / 2026
            </span>
          </section>

          {/* ── Section 06: FAQ Accordion ── */}
          <section id="faq" className="faq-section section-rail">
            <div>
              <span className="eyebrow">A LITTLE MORE CLARITY</span>
              <h2>
                Good questions.
                <br />
                Clear answers.
              </h2>
              <a href="mailto:hello@rovalabs.com" className="text-link">
                Still curious? Let’s talk ↗
              </a>
            </div>

            <div className="faq-list">
              <details>
                <summary>
                  How does the WhatsApp integration work?
                  <span aria-hidden="true">+</span>
                </summary>
                <p>
                  You connect your WhatsApp Business number to ROVA in under a minute. From then on,
                  you or your team can text sales, forward supplier receipts, or request live
                  balance updates directly in WhatsApp.
                </p>
              </details>

              <details>
                <summary>
                  How does ROVA calculate our 2026 Company Income Tax (CIT)?
                  <span aria-hidden="true">+</span>
                </summary>
                <p>
                  ROVA guides you through a streamlined, 11-step question sequence that maps directly
                  to the official Nigerian Revenue Service (NRS) requirements. It handles asset
                  depreciation, add-backs, and deductible expenses automatically.
                </p>
              </details>

              <details>
                <summary>
                  Do I need prior accounting experience to use ROVA?
                  <span aria-hidden="true">+</span>
                </summary>
                <p>
                  None at all. ROVA translates complex accounting jargon into simple conversational
                  prompts and intuitive visual cards. The double-entry ledger is handled invisibly
                  in the background.
                </p>
              </details>

              <details>
                <summary>
                  Is our business and customer data safe?
                  <span aria-hidden="true">+</span>
                </summary>
                <p>
                  Yes. All records are isolated with PostgreSQL Row Level Security (RLS) on
                  Supabase, communications are secured with TLS encryption, and private keys are
                  stored in isolated secret vaults.
                </p>
              </details>

              <details>
                <summary>
                  Can multiple team members or my accountant access the app?
                  <span aria-hidden="true">+</span>
                </summary>
                <p>
                  Yes. You can invite team members with specific permission roles (e.g., Staff for
                  invoicing, Accountant for tax filings and statements, Admin for full management).
                </p>
              </details>

              <details>
                <summary>
                  How do I get started, and is there a free tier?
                  <span aria-hidden="true">+</span>
                </summary>
                <p>
                  You can sign up in less than two minutes with no credit card required. Our free tier
                  gives you access to essential bookkeeping, receipt generation, and the WhatsApp bot.
                </p>
              </details>
            </div>
          </section>

          {/* ── Section 07: Final Call to Action ── */}
          <section className="preorder-section">
            <span className="eyebrow">
              <span className="status-dot" /> THE NEXT CHAPTER OF YOUR BUSINESS
            </span>
            <h2>
              Make room
              <br />
              <span className="purple-gradient-light">for better business.</span>
            </h2>
            <div>
              <p>
                Be part of the modern wave of streamlined commerce.
                <br />
                One thoughtfully designed platform. Complete peace of mind.
              </p>
              <Link to="/signup" className="button light">
                Get started
                <ArrowUpRight size={18} />
              </Link>
            </div>
            <span className="preorder-note">
              INSTANT SETUP · NO CREDIT CARD REQUIRED · CANCEL ANYTIME
            </span>
          </section>
        </main>
      </div>

      {/* ── Site Footer ── */}
      <footer className="site-footer">
        <div className="footer-top">
          <div>
            <Link to="/" className="footer-brand">
              <img src="/rova-mark.jpg" alt="ROVA Logo" className="brand-logo" />
              <span>rova</span>
            </Link>
            <p style={{ marginTop: '8px' }}>
              A little more aware.
              <br />A lot more in control.
            </p>
          </div>

          <div>
            <a href="mailto:Officialrovabusiness@gmail.com">
              Let’s talk <ArrowUpRight size={15} />
            </a>
            <a href="mailto:Officialrovabusiness@gmail.com">
              Press enquiries <ArrowUpRight size={15} />
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 ROVA SOFTWARE LIMITED</span>
          <span>Thoughtfully designed. For modern African commerce.</span>
          <div style={{ display: 'flex', gap: '20px' }}>
            <Link to="/pricing">Pricing</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
