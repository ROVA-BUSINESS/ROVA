import { subscribeToPush, getExistingPushSubscription, isPushSupported, triggerServerBackgroundTestPush } from '../lib/webPush.ts';
import { useEffect, useState } from 'react';
import { Clock, Bell, Volume2, Check, Sparkles, X } from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import {
  type TransactionReminderConfig,
  getReminderConfig,
  saveReminderConfig,
  formatTimeDisplay,
  getBrowserNotificationPermission,
  fireReminderAlert,
} from '../lib/transactionReminder';

interface TransactionReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSaved?: (config: TransactionReminderConfig) => void;
}

const PRESET_TIMES = [
  { label: '6:00 PM', time: '18:00' },
  { label: '7:00 PM', time: '19:00' },
  { label: '8:00 PM', time: '20:00' },
  { label: '9:00 PM', time: '21:00' },
  { label: '10:00 PM', time: '22:00' },
];

export default function TransactionReminderModal({
  isOpen,
  onClose,
  userId,
  onSaved,
}: TransactionReminderModalProps) {
  const [config, setConfig] = useState<TransactionReminderConfig>(() => getReminderConfig(userId));
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [testSent, setTestSent] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [serverTestStatus, setServerTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      setConfig(getReminderConfig(userId));
      setBrowserPermission(getBrowserNotificationPermission());
      setTestSent(false);
      setSavedSuccess(false);
      if (isPushSupported()) {
        getExistingPushSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      }
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  async function handleEnableWebPush() {
    setSubscribing(true);
    const res = await subscribeToPush(userId);
    setSubscribing(false);
    if (res.success) {
      setIsSubscribed(true);
      setBrowserPermission('granted');
      setConfig((prev) => ({ ...prev, notifyBrowser: true }));
    } else {
      setBrowserPermission(getBrowserNotificationPermission());
    }
  }

  async function handleTestClosedSitePush() {
    setServerTestStatus('Pinging in 10s! Close tab now...');
    const res = await triggerServerBackgroundTestPush(userId, 10);
    if (!res.success) {
      setServerTestStatus(res.message || 'Permission required');
      setTimeout(() => setServerTestStatus(null), 4000);
    } else {
      setTimeout(() => setServerTestStatus(null), 12000);
    }
  }

  function handleSave() {
    saveReminderConfig(userId, config);
    setSavedSuccess(true);
    if (onSaved) onSaved(config);
    setTimeout(() => {
      onClose();
    }, 600);
  }

  async function handleTestAlert() {
    setTestSent(true);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        setBrowserPermission(perm);
      } catch {}
    }
    await fireReminderAlert({
      userId,
      config,
      customTitle: 'Daily Reminder (Test Alert)',
      customBody: `It is ${formatTimeDisplay(config.time)}! Don't forget to record today's income, expenses, and categorise pending transactions.`,
    });
    setTimeout(() => setTestSent(false), 3000);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(5px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: 480,
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--bg-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--accent-primary), #7c3aed)',
                color: 'white',
                boxShadow: '0 4px 12px rgba(102, 45, 145, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Daily Transaction Reminder
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Set a time to record &amp; categorise transactions daily
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Enable toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: config.enabled ? 'var(--accent-dim)' : 'var(--bg-surface)',
              border: `1px solid ${config.enabled ? 'var(--accent-border)' : 'var(--bg-border)'}`,
              transition: 'all 0.2s',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Enable Daily Reminder
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {config.enabled
                  ? `Active every day at ${formatTimeDisplay(config.time)}`
                  : 'Reminders are currently paused'}
              </div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig((prev) => ({ ...prev, enabled: e.target.checked }))}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 24,
                  background: config.enabled ? 'var(--accent-primary)' : 'var(--bg-border)',
                  transition: '0.2s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    height: 18,
                    width: 18,
                    left: config.enabled ? 22 : 3,
                    bottom: 3,
                    borderRadius: '50%',
                    background: 'white',
                    transition: '0.2s',
                  }}
                />
              </span>
            </label>
          </div>

          {/* Time Picker */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Reminder Time
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="time"
                value={config.time}
                onChange={(e) => setConfig((prev) => ({ ...prev, time: e.target.value }))}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--bg-border)',
                  color: 'var(--text-primary)',
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              />
              <div
                style={{
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--bg-border)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--accent-light)',
                  minWidth: 100,
                  textAlign: 'center',
                }}
              >
                {formatTimeDisplay(config.time)}
              </div>
            </div>

            {/* Presets */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {PRESET_TIMES.map((p) => {
                const isSelected = config.time === p.time;
                return (
                  <button
                    key={p.time}
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, time: p.time }))}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                      background: isSelected ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      color: isSelected ? 'white' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Trigger Criteria */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
              When to Alert You
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.onlyIfMissingToday}
                  onChange={(e) => setConfig((prev) => ({ ...prev, onlyIfMissingToday: e.target.checked }))}
                />
                <span>Alert if no transactions have been added today</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.checkUncategorized}
                  onChange={(e) => setConfig((prev) => ({ ...prev, checkUncategorized: e.target.checked }))}
                />
                <span>Alert if there are uncategorised transactions waiting</span>
              </label>
            </div>
          </div>

          {/* Channels & Browser Alerts */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
              Notification Channels
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Web Push (Service Worker) notification check */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--bg-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--accent-dim)',
                      color: 'var(--accent-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bell size={16} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                        Web Push (Lock-Screen Alerts)
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(34,197,94,0.15)',
                          color: 'var(--success)',
                          fontWeight: 700,
                        }}
                      >
                        100% FREE ($0)
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Alerts your phone or desktop screen even when ROVA is closed
                    </div>
                  </div>
                </div>

                {browserPermission === 'denied' ? (
                  <Badge variant="error">Blocked</Badge>
                ) : isSubscribed ? (
                  <Badge variant="success">Active on Device</Badge>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleEnableWebPush}
                    disabled={subscribing}
                  >
                    {subscribing ? 'Connecting...' : 'Enable Alerts'}
                  </Button>
                )}
              </div>

              {/* Sound alert toggle */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={config.sound}
                  onChange={(e) => setConfig((prev) => ({ ...prev, sound: e.target.checked }))}
                />
                <Volume2 size={15} color="var(--text-muted)" />
                <span>Play a gentle chime when the reminder alerts</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--bg-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-elevated)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTestAlert}
              disabled={testSent}
              icon={<Sparkles size={14} />}
            >
              {testSent ? 'Chime Sent!' : 'Instant Test'}
            </Button>
            {isSubscribed && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleTestClosedSitePush}
                disabled={!!serverTestStatus}
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                {serverTestStatus || 'Test Closed-Site (10s)'}
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              icon={savedSuccess ? <Check size={14} /> : undefined}
            >
              {savedSuccess ? 'Saved' : 'Save Reminder'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
