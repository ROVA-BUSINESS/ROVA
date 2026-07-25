import { useEffect, useState, type FormEvent } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Bell, Sparkles, Menu, Search, ArrowLeft } from 'lucide-react';
import Sidebar from './Sidebar';
import { useMobile } from '../../hooks/useMobile';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';
import SearchModal from '../SearchModal';


export default function AppLayout() {
  const { user, profile, isStaff, staffData, refreshAuth } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMobile();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const showBackButton = location.pathname !== '/app/dashboard' && location.pathname !== '/app';

  const displayName = profile?.full_name || profile?.business_name || user?.email?.split('@')[0] || 'User';
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };
  const initials = getInitials(displayName);

  const needsSetup = isStaff && staffData?.status === 'pending';
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');

  useEffect(() => {
    if (!user) return;
    loadUnread();

    const handleUpdateEvent = () => {
      loadUnread();
    };
    window.addEventListener('unread-notifications-updated', handleUpdateEvent);

    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadUnread();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_pending_clarifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadUnread();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('unread-notifications-updated', handleUpdateEvent);
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function loadUnread() {
    try {
      const [notifRes, clarRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user!.id)
          .eq('is_read', false)
          .eq('is_dismissed', false),
        supabase
          .from('ai_pending_clarifications')
          .select('id, notification_id')
          .eq('user_id', user!.id)
          .eq('status', 'pending')
      ]);

      const notifCount = notifRes.count || 0;
      const pendingClars = clarRes.data || [];

      // Find all unread notifications to check if any clarification's notification is already counted
      const { data: unreadNotifs } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user!.id)
        .eq('is_read', false)
        .eq('is_dismissed', false);

      const unreadNotifIds = new Set((unreadNotifs || []).map(n => n.id));
      const readClarIds = new Set(JSON.parse(localStorage.getItem('read_clarifications') || '[]'));

      let extraCount = 0;
      pendingClars.forEach(clar => {
        const hasUnreadNotif = clar.notification_id && unreadNotifIds.has(clar.notification_id);
        const isClarRead = readClarIds.has(clar.id);
        
        if (!hasUnreadNotif && !isClarRead) {
          extraCount++;
        }
      });

      setUnreadCount(notifCount + extraCount);
    } catch (err) {
      console.error('Error loading unread notifications:', err);
    }
  }

  async function handleNotificationClick() {
    navigate('/app/notifications');
    setUnreadCount(0);
    if (!user) return;

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      const { data: pendingClars } = await supabase
        .from('ai_pending_clarifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (pendingClars && pendingClars.length > 0) {
        const readClarIds = JSON.parse(localStorage.getItem('read_clarifications') || '[]');
        pendingClars.forEach(clar => {
          if (!readClarIds.includes(clar.id)) {
            readClarIds.push(clar.id);
          }
        });
        localStorage.setItem('read_clarifications', JSON.stringify(readClarIds));
      }

      window.dispatchEvent(new Event('unread-notifications-updated'));
    } catch (err) {
      console.error('Error clearing notifications on click:', err);
    }
  }

  async function handleSetupComplete(e: FormEvent) {
    e.preventDefault();
    setSetupLoading(true);
    setSetupError('');

    const { error: dbError } = await supabase.from('team_members').update({ status: 'active' }).eq('id', staffData!.id);
    if (dbError) {
      setSetupError(dbError.message);
      setSetupLoading(false);
      return;
    }

    await refreshAuth();
    setSetupLoading(false);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <div style={{
          height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '0 20px', borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-surface)',
          gap: 8,
        }}>
          {/* Left area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile ? (
              <>
                {showBackButton ? (
                  <button 
                    onClick={() => navigate(-1)}
                    style={{ 
                      color: 'var(--text-primary)', 
                      padding: 4, 
                      display: 'flex', 
                      alignItems: 'center',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    title="Go Back"
                  >
                    <ArrowLeft size={20} />
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsSidebarOpen(true)}
                    style={{ 
                      color: 'var(--text-primary)', 
                      padding: 4, 
                      display: 'flex', 
                      alignItems: 'center',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <Menu size={20} />
                  </button>
                )}
                <img src={theme === 'light' ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" style={{ height: 30, objectFit: 'contain' }} />
              </>
            ) : (
              showBackButton && (
                <button 
                  onClick={() => navigate(-1)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--bg-border)',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
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
                  <ArrowLeft size={16} />
                  Back
                </button>
              )
            )}
          </div>

          {/* Right area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={handleNotificationClick}
              style={{ position: 'relative', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', transition: 'all 0.15s', background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              title="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  minWidth: 14,
                  height: 14,
                  borderRadius: 7,
                  background: 'var(--error)',
                  color: 'white',
                  fontSize: 8,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  border: '1.5px solid var(--bg-surface)',
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
            
            <button onClick={() => setIsSearchOpen(true)}
              style={{ position: 'relative', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', transition: 'all 0.15s', background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              title="Search (Press /)"
            >
              <Search size={16} />
            </button>

            {/* Settings / Profile Avatar Button */}
            <button
              onClick={() => navigate('/app/settings')}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
                color: 'white',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: 'none',
                padding: 0,
                marginLeft: 8,
                flexShrink: 0,
                transition: 'transform 0.15s ease, filter 0.15s ease',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = 'scale(1.05)';
                el.style.filter = 'brightness(1.1)';
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = 'scale(1)';
                el.style.filter = 'brightness(1)';
              }}
              title="Settings"
            >
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Avatar" 
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                />
              ) : (
                initials
              )}
            </button>
          </div>
        </div>
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Outlet />
        </main>
      </div>

      {needsSetup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-xl)', padding: 32, width: '100%', maxWidth: 400,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
            animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{
                width: 48, height: 48, background: 'var(--accent-dim)', borderRadius: 'var(--radius-full)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                border: '1px solid var(--accent-border)'
              }}>
                <Sparkles size={24} color="var(--accent-light)" />
              </div>
              <h2 style={{ fontSize: 20, marginBottom: 8 }}>Welcome to ROVA</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                Your account is ready. Click below to complete your setup and access your dashboard.
              </p>
            </div>

            <form onSubmit={handleSetupComplete} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {setupError && (
                <div style={{ padding: '10px 12px', background: 'var(--error-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--error)', fontSize: 13 }}>
                  {setupError}
                </div>
              )}

              <Button variant="primary" loading={setupLoading} type="submit" style={{ width: '100%', justifyContent: 'center' }}>
                Go to Dashboard
              </Button>
            </form>
          </div>
        </div>
      )}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}
