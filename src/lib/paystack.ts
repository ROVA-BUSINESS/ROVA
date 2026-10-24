// Paystack inline payment & subscription utility for ROVA
// Supports:
// 1. Monthly Plan: Charged ONCE (one-time payment, 30 days access, no automatic recurring charges)
// 2. Daily Plan: Automatic RECURRING daily payments via Paystack Subscription API / Plan

import { supabase } from './supabase';

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: PaystackSetupOptions) => { openIframe: () => void };
    };
  }
}

export interface PaystackSetupOptions {
  key: string;
  email: string;
  amount: number; // in kobo (× 100)
  currency: string;
  ref: string;
  plan?: string;  // Included ONLY for daily recurring plans!
  metadata?: Record<string, unknown>;
  callback: (response: { reference: string; trans?: string; status?: string; message?: string }) => void;
  onClose: () => void;
}

export interface PaystackPaymentOptions {
  email: string;
  amountNaira: number;       // pass in naira — converted to kobo internally
  reference: string;
  planKey?: PlanKey;
  planCode?: string;         // Paystack plan code (for daily recurring)
  metadata?: Record<string, unknown>;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) {
      resolve();
      return;
    }
    const existing = document.getElementById('paystack-inline-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = 'paystack-inline-script';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Plan metadata helpers
export type PlanKey = 'basic_daily' | 'basic_monthly' | 'business_daily' | 'business_monthly';
export type PaymentType = 'one_time' | 'recurring';
export type BillingInterval = 'daily' | 'monthly';

export interface PlanConfig {
  key: PlanKey;
  tier: 'basic' | 'business';
  label: string;
  frequency: BillingInterval;
  paymentType: PaymentType;
  amountNaira: number;
  nextPaymentDays: number; // days until expiry/renewal
  paystackPlanCode?: string; // configured plan code for Paystack recurring
  billingTerms: string;
  renewalDescription: string;
}

export const PLANS: Record<PlanKey, PlanConfig> = {
  basic_daily: {
    key: 'basic_daily',
    tier: 'basic',
    label: 'ROVA Basic — Daily',
    frequency: 'daily',
    paymentType: 'recurring',
    amountNaira: 100,
    nextPaymentDays: 1,
    paystackPlanCode: (import.meta.env.VITE_PAYSTACK_PLAN_BASIC_DAILY as string) || 'PLN_rova_basic_daily',
    billingTerms: 'Charged ₦100 daily on recurring auto-renewal via Paystack until cancelled.',
    renewalDescription: 'Renews automatically every 24 hours. Cancel anytime in 1 click.',
  },
  basic_monthly: {
    key: 'basic_monthly',
    tier: 'basic',
    label: 'ROVA Basic — Monthly',
    frequency: 'monthly',
    paymentType: 'one_time',
    amountNaira: 3000,
    nextPaymentDays: 30,
    billingTerms: 'One-time payment for 30 days of full access. No automatic renewal.',
    renewalDescription: 'Pay once for 30 days. No recurring charges or surprise fees.',
  },
  business_daily: {
    key: 'business_daily',
    tier: 'business',
    label: 'ROVA Business — Daily',
    frequency: 'daily',
    paymentType: 'recurring',
    amountNaira: 500,
    nextPaymentDays: 1,
    paystackPlanCode: (import.meta.env.VITE_PAYSTACK_PLAN_BUSINESS_DAILY as string) || 'PLN_rova_business_daily',
    billingTerms: 'Charged ₦500 daily on recurring auto-renewal via Paystack until cancelled.',
    renewalDescription: 'Renews automatically every 24 hours. Cancel anytime in 1 click.',
  },
  business_monthly: {
    key: 'business_monthly',
    tier: 'business',
    label: 'ROVA Business — Monthly',
    frequency: 'monthly',
    paymentType: 'one_time',
    amountNaira: 15000,
    nextPaymentDays: 30,
    billingTerms: 'One-time payment for 30 days of full access. No automatic renewal.',
    renewalDescription: 'Pay once for 30 days. No recurring charges or surprise fees.',
  },
};

export const TAX_FILING_AMOUNT = 5000;

export function getNextPaymentDate(planKey: PlanKey, fromDate?: Date): string {
  const plan = PLANS[planKey];
  const d = fromDate ? new Date(fromDate) : new Date();
  d.setDate(d.getDate() + (plan?.nextPaymentDays || 30));
  return d.toISOString().split('T')[0];
}

export function generatePaymentRef(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `ROVA_${prefix}_${timestamp}_${random}`;
}

/**
 * Opens Paystack Inline popup.
 * CRITICAL RULE:
 * - Daily Plans: passes the recurring plan code so Paystack automatically creates a daily recurring subscription.
 * - Monthly Plans: strictly omits the plan code so Paystack performs ONLY a one-time charge.
 */
export async function openPaystackPopup(options: PaystackPaymentOptions): Promise<void> {
  await loadPaystackScript();

  const key = (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string) || 'pk_live_fb2ec2eb1534b3b19caf7c13cfc5e146f9f3159b';
  if (!key) {
    console.error('VITE_PAYSTACK_PUBLIC_KEY is not set in environment variables');
    throw new Error('Payment configuration error. Please contact support.');
  }

  const planConfig = options.planKey ? PLANS[options.planKey] : null;

  // Determine whether to attach recurring plan
  const isDailyRecurring = planConfig?.paymentType === 'recurring';
  const planCode = isDailyRecurring
    ? (options.planCode || planConfig?.paystackPlanCode)
    : undefined;

  const setupOptions: PaystackSetupOptions = {
    key,
    email: options.email,
    amount: Math.round(options.amountNaira * 100), // naira → kobo
    currency: 'NGN',
    ref: options.reference,
    metadata: {
      ...options.metadata,
      planKey: options.planKey,
      paymentType: planConfig?.paymentType || 'one_time',
      billingInterval: planConfig?.frequency || 'monthly',
    },
    callback: (response) => {
      options.onSuccess(response.reference);
    },
    onClose: options.onClose,
  };

  // Only attach plan for daily recurring plans
  if (isDailyRecurring && planCode) {
    setupOptions.plan = planCode;
  }

  const handler = window.PaystackPop.setup(setupOptions);
  handler.openIframe();
}

/**
 * Server-side payment verification call.
 * Never grants access solely on frontend redirect/callback.
 */
export async function verifyPaymentOnServer(params: {
  reference: string;
  planKey?: PlanKey;
  serviceType?: string;
  taxYear?: number;
  filingType?: string;
  consentGiven?: boolean;
}): Promise<{ success: boolean; error?: string; subscription?: any; payment?: any }> {
  try {
    // 1. Try Supabase Edge Function paystack-verify
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke('paystack-verify', {
      body: params,
    });

    if (!edgeError && edgeData?.success) {
      return edgeData;
    }

    // 2. Try Node/Express backend API fallback (/api/paystack/verify)
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    if (backendUrl || window.location.origin) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const res = await fetch(`${backendUrl}/api/paystack/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(params),
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.success) return resData;
        }
      } catch (e) {
        // Fallback continues
      }
    }

    if (edgeError) {
      console.warn('Edge function verification returned error, checking message:', edgeError.message);
    }

    return {
      success: false,
      error: edgeData?.error || edgeError?.message || 'Server verification failed. Please contact support.',
    };
  } catch (err: any) {
    console.error('Verification error:', err);
    return { success: false, error: err.message || 'Payment verification encountered an unexpected error.' };
  }
}

/**
 * Server-side subscription cancellation call.
 */
export async function cancelSubscriptionOnServer(subscriptionId: string): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    // 1. Try Supabase Edge Function paystack-cancel
    const { data, error } = await supabase.functions.invoke('paystack-cancel', {
      body: { subscriptionId },
    });

    if (!error && data?.success) {
      return data;
    }

    // 2. Try Node/Express backend API fallback
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const res = await fetch(`${backendUrl}/api/paystack/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ subscriptionId }),
    });

    if (res.ok) {
      return await res.json();
    }

    return { success: false, error: data?.error || error?.message || 'Failed to cancel subscription on server.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to cancel subscription' };
  }
}
