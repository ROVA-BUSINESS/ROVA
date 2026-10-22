import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, type RovaSubscription, type RovaServicePayment, type RovaPaymentHistory } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  type PlanKey,
  verifyPaymentOnServer,
  cancelSubscriptionOnServer
} from '../lib/paystack';
import { isDeveloperEmail, isDeveloperBypassCode } from '../config/developers';

interface SubscriptionContextValue {
  subscription: RovaSubscription | null;
  servicePayments: RovaServicePayment[];
  paymentHistory: RovaPaymentHistory[];
  loading: boolean;
  isActive: boolean;
  isExpired: boolean;
  isBasic: boolean;
  isBusiness: boolean;
  isDeveloper: boolean;
  planKey: PlanKey | null;
  refresh: () => Promise<void>;
  activateByReference: (reference: string, planKey?: PlanKey) => Promise<{ success: boolean; error?: string }>;
  cancelCurrentSubscription: () => Promise<{ success: boolean; error?: string; message?: string }>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  servicePayments: [],
  paymentHistory: [],
  loading: true,
  isActive: false,
  isExpired: false,
  isBasic: false,
  isBusiness: false,
  isDeveloper: false,
  planKey: null,
  refresh: async () => {},
  activateByReference: async () => ({ success: false, error: 'Not initialized' }),
  cancelCurrentSubscription: async () => ({ success: false, error: 'Not initialized' }),
});

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<RovaSubscription | null>(null);
  const [servicePayments, setServicePayments] = useState<RovaServicePayment[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<RovaPaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) {
      setSubscription(null);
      setServicePayments([]);
      setPaymentHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const [subRes, svcRes, histRes] = await Promise.all([
      supabase
        .from('rova_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('rova_service_payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('rova_payment_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    let activeSub = subRes.data?.[0] ?? null;

    // Auto-grant developer subscription for whitelisted emails
    if (!activeSub && isDeveloperEmail(user.email)) {
      try {
        const { data: devSub } = await supabase.from('rova_subscriptions').insert({
          user_id: user.id,
          plan: 'business_monthly',
          amount: 0,
          payment_type: 'one_time',
          billing_interval: 'monthly',
          status: 'active',
          payment_reference: 'DEV_AUTO_BYPASS',
          paystack_transaction_id: 'DEV_AUTO_BYPASS',
          payment_date: new Date().toISOString(),
          start_date: new Date().toISOString().split('T')[0],
          access_expires_at: '2099-12-31T23:59:59.000Z',
          next_payment_date: '2099-12-31',
        }).select().single();

        if (devSub) activeSub = devSub;
      } catch (err) {
        console.error('Failed to auto-grant dev subscription:', err);
      }
    }

    // Auto-recover pending payment from localStorage via server verification
    if (!activeSub) {
      try {
        const rawPending = localStorage.getItem('rova_pending_payment');
        if (rawPending) {
          const pending = JSON.parse(rawPending);
          if (pending && pending.userId === user.id && pending.type === 'subscription' && pending.reference) {
            const verRes = await verifyPaymentOnServer({
              reference: pending.reference,
              planKey: pending.planKey,
            });

            if (verRes.success && verRes.subscription) {
              activeSub = verRes.subscription;
              localStorage.removeItem('rova_pending_payment');
            }
          }
        }
      } catch (err) {
        console.error('Pending payment recovery error:', err);
      }
    }

    setSubscription(activeSub);
    setServicePayments(svcRes.data ?? []);
    setPaymentHistory(histRes.data ?? []);
    setLoading(false);
  }

  async function activateByReference(reference: string, targetPlanKey: PlanKey = 'basic_daily') {
    if (!user) return { success: false, error: 'Not logged in' };
    const cleanRef = reference.trim();
    if (!cleanRef) return { success: false, error: 'Please enter a valid Paystack payment reference' };

    try {
      const isDevBypass = isDeveloperBypassCode(cleanRef);
      if (isDevBypass) {
        await supabase
          .from('rova_subscriptions')
          .update({ status: 'cancelled' })
          .eq('user_id', user.id)
          .eq('status', 'active');

        const { data: newSub, error } = await supabase.from('rova_subscriptions').insert({
          user_id: user.id,
          plan: 'business_monthly',
          amount: 0,
          payment_type: 'one_time',
          billing_interval: 'monthly',
          status: 'active',
          payment_reference: cleanRef,
          paystack_transaction_id: cleanRef,
          payment_date: new Date().toISOString(),
          start_date: new Date().toISOString().split('T')[0],
          access_expires_at: '2099-12-31T23:59:59.000Z',
          next_payment_date: '2099-12-31',
        }).select().single();

        if (error) throw error;
        setSubscription(newSub);
        return { success: true };
      }

      // Perform server-side payment verification
      const verifyRes = await verifyPaymentOnServer({
        reference: cleanRef,
        planKey: targetPlanKey,
      });

      if (!verifyRes.success) {
        return { success: false, error: verifyRes.error || 'Failed to verify payment reference on server.' };
      }

      await load();
      localStorage.removeItem('rova_pending_payment');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to activate reference' };
    }
  }

  async function cancelCurrentSubscription() {
    if (!subscription) return { success: false, error: 'No active subscription' };
    try {
      const res = await cancelSubscriptionOnServer(subscription.id);
      await load();
      return res;
    } catch (err: any) {
      return { success: false, error: err.message || 'Cancellation failed' };
    }
  }

  useEffect(() => {
    load();
  }, [user?.id]);

  const isDeveloper = isDeveloperEmail(user?.email) || isDeveloperBypassCode(subscription?.payment_reference);

  // Expiration check: Has current access expired?
  let isExpired = false;
  if (!isDeveloper && subscription) {
    if (subscription.access_expires_at) {
      isExpired = new Date(subscription.access_expires_at).getTime() < Date.now();
    } else if (subscription.next_payment_date) {
      // Fallback: if next_payment_date has passed by more than 24h
      const expDate = new Date(subscription.next_payment_date);
      expDate.setHours(23, 59, 59, 999);
      isExpired = expDate.getTime() < Date.now();
    }
  }

  // Active status strictly requires valid non-expired access
  const isActive = isDeveloper || (subscription?.status === 'active' && !isExpired);
  const planKey = (isDeveloper && !subscription?.plan ? 'business_monthly' : subscription?.plan ?? null) as PlanKey | null;
  const isBasic = isActive && (planKey === 'basic_daily' || planKey === 'basic_monthly');
  const isBusiness = isDeveloper || (isActive && (planKey === 'business_daily' || planKey === 'business_monthly'));

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        servicePayments,
        paymentHistory,
        loading,
        isActive,
        isExpired,
        isBasic,
        isBusiness,
        isDeveloper,
        planKey,
        refresh: load,
        activateByReference,
        cancelCurrentSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
