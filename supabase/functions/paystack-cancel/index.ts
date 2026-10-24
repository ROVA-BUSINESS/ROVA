import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwt = authHeader.replace('Bearer ', '').trim();
      const { data: { user } } = await supabaseClient.auth.getUser(jwt);
      if (user) userId = user.id;
    }

    const { subscriptionId } = await req.json();
    if (!subscriptionId) {
      return new Response(JSON.stringify({ error: 'subscriptionId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let query = supabaseClient.from('rova_subscriptions').select('*').eq('id', subscriptionId);
    if (userId) {
      query = query.eq('user_id', userId);
    }
    const { data: sub, error: subErr } = await query.maybeSingle();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (sub.payment_type === 'recurring' && sub.paystack_subscription_code && paystackSecretKey) {
      try {
        await fetch('https://api.paystack.co/subscription/disable', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: sub.paystack_subscription_code,
            token: sub.paystack_email_token,
          }),
        });
      } catch (e: any) {
        console.warn('Paystack disable error:', e.message);
      }
    }

    await supabaseClient
      .from('rova_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);

    return new Response(JSON.stringify({
      success: true,
      message: sub.payment_type === 'recurring'
        ? 'Daily recurring subscription cancelled. Future automatic charges stopped.'
        : 'Monthly plan marked cancelled. Access remains active until end of 30-day period.',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Cancel error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
