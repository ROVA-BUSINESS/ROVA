-- Migration: Add settlement_accounts table for banking & payouts
-- Created: 2026-11-18

CREATE TABLE IF NOT EXISTS settlement_accounts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name               TEXT,
  bank_code               TEXT,
  account_number          TEXT NOT NULL,
  account_name            TEXT NOT NULL,
  is_verified             BOOLEAN NOT NULL DEFAULT false,
  is_primary              BOOLEAN NOT NULL DEFAULT false,
  paystack_subaccount_code TEXT,
  paystack_recipient_code  TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_settlement_accounts_user_id ON settlement_accounts(user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_settlement_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER settlement_accounts_updated_at
  BEFORE UPDATE ON settlement_accounts
  FOR EACH ROW EXECUTE FUNCTION update_settlement_accounts_updated_at();

-- Enable Row Level Security
ALTER TABLE settlement_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can only manage their own records
CREATE POLICY "Users manage own settlement accounts"
  ON settlement_accounts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
