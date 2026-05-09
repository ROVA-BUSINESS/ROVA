/*
  # Add mono_account_id to accounts table

  Allows upserting on mono_account_id so reconnecting the same bank
  updates the existing account instead of creating a duplicate.
*/

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS mono_account_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_accounts_mono_account_id ON accounts(mono_account_id)
  WHERE mono_account_id IS NOT NULL;
