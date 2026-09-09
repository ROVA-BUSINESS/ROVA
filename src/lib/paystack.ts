// Paystack inline payment utility for ROVA
// Loads the Paystack inline script on demand and opens the payment popup.

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: PaystackSetupOptions) => { openIframe: () => void };
    };
  }
}

interface PaystackSetupOptions {
  key: string;
  email: string;
  amount: number; // in kobo (× 100)
  currency: string;
  ref: string;
  metadata?: Record<string, unknown>;
  callback: (response: { reference: string; trans: string; status: string }) => void;
  onClose: () => void;
}

export interface PaystackPaymentOptions {
  email: string;
  amountNaira: number;       // pass in naira — we convert internally
  reference: string;
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

export async function openPaystackPopup(options: PaystackPaymentOptions): Promise<void> {
  await loadPaystackScript();

  const key = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string;
  if (!key) {
    console.error('VITE_PAYSTACK_PUBLIC_KEY is not set in environment variables');
    throw new Error('Payment configuration error. Please contact support.');
  }

  const handler = window.PaystackPop.setup({
    key,
    email: options.email,
    amount: Math.round(options.amountNaira * 100), // naira → kobo
    currency: 'NGN',
    ref: options.reference,
    metadata: options.metadata,
    callback: (response) => {
      options.onSuccess(response.reference);
    },
    onClose: options.onClose,
  });

  handler.openIframe();
}

export function generatePaymentRef(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9).toUpperCase();
  return `ROVA_${prefix}_${timestamp}_${random}`;
}

// Plan metadata helpers
export type PlanKey = 'basic_daily' | 'basic_monthly' | 'business_daily' | 'business_monthly';

export interface PlanConfig {
  key: PlanKey;
  tier: 'basic' | 'business';
  label: string;
  frequency: 'daily' | 'monthly';
  amountNaira: number;
  nextPaymentDays: number; // days until next payment
}

export const PLANS: Record<PlanKey, PlanConfig> = {
  basic_daily: {
    key: 'basic_daily',
    tier: 'basic',
    label: 'ROVA Basic — Daily',
    frequency: 'daily',
    amountNaira: 100,
    nextPaymentDays: 1,
  },
  basic_monthly: {
    key: 'basic_monthly',
    tier: 'basic',
    label: 'ROVA Basic — Monthly',
    frequency: 'monthly',
    amountNaira: 3000,
    nextPaymentDays: 30,
  },
  business_daily: {
    key: 'business_daily',
    tier: 'business',
    label: 'ROVA Business — Daily',
    frequency: 'daily',
    amountNaira: 500,
    nextPaymentDays: 1,
  },
  business_monthly: {
    key: 'business_monthly',
    tier: 'business',
    label: 'ROVA Business — Monthly',
    frequency: 'monthly',
    amountNaira: 15000,
    nextPaymentDays: 30,
  },
};

export const TAX_FILING_AMOUNT = 5000;

export function getNextPaymentDate(planKey: PlanKey): string {
  const plan = PLANS[planKey];
  const d = new Date();
  d.setDate(d.getDate() + plan.nextPaymentDays);
  return d.toISOString().split('T')[0];
}
