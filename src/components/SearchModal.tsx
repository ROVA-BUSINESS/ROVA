import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Link2, CornerDownLeft } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchSectionItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  url: string;
  keywords: string[];
}

const APP_SECTIONS: SearchSectionItem[] = [
  { id: 'dashboard', title: 'Dashboard', subtitle: 'Overview, financial stats, and business health', category: 'Main Sections', url: '/app/dashboard', keywords: ['overview', 'metrics', 'home', 'stats', 'balance', 'revenue'] },
  { id: 'transactions', title: 'Transactions', subtitle: 'View, edit, filter, and export income & expenses', category: 'Main Sections', url: '/app/transactions', keywords: ['transactions', 'records', 'income', 'expenses', 'sales', 'bank', 'history'] },
  { id: 'invoices', title: 'Invoices', subtitle: 'Create client invoices and track customer payments', category: 'Main Sections', url: '/app/invoices', keywords: ['invoices', 'clients', 'customers', 'sales', 'billing', 'payments', 'quotes'] },
  { id: 'receipts', title: 'Receipts', subtitle: 'Upload and manage scanned receipts with OCR', category: 'Main Sections', url: '/app/receipts', keywords: ['receipts', 'scan', 'ocr', 'vouchers', 'upload', 'proof'] },
  { id: 'expenses', title: 'Bills & Expenses', subtitle: 'Manage operating costs, recurring bills, and vendors', category: 'Main Sections', url: '/app/expenses', keywords: ['expenses', 'bills', 'costs', 'vendors', 'recurring', 'utilities', 'rent'] },
  { id: 'inventory', title: 'Inventory', subtitle: 'Stock management, product catalogue, and reorder alerts', category: 'Operations & Team', url: '/app/inventory', keywords: ['inventory', 'stock', 'items', 'products', 'catalogue', 'warehouse', 'goods'] },
  { id: 'tax', title: 'Tax', subtitle: 'CIT, VAT, and withholding tax calculations and filing', category: 'Accounting & Tax', url: '/app/tax', keywords: ['tax', 'compliance', 'cit', 'vat', 'wht', 'withholding', 'nrs', 'filing', 'firs'] },
  { id: 'cit-wizard', title: 'CIT Filing Wizard', subtitle: 'Step-by-step NRS corporate income tax return filing', category: 'Accounting & Tax', url: '/app/tax/cit/new', keywords: ['cit', 'filing wizard', 'nrs', 'company income tax', 'tax return', 'annual filing'] },
  { id: 'payroll', title: 'Payroll', subtitle: 'Salary processing, employee payslips, and PAYE tax', category: 'Operations & Team', url: '/app/payroll', keywords: ['payroll', 'salaries', 'wages', 'employees', 'payslips', 'paye', 'remittances'] },
  { id: 'team', title: 'Team & Access Control', subtitle: 'Manage staff accounts, invitations, roles, and logs', category: 'Operations & Team', url: '/app/team', keywords: ['team', 'staff', 'members', 'users', 'roles', 'permissions', 'access', 'invite'] },
  { id: 'accounting-hub', title: 'Accounting Hub', subtitle: 'Master ledger, financial statements, and chart of accounts', category: 'Accounting & Tax', url: '/app/accounting', keywords: ['accounting', 'hub', 'books', 'bookkeeping', 'finance'] },
  { id: 'ledger', title: 'General Ledger', subtitle: 'Detailed double-entry records of all accounts', category: 'Accounting & Tax', url: '/app/ledger', keywords: ['ledger', 'general ledger', 'debit', 'credit', 'double entry', 'accounts'] },
  { id: 'chart-of-accounts', title: 'Chart of Accounts', subtitle: 'Financial structure, asset, liability, and equity accounts', category: 'Accounting & Tax', url: '/app/chart-of-accounts', keywords: ['chart of accounts', 'coa', 'assets', 'liabilities', 'equity'] },
  { id: 'balance-sheet', title: 'Balance Sheet', subtitle: 'Assets, liabilities, and business net worth', category: 'Accounting & Tax', url: '/app/balance-sheet', keywords: ['balance sheet', 'assets', 'liabilities', 'equity', 'net worth'] },
  { id: 'profit-loss', title: 'Profit & Loss (P&L)', subtitle: 'Income statement, gross margins, and net income', category: 'Accounting & Tax', url: '/app/profit-loss', keywords: ['profit and loss', 'p&l', 'income statement', 'revenue', 'margins'] },
  { id: 'cash-flow', title: 'Cash Flow Statement', subtitle: 'Operating, investing, and financing cash movements', category: 'Accounting & Tax', url: '/app/cash-flow', keywords: ['cash flow', 'cashflow', 'liquidity', 'inflows', 'outflows'] },
  { id: 'trial-balance', title: 'Trial Balance', subtitle: 'Summary of debit and credit balances across accounts', category: 'Accounting & Tax', url: '/app/trial-balance', keywords: ['trial balance', 'balancing', 'credits', 'debits'] },
  { id: 'reports', title: 'Reports Hub', subtitle: 'Financial statements, analytics, and data exports', category: 'Accounting & Tax', url: '/app/reports', keywords: ['reports', 'analytics', 'export', 'download', 'csv', 'summary'] },
  { id: 'assistant', title: 'AI Assistant', subtitle: 'Chat with ROVA AI, ask questions, or record data', category: 'Main Sections', url: '/app/assistant', keywords: ['ai', 'assistant', 'bot', 'chat', 'copilot', 'help', 'ask'] },
  { id: 'settings', title: 'Business Profile & Settings', subtitle: 'Manage company information, logo, and address', category: 'Settings & Account', url: '/app/settings', keywords: ['settings', 'profile', 'business name', 'logo', 'company'] },
  { id: 'bank-connections', title: 'Bank Connections', subtitle: 'Connect bank accounts via Mono or Email statement sync', category: 'Settings & Account', url: '/app/settings?tab=banks', keywords: ['bank', 'banks', 'connect', 'mono', 'link bank', 'sync', 'open banking'] },
  { id: 'whatsapp-bot', title: 'WhatsApp Bot Settings', subtitle: 'Connect and configure WhatsApp automated bookkeeping', category: 'Settings & Account', url: '/app/settings?tab=whatsapp', keywords: ['whatsapp', 'bot', 'number', 'whatsapp ai', 'mobile'] },
  { id: 'security', title: 'Security & Access', subtitle: 'Manage password, authentication, and account settings', category: 'Settings & Account', url: '/app/settings?tab=security', keywords: ['security', 'password', 'delete account', 'credentials'] },
  { id: 'billing', title: 'Billing & Subscriptions', subtitle: 'Subscription plans, payment history, and tax services', category: 'Settings & Account', url: '/app/billing', keywords: ['billing', 'subscription', 'pricing', 'plans', 'upgrade', 'pay'] }
];

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchSectionItem[]>(APP_SECTIONS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(APP_SECTIONS);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle global key events (Esc, Slash, Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === '/' && !isOpen && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Perform search when query changes
  useEffect(() => {
    if (!isOpen) return;

    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      setResults(APP_SECTIONS);
      setSelectedIndex(0);
      return;
    }

    const matches = APP_SECTIONS.filter(item => {
      const matchTitle = item.title.toLowerCase().includes(trimmed);
      const matchSubtitle = item.subtitle.toLowerCase().includes(trimmed);
      const matchCategory = item.category.toLowerCase().includes(trimmed);
      const matchKeywords = item.keywords.some(kw => kw.toLowerCase().includes(trimmed) || trimmed.includes(kw.toLowerCase()));
      return matchTitle || matchSubtitle || matchCategory || matchKeywords;
    });

    setResults(matches);
    setSelectedIndex(0);
  }, [query, isOpen]);

  // Handle key navigation within results
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const handleSelect = (item: SearchSectionItem) => {
    navigate(item.url);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)',
        zIndex: 9999, display: 'flex', justifyContent: 'center', padding: '10vh 20px 0'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        ref={modalRef}
        style={{
          width: '100%', maxWidth: 600, background: 'var(--bg-card)',
          border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-xl)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex', flexDirection: 'column', maxHeight: '70vh',
          animation: 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--bg-border)' }}>
          <Search size={18} color="var(--text-muted)" style={{ marginRight: 12, flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search sections, features, settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: 'var(--text-primary)', fontSize: 15, outline: 'none',
              padding: 0
            }}
          />
          {query ? (
            <button 
              onClick={() => setQuery('')}
              style={{ background: 'transparent', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', marginRight: 8 }}
            >
              <X size={14} color="var(--text-muted)" />
            </button>
          ) : null}
          <div style={{
            fontSize: 10, padding: '2px 6px', background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)', borderRadius: 4, color: 'var(--text-muted)',
            fontFamily: 'monospace', userSelect: 'none'
          }}>
            ESC
          </div>
        </div>

        {/* Results List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: 14, fontWeight: 500 }}>No results found for "{query}"</p>
              <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 4 }}>Try searching for a section like "Inventory", "Transactions", "Tax", or "Payroll".</p>
            </div>
          ) : (
            <div>
              {/* Grouping results by section category */}
              {['Main Sections', 'Accounting & Tax', 'Operations & Team', 'Settings & Account'].map((cat) => {
                const catResults = results.filter(r => r.category === cat);
                if (catResults.length === 0) return null;

                return (
                  <div key={cat} style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--accent-primary)',
                      padding: '4px 12px', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      {cat}
                    </div>
                    {catResults.map((item) => {
                      // Find overall index of this item in the flat results array
                      const overallIndex = results.indexOf(item);
                      const isSelected = overallIndex === selectedIndex;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(overallIndex)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', borderRadius: 'var(--radius-md)',
                            background: isSelected ? 'var(--accent-dim)' : 'transparent',
                            cursor: 'pointer', transition: 'background 0.15s'
                          }}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: isSelected ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                            color: isSelected ? '#ffffff' : 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            <Link2 size={16} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 14, fontWeight: 600,
                              color: 'var(--text-primary)'
                            }}>
                              {item.title}
                            </div>
                            <div style={{
                              fontSize: 12, color: 'var(--text-muted)',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                              {item.subtitle}
                            </div>
                          </div>
                          {isSelected && (
                            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--accent-primary)' }}>
                              <CornerDownLeft size={14} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '12px 20px', borderTop: '1px solid var(--bg-border)',
          background: 'var(--bg-elevated)', borderBottomLeftRadius: 'var(--radius-xl)',
          borderBottomRightRadius: 'var(--radius-xl)', fontSize: 11, color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ padding: '1px 4px', background: 'var(--bg-card)', border: '1px solid var(--bg-border)', borderRadius: 3 }}>↑↓</span> Navigate
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ padding: '1px 6px', background: 'var(--bg-card)', border: '1px solid var(--bg-border)', borderRadius: 3 }}>Enter</span> Select
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ padding: '1px 6px', background: 'var(--bg-card)', border: '1px solid var(--bg-border)', borderRadius: 3 }}>/</span> Search shortcut
          </div>
        </div>
      </div>
    </div>
  );
}
