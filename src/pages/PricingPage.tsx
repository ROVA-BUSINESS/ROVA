import { useTheme } from '../contexts/ThemeContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Building2 } from 'lucide-react';
import Button from '../components/ui/Button';

export default function PricingPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const PLAN_FEATURES = [
    { name: "Accounting", basic: true, business: true },
    { name: "Income & Expense Tracking", basic: true, business: true },
    { name: "Invoicing", basic: true, business: true },
    { name: "Financial Dashboard", basic: true, business: true },
    { name: "Live Automatic Tracking", basic: true, business: true },
    { name: "Financial Reports", basic: true, business: true },
    { name: "AI Transaction Categorization", basic: true, business: true },
    { name: "Receipt Storage", basic: true, business: true },
    { name: "Inventory Management", basic: false, business: true },
    { name: "Multi-User Access", basic: false, business: true },
    { name: "User Roles & Permissions", basic: false, business: true },
    { name: "Approval Workflows", basic: false, business: true },
    { name: "Payroll Management", basic: false, business: true },
    { name: "Employee Records", basic: false, business: true },
    { name: "Advanced Analytics", basic: false, business: true },
    { name: "Cash Flow Forecasting", basic: false, business: true },
    { name: "AI Financial Assistant", basic: false, business: true },
    { name: "VAT & PAYE Reports", basic: false, business: true },
    { name: "Priority Support", basic: false, business: true },
  ];

  const ADD_ONS = [
    { name: "Payroll Processing", price: "₦100 per employee/month", available: "Basic & Business" },
    { name: "Advanced Payroll (Payslips, Leave Tracking)", price: "₦500/month + ₦100/employee", available: "Basic & Business" },
    { name: "VAT Report Generation", price: "₦1,000/month", available: "Basic" },
    { name: "PAYE Report Generation", price: "₦1,000/month", available: "Basic" },
    { name: "Full Tax Compliance Package", price: "₦2,500/month", available: "Basic" },
    { name: "VAT Filing Assistance", price: "₦5,000 per filing", available: "Both" },
    { name: "Annual Filing Assistance", price: "₦10,000–₦20,000 per filing", available: "Both" },
    { name: "Additional User Seats", price: "₦500/user/month", available: "Basic" },
    { name: "Extra Cloud Storage", price: "₦500/month", available: "Both" },
    { name: "Priority Support", price: "₦1,000/month", available: "Basic" },
  ];

  return (
    <>
      <style>{`
        .prc-root {
          min-height: 100vh;
          background: ${isLight
            ? 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.03) 0%, #f4f4f5 100%)'
            : 'radial-gradient(circle at 0% 0%, rgba(147,51,234,0.05) 0%, #09090b 100%)'};
          color: var(--text-primary);
          font-family: 'Roboto', sans-serif;
          overflow-x: hidden;
          position: relative;
          padding-bottom: 100px;
        }
        .prc-nav {
          height: 70px;
          background: ${isLight ? 'rgba(244,244,245,0.6)' : 'rgba(9,9,11,0.5)'};
          backdrop-filter: blur(20px);
          border-bottom: 1px solid ${isLight ? 'rgba(9,9,11,0.08)' : 'rgba(255,255,255,0.06)'};
          position: sticky; top: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
        }
        .prc-nav-inner {
          width: 100%; max-width: 1200px; padding: 0 20px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .prc-nav-logo { height: 58px; cursor: pointer; }
        .prc-nav-links { display: flex; gap: 24px; }
        .prc-nav-link {
          font-size: 14px; font-weight: 600; color: var(--text-secondary);
          text-decoration: none; transition: color 0.2s;
        }
        .prc-nav-link:hover { color: var(--text-primary); }
        .prc-container {
          max-width: 1100px; margin: 0 auto; padding: 60px 20px;
          position: relative; z-index: 1;
        }
        .prc-header {
          text-align: center; max-width: 700px; margin: 0 auto 50px;
        }
        .prc-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 18px; background: rgba(147,51,234,0.1);
          border-radius: 100px; margin-bottom: 20px;
          border: 1px solid rgba(147,51,234,0.25);
        }
        .prc-badge-text {
          font-size: 11px; font-weight: 800; color: var(--accent-light);
          text-transform: uppercase; letter-spacing: 2px;
        }
        .prc-title {
          font-size: clamp(32px, 4vw, 52px); font-weight: 800; line-height: 1.15;
          margin-bottom: 20px;
        }
        .prc-subtitle {
          font-size: clamp(15px, 1.8vw, 17px); color: var(--text-secondary); line-height: 1.6;
        }
        
        /* Plan Cards */
        .prc-cards-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 70px;
        }
        @media (max-width: 768px) {
          .prc-cards-grid { grid-template-columns: 1fr; }
        }
        .prc-card {
          background: ${isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,22,0.55)'};
          backdrop-filter: blur(30px);
          border: 1px solid var(--bg-border);
          border-radius: var(--radius-xl); padding: 40px;
          display: flex; flex-direction: column; gap: 24px;
          position: relative; transition: all 0.3s ease;
        }
        .prc-card.featured {
          border: 2px solid var(--accent-primary);
          box-shadow: 0 20px 40px -10px rgba(147,51,234,0.15);
        }
        .prc-card-badge {
          position: absolute; top: -14px; right: 28px;
          background: linear-gradient(135deg, var(--accent-primary), #7c3aed);
          color: white; font-size: 10px; font-weight: 800; text-transform: uppercase;
          letter-spacing: 1px; padding: 6px 14px; border-radius: var(--radius-full);
          box-shadow: 0 4px 12px rgba(147,51,234,0.3);
        }
        .prc-plan-name { font-size: 24px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
        .prc-plan-price { font-size: 40px; font-weight: 800; line-height: 1; }
        .prc-plan-price span { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
        .prc-plan-sub { font-size: 14px; color: var(--text-muted); font-weight: 500; }

        /* Comparison Table */
        .prc-table-section { margin-bottom: 80px; }
        .prc-table-title { font-size: 28px; font-weight: 800; margin-bottom: 24px; text-align: center; }
        .prc-table-container {
          background: ${isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,22,0.55)'};
          backdrop-filter: blur(30px);
          border: 1px solid var(--bg-border);
          border-radius: var(--radius-xl); overflow: hidden;
        }
        .prc-table {
          width: 100%; border-collapse: collapse; text-align: left;
        }
        .prc-th {
          padding: 20px 24px; font-size: 14px; font-weight: 700; border-bottom: 1px solid var(--bg-border);
          color: var(--text-primary);
        }
        .prc-td {
          padding: 16px 24px; font-size: 13px; border-bottom: 1px solid var(--bg-border);
          color: var(--text-secondary);
        }
        .prc-tr:last-child .prc-td { border-bottom: none; }
        .prc-tr:hover { background: ${isLight ? 'rgba(9,9,11,0.01)' : 'rgba(255,255,255,0.01)'}; }
        
        .prc-check-icon { color: #10b981; display: inline-flex; }
        .prc-x-icon { color: var(--text-disabled); display: inline-flex; opacity: 0.5; }

        /* Add-Ons Section */
        .prc-addons-section { margin-bottom: 80px; }
        .prc-addons-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;
        }
        .prc-addon-card {
          background: ${isLight ? 'rgba(255,255,255,0.45)' : 'rgba(20,20,22,0.55)'};
          backdrop-filter: blur(20px);
          border: 1px solid var(--bg-border);
          border-radius: var(--radius-lg); padding: 24px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .prc-addon-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
        .prc-addon-price { font-size: 15px; font-weight: 800; color: var(--accent-light); }
        .prc-addon-avail { font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; }

        /* FAQ Section */
        .prc-faq { max-width: 800px; margin: 0 auto; }
        .prc-faq-title { font-size: 26px; font-weight: 800; text-align: center; margin-bottom: 36px; }
        .prc-faq-item { border-bottom: 1px solid var(--bg-border); padding: 18px 0; display: flex; flex-direction: column; gap: 8px; }
        .prc-faq-q { font-size: 15px; font-weight: 700; }
        .prc-faq-a { color: var(--text-secondary); font-size: 13px; line-height: 1.6; }
      `}</style>

      <div className="prc-root">
        {/* Glow Effects */}
        <div style={{
          position: 'absolute', top: '10%', left: '-10%', width: 400, height: 400,
          background: 'rgba(147,51,234,0.08)', filter: 'blur(120px)', borderRadius: '50%',
          zIndex: 0, pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', top: '50%', right: '-10%', width: 350, height: 350,
          background: 'rgba(59,130,246,0.06)', filter: 'blur(120px)', borderRadius: '50%',
          zIndex: 0, pointerEvents: 'none'
        }} />

        {/* Navbar */}
        <nav className="prc-nav">
          <div className="prc-nav-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <Link to="/" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                color: 'var(--text-secondary)', textDecoration: 'none',
                fontSize: 14, fontWeight: 600, padding: '8px 16px',
                borderRadius: 8, background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--bg-border)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              >
                <ArrowLeft size={16} /> Back
              </Link>
              <Link to="/">
                <img src={isLight ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" className="prc-nav-logo" />
              </Link>
            </div>
            <div className="prc-nav-links">
              <Link to="/features" className="prc-nav-link">Features</Link>
              <Link to="/solutions" className="sol-nav-link">Solutions</Link>
              <Link to="/pricing" className="sol-nav-link" style={{ color: 'var(--text-primary)' }}>Pricing</Link>
              <Link to="/company" className="sol-nav-link">Company</Link>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Link to="/login" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>Login</Link>
              <Link to="/signup" className="sol-nav-link" style={{ background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)', color: '#fff', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>Get Started</Link>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="prc-container">
          <header className="prc-header">
            <div className="prc-badge">
              <span className="prc-badge-text">ROVA Subscription Plans</span>
            </div>
            <h1 className="prc-title">
              Simple, transparent pricing <br />
              built for <span style={{ background: 'linear-gradient(135deg, #a855f7, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Nigerian SMEs</span>
            </h1>
            <p className="prc-subtitle">
              Scale your accounting, invoices, and payroll operations. Choose a plan that fits your current operational needs, with flexible custom add-ons.
            </p>
          </header>

          {/* Cards Grid */}
          <div className="prc-cards-grid">
            {/* Basic Plan */}
            <div className="prc-card">
              <div className="prc-plan-name">
                <Building2 size={24} color="var(--text-secondary)" />
                Basic Plan
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, minHeight: 36 }}>
                Ideal for freelancers and small businesses needing clean bookkeeping and professional invoices.
              </p>
              <div className="prc-plan-price">
                ₦100<span> / day</span>
              </div>
              <div className="prc-plan-sub">
                or <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>₦3,000</span> / month
              </div>
              
              <Link to="/signup" style={{ textDecoration: 'none', marginTop: 'auto' }}>
                <Button variant="secondary" style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}>Get Started</Button>
              </Link>
              <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)' }} />
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Full Bookkeeping & Ledger', 'Income & Expense tracking', 'Professional Invoicing', 'Financial Reports (P&L, Balance Sheet)', 'Bank Transaction Import (Mono)', 'AI Transaction Categorization'].map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, fontWeight: 500 }}>
                    <Check size={16} style={{ color: '#10b981' }} /> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Business Plan */}
            <div className="prc-card featured">
              <span className="prc-card-badge">Most Popular</span>
              <div className="prc-plan-name">
                Business Plan
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, minHeight: 36 }}>
                Perfect for growing companies requiring inventory management, payroll processing, and multi-user collaboration.
              </p>
              <div className="prc-plan-price">
                ₦300<span> / day</span>
              </div>
              <div className="prc-plan-sub">
                or <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>₦9,000</span> / month
              </div>
              
              <Link to="/signup" style={{ textDecoration: 'none', marginTop: 'auto' }}>
                <Button variant="primary" style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}>Start Business Trial</Button>
              </Link>
              <hr style={{ border: 'none', borderTop: '1px solid var(--bg-border)' }} />
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Everything in Basic Plan', 'AI Financial Assistant (ROVA Chat)', 'Multi-User Access & Roles', 'Payroll Management & Employee Records', 'Inventory Management', 'Cash Flow Forecasting & Analytics'].map((f, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, fontWeight: 500 }}>
                    <Check size={16} style={{ color: '#10b981' }} /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Features Comparison Table */}
          <section className="prc-table-section">
            <h2 className="prc-table-title">Compare Plan Features</h2>
            <div className="prc-table-container">
              <table className="prc-table">
                <thead>
                  <tr style={{ background: isLight ? '#f9f9fb' : 'rgba(255,255,255,0.02)' }}>
                    <th className="prc-th">Feature</th>
                    <th className="prc-th" style={{ width: '150px' }}>Basic</th>
                    <th className="prc-th" style={{ width: '150px' }}>Business</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_FEATURES.map((item, index) => (
                    <tr key={index} className="prc-tr">
                      <td className="prc-td" style={{ fontWeight: 600 }}>{item.name}</td>
                      <td className="prc-td">
                        {item.basic ? (
                          <span className="prc-check-icon"><Check size={18} /></span>
                        ) : (
                          <span className="prc-x-icon"><X size={18} /></span>
                        )}
                      </td>
                      <td className="prc-td">
                        {item.business ? (
                          <span className="prc-check-icon"><Check size={18} /></span>
                        ) : (
                          <span className="prc-x-icon"><X size={18} /></span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Add-Ons Section */}
          <section className="prc-addons-section">
            <h2 className="prc-table-title">Flexible Add-Ons</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 32, fontSize: 14, maxWidth: 600, margin: '0 auto 32px' }}>
              Only pay for what your business needs. Attach these modules directly to your Basic or Business plan.
            </p>
            <div className="prc-addons-grid">
              {ADD_ONS.map((addon, index) => (
                <div key={index} className="prc-addon-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="prc-addon-name">{addon.name}</div>
                    <span className="prc-addon-avail">{addon.available}</span>
                  </div>
                  <div className="prc-addon-price">{addon.price}</div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ Section */}
          <section className="prc-faq">
            <h2 className="prc-faq-title">Frequently Asked Questions</h2>
            
            <div className="prc-faq-item">
              <h3 className="prc-faq-q">Can I upgrade or downgrade my plan?</h3>
              <p className="prc-faq-a">
                Yes, you can upgrade, downgrade, or cancel your subscription plan at any time directly from your Billing Settings page. Subscriptions can be billed daily or monthly.
              </p>
            </div>

            <div className="prc-faq-item">
              <h3 className="prc-faq-q">How does the Payroll Processing add-on work?</h3>
              <p className="prc-faq-a">
                Basic and Business plans can activate payroll. You are billed ₦100 per active employee per month. If you have 5 employees, you will pay ₦500/month in addition to your base plan.
              </p>
            </div>

            <div className="prc-faq-item">
              <h3 className="prc-faq-q">Do you assist with tax filing?</h3>
              <p className="prc-faq-a">
                Yes! We offer VAT Filing Assistance (₦5,000 per filing) and Annual Corporate Tax Filing Assistance (₦10,000–₦20,000 per filing) where local tax consultants review and submit your books directly to FIRS.
              </p>
            </div>

            <div className="prc-faq-item">
              <h3 className="prc-faq-q">Can I buy additional user seats?</h3>
              <p className="prc-faq-a">
                If you are on the Basic Plan, you can add extra seats for team members or your external accountant at ₦500/seat/month. The Business Plan includes unlimited seat allocations by default.
              </p>
            </div>
          </section>

          <footer style={{ marginTop: 60, paddingTop: 28, borderTop: '1px solid var(--bg-border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>© 2026 ROVA SOFTWARE LIMITED. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </>
  );
}
