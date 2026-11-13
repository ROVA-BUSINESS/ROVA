import { supabase } from './supabase.ts';

export interface TransactionReminderConfig {
  enabled: boolean;
  time: string; // "HH:mm", e.g. "20:00"
  onlyIfMissingToday: boolean;
  checkUncategorized: boolean;
  notifyBrowser: boolean;
  notifyInApp: boolean;
  sound: boolean;
  lastTriggeredDate?: string; // "YYYY-MM-DD"
}

export const DEFAULT_REMINDER_CONFIG: TransactionReminderConfig = {
  enabled: true,
  time: '20:00', // 8:00 PM default
  onlyIfMissingToday: true,
  checkUncategorized: true,
  notifyBrowser: true,
  notifyInApp: true,
  sound: true,
};

const STORAGE_PREFIX = 'rova_tx_reminder_';

export function getReminderConfig(userId: string): TransactionReminderConfig {
  if (!userId) return DEFAULT_REMINDER_CONFIG;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return DEFAULT_REMINDER_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_REMINDER_CONFIG, ...parsed };
  } catch {
    return DEFAULT_REMINDER_CONFIG;
  }
}

export function saveReminderConfig(userId: string, config: TransactionReminderConfig): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('rova-reminder-settings-updated', { detail: config }));
  } catch (err) {
    console.error('Failed to save reminder config:', err);
  }
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return 'denied';
  }
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export function playReminderSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Pleasant two-tone chime
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12); // A5
    gain2.gain.setValueAtTime(0.2, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (err) {
    console.warn('Could not play reminder sound:', err);
  }
}

export interface ReminderCheckResult {
  todayTxCount: number;
  uncategorizedCount: number;
  shouldAlert: boolean;
  reason: string;
}

export async function checkDailyReminderCriteria(userId: string, config: TransactionReminderConfig): Promise<ReminderCheckResult> {
  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch today's transactions count
  const { count: todayCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('date', todayStr);

  // Fetch uncategorized transactions count
  const { count: uncatCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('category_id', null);

  const todayTx = todayCount || 0;
  const uncatTx = uncatCount || 0;

  let shouldAlert = false;
  let reason = '';

  if (config.onlyIfMissingToday && todayTx === 0) {
    shouldAlert = true;
    reason = 'No transactions recorded yet today.';
  }

  if (config.checkUncategorized && uncatTx > 0) {
    shouldAlert = true;
    reason = reason
      ? `${reason} Also ${uncatTx} uncategorised transaction${uncatTx > 1 ? 's' : ''} need attention.`
      : `You have ${uncatTx} uncategorised transaction${uncatTx > 1 ? 's' : ''} to review.`;
  }

  // If user disabled conditions, alert unconditionally at the set time
  if (!config.onlyIfMissingToday && !config.checkUncategorized) {
    shouldAlert = true;
    reason = 'Daily check-in: record your daily sales, expenses, and receipts.';
  }

  return {
    todayTxCount: todayTx,
    uncategorizedCount: uncatTx,
    shouldAlert,
    reason: reason || 'Keep your books up to date.',
  };
}

export async function fireReminderAlert(params: {
  userId: string;
  config: TransactionReminderConfig;
  customTitle?: string;
  customBody?: string;
}): Promise<void> {
  const { userId, config, customTitle, customBody } = params;

  const title = customTitle || 'Daily Transaction Reminder';
  const body = customBody || `It's ${formatTimeDisplay(config.time)} — time to add today's sales, expenses, and categorise pending transactions.`;

  // 1. Play sound if enabled
  if (config.sound) {
    playReminderSound();
  }

  // 2. Browser push notification
  if (config.notifyBrowser && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      });
      notif.onclick = () => {
        window.focus();
        window.location.href = '/app/transactions';
      };
    } catch (err) {
      console.warn('Browser notification error:', err);
    }
  }

  // 3. In-app notification
  if (config.notifyInApp) {
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'info',
        severity: 'info',
        title,
        body,
        action_url: '/app/transactions',
        action_label: 'View Transactions',
        is_read: false,
        is_dismissed: false,
      });
      window.dispatchEvent(new CustomEvent('unread-notifications-updated'));
    } catch (err) {
      console.warn('In-app notification insert error:', err);
    }
  }

  // 4. In-app banner event
  window.dispatchEvent(
    new CustomEvent('transaction-reminder-banner', {
      detail: { title, body },
    })
  );
}

export async function runReminderCheckIfDue(userId: string): Promise<boolean> {
  if (!userId) return false;
  const config = getReminderConfig(userId);
  if (!config.enabled) return false;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Already fired today
  if (config.lastTriggeredDate === todayStr) {
    return false;
  }

  // Parse reminder time
  const [remHour, remMin] = config.time.split(':').map(Number);
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  const isDue = currentHour > remHour || (currentHour === remHour && currentMin >= remMin);
  if (!isDue) {
    return false;
  }

  // Check conditions
  const criteria = await checkDailyReminderCriteria(userId, config);
  if (!criteria.shouldAlert) {
    // If criteria don't require alert, mark as evaluated for today so we don't query continuously
    config.lastTriggeredDate = todayStr;
    saveReminderConfig(userId, config);
    return false;
  }

  // Trigger alert
  await fireReminderAlert({
    userId,
    config,
    customBody: `It's ${formatTimeDisplay(config.time)} — ${criteria.reason}`,
  });

  // Mark triggered today
  config.lastTriggeredDate = todayStr;
  saveReminderConfig(userId, config);
  return true;
}

export function formatTimeDisplay(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
}
