import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'rova_pwa_install_dismissed_at';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandaloneMode() || wasRecentlyDismissed()) return;

    setDismissed(false);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowIosHint(false);
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // iOS Safari does not fire beforeinstallprompt; show a lightweight tip instead
    if (isIosDevice()) {
      setShowIosHint(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (dismissed || (!deferredPrompt && !showIosHint)) {
    return null;
  }

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore storage errors
    }
    setDismissed(true);
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setDismissed(true);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Install ROVA app"
      style={{
        position: 'fixed',
        bottom: 20,
        left: 16,
        right: 16,
        maxWidth: 420,
        margin: '0 auto',
        zIndex: 9999,
        background: 'var(--bg-surface, #161124)',
        border: '1px solid rgba(124, 58, 237, 0.35)',
        borderRadius: 16,
        padding: '14px 16px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <img
        src="/icons/icon-192x192.png"
        alt="ROVA"
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #ffffff)' }}>
          Install ROVA App
        </div>
        {deferredPrompt ? (
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #cbd5e1)', marginTop: 2 }}>
            Add ROVA to your home screen for faster access &amp; instant alerts.
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary, #cbd5e1)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            Tap <Share size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> then{' '}
            <strong>Add to Home Screen</strong> to install.
          </div>
        )}
      </div>

      {deferredPrompt && (
        <button
          type="button"
          onClick={handleInstallClick}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #662d91, #7c3aed)',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Download size={14} />
          Install
        </button>
      )}

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss install prompt"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted, #94a3b8)',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

