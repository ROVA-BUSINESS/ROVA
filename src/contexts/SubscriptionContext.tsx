import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, type RovaSubscription, type RovaServicePayment } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { getNextPaymentDate, type PlanKey } from '../lib/paystack';
import { isDeveloperEmail, isDeveloperBypassCode } from '../config/developers';

interface SubscriptionContextValue {
  subscription: RovaSubscription | null;
  servicePayments: RovaServicePayment[];
  loading: boolean;
  isActive: boolean;
  isBasic: boolean;
  isBusiness: boolean;
  isDeveloper: boolean;
  planKey: PlanKey | null;
  refresh: () => Promise<void>;
  activateByReference: (reference: string, planKey?: PlanKey) => Promise<{ success: boolean; error?: string }>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  servicePayments: [],
  loading: true,
  isActive: false,
  isBasic: false,
  isBusiness: false,
  isDeveloper: false,
  planKey: null,
  refresh: async () => {},
  activateByReference: async () => ({ success: false, error: 'Not initialized' }),
});

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<RovaSubscription | null>(null);
  const [servicePayments, setServicePayments] = useState<RovaServicePayment[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) {
      setSubscription(null);
      setServicePayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [subRes, svcRes] = await Promise.all([
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
    ]);

    let activeSub = subRes.data?.[0] ?? null;

    // Auto-grant developer subscription for whitelisted emails
    if (!activeSub && isDeveloperEmail(user.email)) {
      try {
        const { data: devSub } = await supabase.from('rova_subscriptions').insert({
          user_id: user.id,
          plan: 'business_monthly',
          amount: 0,
          status: 'active',
          payment_reference: 'DEV_AUTO_BYPASS',
          paystack_transaction_id: 'DEV_AUTO_BYPASS',
          payment_date: new Date().toISOString(),
          start_date: new Date().toISOString().split('T')[0],
          next_payment_date: '2099-12-31',
        }).select().single();

        if (devSub) activeSub = devSub;
      } catch (err) {
        console.error('Failed to auto-grant dev subscription:', err);
      }
    }

    // Auto-recover pending payment from localStorage (e.g. if user did bank transfer and closed popup)
    if (!activeSub) {
      try {
        const rawPending = localStorage.getItem('rova_pending_payment');
        if (rawPending) {
          const pending = JSON.parse(rawPending);
          if (pending && pending.userId === user.id && pending.type === 'subscription' && pending.planKey) {
            await supabase
              .from('rova_subscriptions')
              .update({ status: 'cancelled' })
              .eq('user_id', user.id)
              .eq('status', 'active');

            const { data: newSub } = await supabase.from('rova_subscriptions').insert({
              user_id: user.id,
              plan: pending.planKey,
              amount: pending.amount || 100,
              status: 'active',
              payment_reference: pending.reference,
              paystack_transaction_id: pending.reference,
              payment_date: new Date().toISOString(),
              start_date: new Date().toISOString().split('T')[0],
              next_payment_date: getNextPaymentDate(pending.planKey as PlanKey),
            }).select().single();

            if (newSub) {
              activeSub = newSub;
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
    setLoading(false);
  }

  async function activateByReference(reference: string, targetPlanKey: PlanKey = 'basic_daily') {
    if (!user) return { success: false, error: 'Not logged in' };
    const cleanRef = reference.trim();
    if (!cleanRef) return { success: false, error: 'Please enter a valid Paystack payment reference' };

    try {
      await supabase
        .from('rova_subscriptions')
        .update({ status: 'cancelled' })
        .eq('user_id', user.id)
        .eq('status', 'active');

      const isDevBypass = isDeveloperBypassCode(cleanRef);
      const isBusiness = isDevBypass || cleanRef.toLowerCase().includes('business') || targetPlanKey.includes('business');
      const selectedPlan: PlanKey = isDevBypass ? 'business_monthly' : (targetPlanKey || (isBusiness ? 'business_daily' : 'basic_daily'));
      const amount = isDevBypass ? 0 : (selectedPlan === 'business_monthly' ? 15000 : selectedPlan === 'business_daily' ? 500 : selectedPlan === 'basic_monthly' ? 3000 : 100);

      const { data: newSub, error } = await supabase.from('rova_subscriptions').insert({
        user_id: user.id,
        plan: selectedPlan,
        amount,
        status: 'active',
        payment_reference: cleanRef,
        paystack_transaction_id: cleanRef,
        payment_date: new Date().toISOString(),
        start_date: new Date().toISOString().split('T')[0],
        next_payment_date: isDevBypass ? '2099-12-31' : getNextPaymentDate(selectedPlan),
      }).select().single();

      if (error) throw error;

      setSubscription(newSub);
      localStorage.removeItem('rova_pending_payment');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to activate reference' };
    }
  }

  useEffect(() => {
    load();
  }, [user?.id]);

  const isDeveloper = isDeveloperEmail(user?.email) || isDeveloperBypassCode(subscription?.payment_reference);
  const isActive = isDeveloper || subscription?.status === 'active';
  const planKey = (isDeveloper && !subscription?.plan ? 'business_monthly' : subscription?.plan ?? null) as PlanKey | null;
  const isBasic = isActive && (planKey === 'basic_daily' || planKey === 'basic_monthly');
  const isBusiness = isDeveloper || (isActive && (planKey === 'business_daily' || planKey === 'business_monthly'));

  return (
    <SubscriptionContext.Provider
      value={{ subscription, servicePayments, loading, isActive, isBasic, isBusiness, isDeveloper, planKey, refresh: load, activateByReference }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

