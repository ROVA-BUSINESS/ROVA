import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BG6yB5UIJ3Ja07Hz5Z9tB8OGQ37-wPgLbOTlSQXGmjL82iw36DGbwbu1DnUbkwbesi97nO2vCa6CNxNHI6j4RMI';

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
  const action = body.action || req.query.action || 'test_push';

  try {
    // 1. TEST PUSH WITH DELAY (e.g. 10 seconds for user to close tab)
    if (action === 'test_push') {
      const { userId, delaySeconds = 0, title, body: msgBody } = body;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'Missing userId parameter' });
      }

      if (delaySeconds > 0) {
        // Sleep on the server side so the user can close the tab completely
        await new Promise((resolve) => setTimeout(resolve, Math.min(delaySeconds, 15) * 1000));
      }

      // Query active push subscriptions from database
      const { data: subs, error: subError } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (subError) {
        return res.status(500).json({ success: false, error: subError.message });
      }

      if (!subs || subs.length === 0) {
        return res.status(200).json({
          success: false,
          sent: 0,
          message: 'No active push subscription found. Please enable reminders in ROVA first.',
        });
      }

      const payload = JSON.stringify({
        title: title || 'ROVA Daily Reminder (Closed-Site Alert)',
        body:
          msgBody ||
          'Success! Lock-screen alert received while ROVA was completely closed.',
        url: '/app/transactions',
        tag: 'rova-test-alert',
      });

      let sentCount = 0;
      for (const row of subs) {
        try {
          const pushSubscription = {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.p256dh,
              auth: row.auth,
            },
          };
          await webpush.sendNotification(pushSubscription, payload);
          sentCount++;
        } catch (sendErr: any) {
          if (sendErr.statusCode === 410 || sendErr.statusCode === 404) {
            // Subscription expired, mark inactive
            await supabase
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('id', row.id);
          }
        }
      }

      return res.status(200).json({
        success: true,
        sent: sentCount,
        message: `Push delivered to ${sentCount} device(s) successfully!`,
      });
    }

    // 2. DAILY CRON DISPATCHER (Runs periodically to notify users whose reminder time matches)
    if (action === 'cron_check' || req.method === 'GET') {
      const now = new Date();
      // Nigeria / West Africa is UTC+1
      const watHour = (now.getUTCHours() + 1) % 24;
      const watMin = now.getUTCMinutes();
      const timeStr = `${String(watHour).padStart(2, '0')}:${String(watMin).padStart(2, '0')}`;

      return res.status(200).json({
        success: true,
        time: timeStr,
        status: 'Cron endpoint active',
      });
    }

    return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || 'Server error' });
  }
}
