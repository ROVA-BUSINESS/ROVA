import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, FileText, CreditCard, Link2, CornerDownLeft, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/format';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Pages' | 'Transactions' | 'Invoices';
  url: string;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
}

const STATIC_PAGES = [
  { title: 'Dashboard', subtitle: 'Overview, financial stats, and recent activities', url: '/app/dashboard' },
  { title: 'Transactions', subtitle: 'View, edit, and export transactions', url: '/app/transactions' },
  { title: 'Invoices', subtitle: 'Create invoices, track customer payments', url: '/app/invoices' },
  { title: 'Expenses & Bills', subtitle: 'Manage operating costs, vendor bills, and expenses', url: '/app/expenses' },
  { title: 'Inventory', subtitle: 'Stock management, product catalogue, and reorder levels', url: '/app/inventory' },
  { title: 'Tax', subtitle: 'CIT, VAT, withholding tax calculations, and NRS filing', url: '/app/tax' },
  { title: 'Payroll', subtitle: 'Salary processing, employee payslips, and PAYE tax', url: '/app/payroll' },
  { title: 'Team & Access Control', subtitle: 'Manage staff accounts, roles, and activity logs', url: '/app/team' },
  { title: 'Accounting Hub', subtitle: 'Master ledger, chart of accounts, and financial reports', url: '/app/accounting' },
  { title: 'General Ledger', subtitle: 'Detailed record of all account transactions', url: '/app/ledger' },
  { title: 'Chart of Accounts', subtitle: 'Financial structure and account list', url: '/app/chart-of-accounts' },
  { title: 'Reports Hub', subtitle: 'Financial statements, analytics, and export tools', url: '/app/reports' },
  { title: 'AI Assistant', subtitle: 'Chat with ROVA AI, query financial records', url: '/app/assistant' },
  { title: 'Settings', subtitle: 'Manage business profile, team members, and bank connections', url: '/app/settings' }
];

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults(STATIC_PAGES.map(p => ({
        id: p.url,
        title: p.title,
        subtitle: p.subtitle,
        category: 'Pages',
        url: p.url
      })));
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

    if (!query.trim()) {
      // Show default pages
      setResults(STATIC_PAGES.map(p => ({
        id: p.url,
        title: p.title,
        subtitle: p.subtitle,
        category: 'Pages',
        url: p.url
      })));
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const matchingPages = STATIC_PAGES.filter(p => 
          p.title.toLowerCase().includes(query.toLowerCase()) || 
          p.subtitle.toLowerCase().includes(query.toLowerCase())
        ).map(p => ({
          id: p.url,
          title: p.title,
          subtitle: p.subtitle,
          category: 'Pages' as const,
          url: p.url
        }));

        if (!user) {
          setResults(matchingPages);
          setSelectedIndex(0);
          setLoading(false);
          return;
        }

        // Search Transactions & Invoices in parallel
        const [txRes, invRes] = await Promise.all([
          supabase
            .from('transactions')
            .select('id, description, amount, type, date')
            .eq('user_id', user.id)
            .ilike('description', `%${query}%`)
            .limit(5),
          supabase
            .from('invoices')
            .select('id, client_name, invoice_number, total')
            .eq('user_id', user.id)
            .or(`client_name.ilike.%${query}%,invoice_number.ilike.%${query}%`)
            .limit(5)
        ]);

        const matchingTx = (txRes.data || []).map(tx => ({
          id: tx.id,
          title: tx.description || 'Untitled Transaction',
          subtitle: `${new Date(tx.date).toLocaleDateString()} • ${tx.type === 'income' ? 'Income' : tx.type === 'expense' ? 'Expense' : 'Transfer'}`,
          category: 'Transactions' as const,
          url: '/app/transactions',
          amount: tx.amount,
          type: tx.type
        }));

        const matchingInv = (invRes.data || []).map(inv => ({
          id: inv.id,
          title: `Invoice ${inv.invoice_number}`,
          subtitle: `Client: ${inv.client_name}`,
          category: 'Invoices' as const,
          url: '/app/invoices',
          amount: inv.total,
          type: 'income' as const // Invoices are income source
        }));

        setResults([...matchingPages, ...matchingTx, ...matchingInv]);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen, user]);

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

  const handleSelect = (item: SearchResultItem) => {
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
            placeholder="Search transactions, invoices, or pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              color: 'var(--text-primary)', fontSize: 15, outline: 'none',
              padding: 0
            }}
          />
          {loading ? (
            <Loader2 size={16} color="var(--text-muted)" className="spin" style={{ marginRight: 12 }} />
          ) : query ? (
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
              <p style={{ fontSize: 12, color: 'var(--text-disabled)', marginTop: 4 }}>Try searching for standard pages, transaction names, or invoice customers.</p>
            </div>
          ) : (
            <div>
              {/* Grouping results by category */}
              {['Pages', 'Transactions', 'Invoices'].map((cat) => {
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
                            {cat === 'Pages' && <Link2 size={16} />}
                            {cat === 'Transactions' && <CreditCard size={16} />}
                            {cat === 'Invoices' && <FileText size={16} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 14, fontWeight: 600,
                              color: isSelected ? 'var(--text-primary)' : 'var(--text-primary)'
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
                          {item.amount !== undefined && (
                            <div style={{
                              fontSize: 14, fontWeight: 600,
                              color: item.type === 'income' ? 'var(--success)' : 'var(--error)'
                            }}>
                              {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                            </div>
                          )}
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
