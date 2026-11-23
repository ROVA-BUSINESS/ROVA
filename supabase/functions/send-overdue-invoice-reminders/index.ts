// Supabase Edge Function: send-overdue-invoice-reminders
// Dispatches automated pre-due, due-date, and overdue invoice reminders with payment links,
// logging to reminder_logs to strictly prevent duplicate sends.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function diffDays(dueDateStr: string, todayStr: string): number {
  const due = new Date(`${dueDateStr}T00:00:00Z`).getTime();
  const today = new Date(`${todayStr}T00:00:00Z`).getTime();
  return Math.round((today - due) / (1000 * 60 * 60 * 24)); // negative = before due, 0 = on due, positive = overdue
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY') || '';
    const appOrigin = Deno.env.get('APP_URL') || 'https://www.rovabusiness.com';

    const supabase = createClient(supabaseUrl, serviceKey);
    const today = new Date().toISOString().slice(0, 10);

    const { data: rules, error: rulesErr } = await supabase
      .from('invoice_reminder_rules')
      .select('*')
      .eq('enabled', true);
    if (rulesErr) throw rulesErr;

    let sentCount = 0;

    for (const rule of rules || []) {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', rule.user_id)
        .in('status', ['sent', 'overdue', 'partially_paid']);

      for (const inv of invoices || []) {
        if (!inv.due_date) continue;
        const outstanding = Math.max(
          0,
          Number(inv.total || 0) - Number(inv.amount_paid || 0) - Number(inv.credited_amount || 0)
        );
        if (outstanding <= 0) continue;

        const delta = diffDays(inv.due_date, today);
        let ruleKey: string | null = null;
        if (delta < 0 && Array.isArray(rule.days_before_due) && rule.days_before_due.includes(Math.abs(delta))) {
          ruleKey = `before_${Math.abs(delta)}d`;
        } else if (delta === 0 && rule.remind_on_due_date) {
          ruleKey = 'on_due_date';
        } else if (delta > 0 && Array.isArray(rule.days_after_due) && rule.days_after_due.includes(delta)) {
          ruleKey = `overdue_${delta}d`;
        }

        if (!ruleKey) continue;

        // Deduplication check
        const { data: existing } = await supabase
          .from('reminder_logs')
          .select('id')
          .eq('invoice_id', inv.id)
          .eq('rule_key', ruleKey)
          .maybeSingle();
        if (existing) continue;

        const paymentLink = inv.payment_link_url || `${appOrigin}/pay/invoice/${inv.id}`;
        const statusPhrase =
          delta < 0
            ? `is due in ${Math.abs(delta)} day(s)`
            : delta === 0
            ? 'is due today'
            : `is ${delta} day(s) overdue`;

        const subject = `Invoice ${inv.invoice_number} ${statusPhrase}`;
        const bodyText = `${rule.custom_message || 'Friendly payment reminder.'}\n\nInvoice: ${inv.invoice_number}\nBalance Due: ₦${outstanding.toLocaleString()}\nDue Date: ${inv.due_date}\nPay Online: ${paymentLink}`;

        let channelUsed = 'in_app';
        let deliveryStatus: 'sent' | 'failed' = 'sent';
        let errMsg = '';

        // Email delivery via Resend if configured & client_email exists
        if (rule.channel_email && inv.client_email && resendKey) {
          channelUsed = 'email';
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: Deno.env.get('SUPPORT_FROM_EMAIL') || 'ROVA Invoices <onboarding@resend.dev>',
              to: [inv.client_email],
              subject,
              text: bodyText,
            }),
          });
          if (!emailRes.ok) {
            deliveryStatus = 'failed';
            errMsg = await emailRes.text().catch(() => 'Resend failed');
          }
        }

        // Always create in-app notification fallback if enabled
        if (rule.channel_in_app) {
          await supabase.from('notifications').insert({
            user_id: rule.user_id,
            title: `Overdue Reminder: ${inv.invoice_number}`,
            message: `${inv.client_name}'s invoice (${inv.invoice_number}, ₦${outstanding.toLocaleString()}) ${statusPhrase}. Link: ${paymentLink}`,
            type: delta > 0 ? 'warning' : 'info',
            action_url: '/app/invoices',
            action_label: 'View Invoice',
          });
        }

        await supabase.from('reminder_logs').insert({
          user_id: rule.user_id,
          invoice_id: inv.id,
          rule_key: ruleKey,
          channel: channelUsed,
          recipient: inv.client_email || inv.client_name || 'In-App',
          status: deliveryStatus,
          error_message: errMsg,
        });

        sentCount++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sentCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
