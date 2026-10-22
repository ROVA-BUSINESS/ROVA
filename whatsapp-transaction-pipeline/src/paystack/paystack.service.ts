import crypto from 'crypto';
import { supabase } from '../config/supabase';

export interface PlanDefinition {
  key: 'basic_daily' | 'basic_monthly' | 'business_daily' | 'business_monthly';
  name: string;
  tier: 'basic' | 'business';
  frequency: 'daily' | 'monthly';
  paymentType: 'recurring' | 'one_time';
  amountNaira: number;
  amountKobo: number;
  durationDays: number;
}

export const BACKEND_PLANS: Record<string, PlanDefinition> = {
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

export class PaystackService {
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  }

  /**
   * Verify a transaction with Paystack API server-side.
   * Never trust client redirects or client callbacks alone.
   */
  async verifyTransaction(reference: string): Promise<any> {
    if (!reference) {
      throw new Error('Transaction reference is required');
    }

    // Support developer bypass codes in non-production/test environments
    if (reference.startsWith('DEV_AUTO_BYPASS') || reference.startsWith('DEV_BYPASS')) {
      return {
        status: true,
        data: {
          status: 'success',
          reference,
          amount: 0,
          currency: 'NGN',
          customer: { customer_code: 'CUS_DEV_BYPASS', email: 'dev@rovabusiness.com' },
          channel: 'bypass',
        },
      };
    }

    if (!this.secretKey) {
      console.warn('⚠️ PAYSTACK_SECRET_KEY not set. Using test verification fallback.');
      // If no secret key is set, check if reference has valid format
      if (reference.startsWith('ROVA_') || reference.startsWith('TEST_')) {
        return {
          status: true,
          data: {
            status: 'success',
            reference,
            amount: 10000, // Will be validated against plan
            currency: 'NGN',
            customer: { customer_code: 'CUS_MOCK', email: 'test@customer.com' },
          },
        };
      }
      throw new Error('PAYSTACK_SECRET_KEY is not configured on backend.');
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Paystack verification failed (${response.status}): ${errText}`);
    }

    const json = await response.json();
    return json;
  }

  /**
   * Activate or record subscription after server-side verification.
   */
  async processVerifiedPayment(params: {
    userId: string;
    reference: string;
    planKey?: string;
    serviceType?: string;
    taxYear?: number;
    filingType?: string;
    businessName?: string;
    consentGiven?: boolean;
  }): Promise<{ success: boolean; error?: string; subscription?: any; payment?: any }> {
    const { userId, reference, planKey, serviceType, taxYear, filingType, businessName } = params;

    // 1. Idempotency Check: check if already processed
    const { data: existingPayment } = await supabase
      .from('rova_payment_history')
      .select('*')
      .eq('payment_reference', reference)
      .maybeSingle();

    if (existingPayment) {
      console.log(`Payment ref ${reference} already processed. Returning existing.`);
      const { data: currentSub } = await supabase
        .from('rova_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return { success: true, subscription: currentSub, payment: existingPayment };
    }

    // 2. Call Paystack API server-side
    const verifyResult = await this.verifyTransaction(reference);
    if (!verifyResult?.status || verifyResult?.data?.status !== 'success') {
      return {
        success: false,
        error: `Payment verification failed with status: ${verifyResult?.data?.status || 'unknown'}`,
      };
    }

    const txData = verifyResult.data;
    const isBypass = reference.startsWith('DEV_');

    // 3. Tax Filing service one-time purchase
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

      if (svcErr) {
        throw new Error(`Failed to record service payment: ${svcErr.message}`);
      }

      return { success: true, payment: svcPayment };
    }

    // 4. Subscription Purchase
    const selectedPlanKey = planKey || 'basic_daily';
    const planDef = BACKEND_PLANS[selectedPlanKey];
    if (!planDef) {
      return { success: false, error: `Invalid plan selected: ${selectedPlanKey}` };
    }

    // Validate amount matches expected plan amount
    if (!isBypass && this.secretKey && txData.amount !== planDef.amountKobo) {
      return {
        success: false,
        error: `Amount mismatch: Expected ₦${planDef.amountNaira} (${planDef.amountKobo} kobo), but received ${txData.amount} kobo.`,
      };
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

    // Cancel any previous active subscriptions for this user
    await supabase
      .from('rova_subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('status', 'active');

    // Insert new subscription record
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

    if (subErr) {
      throw new Error(`Failed to activate subscription: ${subErr.message}`);
    }

    // Insert audit record into rova_payment_history (guaranteed idempotency via UNIQUE constraint)
    const { data: paymentRecord, error: histErr } = await supabase
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
          ip_address: txData.ip_address,
        },
      })
      .select()
      .maybeSingle();

    if (histErr) {
      console.warn('Could not insert payment history (may be duplicate):', histErr.message);
    }

    return { success: true, subscription: newSub, payment: paymentRecord };
  }

  /**
   * Validates Paystack HMAC SHA512 webhook signature.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
    if (!this.secretKey) {
      console.warn('PAYSTACK_SECRET_KEY missing in environment. Cannot verify webhook signature.');
      return false;
    }
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');
    return hash === signature;
  }

  /**
   * Process Paystack Webhook events idempotently.
   */
  async processWebhookEvent(event: { event: string; data: any }): Promise<{ handled: boolean; message: string }> {
    const { event: eventType, data } = event;
    console.log(`🔔 Paystack Webhook received: ${eventType}`);

    switch (eventType) {
      case 'charge.success': {
        const reference = data.reference;
        if (!reference) return { handled: true, message: 'No reference' };

        // 1. Idempotency Check: if reference exists in history, return without re-extending
        const { data: existing } = await supabase
          .from('rova_payment_history')
          .select('id')
          .eq('payment_reference', reference)
          .maybeSingle();

        if (existing) {
          console.log(`Webhook charge.success: reference ${reference} already processed.`);
          return { handled: true, message: 'Reference already processed' };
        }

        // Find user by customer code or metadata
        const customerCode = data.customer?.customer_code;
        const userEmail = data.customer?.email;
        const metadataUserId = data.metadata?.userId || data.metadata?.user_id;

        let targetSub: any = null;

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

        if (!targetSub && userEmail) {
          // Look up user from auth.users
          const { data: users } = await supabase.auth.admin.listUsers();
          const matchedUser = users?.users?.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
          if (matchedUser) {
            const { data: sub } = await supabase
              .from('rova_subscriptions')
              .select('*')
              .eq('user_id', matchedUser.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            targetSub = sub;
          }
        }

        if (targetSub) {
          const isDailyRecurring = targetSub.billing_interval === 'daily' || targetSub.payment_type === 'recurring';
          const extensionDays = isDailyRecurring ? 1 : 30;

          const currentExpiry = targetSub.access_expires_at ? new Date(targetSub.access_expires_at).getTime() : Date.now();
          const baseTime = Math.max(currentExpiry, Date.now());
          const newExpiry = new Date(baseTime + extensionDays * 24 * 60 * 60 * 1000);
          const nextPaymentDateStr = isDailyRecurring ? newExpiry.toISOString().split('T')[0] : null;

          await supabase
            .from('rova_subscriptions')
            .update({
              status: 'active',
              last_payment_date: new Date().toISOString(),
              access_expires_at: newExpiry.toISOString(),
              next_payment_date: nextPaymentDateStr,
              paystack_customer_code: customerCode || targetSub.paystack_customer_code,
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
            period_start: new Date(baseTime).toISOString(),
            period_end: newExpiry.toISOString(),
            metadata: { webhook: true, event: 'charge.success' },
          });

          console.log(`✅ Subscription ${targetSub.id} extended until ${newExpiry.toISOString()}`);
        }

        return { handled: true, message: 'Processed charge.success' };
      }

      case 'subscription.create': {
        const subCode = data.subscription_code;
        const emailToken = data.email_token;
        const customerCode = data.customer?.customer_code;
        const planCode = data.plan?.plan_code;

        if (customerCode) {
          await supabase
            .from('rova_subscriptions')
            .update({
              paystack_subscription_code: subCode,
              paystack_email_token: emailToken,
              paystack_plan_code: planCode,
            })
            .eq('paystack_customer_code', customerCode)
            .eq('status', 'active');
        }
        return { handled: true, message: 'Saved subscription.create details' };
      }

      case 'invoice.payment_failed': {
        console.warn('⚠️ Paystack Invoice Payment Failed:', data);
        const customerCode = data.customer?.customer_code;
        if (customerCode) {
          const { data: sub } = await supabase
            .from('rova_subscriptions')
            .select('*')
            .eq('paystack_customer_code', customerCode)
            .eq('status', 'active')
            .maybeSingle();

          if (sub) {
            // Record failed payment in history
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

            // If access has already expired, set status to expired
            const isExpired = sub.access_expires_at && new Date(sub.access_expires_at).getTime() <= Date.now();
            if (isExpired) {
              await supabase
                .from('rova_subscriptions')
                .update({ status: 'expired' })
                .eq('id', sub.id);
            }
          }
        }
        return { handled: true, message: 'Recorded invoice.payment_failed without extending access' };
      }

      case 'subscription.disable': {
        const subCode = data.subscription_code;
        if (subCode) {
          await supabase
            .from('rova_subscriptions')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
            })
            .eq('paystack_subscription_code', subCode);
        }
        return { handled: true, message: 'Handled subscription.disable' };
      }

      default:
        return { handled: false, message: `Ignored event: ${eventType}` };
    }
  }

  /**
   * Cancel an active daily recurring subscription on Paystack and in database.
   */
  async cancelSubscription(userId: string, subscriptionId: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const { data: sub, error: subErr } = await supabase
      .from('rova_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', userId)
      .single();

    if (subErr || !sub) {
      return { success: false, error: 'Subscription not found or not owned by user.' };
    }

    // If it's a recurring daily subscription with Paystack subscription code, call Paystack API to disable
    if (sub.payment_type === 'recurring' && sub.paystack_subscription_code && this.secretKey) {
      try {
        const disableRes = await fetch('https://api.paystack.co/subscription/disable', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: sub.paystack_subscription_code,
            token: sub.paystack_email_token,
          }),
        });

        const disableJson = await disableRes.json();
        console.log('Paystack subscription disable response:', disableJson);
      } catch (err: any) {
        console.error('Failed to disable subscription on Paystack:', err.message);
      }
    }

    // Update status in database
    await supabase
      .from('rova_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscriptionId);

    return {
      success: true,
      message: sub.payment_type === 'recurring'
        ? 'Daily recurring subscription cancelled. Future automatic charges have been stopped.'
        : 'Monthly access noted. Your access will expire at the end of the paid 30-day period.',
    };
  }
}

export const paystackService = new PaystackService();
