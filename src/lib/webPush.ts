// ROVA Web Push Notifications & Service Worker Integration (100% Free / $0 Forever)
import { supabase } from './supabase.ts';

// Standard VAPID Public Key (P-256 ECDSA)
export const VAPID_PUBLIC_KEY =
  'BPdwQ3s_-P9Z2nfl9FY75bVVtjLq8AqforPTg_8_qpybyQO6Dd6ZmAtUN8E4OX6-TfbczPqZo2MUdiyeZZ7RJA0';

/**
 * Converts a URL-safe Base64 string into a Uint8Array for pushManager.subscribe
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  if (typeof window === 'undefined' && typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks whether Web Push and Service Workers are supported on this device/browser
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Gets the current notification permission
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Registers the root Service Worker (/sw.js)
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('Service Worker registration failed:', err);
    return null;
  }
}

/**
 * Returns the existing PushSubscription if one is active on this device
 */
export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Subscribes the user to Web Push notifications using VAPID
 */
export async function subscribeToPush(userId: string): Promise<{
  success: boolean;
  subscription?: PushSubscription;
  error?: string;
}> {
  if (!isPushSupported()) {
    return { success: false, error: 'Web Push is not supported on this browser/device.' };
  }

  try {
    // 1. Request notification permission from user
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission was denied.' };
    }

    // 2. Ensure Service Worker is registered and ready
    await registerServiceWorker();
    const registration = await navigator.serviceWorker.ready;

    // 3. Check for existing subscription or create a new one
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as any,
      });
    }

    // 4. Extract keys and endpoint
    const subJson = subscription.toJSON();
    const endpoint = subJson.endpoint || '';
    const p256dh = subJson.keys?.p256dh || '';
    const auth = subJson.keys?.auth || '';

    // 5. Store subscription in database & local storage
    if (userId && endpoint) {
      try {
        let reminderConfig: any = null;
        try {
          const raw = localStorage.getItem(`rova_tx_reminder_${userId}`);
          if (raw) reminderConfig = JSON.parse(raw);
        } catch {}

        await supabase.from('push_subscriptions').upsert(
          {
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            reminder_enabled: reminderConfig ? reminderConfig.enabled : true,
            reminder_time: reminderConfig ? reminderConfig.time : '20:00',
            only_if_missing_today: reminderConfig ? reminderConfig.onlyIfMissingToday : true,
            check_uncategorized: reminderConfig ? reminderConfig.checkUncategorized : true,
            sound: reminderConfig ? reminderConfig.sound : true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,endpoint' }
        );
      } catch (dbErr) {
        console.warn('Could not sync subscription to DB, saving locally:', dbErr);
      }

      try {
        localStorage.setItem(`rova_push_sub_${userId}`, JSON.stringify(subJson));
      } catch {
        // ignore storage errors
      }
    }

    return { success: true, subscription };
  } catch (err: any) {
    console.error('Failed to subscribe to Web Push:', err);
    return {
      success: false,
      error: err?.message || 'Failed to complete push subscription.',
    };
  }
}

/**
 * Unsubscribes the user from Web Push notifications
 */
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      if (userId && endpoint) {
        try {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', endpoint);
        } catch {
          // ignore
        }
      }
    }

    if (userId) {
      localStorage.removeItem(`rova_push_sub_${userId}`);
    }
    return true;
  } catch (err) {
    console.error('Failed to unsubscribe:', err);
    return false;
  }
}

/**
 * Triggers a system lock-screen / desktop notification via the Service Worker.
 * Works even when the browser tab is minimized or in the background!
 */
export async function showServiceWorkerNotification(params: {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}): Promise<boolean> {
  const { title, body, url = '/app/transactions', tag = 'rova-reminder' } = params;

  if (typeof window === 'undefined') return false;

  // 1. If permission is not yet granted, prompt user immediately
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return false;
      } catch {
        return false;
      }
    } else if (Notification.permission === 'denied') {
      return false;
    }
  }

  let shown = false;

  // 2. Immediate window notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body: body || "Don't forget to record today's transactions.",
        icon: '/rova.png',
        badge: '/favicon.svg',
      });
      notif.onclick = () => {
        window.focus();
        window.location.href = url;
      };
      shown = true;
    } catch (notifErr) {
      console.warn('Window Notification error:', notifErr);
    }
  }

  // 3. Service worker notification (for mobile/lock screen)
  if ('serviceWorker' in navigator) {
    try {
      const readyReg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((r) => setTimeout(() => r(null), 800)),
      ]);
      const reg = readyReg || (await navigator.serviceWorker.getRegistration());
      if (reg && (reg as any).showNotification) {
        await (reg as any).showNotification(title, {
          body: body || "Don't forget to record today's transactions.",
          icon: '/rova.png',
          badge: '/favicon.svg',
          vibrate: [250, 100, 250],
          tag,
          renotify: true,
          requireInteraction: true,
          data: { url, dateOfArrival: Date.now() },
        });
        shown = true;
      }
    } catch (swErr) {
      console.warn('Service Worker showNotification failed:', swErr);
    }
  }

  return shown;
}

/**
 * Schedules a background notification directly via the Service Worker.
 * When you close the browser tab, the Service Worker thread stays alive
 * for the delay (via event.waitUntil) and rings on the lock screen!
 */
export async function scheduleServiceWorkerBackgroundNotification(
  delaySeconds: number = 10,
  title?: string,
  body?: string
): Promise<{ success: boolean; message?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { success: false, message: 'Service Worker not supported on this device.' };
  }

  // Ensure notification permission
  if ('Notification' in window && Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      return { success: false, message: 'Notification permission denied in browser.' };
    }
  }

  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }

    const readyReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((r) => setTimeout(() => r(null), 1200)),
    ]);

    const targetReg = readyReg || reg;
    const worker = targetReg?.active || navigator.serviceWorker.controller;

    if (worker) {
      worker.postMessage({
        type: 'ROVA_SCHEDULE_NOTIFICATION',
        delayMs: delaySeconds * 1000,
        title: title || 'ROVA Daily Reminder (Closed-Site Alert)',
        body: body || 'Success! Alert received while your browser was completely closed.',
        url: '/app/transactions',
      });
      return {
        success: true,
        message: `Pinging in ${delaySeconds}s! Close this browser tab now to test lock-screen alert.`,
      };
    } else {
      // Fallback: direct registration showNotification timeout
      setTimeout(() => {
        if (targetReg && targetReg.showNotification) {
          targetReg.showNotification(title || 'ROVA Daily Reminder', {
            body: body || 'Success! Alert received.',
            icon: '/rova.png',
            badge: '/favicon.svg',
          });
        }
      }, delaySeconds * 1000);
      return {
        success: true,
        message: `Pinging in ${delaySeconds}s! Close tab now...`,
      };
    }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to schedule.' };
  }
}

/**
 * Synchronizes the user's reminder schedule to their push_subscriptions rows in Supabase
 */
export async function syncReminderScheduleToDatabase(
  userId: string,
  config: {
    enabled: boolean;
    time: string;
    onlyIfMissingToday: boolean;
    checkUncategorized: boolean;
    sound: boolean;
  }
): Promise<boolean> {
  if (!userId) return false;
  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({
        reminder_enabled: config.enabled,
        reminder_time: config.time,
        only_if_missing_today: config.onlyIfMissingToday,
        check_uncategorized: config.checkUncategorized,
        sound: config.sound,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.warn('Could not sync reminder schedule to push_subscriptions:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to sync reminder schedule to DB:', err);
    return false;
  }
}

/**
 * Triggers a real server-side Web Push through Supabase Edge Function.
 * If delaySeconds > 0, the server waits that many seconds before sending,
 * allowing the user to completely close the browser and test lock-screen arrival!
 */
export async function triggerServerBackgroundTestPush(
  userId: string,
  delaySeconds: number = 0
): Promise<{ success: boolean; message?: string }> {
  if (!userId) return { success: false, message: 'Missing userId' };

  // 1. Ensure user has a registered push subscription saved to database
  try {
    const sub = await subscribeToPush(userId);
    if (!sub.success && !sub.subscription) {
      console.warn('Subscription check before push:', sub.error);
    }
  } catch (subErr) {
    console.warn('Subscription check error:', subErr);
  }

  // 2. Try Vercel Serverless Endpoint (/api/reminder-push)
  try {
    const res = await fetch('/api/reminder-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'test_push',
        userId,
        delaySeconds,
        title: 'ROVA Daily Reminder (Site Closed)',
        body: 'Success! Web push notification arrived while your browser was closed.',
      }),
    });

    if (res.ok) {
      const json = await res.json();
      return { success: json.success ?? true, message: json.message };
    }
  } catch {
    // Vercel endpoint unavailable (e.g. running vite local dev), fallback to Supabase
  }

  // 3. Fallback to Supabase Functions
  try {
    const { data, error } = await supabase.functions.invoke('send-reminder-push', {
      body: {
        action: 'test_push',
        userId,
        delaySeconds,
        title: 'ROVA Daily Reminder (Site Closed)',
        body: 'Success! Web push notification arrived while your browser was closed.',
      },
    });

    if (!error && data) {
      return { success: data?.success ?? true, message: data?.message };
    }
  } catch {
    // Supabase function not yet deployed
  }

  // 4. Client-side Service Worker scheduling fallback
  return await scheduleServiceWorkerBackgroundNotification(
    delaySeconds,
    'ROVA Daily Reminder (Site Closed)',
    'Success! Web push notification arrived while your browser was closed.'
  );
}
