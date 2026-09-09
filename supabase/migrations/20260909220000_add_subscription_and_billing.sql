-- ============================================================
-- ROVA Subscription & Billing Tables
-- ============================================================

-- 1. ROVA Subscriptions
--    Tracks which plan a user is on (basic_daily, basic_monthly,
--    business_daily, business_monthly) and its lifecycle.
-- ============================================================
CREATE TABLE IF NOT EXISTS rova_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name          TEXT,
  plan                   TEXT NOT NULL CHECK (plan IN ('basic_daily','basic_monthly','business_daily','business_monthly')),
  amount                 NUMERIC(12,2) NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','expired')),
  payment_reference      TEXT,
  paystack_transaction_id TEXT,
  payment_date           TIMESTAMPTZ,
  start_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  next_payment_date      DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rova_subscriptions_user_id ON rova_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_rova_subscriptions_status  ON rova_subscriptions(status);

ALTER TABLE rova_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscriptions"
  ON rova_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own subscriptions"
  ON rova_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own subscriptions"
  ON rova_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. ROVA Service Payments
--    Tracks one-time professional service purchases such as
--    Tax Filing (₦5,000). Extensible for future services.
-- ============================================================
CREATE TABLE IF NOT EXISTS rova_service_payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name          TEXT,
  service_type           TEXT NOT NULL DEFAULT 'tax_filing',
  service_name           TEXT NOT NULL,
  tax_year               INTEGER,
  filing_type            TEXT,
  amount                 NUMERIC(12,2) NOT NULL DEFAULT 5000,
  payment_reference      TEXT,
  paystack_transaction_id TEXT,
  payment_date           TIMESTAMPTZ,
  payment_status         TEXT NOT NULL DEFAULT 'unpaid'
                         CHECK (payment_status IN ('unpaid','paid','processing','filed')),
  filing_status          TEXT NOT NULL DEFAULT 'pending'
                         CHECK (filing_status IN ('pending','processing','filed','rejected')),
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rova_service_payments_user_id ON rova_service_payments(user_id);

ALTER TABLE rova_service_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own service payments"
  ON rova_service_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own service payments"
  ON rova_service_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own service payments"
  ON rova_service_payments FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. ROVA Services Catalog
--    Future-proof service registry. Seed with initial services.
-- ============================================================
CREATE TABLE IF NOT EXISTS rova_services_catalog (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  price            NUMERIC(12,2) NOT NULL,
  payment_type     TEXT NOT NULL CHECK (payment_type IN ('recurring','one_time')),
  billing_frequency TEXT CHECK (billing_frequency IN ('daily','monthly','one_time')),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial services
INSERT INTO rova_services_catalog (name, description, price, payment_type, billing_frequency) VALUES
  ('ROVA Basic — Daily',    'Full ROVA platform access billed daily',            100,  'recurring', 'daily'),
  ('ROVA Basic — Monthly',  'Full ROVA platform access billed monthly',          3000, 'recurring', 'monthly'),
  ('ROVA Business — Daily', 'Full ROVA Business plan billed daily',              500,  'recurring', 'daily'),
  ('ROVA Business — Monthly','Full ROVA Business plan billed monthly',           15000,'recurring', 'monthly'),
  ('Tax Filing Service',    'ROVA handles your tax filing with FIRS — one-time', 5000, 'one_time',  'one_time')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Helper trigger: auto-update updated_at on subscriptions
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rova_subscriptions_updated_at ON rova_subscriptions;
CREATE TRIGGER trg_rova_subscriptions_updated_at
  BEFORE UPDATE ON rova_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rova_service_payments_updated_at ON rova_service_payments;
CREATE TRIGGER trg_rova_service_payments_updated_at
  BEFORE UPDATE ON rova_service_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
