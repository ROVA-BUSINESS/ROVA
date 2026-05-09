import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, ChartBar as BarChart2, FileText, Receipt,
  Settings, LogOut, Plus, BookOpen, Layers, BookMarked,
  Scale, TrendingUp, LayoutList, Banknote, ChevronDown, ChevronRight,
  Sparkles, Users, Package, Shield, X
} from 'lucide-react';
import { useMobile } from '../../hooks/useMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getInitials } from '../../lib/format';
import QuickAddModal from '../QuickAddModal';

type NavItem = { to: string; icon: React.ElementType; label: string };

type NavGroup = {
  label: string;
  key: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    key: 'overview',
    items: [
      { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/app/assistant', icon: Sparkles, label: 'AI Assistant' },
    ],
  },
  {
    label: 'Transactions',
    key: 'transactions',
    items: [
      { to: '/app/transactions', icon: ArrowLeftRight, label: 'All Transactions' },
    ],
  },
  {
    label: 'Financial Records',
    key: 'records',
    items: [
      { to: '/app/ledger', icon: BookOpen, label: 'General Ledger' },
      { to: '/app/chart-of-accounts', icon: Layers, label: 'Chart of Accounts' },
      { to: '/app/journal-entries', icon: BookMarked, label: 'Journal Entries' },
      { to: '/app/trial-balance', icon: Scale, label: 'Trial Balance' },
    ],
  },
  {
    label: 'Financial Statements',
    key: 'statements',
    items: [
      { to: '/app/profit-loss', icon: TrendingUp, label: 'Profit & Loss' },
      { to: '/app/balance-sheet', icon: LayoutList, label: 'Balance Sheet' },
      { to: '/app/cash-flow', icon: Banknote, label: 'Cash Flow' },
    ],
  },
  {
    label: 'People & Operations',
    key: 'people',
    items: [
      { to: '/app/payroll', icon: Users, label: 'Payroll & Staff' },
      { to: '/app/inventory', icon: Package, label: 'Inventory' },
      { to: '/app/team', icon: Shield, label: 'Team & Access' },
    ],
  },
  {
    label: 'More',
    key: 'more',
    items: [
      { to: '/app/reports', icon: BarChart2, label: 'Reports' },
      { to: '/app/invoices', icon: Receipt, label: 'Invoices' },
      { to: '/app/tax', icon: FileText, label: 'Tax & Compliance' },
      { to: '/app/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { user, profile, isStaff, signOut } = useAuth();
  const { theme } = useTheme();
  const isMobile = useMobile();
  const navigate = useNavigate();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  function toggleGroup(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const displayName = profile?.full_name || profile?.business_name || user?.email?.split('@')[0] || 'User';
  const initials = getInitials(displayName);

  const filteredNavGroups = navGroups.map(group => {
    if (isStaff) {
      if (group.key === 'overview') return group;
      if (group.key === 'transactions') return group;
      if (group.key === 'more') {
        return {
          ...group,
          items: group.items.filter(item => item.to === '/app/invoices' || item.to === '/app/settings')
        };
      }
      return null;
    }
    return group;
  }).filter(Boolean) as NavGroup[];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobile && isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 40, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <aside style={{
        width: 220,
        minWidth: 220,
        height: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--bg-border)',
        display: 'flex',
        flexDirection: 'column',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        zIndex: 50,
        transform: isMobile ? (isOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflowY: 'auto',
      }}>
        <div style={{ padding: '16px 0', borderBottom: '1px solid var(--bg-border)', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          <div style={{
            width: 140, height: 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <img src={theme === 'light' ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
          </div>
          {isMobile && (
            <button onClick={onClose} style={{ position: 'absolute', right: 10, color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          )}
        </div>


      <div style={{ padding: '12px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--bg-border)', margin: '0 6px', flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, var(--accent-primary), #7e22ce)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>

        </div>
      </div>

      <div style={{ padding: '10px 10px 0', flexShrink: 0 }}>
        <button
          onClick={() => setShowQuickAdd(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '10px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600,
            background: 'linear-gradient(135deg, var(--accent-primary), #7e22ce)',
            color: 'white', border: 'none',
            boxShadow: '0 2px 12px rgba(147,51,234,0.35)',
            transition: 'all 0.15s ease', cursor: 'pointer',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(147,51,234,0.5)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(147,51,234,0.35)';
          }}
        >
          <Plus size={14} />
          Add Transaction
        </button>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 8px' }}>
        {filteredNavGroups.map(group => (
          <div key={group.key} style={{ marginBottom: 2 }}>
            {group.label !== 'Overview' && (
              <button
                onClick={() => toggleGroup(group.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 8px 4px',
                  background: 'none', cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {group.label}
                </span>
                {collapsed.has(group.key)
                  ? <ChevronRight size={10} color="var(--text-muted)" />
                  : <ChevronDown size={10} color="var(--text-muted)" />
                }
              </button>
            )}

            {!collapsed.has(group.key) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {group.items.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    style={({ isActive }) => ({
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 8px',
                      borderRadius: 'var(--radius-md)',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      background: isActive ? 'var(--accent-dim)' : 'transparent',
                      borderLeft: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 12,
                      transition: 'all 0.15s ease',
                      textDecoration: 'none',
                    })}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLElement;
                      if (!el.getAttribute('aria-current')) {
                        el.style.background = 'var(--bg-hover)';
                        el.style.color = 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLElement;
                      if (!el.getAttribute('aria-current')) {
                        el.style.background = 'transparent';
                        el.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    <Icon size={13} />
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <QuickAddModal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />

      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--bg-border)', flexShrink: 0 }}>
        <button
          onClick={handleSignOut}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', width: '100%',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-muted)', fontSize: 13,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--error-dim)';
            (e.currentTarget as HTMLElement).style.color = 'var(--error)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
    </>
  );
}
