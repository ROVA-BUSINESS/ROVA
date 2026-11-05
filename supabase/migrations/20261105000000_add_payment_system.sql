-- ============================================================
-- Migration: Add ROVA Unified Payment System
-- Supports Paystack, Kuda Business, OPay Business, Moniepoint Business,
-- Payment Links, Unified Transactions, and Manual Statement Imports
-- ============================================================

-- 1. Payment Provider Configurations
CREATE TABLE IF NOT EXISTS payment_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('paystack', 'kuda', 'opay', 'moniepoint')),
  status TEXT NOT NULL DEFAULT 'not_connected' CHECK (status IN ('connected', 'not_connected', 'pending_approval', 'error')),
  public_key TEXT,
  secret_key TEXT,
  merchant_id TEXT,
  webhook_secret TEXT,
  account_number TEXT,
  is_live BOOLEAN NOT NULL DEFAULT false,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (last_sync_status IN ('idle', 'success', 'failed', 'running')),
  last_sync_error TEXT,
  synced_records_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_provider_user UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_payment_provider_configs_user_id ON payment_provider_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_provider_configs_provider ON payment_provider_configs(provider);

ALTER TABLE payment_provider_configs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_provider_configs' AND policyname = 'Users manage own provider configs'
  ) THEN
    CREATE POLICY "Users manage own provider configs"
      ON payment_provider_configs FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- 2. Payment Links
CREATE TABLE IF NOT EXISTS payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'paystack' CHECK (provider IN ('paystack', 'kuda', 'opay', 'moniepoint')),
  provider_link_id TEXT,
  provider_slug TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  amount NUMERIC(15,2), -- NULL when customer can enter amount
  currency TEXT NOT NULL DEFAULT 'NGN',
  allow_custom_amount BOOLEAN NOT NULL DEFAULT false,
  payment_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  total_collected NUMERIC(15,2) NOT NULL DEFAULT 0,
  payments_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_user_id ON payment_links(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_provider ON payment_links(provider);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON payment_links(status);

ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_links' AND policyname = 'Users manage own payment links'
  ) THEN
    CREATE POLICY "Users manage own payment links"
      ON payment_links FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;


-- 3. Unified Payment Transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('paystack', 'kuda', 'opay', 'moniepoint', 'manual_import')),
  provider_account_id TEXT,
  provider_reference TEXT NOT NULL,
  provider_event_id TEXT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'refund', 'transfer', 'fee')),
  description TEXT DEFAULT '',
  counterparty_name TEXT,
  counterparty_account TEXT,
  counterparty_bank TEXT,
  counterparty_email TEXT,
  counterparty_phone TEXT,
  provider_status TEXT NOT NULL DEFAULT 'pending' CHECK (provider_status IN ('success', 'pending', 'failed', 'refunded', 'reversed')),
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'unverified', 'manual_review', 'failed')),
  source TEXT NOT NULL CHECK (source IN ('webhook', 'api_sync', 'manual_import', 'payment_link')),
  payment_link_id UUID REFERENCES payment_links(id) ON DELETE SET NULL,
  rova_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  accounting_status TEXT NOT NULL DEFAULT 'unclassified' CHECK (accounting_status IN ('unclassified', 'classified_income', 'classified_expense', 'classified_transfer', 'ignored')),
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  reconciliation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payment_tx_user_provider_ref UNIQUE (user_id, provider, provider_reference)
);

CREATE INDEX IF NOT EXISTS idx_payment_tx_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_provider ON payment_transactions(provider);
CREATE INDEX IF NOT EXISTS idx_payment_tx_ref ON payment_transactions(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payment_tx_date ON payment_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_payment_tx_link_id ON payment_transactions(payment_link_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_rova_id ON payment_transactions(rova_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payment_tx_status ON payment_transactions(provider_status);
CREATE INDEX IF NOT EXISTS idx_payment_tx_verification ON payment_transactions(verification_status);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_transactions' AND policyname = 'Users manage own payment transactions'
  ) THEN
    CREATE POLICY "Users manage own payment transactions"
      ON payment_transactions FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

