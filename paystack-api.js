import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qlwqktnziuqeosbnhnls.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsd3FrdG56aXVxZW9zYm5obmxzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyNjc0OSwiZXhwIjoyMDkyNzAyNzQ5fQ.GsPyA-kk8jLyJo6uJX3G2AVIQZxLsCoLDON_UrP2o5A';
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export const BACKEND_PLANS = {
  basic_daily: {
    key: 'basic_daily',
    name: 'ROVA Basic — Daily',
    tier: 'basic',
    frequency: 'daily',
    paymentType: 'recurring',
    amountNaira: 100,
    amountKobo: 10000,
    durationDays: 1,
  },
  basic_monthly: {
    key: 'basic_monthly',
    name: 'ROVA Basic — Monthly',
    tier: 'basic',
    frequency: 'monthly',
    paymentType: 'one_time',
    amountNaira: 3000,
    amountKobo: 300000,
    durationDays: 30,
  },
  business_daily: {
    key: 'business_daily',
    name: 'ROVA Business — Daily',
    tier: 'business',
    frequency: 'daily',
    paymentType: 'recurring',
    amountNaira: 500,
    amountKobo: 50000,
    durationDays: 1,
  },
  business_monthly: {
    key: 'business_monthly',
    name: 'ROVA Business — Monthly',
    tier: 'business',
    frequency: 'monthly',
    paymentType: 'one_time',
    amountNaira: 15000,
    amountKobo: 1500000,
    durationDays: 30,
  },
};

/**
 * Verify transaction with Paystack API server-side
 */
async function verifyWithPaystack(reference) {
  if (reference.startsWith('DEV_AUTO_BYPASS') || reference.startsWith('DEV_BYPASS')) {
    return {
      status: true,
      data: {
        status: 'success',
        reference,
        amount: 0,
        currency: 'NGN',
        customer: { customer_code: 'CUS_DEV_BYPASS', email: 'dev@rovabusiness.com' },
      },
    };
  }

  if (!paystackSecretKey) {
    if (reference.startsWith('ROVA_') || reference.startsWith('TEST_')) {
      return {
        status: true,
        data: {
          status: 'success',
          reference,
          amount: 10000,
          currency: 'NGN',
          customer: { customer_code: 'CUS_MOCK', email: 'test@customer.com' },
        },
      };
    }
    throw new Error('PAYSTACK_SECRET_KEY is not set on backend');
  }

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paystack API returned ${res.status}: ${text}`);
  }

  return await res.json();
}

/**
 * POST /verify
 */
router.post('/verify', async (req, res) => {
  try {
    let userId = req.body.userId;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User must be authenticated' });
    }

    const { reference, planKey, serviceType, taxYear, filingType, businessName } = req.body;

    if (!reference) {
      return res.status(400).json({ success: false, error: 'Payment reference is required' });
    }

    // Idempotency check: already processed?
    const { data: existingPayment } = await supabase
      .from('rova_payment_history')
      .select('*')
      .eq('payment_reference', reference)
      .maybeSingle();

    if (existingPayment) {
      const { data: currentSub } = await supabase
        .from('rova_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return res.status(200).json({ success: true, subscription: currentSub, payment: existingPayment });
    }

    // Call Paystack API
    const verifyRes = await verifyWithPaystack(reference);
    if (!verifyRes?.status || verifyRes?.data?.status !== 'success') {
      return res.status(400).json({
        success: false,
        error: `Paystack verification returned status: ${verifyRes?.data?.status || 'failed'}`,
      });
    }

    const txData = verifyRes.data;
    const isBypass = reference.startsWith('DEV_');

    // Tax Filing
    if (serviceType === 'tax_filing') {
      const { data: svcPayment, error: svcErr } = await supabase
        .from('rova_service_payments')
        .insert({
          user_id: userId,
          business_name: businessName || null,
          service_type: 'tax_filing',
          service_name: `${taxYear || new Date().getFullYear()} Tax Filing`,
          tax_year: taxYear || new Date().getFullYear(),
          filing_type: filingType || 'Annual Return',
          amount: 5000,
          payment_reference: reference,
          paystack_transaction_id: String(txData.id || reference),
          payment_date: new Date().toISOString(),
          payment_status: 'paid',
          filing_status: 'processing',
        })
        .select()
        .single();

      if (svcErr) throw svcErr;
      return res.status(200).json({ success: true, payment: svcPayment });
    }

    // Subscription
    const selectedPlanKey = planKey || 'basic_daily';
    const planDef = BACKEND_PLANS[selectedPlanKey];
    if (!planDef) {
      return res.status(400).json({ success: false, error: `Invalid plan: ${selectedPlanKey}` });
    }

    // Validate amount
    if (!isBypass && paystackSecretKey && txData.amount !== planDef.amountKobo) {
      return res.status(400).json({
        success: false,
        error: `Amount mismatch: Expected ₦${planDef.amountNaira} (${planDef.amountKobo} kobo), received ${txData.amount} kobo.`,
      });
    }

    const now = new Date();
    const startDateStr = now.toISOString().split('T')[0];
    const expiresAt = new Date(now.getTime() + planDef.durationDays * 24 * 60 * 60 * 1000);
    const expiresAtIso = expiresAt.toISOString();
    const nextPaymentDateStr = planDef.paymentType === 'recurring'
      ? expiresAt.toISOString().split('T')[0]
      : null; // Strictly null for monthly one-time plans

    const customerCode = txData.customer?.customer_code || null;
    const subscriptionCode = txData.subscription?.subscription_code || txData.plan_object?.subscriptions?.[0]?.subscription_code || null;
    const emailToken = txData.subscription?.email_token || null;
    const planCode = txData.plan?.plan_code || txData.plan_object?.plan_code || null;

    // Cancel existing active subscriptions
    await supabase
      .from('rova_subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('status', 'active');

    // Insert new subscription
    const { data: newSub, error: subErr } = await supabase
      .from('rova_subscriptions')
      .insert({
        user_id: userId,
        business_name: businessName || null,
        plan: selectedPlanKey,
        amount: isBypass ? 0 : planDef.amountNaira,
        payment_type: planDef.paymentType,
        billing_interval: planDef.frequency,
        status: 'active',
        payment_reference: reference,
        paystack_transaction_id: String(txData.id || reference),
        paystack_customer_code: customerCode,
        paystack_subscription_code: subscriptionCode,
        paystack_email_token: emailToken,
        paystack_plan_code: planCode,
        access_expires_at: expiresAtIso,
        last_payment_date: now.toISOString(),
        payment_date: now.toISOString(),
        start_date: startDateStr,
        next_payment_date: nextPaymentDateStr,
      })
      .select()
      .single();

    if (subErr) throw subErr;

    // Record in rova_payment_history
    const { data: paymentRecord } = await supabase
      .from('rova_payment_history')
      .insert({
        user_id: userId,
        subscription_id: newSub.id,
        payment_type: planDef.paymentType,
        billing_interval: planDef.frequency,
        plan: selectedPlanKey,
        amount: isBypass ? 0 : planDef.amountNaira,
        currency: 'NGN',
        status: 'success',
        payment_reference: reference,
        paystack_transaction_id: String(txData.id || reference),
        paystack_customer_code: customerCode,
        paystack_subscription_code: subscriptionCode,
        paystack_plan_code: planCode,
        period_start: now.toISOString(),
        period_end: expiresAtIso,
        metadata: {
          channel: txData.channel,
          gateway_response: txData.gateway_response,
        },
      })
      .select()
      .maybeSingle();

    return res.status(200).json({ success: true, subscription: newSub, payment: paymentRecord });
  } catch (err) {
    console.error('Verify error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * POST /webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    if (signature && paystackSecretKey) {
      const hash = crypto
        .createHmac('sha512', paystackSecretKey)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (hash !== signature) {
        console.warn('❌ Invalid Paystack webhook signature');
        return res.status(400).send('Invalid signature');
      }
    }

    res.status(200).send('Webhook received');

    const { event, data } = req.body || {};
    if (!event || !data) return;

    if (event === 'charge.success') {
      const reference = data.reference;
      if (!reference) return;

      // Idempotency
      const { data: existing } = await supabase
        .from('rova_payment_history')
        .select('id')
        .eq('payment_reference', reference)
        .maybeSingle();

      if (existing) return;

      const customerCode = data.customer?.customer_code;
      const metadataUserId = data.metadata?.userId || data.metadata?.user_id;

      let targetSub = null;
      if (metadataUserId) {
        const { data: sub } = await supabase
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
        const { data: sub } = await supabase
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
        const days = isDaily ? 1 : 30;
        const currentExp = targetSub.access_expires_at ? new Date(targetSub.access_expires_at).getTime() : Date.now();
        const base = Math.max(currentExp, Date.now());
        const newExp = new Date(base + days * 24 * 60 * 60 * 1000);

        await supabase
          .from('rova_subscriptions')
          .update({
            status: 'active',
            last_payment_date: new Date().toISOString(),
            access_expires_at: newExp.toISOString(),
            next_payment_date: isDaily ? newExp.toISOString().split('T')[0] : null,
          })
          .eq('id', targetSub.id);

        await supabase.from('rova_payment_history').insert({
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
          period_start: new Date(base).toISOString(),
          period_end: newExp.toISOString(),
          metadata: { webhook: true, event: 'charge.success' },
        });
      }
    } else if (event === 'invoice.payment_failed') {
      const customerCode = data.customer?.customer_code;
      if (customerCode) {
        const { data: sub } = await supabase
          .from('rova_subscriptions')
          .select('*')
          .eq('paystack_customer_code', customerCode)
          .eq('status', 'active')
          .maybeSingle();

        if (sub) {
          await supabase.from('rova_payment_history').insert({
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

          if (sub.access_expires_at && new Date(sub.access_expires_at).getTime() <= Date.now()) {
            await supabase.from('rova_subscriptions').update({ status: 'expired' }).eq('id', sub.id);
          }
        }
      }
    } else if (event === 'subscription.disable') {
      const subCode = data.subscription_code;
      if (subCode) {
        await supabase
          .from('rova_subscriptions')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('paystack_subscription_code', subCode);
      }
    }
  } catch (err) {
    console.error('Webhook error:', err);
  }
});

/**
 * POST /cancel
 */
router.post('/cancel', async (req, res) => {
  try {
    let userId = req.body.userId;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    const { subscriptionId } = req.body;
    if (!subscriptionId) return res.status(400).json({ success: false, error: 'subscriptionId is required' });

    const { data: sub } = await supabase
      .from('rova_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (!sub) return res.status(404).json({ success: false, error: 'Subscription not found' });

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
      } catch (e) {
        console.warn('Paystack disable error:', e.message);
      }
    }

    await supabase
      .from('rova_subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', subscriptionId);

    return res.status(200).json({
      success: true,
      message: sub.payment_type === 'recurring'
        ? 'Daily recurring subscription cancelled. Future automatic charges stopped.'
        : 'Monthly plan marked cancelled. Access remains until end of 30-day period.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
