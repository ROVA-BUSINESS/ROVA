import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, ChartBar as BarChart2, FileText, Receipt,
  Settings, LogOut, Plus, BookOpen,
  ChevronDown, ChevronRight, ChevronLeft,
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
    label: 'Workspace',
    key: 'workspace',
    items: [
      { to: '/app/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/app/transactions', icon: ArrowLeftRight, label: 'Transactions' },
      { to: '/app/invoices', icon: Receipt, label: 'Invoices' },
      { to: '/app/reports', icon: BarChart2, label: 'Reports Hub' },
      { to: '/app/assistant', icon: Sparkles, label: 'AI Assistant' },
    ],
  },
  {
    label: 'Accounting',
    key: 'accounting',
    items: [
      { to: '/app/accounting', icon: BookOpen, label: 'Accounting Hub' },
    ],
  },
  {
    label: 'Compliance',
    key: 'compliance',
    items: [
      { to: '/app/tax', icon: FileText, label: 'Tax & Compliance' },
    ],
  },
  {
    label: 'Operations',
    key: 'operations',
    items: [
      { to: '/app/team', icon: Shield, label: 'Team & Access' },
      { to: '/app/payroll', icon: Users, label: 'Payroll' },
      { to: '/app/inventory', icon: Package, label: 'Inventory' },
    ],
  },
  {
    label: 'System',
    key: 'system',
    items: [
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['accounting', 'operations']));
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

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
      if (group.key === 'workspace') {
        return {
          ...group,
          items: group.items.filter(item => item.to !== '/app/reports') // Staff don't see reports
        };
      }
      if (group.key === 'system') return group;
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
        width: isMobile ? 220 : (isDesktopCollapsed ? 68 : 220),
        minWidth: isMobile ? 220 : (isDesktopCollapsed ? 68 : 220),
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
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        <div style={{ padding: '16px 0', borderBottom: '1px solid var(--bg-border)', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          {!isDesktopCollapsed ? (
            <div style={{
              width: 140, height: 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <img src={theme === 'light' ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" style={{ width: '100%', height: 'auto', objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{ height: 24 }} /> // Placeholder to maintain height
          )}
          {isMobile && (
            <button onClick={onClose} style={{ position: 'absolute', right: 10, color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          )}
        </div>

        {!isMobile && (
          <button
            onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
            style={{ 
              position: 'absolute', right: -12, top: 24, 
              background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', 
              borderRadius: '50%', width: 24, height: 24, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              cursor: 'pointer', zIndex: 100, color: 'var(--text-muted)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
          >
            {isDesktopCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}


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
          {!isDesktopCollapsed && (
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
          )}
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
          {!isDesktopCollapsed && 'Add Transaction'}
        </button>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 8px', flex: 1, overflowY: 'auto' }}>
        {filteredNavGroups.map(group => (
          <div key={group.key} style={{ marginBottom: 2 }}>
            {(group.label !== 'Workspace' && group.label !== 'System' && !isDesktopCollapsed) && (
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

            {(!collapsed.has(group.key) || isDesktopCollapsed) && (
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
                    <Icon size={13} style={{ flexShrink: 0 }} />
                    {!isDesktopCollapsed && label}
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
          <LogOut size={15} style={{ flexShrink: 0 }} />
          {!isDesktopCollapsed && 'Sign out'}
        </button>
      </div>
    </aside>
    </>
  );
}
