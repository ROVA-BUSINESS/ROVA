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
        await supabase.from('push_subscriptions').upsert(
          {
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
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

  // 1. Try via active Service Worker registration
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && (registration as any).showNotification) {
        await (registration as any).showNotification(title, {
          body: body || "Don't forget to record today's transactions.",
          icon: '/rova.png',
          badge: '/favicon.svg',
          vibrate: [200, 100, 200],
          tag,
          renotify: true,
          data: { url, dateOfArrival: Date.now() },
        });
        return true;
      }
    } catch (swErr) {
      console.warn('Service Worker showNotification failed:', swErr);
    }
  }

  // 2. Fallback to standard Window Notification if permission is granted
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
      return true;
    } catch (notifErr) {
      console.warn('Window Notification fallback failed:', notifErr);
    }
  }

  return false;
}
