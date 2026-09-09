import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase, type RovaSubscription, type RovaServicePayment } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { PlanKey } from '../lib/paystack';

interface SubscriptionContextValue {
  subscription: RovaSubscription | null;
  servicePayments: RovaServicePayment[];
  loading: boolean;
  isActive: boolean;
  isBasic: boolean;
  isBusiness: boolean;
  planKey: PlanKey | null;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  subscription: null,
  servicePayments: [],
  loading: true,
  isActive: false,
  isBasic: false,
  isBusiness: false,
  planKey: null,
  refresh: async () => {},
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

    setSubscription(subRes.data?.[0] ?? null);
    setServicePayments(svcRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [user?.id]);

  const isActive = subscription?.status === 'active';
  const planKey = (subscription?.plan ?? null) as PlanKey | null;
  const isBasic = isActive && (planKey === 'basic_daily' || planKey === 'basic_monthly');
  const isBusiness = isActive && (planKey === 'business_daily' || planKey === 'business_monthly');

  return (
    <SubscriptionContext.Provider
      value={{ subscription, servicePayments, loading, isActive, isBasic, isBusiness, planKey, refresh: load }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
