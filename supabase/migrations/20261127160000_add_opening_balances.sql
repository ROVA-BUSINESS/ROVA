-- ============================================================================
-- RovaFlow Opening Balances Module
-- Supports draft saving, balanced double-entry posting, AR/AP sub-ledgers,
-- duplicate prevention, and post-posting adjustment audit trail.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opening_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  notes text,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  adjustment_journal_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  customer_balances jsonb NOT NULL DEFAULT '[]'::jsonb,
  supplier_balances jsonb NOT NULL DEFAULT '[]'::jsonb,
  fixed_asset_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  inventory_items_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_debits numeric(14,2) NOT NULL DEFAULT 0,
  total_credits numeric(14,2) NOT NULL DEFAULT 0,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate posted opening balance records per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_opening_balances_one_posted_per_user
  ON public.opening_balances (user_id)
  WHERE status = 'posted';

CREATE INDEX IF NOT EXISTS idx_opening_balances_user_status
  ON public.opening_balances (user_id, status);

ALTER TABLE public.opening_balances ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'opening_balances' AND policyname = 'Users can manage own opening balances'
  ) THEN
    CREATE POLICY "Users can manage own opening balances"
      ON public.opening_balances
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
