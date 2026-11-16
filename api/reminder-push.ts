import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  process.env.VITE_VAPID_PUBLIC_KEY ||
  'BL2-7X2E4pmZCgImcL4lc0f2HDa9IZ5QSID0hx_mo4tbW-jsm2JrFwrVWpEWUWqrOwUSoF9MV8ICRXF25CWR5U8';

const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@rova.business';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (e) {
    console.warn('webpush.setVapidDetails warning:', e);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://ngevqechqqtmzkpfrase.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZXZxZWNocXF0bXprcGZyYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NzM4NTgsImV4cCI6MjA5NjM0OTg1OH0.0iUJQyjyTWxEPDTkmURvZS6-uQXgvL6uKAI1cC6OKc8';

  const supabase = createClient(supabaseUrl, supabaseKey);

  const body = req.body || {};
  const action = body.action || req.query.action || 'cron_check';

  try {
    // 1. TEST PUSH WITH OPTIONAL DELAY
    if (action === 'test_push') {
      const { userId, delaySeconds = 0, title, body: msgBody } = body;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'Missing userId parameter' });
      }

      if (delaySeconds > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(delaySeconds, 15) * 1000));
      }

      const { data: subs, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .neq('is_active', false);

      if (subError) {
        return res.status(500).json({ success: false, error: subError.message });
      }

      if (!subs || subs.length === 0) {
        return res.status(200).json({
          success: false,
          sent: 0,
          message: 'No active push subscription found.',
        });
      }

      const payload = JSON.stringify({
        title: title || 'ROVA Daily Reminder',
        body: msgBody || "Time to record today's transactions and review pending categories.",
        url: '/app/transactions',
        tag: 'rova-reminder',
      });

      let sentCount = 0;
      for (const row of subs) {
        try {
          const pushSubscription = {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          };
          await webpush.sendNotification(pushSubscription, payload);
          sentCount++;
        } catch (sendErr: any) {
          if (sendErr.statusCode === 410 || sendErr.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', row.id);
          }
        }
      }

      return res.status(200).json({
        success: true,
        sent: sentCount,
        message: `Push delivered to ${sentCount} device(s) successfully!`,
      });
    }

    // 2. DAILY CRON DISPATCHER (Runs periodically)
    if (action === 'cron_check' || req.method === 'GET') {
      const now = new Date();
      // Nigeria / West Africa is UTC+1
      const watDate = new Date(now.getTime() + 1 * 60 * 60 * 1000);
      const watDateStr = watDate.toISOString().split('T')[0];
      const watHour = watDate.getUTCHours();
      const watMin = watDate.getUTCMinutes();
      const timeStr = `${String(watHour).padStart(2, '0')}:${String(watMin).padStart(2, '0')}`;

      // Query active subscriptions where reminders are enabled and not yet sent today
      const { data: subs, error: queryErr } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('reminder_enabled', true)
        .neq('is_active', false);

      if (queryErr) throw queryErr;

      const results = [];
      for (const sub of subs || []) {
        // Skip if already pushed today
        if (sub.last_pushed_date === watDateStr) continue;

        // Check if reminder time is due
        const [remH, remM] = (sub.reminder_time || '20:00').split(':').map(Number);
        const isDue = watHour > remH || (watHour === remH && watMin >= remM);
        if (!isDue) continue;

        const userId = sub.user_id;
        let shouldAlert = false;
        let reason = "Time to record today's transactions and review pending categories.";

        if (sub.only_if_missing_today) {
          const { count: txCount } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('date', watDateStr);

          if ((txCount || 0) === 0) {
            shouldAlert = true;
            reason = 'No transactions recorded yet today.';
          }
        }

        if (sub.check_uncategorized) {
          const { count: uncatCount } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .is('category_id', null);

          if ((uncatCount || 0) > 0) {
            shouldAlert = true;
            reason = `${reason} You have ${uncatCount} uncategorised transaction(s) waiting.`;
          }
        }

        if (!sub.only_if_missing_today && !sub.check_uncategorized) {
          shouldAlert = true;
        }

        if (shouldAlert) {
          try {
            const payload = JSON.stringify({
              title: 'ROVA Daily Reminder',
              body: `It's ${sub.reminder_time} — ${reason}`,
              url: '/app/transactions',
              tag: 'rova-transaction-reminder',
            });

            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload
            );

            // Mark pushed for today
            await supabase
              .from('push_subscriptions')
              .update({
                last_pushed_date: watDateStr,
                last_pushed_at: new Date().toISOString(),
              })
              .eq('id', sub.id);

            // In-app notification
            await supabase.from('notifications').insert({
              user_id: userId,
              type: 'info',
              severity: 'info',
              title: 'Daily Transaction Reminder',
              body: `It's ${sub.reminder_time} — ${reason}`,
              action_url: '/app/transactions',
              action_label: 'View Transactions',
              is_read: false,
              is_dismissed: false,
            });

            results.push({ id: sub.id, userId, status: 'sent' });
          } catch (pushErr: any) {
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id);
            }
            results.push({ id: sub.id, userId, status: 'error', error: pushErr.message });
          }
        }
      }

      return res.status(200).json({
        success: true,
        watTime: timeStr,
        processed: results.length,
        results,
      });
    }

    return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
}
