-- ============================================================
-- Migration: Update ROVA Paystack Billing System
-- Monthly One-Time & Daily Recurring Payment Architecture
-- ============================================================

-- 1. Add schema fields to rova_subscriptions
ALTER TABLE rova_subscriptions
  ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('one_time', 'recurring')) DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS billing_interval TEXT CHECK (billing_interval IN ('daily', 'monthly')) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_email_token TEXT,
  ADD COLUMN IF NOT EXISTS paystack_plan_code TEXT,
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Indexes for fast lookup by Paystack identifiers and expiry
CREATE INDEX IF NOT EXISTS idx_rova_subscriptions_sub_code ON rova_subscriptions(paystack_subscription_code);
CREATE INDEX IF NOT EXISTS idx_rova_subscriptions_cus_code ON rova_subscriptions(paystack_customer_code);
CREATE INDEX IF NOT EXISTS idx_rova_subscriptions_expires_at ON rova_subscriptions(access_expires_at);

-- 3. Dedicated Payment History Table for audit log and idempotency
CREATE TABLE IF NOT EXISTS rova_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES rova_subscriptions(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('one_time', 'recurring')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('daily', 'monthly')),
  plan TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'refunded')),
  payment_reference TEXT UNIQUE NOT NULL,
  paystack_transaction_id TEXT,
  paystack_customer_code TEXT,
  paystack_subscription_code TEXT,
  paystack_plan_code TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rova_payment_history_user_id ON rova_payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_rova_payment_history_ref ON rova_payment_history(payment_reference);
CREATE INDEX IF NOT EXISTS idx_rova_payment_history_sub_id ON rova_payment_history(subscription_id);

-- Enable RLS
ALTER TABLE rova_payment_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rova_payment_history' AND policyname = 'Users view own payment history'
  ) THEN
    CREATE POLICY "Users view own payment history"
      ON rova_payment_history FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Safely migrate existing records without converting monthly into recurring
-- Migrate existing monthly customers (One-time, 30 days access, no auto-charge)
UPDATE rova_subscriptions
SET
  payment_type = 'one_time',
  billing_interval = 'monthly',
  access_expires_at = COALESCE(payment_date, created_at) + INTERVAL '30 days',
  last_payment_date = COALESCE(payment_date, created_at)
WHERE plan IN ('basic_monthly', 'business_monthly')
  AND (payment_type IS NULL OR access_expires_at IS NULL);

-- Migrate existing daily customers (Marked daily recurring, initial access 1 day, no unauthorized auto charges)
UPDATE rova_subscriptions
SET
  payment_type = 'recurring',
  billing_interval = 'daily',
  access_expires_at = COALESCE(payment_date, created_at) + INTERVAL '1 day',
  last_payment_date = COALESCE(payment_date, created_at)
WHERE plan IN ('basic_daily', 'business_daily')
  AND (payment_type IS NULL OR access_expires_at IS NULL);

-- 5. Backfill historical records into rova_payment_history
INSERT INTO rova_payment_history (
  user_id, subscription_id, payment_type, billing_interval, plan,
  amount, status, payment_reference, paystack_transaction_id,
  period_start, period_end, created_at
)
SELECT
  user_id,
  id,
  payment_type,
  billing_interval,
  plan,
  amount,
  'success',
  payment_reference,
  paystack_transaction_id,
  COALESCE(payment_date, created_at),
  access_expires_at,
  COALESCE(payment_date, created_at)
FROM rova_subscriptions
WHERE payment_reference IS NOT NULL
ON CONFLICT (payment_reference) DO NOTHING;

-- 6. Ensure rova_services_catalog table exists and is updated
CREATE TABLE IF NOT EXISTS rova_services_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('recurring','one_time')),
  billing_frequency TEXT CHECK (billing_frequency IN ('daily','monthly','one_time')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO rova_services_catalog (name, description, price, payment_type, billing_frequency) VALUES
  ('ROVA Basic — Daily',    'Full ROVA platform access billed daily (recurring)',    100,   'recurring', 'daily'),
  ('ROVA Basic — Monthly',  'Full ROVA platform access billed monthly (one-time)',    3000,  'one_time',  'monthly'),
  ('ROVA Business — Daily', 'Full ROVA Business plan billed daily (recurring)',      500,   'recurring', 'daily'),
  ('ROVA Business — Monthly','Full ROVA Business plan billed monthly (one-time)',   15000, 'one_time',  'monthly'),
  ('Tax Filing Service',    'ROVA handles your tax filing with FIRS — one-time',     5000,  'one_time',  'one_time')
ON CONFLICT DO NOTHING;

UPDATE rova_services_catalog
SET payment_type = 'one_time', billing_frequency = 'monthly'
WHERE name IN ('ROVA Basic — Monthly', 'ROVA Business — Monthly');

UPDATE rova_services_catalog
SET payment_type = 'recurring', billing_frequency = 'daily'
WHERE name IN ('ROVA Basic — Daily', 'ROVA Business — Daily');
