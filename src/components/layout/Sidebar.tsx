import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, ArrowLeftRight, ChartBar as BarChart2, FileText, Receipt,
  Settings, LogOut, Plus, BookOpen,
  ChevronDown, ChevronRight, ChevronsUpDown,
  Users, Package, Shield, X, Brain,
  TrendingDown
} from 'lucide-react';
import { useMobile } from '../../hooks/useMobile';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getInitials } from '../../lib/format';
import QuickAddModal from '../QuickAddModal';

// Custom SVG Icons for sidebar panel toggle to ensure compatibility
const PanelLeftCloseIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m16 15-3-3 3-3" />
  </svg>
);

const PanelLeftOpenIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <path d="M9 3v18" />
    <path d="m14 9 3 3-3 3" />
  </svg>
);

type NavItem = { to: string; icon: React.ElementType; label: string };

type NavGroupItem = {
  type: 'link';
  to: string;
  icon: React.ElementType;
  label: string;
} | {
  type: 'group';
  label: string;
  key: string;
  icon: React.ElementType;
  items: NavItem[];
};

const mainNavItems: NavGroupItem[] = [
  { type: 'link', to: '/app/dashboard', icon: Home, label: 'Home' },
  { type: 'link', to: '/app/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { type: 'link', to: '/app/invoices', icon: Receipt, label: 'Invoices' },
  { type: 'link', to: '/app/expenses', icon: TrendingDown, label: 'Bills & Expenses' },
  { type: 'link', to: '/app/reports', icon: BarChart2, label: 'Reports Hub' },
  { type: 'link', to: '/app/assistant', icon: Brain, label: 'AI Assistant' },
  {
    type: 'group',
    label: 'Accounting',
    key: 'accounting',
    icon: BookOpen,
    items: [
      { to: '/app/accounting', icon: BookOpen, label: 'Accounting Hub' }
    ]
  },
  {
    type: 'group',
    label: 'Compliance',
    key: 'compliance',
    icon: Shield,
    items: [
      { to: '/app/tax', icon: FileText, label: 'Tax & Compliance' }
    ]
  },
  {
    type: 'group',
    label: 'Operations',
    key: 'operations',
    icon: Users,
    items: [
      { to: '/app/team', icon: Shield, label: 'Team & Access' },
      { to: '/app/payroll', icon: Users, label: 'Payroll' },
      { to: '/app/inventory', icon: Package, label: 'Inventory' }
    ]
  }
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
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [showHeaderDropdown, setShowHeaderDropdown] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(['accounting', 'compliance', 'operations']));

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const displayName = profile?.full_name || profile?.business_name || user?.email?.split('@')[0] || 'User';
  const initials = getInitials(displayName);

  // Filter navigation items based on user role (isStaff logic)
  const visibleNavItems = mainNavItems.filter(item => {
    if (isStaff) {
      if (item.type === 'link') {
        return item.to !== '/app/reports'; // Staff do not see reports
      }
      return false; // Hide Accounting, Compliance, and Operations for staff
    }
    return true;
  });

  const isLight = theme === 'light';
  const sidebarBg = isLight ? '#f9f9fb' : '#09090b';
  const sidebarBorder = isLight ? '#eaeaea' : '#27272a';
  const itemColor = isLight ? '#55555d' : '#a1a1aa';
  const hoverBg = isLight ? '#f5f5f7' : '#1f2937';
  const activeBg = isLight ? '#f1f1f4' : '#27272a';
  const textColorActive = isLight ? '#09090b' : '#fafafa';

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
        width: isMobile ? 240 : (isDesktopCollapsed ? 68 : 240),
        minWidth: isMobile ? 240 : (isDesktopCollapsed ? 68 : 240),
        height: '100dvh',
        background: sidebarBg,
        borderRight: `1px solid ${sidebarBorder}`,
        display: 'flex',
        flexDirection: 'column',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        zIndex: 50,
        transform: isMobile ? (isOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: '16px 0',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          width: '100%',
          height: '100%'
        }}>
          {/* Top Header - Brand Logo */}
          <div style={{
          padding: !isDesktopCollapsed ? '24px 20px 16px' : '12px 0 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
          gap: !isDesktopCollapsed ? 0 : 8
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: !isDesktopCollapsed ? 88 : 40,
            width: '100%'
          }}>
            {!isDesktopCollapsed ? (
              <img 
                src={isLight ? "/rova-light.png" : "/rova.png"} 
                alt="ROVA Logo" 
                style={{ height: 84, width: 'auto', objectFit: 'contain' }} 
              />
            ) : (
              <img 
                src={isLight ? "/rova-light.png" : "/rova.png"} 
                alt="ROVA Icon" 
                style={{ height: 36, width: 'auto', objectFit: 'contain' }} 
              />
            )}
          </div>

          {/* Collapse Button inside Header */}
          {!isMobile && (
            <button
              onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 6,
                color: 'var(--text-muted)',
                transition: 'all 0.2s',
                cursor: 'pointer',
                border: 'none',
                background: 'transparent',
                position: !isDesktopCollapsed ? 'absolute' : 'relative',
                right: !isDesktopCollapsed ? 12 : undefined,
                top: !isDesktopCollapsed ? 12 : undefined,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = hoverBg;
                (e.currentTarget as HTMLElement).style.color = isLight ? '#111827' : '#fafafa';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              }}
            >
              {isDesktopCollapsed ? <PanelLeftOpenIcon size={15} /> : <PanelLeftCloseIcon size={15} />}
            </button>
          )}

          {isMobile && (
            <button 
              onClick={onClose} 
              style={{ 
                color: 'var(--text-muted)', 
                display: 'flex', 
                alignItems: 'center', 
                border: 'none', 
                background: 'transparent',
                position: 'absolute',
                right: 16,
                top: 16
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Workspace Selector Card */}
        <div style={{ padding: '0 10px 12px', position: 'relative', flexShrink: 0 }}>
          <div 
            onClick={() => setShowHeaderDropdown(!showHeaderDropdown)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isDesktopCollapsed ? 'center' : 'space-between',
              gap: isDesktopCollapsed ? 0 : 8,
              padding: '8px 10px',
              borderRadius: '10px',
              background: isLight ? '#ffffff' : '#141416',
              border: `1px solid ${sidebarBorder}`,
              cursor: 'pointer',
              userSelect: 'none',
              boxShadow: isLight ? '0 1px 2px rgba(0,0,0,0.02)' : 'none',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = hoverBg}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isLight ? '#ffffff' : '#141416'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* circular brand logo representation */}
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 10, fontWeight: 700, flexShrink: 0,
                lineHeight: '20px'
              }}>
                {initials}
              </div>
              {!isDesktopCollapsed && (
                <span style={{ fontSize: 13, fontWeight: 600, color: isLight ? '#1f2937' : '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 125 }}>
                  {displayName}
                </span>
              )}
            </div>
            {!isDesktopCollapsed && (
              <ChevronsUpDown size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            )}
          </div>

          {/* Workspace dropdown menu */}
          {showHeaderDropdown && (
            <div style={{
              position: 'absolute',
              top: '44px',
              left: '10px',
              right: '10px',
              zIndex: 1000,
              background: isLight ? '#ffffff' : '#18181b',
              border: `1px solid ${sidebarBorder}`,
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              padding: '4px',
            }}>
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${isLight ? '#f4f4f5' : '#27272a'}`, marginBottom: '4px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                  Workspace
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isLight ? '#1f2937' : '#fafafa', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </div>
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  fontSize: 12,
                  borderRadius: '6px',
                  color: isLight ? '#ef4444' : '#f87171',
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: 'none',
                  background: 'transparent'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = isLight ? '#fef2f2' : 'rgba(239,68,68,0.1)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <LogOut size={13} />
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Primary Action Button (New Transaction) */}
        <div style={{ padding: '0 10px 8px', display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          <button
            onClick={() => setShowQuickAdd(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isDesktopCollapsed ? 'center' : 'flex-start',
              gap: isDesktopCollapsed ? 0 : 10,
              padding: '8px 10px',
              borderRadius: '6px',
              color: itemColor,
              fontSize: '13px',
              fontWeight: '500',
              transition: 'all 0.15s ease',
              cursor: 'pointer',
              width: '100%',
              border: 'none',
              background: 'transparent'
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = hoverBg;
              (e.currentTarget as HTMLElement).style.color = textColorActive;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = itemColor;
            }}
          >
            <Plus size={16} style={{ flexShrink: 0 }} />
            {!isDesktopCollapsed && 'Add Transaction'}
          </button>
        </div>

        {/* Navigation Items List */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 10px', flexShrink: 0 }}>
          {visibleNavItems.map(item => {
            if (item.type === 'link') {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isDesktopCollapsed ? 'center' : 'flex-start',
                    gap: isDesktopCollapsed ? 0 : 10,
                    padding: '8px 10px',
                    borderRadius: '6px',
                    color: isActive ? textColorActive : itemColor,
                    background: isActive ? activeBg : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: 13,
                    transition: 'all 0.15s ease',
                    textDecoration: 'none',
                    margin: '1px 0'
                  })}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    if (!el.getAttribute('aria-current')) {
                      el.style.background = hoverBg;
                      el.style.color = textColorActive;
                    }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    if (!el.getAttribute('aria-current')) {
                      el.style.background = 'transparent';
                      el.style.color = itemColor;
                    }
                  }}
                >
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  {!isDesktopCollapsed && item.label}
                </NavLink>
              );
            } else {
              // Collapsible Group Button (Accounting, Compliance, Operations) rendered inline inside the main list!
              const Icon = item.icon;
              const isCollapsed = collapsedGroups.has(item.key);
              
              return (
                <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <button
                    onClick={() => toggleGroup(item.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isDesktopCollapsed ? 'center' : 'space-between',
                      gap: isDesktopCollapsed ? 0 : 10,
                      padding: '8px 10px',
                      borderRadius: '6px',
                      color: itemColor,
                      fontSize: '13px',
                      fontWeight: '500',
                      transition: 'all 0.15s ease',
                      cursor: 'pointer',
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      margin: '1px 0'
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = hoverBg;
                      (e.currentTarget as HTMLElement).style.color = textColorActive;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = itemColor;
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: isDesktopCollapsed ? 0 : 10 }}>
                      <Icon size={16} style={{ flexShrink: 0 }} />
                      {!isDesktopCollapsed && item.label}
                    </div>
                    {!isDesktopCollapsed && (
                      isCollapsed 
                        ? <ChevronRight size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        : <ChevronDown size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    )}
                  </button>

                  {/* Render Nested Sub-links when expanded */}
                  {!isCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {item.items.map(({ to, icon: SubIcon, label }) => (
                        <NavLink
                          key={to}
                          to={to}
                          style={({ isActive }) => ({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isDesktopCollapsed ? 'center' : 'flex-start',
                            gap: isDesktopCollapsed ? 0 : 10,
                            padding: isDesktopCollapsed ? '8px 0' : '8px 10px 8px 32px',
                            borderRadius: '6px',
                            color: isActive ? textColorActive : itemColor,
                            background: isActive ? activeBg : 'transparent',
                            fontWeight: isActive ? 600 : 500,
                            fontSize: 12.5,
                            transition: 'all 0.15s ease',
                            textDecoration: 'none',
                            margin: '1px 0'
                          })}
                          onMouseEnter={e => {
                            const el = e.currentTarget as HTMLElement;
                            if (!el.getAttribute('aria-current')) {
                              el.style.background = hoverBg;
                              el.style.color = textColorActive;
                            }
                          }}
                          onMouseLeave={e => {
                            const el = e.currentTarget as HTMLElement;
                            if (!el.getAttribute('aria-current')) {
                              el.style.background = 'transparent';
                              el.style.color = itemColor;
                            }
                          }}
                        >
                          <SubIcon size={14} style={{ flexShrink: 0 }} />
                          {!isDesktopCollapsed && label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
          })}
        </nav>

        {/* Quick Add Modal component */}
        <QuickAddModal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />

        <div style={{ flex: 1 }} />

        {/* Bottom Section - Settings & Sign Out */}
        <div style={{
          padding: '8px 10px 0',
          borderTop: `1px solid ${sidebarBorder}`,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}>
          {/* Settings Link */}
          <NavLink
            to="/app/settings"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: isDesktopCollapsed ? 'center' : 'flex-start',
              gap: isDesktopCollapsed ? 0 : 10,
              padding: '8px 10px',
              borderRadius: '6px',
              color: isActive ? textColorActive : itemColor,
              background: isActive ? activeBg : 'transparent',
              fontWeight: isActive ? 600 : 500,
              fontSize: 13,
              transition: 'all 0.15s ease',
              textDecoration: 'none',
              width: '100%'
            })}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              if (!el.getAttribute('aria-current')) {
                el.style.background = hoverBg;
                el.style.color = textColorActive;
              }
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              if (!el.getAttribute('aria-current')) {
                el.style.background = 'transparent';
                el.style.color = itemColor;
              }
            }}
          >
            <Settings size={16} style={{ flexShrink: 0 }} />
            {!isDesktopCollapsed && 'Settings'}
          </NavLink>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isDesktopCollapsed ? 'center' : 'flex-start',
              gap: isDesktopCollapsed ? 0 : 10,
              padding: '8px 10px',
              width: '100%',
              borderRadius: '6px',
              color: isLight ? '#ef4444' : '#f87171',
              fontSize: '13px',
              fontWeight: '500',
              transition: 'all 0.15s ease',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = isLight ? '#fef2f2' : 'rgba(239,68,68,0.1)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
            {!isDesktopCollapsed && 'Sign out'}
          </button>
        </div>
        </div>
      </aside>
    </>
  );
}
