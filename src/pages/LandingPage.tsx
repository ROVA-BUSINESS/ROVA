import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Landmark,
  Menu,
  MessageSquare,
  Package,
  Receipt,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import './LandingPage.css';

type StatementKey = 'ledger' | 'trial' | 'pnl' | 'balance' | 'cashflow';

interface AlertDemo {
  channel: string;
  alertText: string;
  matchedDoc: string;
  client: string;
  invoiceNo: string;
  date: string;
  status: string;
  itemDesc: string;
  subtotal: number;
  vat: number;
  total: number;
  memo: string;
  category: string;
  bank: string;
}

const ALERT_DEMOS: AlertDemo[] = [
  {
    channel: 'WhatsApp · GTBank Credit Alert',
    alertText: 'Credit Alert: ₦485,000.00 from Kora Foods Ltd matched to Invoice #1384.',
    matchedDoc: 'INV #1384',
    client: 'Kora Foods Nig. Ltd',
    invoiceNo: 'INV-1384',
    date: '10/11/2026',
    status: 'Paid in full',
    itemDesc: '20x Wholesale Cartons',
    subtotal: 451163,
    vat: 33837,
    total: 485000,
    memo: 'Wholesale Supply',
    category: 'Money In · Sales',
    bank: 'GTBank **4921',
  },
  {
    channel: 'WhatsApp · Access Bank Credit',
    alertText: 'Credit Alert: ₦180,000.00 from Bello & Sons logged and receipt sent.',
    matchedDoc: 'RCP #1385',
    client: 'Bello & Sons Stores',
    invoiceNo: 'RCP-1385',
    date: '10/11/2026',
    status: 'Receipt sent',
    itemDesc: 'Monthly Restock Delivery',
    subtotal: 167442,
    vat: 12558,
    total: 180000,
    memo: 'Restock Delivery',
    category: 'Money In · Sales',
    bank: 'Access **8104',
  },
  {
    channel: 'WhatsApp · Zenith Bank Debit',
    alertText: 'Debit Alert: ₦42,000.00 at TotalEnergies Station categorized automatically.',
    matchedDoc: 'EXP #412',
    client: 'TotalEnergies Station',
    invoiceNo: 'EXP-0412',
    date: '10/11/2026',
    status: 'Reconciled',
    itemDesc: 'Shop Generator Diesel',
    subtotal: 42000,
    vat: 0,
    total: 42000,
    memo: 'Generator Fuel',
    category: 'Money Out · Power',
    bank: 'Zenith **2290',
  },
];

const STATEMENTS: Record<
  StatementKey,
  { label: string; rows: { name: string; value: string }[]; note: string }
> = {
  ledger: {
    label: 'General ledger',
    rows: [
      { name: '1010 · Business Bank Accounts', value: '₦2,415,000 Dr' },
      { name: '4000 · Sales Revenue', value: '₦4,180,000 Cr' },
      { name: '5100 · Operating Expenses', value: '₦1,765,000 Dr' },
    ],
    note: 'Updated continuously from bank alerts, invoices, payroll, and WhatsApp entries.',
  },
  trial: {
    label: 'Trial balance',
    rows: [
      { name: 'Total Debits', value: '₦5,945,000' },
      { name: 'Total Credits', value: '₦5,945,000' },
      { name: 'Net Variance', value: '₦0 · Balanced' },
    ],
    note: 'Debits and credits stay balanced without manual journal entries.',
  },
  pnl: {
    label: 'Profit & loss',
    rows: [
      { name: 'Gross Revenue', value: '₦4,180,000' },
      { name: 'Operating & Payroll Costs', value: '-₦1,765,000' },
      { name: 'Net Profit', value: '₦2,415,000' },
    ],
    note: 'See real business margin before your accountant closes the month.',
  },
  balance: {
    label: 'Balance sheet',
    rows: [
      { name: 'Cash, Inventory & Receivables', value: '₦3,105,000' },
      { name: 'Tax & Supplier Liabilities', value: '₦410,000' },
      { name: 'Owner’s Equity', value: '₦2,695,000' },
    ],
    note: 'Ready whenever a bank or investor requests financial statements.',
  },
  cashflow: {
    label: 'Cash flow',
    rows: [
      { name: 'Cash Received', value: '+₦3,920,000' },
      { name: 'Cash Paid Out', value: '-₦1,505,000' },
      { name: 'Net Cash Movement', value: '+₦2,415,000' },
    ],
    note: 'Distinguishes collected bank cash from unpaid customer invoices.',
  },
};

const WHATSAPP_CHATS = [
  {
    title: 'Record daily sales and expenses by text',
    desc: 'Text "Sold 15 cartons to Mama Tunde for ₦270,000" or forward supplier receipts straight on WhatsApp.',
    user: 'Bought diesel for shop generator ₦45,000 transfer',
    bot: 'Recorded ₦45,000 under Utilities & Fuel. Inventory, cashflow, and Profit & Loss updated automatically.',
  },
  {
    title: 'Check cashflow, stock, and payroll anytime',
    desc: 'Ask ROVA how much profit you made this week or which SKUs are running low without opening a laptop.',
    user: 'How much net profit did we make this week?',
    bot: 'This week: ₦840,000 Money In, ₦195,000 Money Out, ₦645,000 Net Profit. Top seller: 50kg Rice (42 bags left).',
  },
  {
    title: 'Share receipts and invite your accountant',
    desc: 'Send customer receipts on WhatsApp, Telegram, or email, while your accountant reviews clean statements.',
    user: 'Send receipt to Kora Foods on WhatsApp',
    bot: 'Receipt #RCP-1384 (₦485,000) generated and ready to share via WhatsApp, Telegram, Gmail, or SMS.',
  },
];

const FAQS = [
  {
    q: 'What does ROVA actually do for my business?',
    a: 'ROVA is an all-in-one financial operating system. It tracks bank inflows and outflows automatically, creates branded invoices and receipts, manages inventory and payroll, gives you an AI financial assistant on web and WhatsApp, generates proper accounting statements, and prepares Nigerian tax returns.',
  },
  {
    q: 'What accounting records does ROVA generate automatically?',
    a: 'Every recorded sale, expense, invoice payment, payroll run, or loan automatically updates your General Ledger, Trial Balance, Profit & Loss Statement, Balance Sheet, and Cash Flow Statement.',
  },
  {
    q: 'Can my staff and accountant use ROVA together?',
    a: 'Yes. You can assign roles so staff can create receipts or log daily sales, while your accountant reviews reconciled statements, inventory valuations, and tax schedules.',
  },
  {
    q: 'How does pricing work for ROVA and optional Tax Filing?',
    a: 'ROVA starts at ₦3,000 per month (or ₦100/day on Basic) for automated bookkeeping, bank tracking, and invoicing, with Business plans for WhatsApp AI, payroll, team seats, and inventory. Optional tax filing handled on your behalf costs ₦5,000 one-time per filing.',
  },
  {
    q: 'Do I need accounting knowledge to get started?',
    a: 'No. ROVA uses clear Money In and Money Out workflows plus plain-English WhatsApp chat, while handling debits, credits, and accounting statements silently in the background.',
  },
  {
    q: 'Is my bank and company data secure?',
    a: 'All workspace records are isolated with PostgreSQL Row Level Security (RLS), encrypted in transit via TLS, and billed securely through Paystack.',
  },
];

const HERO_CONFETTI = [
  { top: '7%', left: '68%', w: 5, h: 5, color: '#7c3aed', dx: '12px', rot: '110deg', dur: '6.2s', delay: '0s', round: true },
  { top: '12%', left: '78%', w: 7, h: 3, color: '#a855f7', dx: '-10px', rot: '165deg', dur: '7.1s', delay: '0.8s', round: false },
  { top: '18%', left: '88%', w: 4, h: 4, color: '#da70d6', dx: '8px', rot: '90deg', dur: '5.8s', delay: '1.4s', round: true },
  { top: '24%', left: '73%', w: 6, h: 2.5, color: '#c4b5fd', dx: '-14px', rot: '140deg', dur: '6.8s', delay: '2.1s', round: false },
  { top: '9%', left: '92%', w: 4, h: 4, color: '#9333ea', dx: '-8px', rot: '120deg', dur: '6.4s', delay: '0.4s', round: true },
  { top: '29%', left: '84%', w: 6, h: 3, color: '#7c3aed', dx: '14px', rot: '180deg', dur: '7.5s', delay: '1.7s', round: false },
  { top: '15%', left: '61%', w: 4, h: 4, color: '#c4b5fd', dx: '9px', rot: '95deg', dur: '6.9s', delay: '2.9s', round: true },
  { top: '8%', left: '5%', w: 5, h: 2.5, color: '#a855f7', dx: '10px', rot: '130deg', dur: '7.4s', delay: '1.1s', round: false },
  { top: '22%', left: '3%', w: 4, h: 4, color: '#da70d6', dx: '12px', rot: '100deg', dur: '6.1s', delay: '2.4s', round: true },
  { top: '19%', left: '95%', w: 5, h: 2.5, color: '#7c3aed', dx: '-11px', rot: '155deg', dur: '6.6s', delay: '3.2s', round: false },
];

const HERO_FIREWORKS = [
  { top: '14%', left: '82%', fdur: '4.2s', fdelay: '0.2s', dist: '26px', colors: ['#7c3aed', '#da70d6', '#a855f7', '#c4b5fd'] },
  { top: '22%', left: '66%', fdur: '5.0s', fdelay: '1.8s', dist: '22px', colors: ['#a855f7', '#7c3aed', '#da70d6', '#9333ea'] },
  { top: '11%', left: '91%', fdur: '4.6s', fdelay: '2.9s', dist: '24px', colors: ['#da70d6', '#c4b5fd', '#7c3aed', '#a855f7'] },
];

const fmtNaira = (n: number) => '₦' + new Intl.NumberFormat('en-NG').format(n);

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoIdx, setDemoIdx] = useState(0);
  const [flash, setFlash] = useState(false);
  const [stmtTab, setStmtTab] = useState<StatementKey>('ledger');
  const [waIdx, setWaIdx] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const demo = ALERT_DEMOS[demoIdx];
  const stmt = STATEMENTS[stmtTab];

  const selectDemo = (idx: number) => {
    setDemoIdx(idx);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 450);
  };

  return (
    <div className="rva-page">
      {/* Subtle Top Black Bar */}
      <div className="rva-top-strip">
        ROVA brings bookkeeping, invoicing, bank sync, payroll, and 2026 tax readiness into one OS.
        <Link to="/signup">Start now</Link>
      </div>

      {/* ── Sticky White Navigation ── */}
      <header className="rva-nav-wrap">
        <div className="rva-wrap rva-nav">
          <div className="rva-nav-left">
            <Link to="/" className="rva-brand" aria-label="ROVA Home">
              <img
                src="/rova-logo-transparent.png"
                alt=""
                style={{ width: 26, height: 26, objectFit: 'contain', display: 'block' }}
              />
              <span>rova</span>
            </Link>

            <nav className="rva-nav-links" aria-label="Main navigation">
              <a href="#platform">Platform</a>
              <a href="#features">Features</a>
              <a href="#whatsapp">WhatsApp AI</a>
              <a href="#pricing">Pricing</a>
            </nav>
          </div>

          <div className="rva-nav-actions">
            <Link to="/login" className="rva-btn rva-btn-outline rva-nav-desktop">
              Sign in
            </Link>
            <Link to="/signup" className="rva-btn rva-btn-black">
              Start now
            </Link>
            <button
              type="button"
              className="rva-mobile-btn"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div
            style={{
              padding: '16px 24px 22px',
              background: '#ffffff',
              borderTop: '1px solid #e4e4e7',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <a href="#platform" onClick={() => setMobileOpen(false)} style={{ color: '#111113', textDecoration: 'none' }}>
              Platform
            </a>
            <a href="#features" onClick={() => setMobileOpen(false)} style={{ color: '#111113', textDecoration: 'none' }}>
              Features
            </a>
            <a href="#whatsapp" onClick={() => setMobileOpen(false)} style={{ color: '#111113', textDecoration: 'none' }}>
              WhatsApp AI
            </a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} style={{ color: '#111113', textDecoration: 'none' }}>
              Pricing
            </a>
            <Link to="/login" onClick={() => setMobileOpen(false)} style={{ color: '#5e616b', textDecoration: 'none' }}>
              Sign in
            </Link>
          </div>
        )}
      </header>

      <main>
        {/* ── 1. WHITE SECTION: Ramp Headline + 4-Corner Moving Purple Light + Canvas ── */}
        <section className="rva-hero">
          <div className="rva-hero-perimeter" aria-hidden="true" />
          <div className="rva-corner-light" aria-hidden="true" />
          <div className="rva-hero-confetti" aria-hidden="true">
            {HERO_CONFETTI.map((p, idx) => (
              <span
                key={`conf-${idx}`}
                className="rva-confetti-piece"
                style={{
                  top: p.top,
                  left: p.left,
                  width: p.w,
                  height: p.h,
                  borderRadius: p.round ? '50%' : '2px',
                  background: p.color,
                  ['--dx' as string]: p.dx,
                  ['--rot' as string]: p.rot,
                  ['--dur' as string]: p.dur,
                  ['--delay' as string]: p.delay,
                }}
              />
            ))}
            {HERO_FIREWORKS.map((fw, fIdx) => (
              <div
                key={`fw-${fIdx}`}
                className="rva-firework"
                style={{ top: fw.top, left: fw.left }}
              >
                {[0, 45, 90, 135, 180, 225, 270, 315].map((ang, sIdx) => (
                  <span
                    key={ang}
                    className="rva-fw-spark"
                    style={{
                      ['--ang' as string]: `${ang}deg`,
                      ['--dist' as string]: fw.dist,
                      ['--fdur' as string]: fw.fdur,
                      ['--fdelay' as string]: fw.fdelay,
                      ['--c' as string]: fw.colors[sIdx % fw.colors.length],
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="rva-wrap" style={{ position: 'relative', zIndex: 3 }}>
            <div className="rva-hero-head">
              <h1 className="rva-h1">
                One platform for all of business finance.
                <span className="rva-h1-muted">
                  AI bookkeeping, invoicing, payroll, and taxes—working 24/7.
                </span>
              </h1>
              <div className="rva-hero-ctas">
                <Link to="/signup" className="rva-btn rva-btn-black">
                  Start now
                </Link>
                <a href="#platform" className="rva-btn rva-btn-soft">
                  See how it works
                </a>
              </div>
            </div>

            <div id="canvas-demo" className="rva-canvas">
              <div className="rva-canvas-bar">
                <span style={{ fontSize: 13, color: 'var(--muted-light-bg)' }}>
                  Interactive product preview — click an incoming bank alert to watch ROVA book, invoice, and code it live
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`rva-sim-pill ${demoIdx === 0 ? 'active' : ''}`}
                    onClick={() => selectDemo(0)}
                  >
                    GTBank +₦485,000
                  </button>
                  <button
                    type="button"
                    className={`rva-sim-pill ${demoIdx === 1 ? 'active' : ''}`}
                    onClick={() => selectDemo(1)}
                  >
                    Access +₦180,000
                  </button>
                  <button
                    type="button"
                    className={`rva-sim-pill ${demoIdx === 2 ? 'active' : ''}`}
                    onClick={() => selectDemo(2)}
                  >
                    Zenith -₦42,000 Fuel
                  </button>
                </div>
              </div>

              <div className="rva-canvas-stage">
                <div className={`rva-node-card ${flash ? 'highlight' : ''}`}>
                  <span className="rva-node-corner-bl" aria-hidden="true" />
                  <span className="rva-node-corner-br" aria-hidden="true" />
                  <div className="rva-card-kicker">
                    <Check size={13} color="#111113" />
                    <span>MATCHED VIA WHATSAPP</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div style={{ border: '1px solid #ededf0', padding: 10, background: '#fafafa' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--subtle-light-bg)' }}>BANK ALERT</div>
                      <div className="tabular" style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>
                        {fmtNaira(demo.total)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted-light-bg)', marginTop: 2 }}>
                        {demo.bank}
                      </div>
                    </div>
                    <div style={{ border: '1px solid #ededf0', padding: 10, background: '#fafafa' }}>
                      <div style={{ fontSize: 10.5, color: 'var(--subtle-light-bg)' }}>RECORD</div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>
                        {demo.matchedDoc}
                      </div>
                      <div style={{ fontSize: 11, color: '#111113', marginTop: 2, fontWeight: 500 }}>
                        Synced
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted-light-bg)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-light-bg)' }}>{demo.channel}:</strong>{' '}
                    {demo.alertText}
                  </div>
                </div>

                <div className="rva-invoice-sheet">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em' }}>
                        {demo.client}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--subtle-light-bg)', marginTop: 6 }}>
                        Victoria Island, Lagos
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11.5 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Document details</div>
                      <div style={{ color: 'var(--muted-light-bg)' }}>Date: {demo.date}</div>
                      <div style={{ color: 'var(--muted-light-bg)' }}>Ref: {demo.invoiceNo}</div>
                      <div style={{ color: 'var(--muted-light-bg)' }}>Status: {demo.status}</div>
                    </div>
                  </div>

                  <table className="rva-inv-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{demo.itemDesc}</td>
                        <td className="tabular" style={{ textAlign: 'right' }}>{fmtNaira(demo.subtotal)}</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--muted-light-bg)' }}>VAT (7.5%)</td>
                        <td className="tabular" style={{ textAlign: 'right' }}>{fmtNaira(demo.vat)}</td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 600 }}>Total settled</td>
                        <td className="tabular" style={{ textAlign: 'right', fontWeight: 600 }}>
                          {fmtNaira(demo.total)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className={`rva-node-card ${flash ? 'highlight' : ''}`}>
                    <span className="rva-node-corner-bl" aria-hidden="true" />
                    <span className="rva-node-corner-br" aria-hidden="true" />
                    <div className="rva-card-kicker">
                      <span>LEDGER &amp; INVENTORY SYNC</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted-light-bg)' }}>Double-entry status</span>
                        <span style={{ color: '#111113', fontWeight: 600 }}>Balanced</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted-light-bg)' }}>Receipt share</span>
                        <span>WhatsApp / PDF</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted-light-bg)' }}>Tax mapping</span>
                        <span>{demo.vat > 0 ? 'VAT 7.5%' : 'Deductible'}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`rva-node-card ${flash ? 'highlight' : ''}`}>
                    <span className="rva-node-corner-bl" aria-hidden="true" />
                    <span className="rva-node-corner-br" aria-hidden="true" />
                    <div className="rva-card-kicker">
                      <span>AUTO-CODING</span>
                    </div>
                    <div className="rva-coding-grid">
                      <div className="rva-coding-field">
                        <div style={{ fontSize: 10.5, color: 'var(--subtle-light-bg)' }}>Memo</div>
                        <div style={{ fontWeight: 500 }}>{demo.memo}</div>
                      </div>
                      <div className="rva-coding-field">
                        <div style={{ fontSize: 10.5, color: 'var(--subtle-light-bg)' }}>Amount</div>
                        <div className="tabular" style={{ fontWeight: 500 }}>{fmtNaira(demo.total)}</div>
                      </div>
                      <div className="rva-coding-field">
                        <div style={{ fontSize: 10.5, color: 'var(--subtle-light-bg)' }}>Category</div>
                        <div style={{ fontWeight: 500 }}>{demo.category}</div>
                      </div>
                      <div className="rva-coding-field">
                        <div style={{ fontSize: 10.5, color: 'var(--subtle-light-bg)' }}>Reports</div>
                        <div style={{ fontWeight: 500 }}>P&amp;L + Bal. Sheet</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="rva-seam" aria-hidden="true" />

        {/* ── 2. BLACK SECTION: 4-Col Workflows + Automated Accounting Statements ── */}
        <section id="platform" className="rva-sec-black">
          <div className="rva-wrap">
            <div style={{ maxWidth: 680 }}>
              <h2 className="rva-h2">
                Every business workflow in one operating system.
              </h2>
              <p style={{ color: 'var(--muted-dark-bg)', marginTop: 14, maxWidth: '58ch' }}>
                Manage cashflow, invoices, inventory, payroll, accounting records, and Nigerian tax
                compliance without jumping between five different tools.
              </p>
            </div>

            <div className="rva-4col-dark">
              <div>
                <div className="rva-4col-icon-dark">
                  <Landmark size={17} />
                </div>
                <h3>Cashflow &amp; bank sync</h3>
                <p>
                  Track every Money In and Money Out transfer automatically across connected bank
                  accounts.
                </p>
                <a href="#features" style={{ color: '#ffffff', textDecoration: 'none', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  Explore tracking <ArrowRight size={14} />
                </a>
              </div>

              <div>
                <div className="rva-4col-icon-dark">
                  <Receipt size={17} />
                </div>
                <h3>Invoicing &amp; receipts</h3>
                <p>
                  Send branded invoices and receipts via WhatsApp, Telegram, Gmail, SMS, or X in
                  seconds.
                </p>
                <a href="#features" style={{ color: '#ffffff', textDecoration: 'none', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  Explore invoicing <ArrowRight size={14} />
                </a>
              </div>

              <div>
                <div className="rva-4col-icon-dark">
                  <Bot size={17} />
                </div>
                <h3>AI &amp; WhatsApp bookkeeper</h3>
                <p>
                  Record sales, snap paper receipts, and ask cashflow questions directly in chat.
                </p>
                <a href="#whatsapp" style={{ color: '#ffffff', textDecoration: 'none', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  Explore AI <ArrowRight size={14} />
                </a>
              </div>

              <div>
                <div className="rva-4col-icon-dark">
                  <Users size={17} />
                </div>
                <h3>Payroll, stock &amp; tax</h3>
                <p>
                  Pay staff, track chronological inventory SKUs, and generate 2026 tax schedules.
                </p>
                <a href="#pricing" style={{ color: '#ffffff', textDecoration: 'none', fontSize: 13.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  Explore suite <ArrowRight size={14} />
                </a>
              </div>
            </div>

            <div className="rva-acct-panel-dark">
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: '#ffffff' }}>
                  Proper accounting records, generated automatically
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--muted-dark-bg)' }}>
                  {stmt.note}
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }} role="tablist">
                {(Object.keys(STATEMENTS) as StatementKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={stmtTab === key}
                    className={`rva-acct-btn-dark ${stmtTab === key ? 'active' : ''}`}
                    onClick={() => setStmtTab(key)}
                  >
                    {STATEMENTS[key].label}
                  </button>
                ))}
              </div>

              <div style={{ border: '1px solid var(--border-dark)', borderRadius: 8, overflow: 'hidden' }}>
                {stmt.rows.map((r) => (
                  <div
                    key={r.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--border-dark)',
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: 'var(--muted-dark-bg)' }}>{r.name}</span>
                    <strong className="tabular">{r.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="rva-seam" aria-hidden="true" />

        {/* ── 3. WHITE SECTION: Pleo Split Cards + 6-Card Bento Capabilities ── */}
        <section id="features" className="rva-sec-white">
          <div className="rva-wrap">
            <div className="rva-pleo-grid">
              <div className="rva-pleo-tile">
                <span className="rva-pleo-arrow" aria-hidden="true">
                  →
                </span>
                <div className="rva-black-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 600, fontSize: 16 }}>
                      <img src="/rova-logo-transparent.png" alt="" style={{ width: 18, height: 18, objectFit: 'contain', display: 'block' }} />
                      rova
                    </span>
                    <span style={{ fontSize: 11, color: '#a1a4ad' }}>Business Account</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#a1a4ad' }}>GTBank Connected</div>
                      <div className="tabular" style={{ fontSize: 14, letterSpacing: '0.1em', marginTop: 2 }}>
                        •••• 4921
                      </div>
                    </div>
                    <span style={{ fontSize: 11.5, color: '#ffffff', fontWeight: 500 }}>NGN</span>
                  </div>
                </div>

                <div className="rva-pleo-meter">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                    <span style={{ color: '#5e616b' }}>Monthly expense budget</span>
                    <strong className="tabular">₦2,500,000</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#5e616b', marginBottom: 6 }}>
                    <span className="tabular">₦1,765,000 spent</span>
                    <span>9 days remaining</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 99, background: '#e4e4e7', overflow: 'hidden' }}>
                    <div style={{ width: '70%', height: '100%', background: '#111113' }} />
                  </div>
                </div>
              </div>

              <div className="rva-pleo-tile">
                <span className="rva-pleo-arrow" aria-hidden="true">
                  →
                </span>
                <div className="rva-sync-card">
                  <div className="rva-sync-head">
                    <span>Syncing daily operations</span>
                    <span>→</span>
                  </div>
                  <div className="rva-sync-row">
                    <div>
                      <div style={{ fontWeight: 500 }}>POS Settlement · Paystack</div>
                      <div style={{ fontSize: 11.5, color: '#868994' }}>Money In · Sales</div>
                    </div>
                    <strong className="tabular">+₦340,000</strong>
                  </div>
                  <div className="rva-sync-row">
                    <div>
                      <div style={{ fontWeight: 500 }}>Monthly Staff Payroll</div>
                      <div style={{ fontSize: 11.5, color: '#868994' }}>Money Out · 6 Employees</div>
                    </div>
                    <strong className="tabular">-₦620,000</strong>
                  </div>
                  <div className="rva-sync-row">
                    <div>
                      <div style={{ fontWeight: 500 }}>Inventory Restock (24 SKUs)</div>
                      <div style={{ fontSize: 11.5, color: '#111113', fontWeight: 500 }}>Ledger updated</div>
                    </div>
                    <strong className="tabular">-₦290,000</strong>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 64 }}>
              <h2 className="rva-h2">
                Everything required to run your business finances cleanly.
              </h2>

              <div className="rva-carousel-wrap" aria-label="ROVA core capabilities carousel">
                <div className="rva-carousel-track">
                  {[0, 1].map((dupIdx) => (
                    <div
                      key={dupIdx}
                      style={{ display: 'flex', gap: 18 }}
                      aria-hidden={dupIdx === 1}
                    >
                      {[
                        {
                          title: 'Automated bookkeeping',
                          icon: SlidersHorizontal,
                          desc: 'Record Money In, Money Out, and loans in plain language while ROVA maintains your General Ledger, Trial Balance, P&L, Balance Sheet, and Cash Flow.',
                        },
                        {
                          title: 'Invoicing & receipts',
                          icon: Receipt,
                          desc: 'Create branded PDF invoices and payment receipts in 15 seconds and send them via WhatsApp, Telegram, Gmail, SMS, or X.',
                        },
                        {
                          title: 'Bank sync & reconciliation',
                          icon: Landmark,
                          desc: 'Connect your Nigerian business bank accounts to import incoming alerts and debits without spreadsheet copy-pasting.',
                        },
                        {
                          title: 'Inventory & SKUs',
                          icon: Package,
                          desc: 'Track product quantities, chronological restocks, unit margins, and cost of goods sold alongside your sales.',
                        },
                        {
                          title: 'Payroll & team roles',
                          icon: Users,
                          desc: 'Run staff and contractor payroll schedules and invite team members or your accountant with scoped permissions.',
                        },
                        {
                          title: 'Nigerian tax readiness',
                          icon: FileSpreadsheet,
                          desc: 'Keep VAT, WHT, and 2026 Company Income Tax schedules reconciled year-round, with one-click Excel export or optional filing.',
                        },
                      ].map((card) => {
                        const Icon = card.icon;
                        return (
                          <article key={`${dupIdx}-${card.title}`} className="rva-bento-item">
                            <div className="rva-bento-top">
                              <h3>{card.title}</h3>
                              <Icon size={20} strokeWidth={1.6} />
                            </div>
                            <p>{card.desc}</p>
                          </article>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="rva-seam" aria-hidden="true" />

        {/* ── 4. BLACK SECTION: Cowrywise Editorial Cards + WhatsApp Bookkeeper ── */}
        <section id="whatsapp" className="rva-sec-black">
          <div className="rva-wrap">
            <div style={{ textAlign: 'center', maxWidth: 660, margin: '0 auto' }}>
              <h2 className="rva-h2">Run your books on the web or on WhatsApp.</h2>
              <p style={{ color: 'var(--muted-dark-bg)', marginTop: 12 }}>
                Log transactions, inspect stock levels, or share customer receipts from the same
                chat app you already open every day.
              </p>
            </div>

            <div className="rva-cw-grid">
              {WHATSAPP_CHATS.map((card, i) => (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => setWaIdx(i)}
                  className={`rva-cw-card-dark ${waIdx === i ? 'active' : ''}`}
                >
                  <span className="rva-cw-slashes">//</span>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </button>
              ))}
            </div>

            <div
              style={{
                marginTop: 20,
                background: 'var(--ink)',
                border: '1px solid var(--border-dark)',
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ fontSize: 12.5, color: 'var(--muted-dark-bg)', display: 'flex', justifyContent: 'space-between' }}>
                <span>WhatsApp Business Preview</span>
                <span style={{ color: '#ffffff' }}>Click any card above to switch example</span>
              </div>
              <div
                style={{
                  alignSelf: 'flex-end',
                  background: '#27272e',
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 14,
                  maxWidth: 520,
                }}
              >
                {WHATSAPP_CHATS[waIdx].user}
              </div>
              <div
                style={{
                  alignSelf: 'flex-start',
                  background: '#1e1e24',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 14,
                  maxWidth: 560,
                }}
              >
                {WHATSAPP_CHATS[waIdx].bot}
              </div>
            </div>
          </div>
        </section>

        <div className="rva-seam" aria-hidden="true" />

        {/* ── 5. WHITE SECTION: Plaid Real-Fact Strip + Simple Pricing ── */}
        <section id="pricing" className="rva-sec-white">
          <div className="rva-wrap">
            <div className="rva-plaid-grid">
              <div>
                <div className="rva-plaid-num tabular">10+ hrs</div>
                <div className="rva-plaid-label">saved weekly recording transactions &amp; filing</div>
              </div>
              <div>
                <div className="rva-plaid-num tabular">₦500k+</div>
                <div className="rva-plaid-label">saved yearly vs. professional accounting retainers</div>
              </div>
              <div>
                <div className="rva-plaid-num tabular">100%</div>
                <div className="rva-plaid-label">NRS &amp; FIRS 2026 tax schedule ready</div>
              </div>
              <div>
                <div className="rva-plaid-num tabular">24/7</div>
                <div className="rva-plaid-label">AI &amp; specialist support on web &amp; WhatsApp</div>
              </div>
            </div>

            <div>
              <h2 className="rva-h2">Simple, transparent pricing.</h2>
              <p style={{ color: 'var(--muted-light-bg)', marginTop: 12, maxWidth: '58ch' }}>
                One clear monthly subscription for your business finances, plus optional tax filing
                only when a return is due.
              </p>

              <div className="rva-pricing-grid">
                <div className="rva-price-card">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#9b38cf' }}>
                      ROVA All-in-One
                    </div>
                    <div className="rva-price-num tabular" style={{ color: '#111113' }}>
                      ₦3,000{' '}
                      <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--muted-light-bg)' }}>
                        / month
                      </span>
                    </div>
                    <p style={{ color: 'var(--muted-light-bg)', fontSize: 14.5, margin: '0 0 18px' }}>
                      Everything SME owners and their accountants need to run accurate books every
                      day.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, fontSize: 14 }}>
                      {[
                        'Automatic Nigerian bank transaction tracking',
                        'WhatsApp & web AI financial assistant',
                        'Branded PDF invoices & multi-channel receipts',
                        'General ledger, trial balance, P&L, balance sheet & cash flow',
                      ].map((item) => (
                        <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Check size={15} color="#a444d5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link to="/signup" className="rva-btn rva-btn-black" style={{ width: '100%' }}>
                    Start now
                  </Link>
                </div>

                <div className="rva-price-card">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#9b38cf' }}>
                      Optional Tax Filing
                    </div>
                    <div className="rva-price-num tabular" style={{ color: '#111113' }}>
                      ₦5,000{' '}
                      <span style={{ fontSize: 15, fontWeight: 400, color: 'var(--muted-light-bg)' }}>
                        / tax filing
                      </span>
                    </div>
                    <p style={{ color: 'var(--muted-light-bg)', fontSize: 14.5, margin: '0 0 18px' }}>
                      Optional add-on when you want ROVA to prepare and submit a tax return with
                      FIRS / NRS on your behalf.
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10, fontSize: 14 }}>
                      {[
                        'VAT returns, PAYE, or 2026 Company Income Tax',
                        'Generated directly from your live ROVA ledger',
                        'One-time payment—never auto-renews',
                      ].map((item) => (
                        <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Check size={15} color="#a444d5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Link to="/pricing" className="rva-btn rva-btn-black" style={{ width: '100%' }}>
                    See full plan details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="rva-seam" aria-hidden="true" />

        {/* ── 6. BLACK SECTION: FAQ + Matte Black Footer ── */}
        <section className="rva-sec-black" style={{ paddingBottom: 48 }}>
          <div className="rva-wrap" style={{ maxWidth: 920 }}>
            <h2 className="rva-h2">Frequently asked questions</h2>
            <div className="rva-faq-list-dark">
              {FAQS.map((item, idx) => {
                const open = openFaq === idx;
                return (
                  <div key={item.q} className="rva-faq-row-dark">
                    <button
                      type="button"
                      className="rva-faq-btn-dark"
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? null : idx)}
                    >
                      <span>{item.q}</span>
                      <span className="rva-faq-chevron-dark" aria-hidden="true">
                        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </span>
                    </button>
                    {open && <div className="rva-faq-ans-dark">{item.a}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>

      <footer className="rva-footer">
        <div className="rva-wrap">
          <div className="rva-footer-cta">
            <div>
              <h2 className="rva-h2" style={{ color: '#ffffff', maxWidth: '24ch', marginBottom: 8 }}>
                Time is money. Keep both clear.
              </h2>
              <p style={{ margin: 0, color: 'var(--muted-dark-bg)', fontSize: 15 }}>
                Start now in two minutes and run your bookkeeping, invoicing, payroll, and taxes in
                one place.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/signup" className="rva-btn rva-btn-white">
                Start now
              </Link>
              <a
                href="https://wa.me/2348000000000?text=Hello%20ROVA%2C%20I%20would%20like%20to%20get%20started."
                target="_blank"
                rel="noreferrer"
                className="rva-btn"
                style={{ borderColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }}
              >
                <MessageSquare size={15} />
                Chat on WhatsApp
              </a>
            </div>
          </div>

          <div className="rva-footer-cols">
            <div>
              <h4>Product</h4>
              <ul>
                <li><a href="#features">Bookkeeping</a></li>
                <li><a href="#features">Invoicing &amp; receipts</a></li>
                <li><a href="#features">Bank sync</a></li>
                <li><a href="#features">Payroll &amp; inventory</a></li>
                <li><a href="#features">Tax readiness</a></li>
              </ul>
            </div>
            <div>
              <h4>Accounting</h4>
              <ul>
                <li><a href="#platform">General ledger</a></li>
                <li><a href="#platform">Trial balance</a></li>
                <li><a href="#platform">Profit &amp; loss</a></li>
                <li><a href="#platform">Balance sheet</a></li>
                <li><a href="#platform">Cash flow</a></li>
              </ul>
            </div>
            <div>
              <h4>Platform</h4>
              <ul>
                <li><Link to="/features">All features</Link></li>
                <li><Link to="/solutions">Solutions</Link></li>
                <li><Link to="/pricing">Pricing</Link></li>
                <li><Link to="/login">Sign in</Link></li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><Link to="/company">About ROVA</Link></li>
                <li><Link to="/privacy">Privacy Policy</Link></li>
                <li><Link to="/terms">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4>Contact</h4>
              <ul>
                <li><a href="mailto:Officialrovabusiness@gmail.com">Officialrovabusiness@gmail.com</a></li>
                <li>
                  <a
                    href="https://wa.me/2348000000000?text=Hello%20ROVA"
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp Support
                  </a>
                </li>
                <li><span>Lagos, Nigeria</span></li>
              </ul>
            </div>
          </div>

          <div className="rva-footer-legal">
            <div style={{ maxWidth: 680 }}>
              <div>© 2026 ROVA Software Limited. All rights reserved.</div>
              <div style={{ marginTop: 8 }}>
                ROVA provides automated bookkeeping, invoicing, inventory &amp; payroll workflows,
                financial statement generation, and Nigerian tax preparation. Payments are processed
                via Paystack.
              </div>
            </div>
            <div style={{ color: '#a4a7b2', fontSize: 12 }}>
              Built in Lagos for Nigerian SMEs &amp; accountants
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
