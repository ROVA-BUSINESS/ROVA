/*
  # Add Email Bank Sync Support

  1. New Columns in `accounts`:
    - `sync_source` (text): 'manual', 'mono', or 'email'
    - `sync_status` (text): 'active', 'error', 'pending'
    - `last_synced_at` (timestamptz)
    - `sync_account_id` (text): External ID for the sync (account number or similar)

  2. New Tables:
    - `bank_email_sync_settings`
      - Stores OAuth metadata and bank-specific settings for email parsing.
*/

-- Update accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS sync_source text DEFAULT 'manual' CHECK (sync_source IN ('manual', 'mono', 'email')),
ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'active' CHECK (sync_status IN ('active', 'error', 'pending')),
ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
ADD COLUMN IF NOT EXISTS sync_account_id text;

-- Create email sync settings table
CREATE TABLE IF NOT EXISTS bank_email_sync_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  email_address text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('gmail', 'outlook')),
  refresh_token text, -- Encrypted or managed via secret service
  bank_sender_address text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(account_id)
);

ALTER TABLE bank_email_sync_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email sync settings"
  ON bank_email_sync_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update transactions table to include source
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual' CHECK (source IN ('manual', 'mono', 'email'));
