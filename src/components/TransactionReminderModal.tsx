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
  requestBrowserNotificationPermission,
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

  useEffect(() => {
    if (isOpen && userId) {
      setConfig(getReminderConfig(userId));
      setBrowserPermission(getBrowserNotificationPermission());
      setTestSent(false);
      setSavedSuccess(false);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  async function handleRequestPermission() {
    const res = await requestBrowserNotificationPermission();
    setBrowserPermission(res);
    if (res === 'granted') {
      setConfig((prev) => ({ ...prev, notifyBrowser: true }));
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
                background: 'var(--accent-dim)',
                color: 'var(--accent-light)',
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
              {/* Browser notification check */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--bg-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bell size={16} color="var(--accent-light)" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Browser Desktop &amp; Mobile Push
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Alerts you even when ROVA is in another tab
                    </div>
                  </div>
                </div>

                {browserPermission === 'granted' ? (
                  <Badge variant="success">Enabled</Badge>
                ) : browserPermission === 'denied' ? (
                  <Badge variant="error">Blocked in browser</Badge>
                ) : (
                  <Button variant="secondary" size="sm" onClick={handleRequestPermission}>
                    Allow Alerts
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTestAlert}
            disabled={testSent}
            icon={<Sparkles size={14} />}
          >
            {testSent ? 'Alert Sent!' : 'Send Test Alert'}
          </Button>

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
