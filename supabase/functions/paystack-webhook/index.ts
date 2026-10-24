import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
async function verifyHmacSha512(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const hashHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex === signature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const rawBody = await req.text();
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const signature = req.headers.get('x-paystack-signature');

    if (signature && paystackSecretKey) {
      const isValid = await verifyHmacSha512(rawBody, signature, paystackSecretKey);
      if (!isValid) {
        return new Response('Invalid signature', { status: 400 });
      }
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const event = JSON.parse(rawBody || '{}');
    const eventType = event.event;
    const data = event.data;

    if (!eventType || !data) {
      return new Response('Invalid payload', { status: 400 });
    }

    // Process event idempotently
    if (eventType === 'charge.success') {
      const reference = data.reference;
      if (reference) {
        // Idempotency check:
        const { data: existing } = await supabaseClient
          .from('rova_payment_history')
          .select('id')
          .eq('payment_reference', reference)
          .maybeSingle();

        if (existing) {
          return new Response('Already processed', { status: 200 });
        }

        const customerCode = data.customer?.customer_code;
        const metadataUserId = data.metadata?.userId || data.metadata?.user_id;

        let targetSub: any = null;
        if (metadataUserId) {
          const { data: sub } = await supabaseClient
            .from('rova_subscriptions')
            .select('*')
            .eq('user_id', metadataUserId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          targetSub = sub;
        }

        if (!targetSub && customerCode) {
          const { data: sub } = await supabaseClient
            .from('rova_subscriptions')
            .select('*')
            .eq('paystack_customer_code', customerCode)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          targetSub = sub;
        }

        if (targetSub) {
          const isDaily = targetSub.billing_interval === 'daily' || targetSub.payment_type === 'recurring';
          const extensionDays = isDaily ? 1 : 30;

          const currentExpiry = targetSub.access_expires_at ? new Date(targetSub.access_expires_at).getTime() : Date.now();
          const baseTime = Math.max(currentExpiry, Date.now());
          const newExpiry = new Date(baseTime + extensionDays * 24 * 60 * 60 * 1000);
          const nextPaymentDateStr = isDaily ? newExpiry.toISOString().split('T')[0] : null;

          await supabaseClient
            .from('rova_subscriptions')
            .update({
              status: 'active',
              last_payment_date: new Date().toISOString(),
              access_expires_at: newExpiry.toISOString(),
              next_payment_date: nextPaymentDateStr,
            })
            .eq('id', targetSub.id);

          await supabaseClient.from('rova_payment_history').insert({
            user_id: targetSub.user_id,
            subscription_id: targetSub.id,
            payment_type: targetSub.payment_type,
            billing_interval: targetSub.billing_interval,
            plan: targetSub.plan,
            amount: data.amount ? data.amount / 100 : targetSub.amount,
            currency: 'NGN',
            status: 'success',
            payment_reference: reference,
            paystack_transaction_id: String(data.id || reference),
            paystack_customer_code: customerCode,
            period_start: new Date(baseTime).toISOString(),
            period_end: newExpiry.toISOString(),
            metadata: { webhook: true, event: 'charge.success' },
          });
        }
      }
    } else if (eventType === 'invoice.payment_failed') {
      const customerCode = data.customer?.customer_code;
      if (customerCode) {
        const { data: sub } = await supabaseClient
          .from('rova_subscriptions')
          .select('*')
          .eq('paystack_customer_code', customerCode)
          .eq('status', 'active')
          .maybeSingle();

        if (sub) {
          await supabaseClient.from('rova_payment_history').insert({
            user_id: sub.user_id,
            subscription_id: sub.id,
            payment_type: sub.payment_type,
            billing_interval: sub.billing_interval,
            plan: sub.plan,
            amount: data.amount ? data.amount / 100 : sub.amount,
            currency: 'NGN',
            status: 'failed',
            payment_reference: data.reference || `FAILED_${Date.now()}`,
            paystack_customer_code: customerCode,
            metadata: { webhook: true, reason: 'invoice.payment_failed' },
          });

          // If current access has expired, mark subscription as expired
          if (sub.access_expires_at && new Date(sub.access_expires_at).getTime() <= Date.now()) {
            await supabaseClient
              .from('rova_subscriptions')
              .update({ status: 'expired' })
              .eq('id', sub.id);
          }
        }
      }
    } else if (eventType === 'subscription.disable') {
      const subCode = data.subscription_code;
      if (subCode) {
        await supabaseClient
          .from('rova_subscriptions')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('paystack_subscription_code', subCode);
      }
    }

    return new Response('Webhook received', { status: 200 });
  } catch (err: any) {
    return new Response(err.message || 'Webhook processing error', { status: 500 });
  }
});
