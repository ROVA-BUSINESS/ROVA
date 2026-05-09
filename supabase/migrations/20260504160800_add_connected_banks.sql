/*
  # Add connected_banks table for Mono API Integration

  1. New Tables
    - `connected_banks`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `mono_account_id` (text, unique)
      - `bank_name` (text)
      - `account_name` (text)
      - `account_number` (text)
      - `currency` (text)
      - `balance` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `connected_banks` table
    - Add policies for authenticated users to manage their own connected banks
*/

CREATE TABLE IF NOT EXISTS connected_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mono_account_id text NOT NULL UNIQUE,
  bank_name text,
  account_name text,
  account_number text,
  currency text DEFAULT 'NGN',
  balance numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE connected_banks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connected banks"
  ON connected_banks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connected banks"
  ON connected_banks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connected banks"
  ON connected_banks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own connected banks"
  ON connected_banks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_connected_banks_user_id ON connected_banks(user_id);
