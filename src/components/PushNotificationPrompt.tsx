import { useState, useEffect } from 'react';
import { Bell, Check, X, Smartphone } from 'lucide-react';
import Button from './ui/Button';
import { isPushSupported, subscribeToPush } from '../lib/webPush';

interface PushNotificationPromptProps {
  userId: string;
}

const DISMISS_KEY = 'rova_push_prompt_dismissed_at';
const DISMISS_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

export default function PushNotificationPrompt({ userId }: PushNotificationPromptProps) {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'denied'>('idle');
  const [isIosBrowser, setIsIosBrowser] = useState(false);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;

    // Detect iOS Safari (not in standalone PWA mode)
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) {
      setIsIosBrowser(true);
    }

    // Check if push is supported or if permission is already granted/denied
    if (!isPushSupported()) return;

    if (!('Notification' in window) || Notification.permission !== 'default') {
      return;
    }

    // Check if previously dismissed within 5 days
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const timeSince = Date.now() - parseInt(dismissedAt, 10);
      if (timeSince < DISMISS_DURATION_MS) {
        return;
      }
    }

    // Delay 2 seconds after page load so it feels organic
    const timer = setTimeout(() => {
      setVisible(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [userId]);

  if (!visible) return null;

  async function handleEnable() {
    setSubscribing(true);
    try {
      const res = await subscribeToPush(userId);
      if (res.success) {
        setStatus('success');
        setTimeout(() => {
          setVisible(false);
        }, 2200);
      } else {
        if ('Notification' in window && Notification.permission === 'denied') {
          setStatus('denied');
          setTimeout(() => {
            setVisible(false);
          }, 3000);
        } else {
          setVisible(false);
        }
      }
    } catch {
      setVisible(false);
    } finally {
      setSubscribing(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  }

  return (
    <div
      style={{
        margin: '12px 16px 0',
        padding: '12px 16px',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, rgba(102, 45, 145, 0.18), var(--bg-elevated))',
        border: '1px solid var(--accent-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        animation: 'fadeIn 0.25s ease',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: status === 'success' ? 'var(--success)' : 'var(--accent-primary)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.3s ease',
          }}
        >
          {status === 'success' ? <Check size={18} /> : <Bell size={18} />}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {status === 'success'
              ? 'Lock-Screen Reminders Enabled!'
              : status === 'denied'
              ? 'Notification Permission Blocked'
              : 'Turn On Daily Lock-Screen Reminders'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {status === 'success'
              ? "You'll receive daily transaction reminders even when ROVA is closed."
              : status === 'denied'
              ? 'You can re-enable notifications anytime in your browser address bar settings.'
              : isIosBrowser
              ? 'Tip: On iPhone, tap Share → Add to Home Screen to receive alerts while closed.'
              : 'Never forget daily sales or expenses. Get notified even when your browser is closed.'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {status === 'idle' && (
          <>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEnable}
              disabled={subscribing}
              icon={isIosBrowser ? <Smartphone size={14} /> : <Bell size={14} />}
            >
              {subscribing ? 'Connecting...' : 'Enable Alerts'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              style={{ color: 'var(--text-muted)' }}
            >
              Later
            </Button>
          </>
        )}
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            borderRadius: 4,
          }}
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
