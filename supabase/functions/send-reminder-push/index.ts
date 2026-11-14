// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY =
  Deno.env.get("VAPID_PUBLIC_KEY") ||
  "BG6yB5UIJ3Ja07Hz5Z9tB8OGQ37-wPgLbOTlSQXGmjL82iw36DGbwbu1DnUbkwbesi97nO2vCa6CNxNHI6j4RMI";

const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";

const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@rova.business";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (e) {
    console.warn("webpush.setVapidDetails warning:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action || "test_push";

    // ─────────────────────────────────────────────────────────────
    // ACTION 1: TEST PUSH (Direct or with optional delay for closing tab)
    // ─────────────────────────────────────────────────────────────
    if (action === "test_push") {
      const { userId, delaySeconds = 0, title, body: msgBody } = body;

      if (!userId) {
        throw new Error("Missing required parameter: userId");
      }

      // If user requested a delay (e.g. 10 seconds), wait so they can close their tab/screen
      if (delaySeconds > 0) {
        console.log(`Waiting ${delaySeconds} seconds before delivering background push...`);
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }

      // Fetch user's registered browser push subscriptions
      const { data: subs, error: subErr } = await supabaseClient
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", userId);

      if (subErr) throw subErr;
      if (!subs || subs.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "No push subscriptions registered for this user on any device.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payload = JSON.stringify({
        title: title || "ROVA Daily Reminder (Closed-Site Test)",
        body:
          msgBody ||
          "It works! Lock-screen alert received while ROVA was completely closed.",
        url: "/app/transactions",
        icon: "/rova.png",
        badge: "/favicon.svg",
        tag: "rova-transaction-reminder",
      });

      const pushResults = [];
      for (const sub of subs) {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };
          const res = await webpush.sendNotification(pushSubscription, payload);
          pushResults.push({ id: sub.id, status: res.statusCode });
        } catch (pushErr) {
          console.error(`Failed to push to sub ${sub.id}:`, pushErr);
          // If subscription has expired or unsubscribed (410 or 404), delete it
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await supabaseClient.from("push_subscriptions").delete().eq("id", sub.id);
          }
          pushResults.push({ id: sub.id, error: pushErr.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Dispatched push to ${subs.length} device(s).`,
          results: pushResults,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION 2: SCHEDULED CRON CHECK
    // ─────────────────────────────────────────────────────────────
    if (action === "check_scheduled") {
      const now = new Date();
      // Nigeria / West Africa Time (UTC+1)
      const lagosFormatter = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Lagos",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const lagosDateFormatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
      });

      const currentLagosTime = lagosFormatter.format(now); // e.g. "20:00"
      const currentLagosDate = lagosDateFormatter.format(now); // e.g. "2026-11-13"

      console.log(`Cron check at WAT: ${currentLagosDate} ${currentLagosTime}`);

      // Query subscriptions where reminder is enabled, time matches, and not already pushed today
      const { data: subs, error: queryErr } = await supabaseClient
        .from("push_subscriptions")
        .select("*")
        .eq("reminder_enabled", true)
        .eq("reminder_time", currentLagosTime);

      if (queryErr) throw queryErr;

      const toNotify = (subs || []).filter(
        (s) => s.last_pushed_date !== currentLagosDate
      );

      console.log(`Found ${toNotify.length} eligible subscription(s) for ${currentLagosTime}`);

      const results = [];
      for (const sub of toNotify) {
        try {
          const userId = sub.user_id;

          // Check user criteria: transactions today & uncategorized
          let shouldAlert = false;
          let reason = "Time to record today's transactions.";

          if (sub.only_if_missing_today) {
            const { count: txCount } = await supabaseClient
              .from("transactions")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("date", currentLagosDate);

            if ((txCount || 0) === 0) {
              shouldAlert = true;
              reason = "No transactions recorded yet today.";
            }
          }

          if (sub.check_uncategorized) {
            const { count: uncatCount } = await supabaseClient
              .from("transactions")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .is("category_id", null);

            if ((uncatCount || 0) > 0) {
              shouldAlert = true;
              reason = `${reason} You also have ${uncatCount} uncategorised transaction(s) waiting.`;
            }
          }

          if (!sub.only_if_missing_today && !sub.check_uncategorized) {
            shouldAlert = true;
          }

          if (shouldAlert) {
            const payload = JSON.stringify({
              title: "ROVA Daily Reminder",
              body: `It's ${currentLagosTime} — ${reason}`,
              url: "/app/transactions",
              icon: "/rova.png",
              badge: "/favicon.svg",
              tag: "rova-transaction-reminder",
            });

            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload
            );

            // Mark as pushed today
            await supabaseClient
              .from("push_subscriptions")
              .update({
                last_pushed_date: currentLagosDate,
                last_pushed_at: new Date().toISOString(),
              })
              .eq("id", sub.id);

            // Also record an in-app notification
            await supabaseClient.from("notifications").insert({
              user_id: userId,
              type: "info",
              severity: "info",
              title: "Daily Transaction Reminder",
              body: `It's ${currentLagosTime} — ${reason}`,
              action_url: "/app/transactions",
              action_label: "View Transactions",
              is_read: false,
              is_dismissed: false,
            });

            results.push({ id: sub.id, userId, status: "pushed" });
          } else {
            // Mark evaluated so we don't repeat
            await supabaseClient
              .from("push_subscriptions")
              .update({ last_pushed_date: currentLagosDate })
              .eq("id", sub.id);
            results.push({ id: sub.id, userId, status: "skipped_criteria" });
          }
        } catch (subErr) {
          console.error(`Error notifying sub ${sub.id}:`, subErr);
          if (subErr.statusCode === 410 || subErr.statusCode === 404) {
            await supabaseClient.from("push_subscriptions").delete().eq("id", sub.id);
          }
          results.push({ id: sub.id, error: subErr.message });
        }
      }

      return new Response(
        JSON.stringify({ success: true, processed: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unsupported action: ${action}`);
  } catch (error) {
    console.error("send-reminder-push error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
