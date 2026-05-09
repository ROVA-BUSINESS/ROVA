import { useEffect, useState, type FormEvent } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Bell, Sparkles, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { useMobile } from '../../hooks/useMobile';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';


export default function AppLayout() {
  const { user, isStaff, staffData, refreshAuth } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const needsSetup = isStaff && staffData?.status === 'pending';
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');

  useEffect(() => {
    if (user) loadUnread();
  }, [user]);

  async function loadUnread() {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('is_read', false)
      .eq('is_dismissed', false);
    setUnreadCount(count || 0);
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
          justifyContent: isMobile ? 'space-between' : 'flex-end',
          padding: '0 20px', borderBottom: '1px solid var(--bg-border)', background: 'var(--bg-surface)',
          gap: 8,
        }}>
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button 
                onClick={() => setIsSidebarOpen(true)}
                style={{ color: 'var(--text-primary)', padding: 4, display: 'flex', alignItems: 'center' }}
              >
                <Menu size={20} />
              </button>
              <img src={theme === 'light' ? "/rova-light.png" : "/rova.png"} alt="ROVA Logo" style={{ height: 30, objectFit: 'contain' }} />
            </div>
          )}
          <button onClick={() => navigate('/notifications')}
            style={{ position: 'relative', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', transition: 'all 0.15s', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4, width: 8, height: 8,
                borderRadius: '50%', background: 'var(--error)',
                border: '1.5px solid var(--bg-surface)',
              }} />
            )}
          </button>
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
    </div>
  );
}
