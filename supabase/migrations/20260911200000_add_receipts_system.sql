/*
  # Add Receipts System

  ## Overview
  Creates the database schema for ROVA's Receipt Creation & Generation System.

  ## New Tables
  1. `receipts`
     - Header and summary information for payment receipts
     - Linked to business (`user_id`), transaction (`transaction_id`), and customer
     - Sequential business-specific receipt numbering (e.g. RCPT-000001)

  2. `receipt_items`
     - Line items for receipts with product link, quantity, price, discount, and line total

  ## Functions
  - `generate_next_receipt_number(target_user_id uuid)`: Safe server-side sequential receipt number generator

  ## Security
  - RLS enabled on both tables using `is_owner_or_collaborator(user_id)`
*/

-- 1. Create Receipts Table
CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  customer_id uuid,
  customer_name text NOT NULL,
  customer_phone text DEFAULT '',
  customer_email text DEFAULT '',
  receipt_number text NOT NULL,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'NGN',
  payment_method text DEFAULT 'Bank Transfer',
  payment_reference text DEFAULT '',
  description text DEFAULT '',
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric(15,2) DEFAULT 0,
  discount numeric(15,2) DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  status text DEFAULT 'generated' CHECK (status IN ('draft', 'generated', 'sent', 'viewed', 'cancelled')),
  pdf_url text DEFAULT '',
  image_url text DEFAULT '',
  verification_code text DEFAULT '',
  created_by text DEFAULT 'Admin',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT receipts_user_number_unique UNIQUE (user_id, receipt_number)
);

-- 2. Create Receipt Items Table
CREATE TABLE IF NOT EXISTS public.receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(15,3) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  discount numeric(15,2) DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. Create Sequential Receipt Number Generator Function
CREATE OR REPLACE FUNCTION public.generate_next_receipt_number(target_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_num integer;
  next_num integer;
  formatted_num text;
BEGIN
  SELECT COALESCE(
    MAX(
      NULLIF(regexp_replace(receipt_number, '^RCPT-0*', ''), '')::integer
    ), 0
  ) INTO max_num
  FROM public.receipts
  WHERE user_id = target_user_id
    AND receipt_number ~ '^RCPT-[0-9]+$';

  next_num := max_num + 1;
  formatted_num := 'RCPT-' || lpad(next_num::text, 6, '0');
  RETURN formatted_num;
END;
$$;

-- 4. Enable Row Level Security
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Users can manage own/collaborator receipts" ON public.receipts;
CREATE POLICY "Users can manage own/collaborator receipts"
  ON public.receipts FOR ALL TO authenticated
  USING (public.is_owner_or_collaborator(user_id))
  WITH CHECK (public.is_owner_or_collaborator(user_id));

DROP POLICY IF EXISTS "Users can manage own/collaborator receipt items" ON public.receipt_items;
CREATE POLICY "Users can manage own/collaborator receipt items"
  ON public.receipt_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_items.receipt_id
        AND public.is_owner_or_collaborator(receipts.user_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.receipts
      WHERE receipts.id = receipt_items.receipt_id
        AND public.is_owner_or_collaborator(receipts.user_id)
    )
  );

-- 6. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON public.receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_transaction_id ON public.receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON public.receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON public.receipts(receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON public.receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON public.receipt_items(receipt_id);
