-- ============================================================================
-- RovaFlow SME Budgeting Feature — Extend existing public.budgets table
-- Strictly planning/tracking only: never creates journal entries or alters GL.
-- ============================================================================

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS budget_type text NOT NULL DEFAULT 'expense',
  ADD COLUMN IF NOT EXISTS category_name text,
  ADD COLUMN IF NOT EXISTS coa_account_code text,
  ADD COLUMN IF NOT EXISTS accounting_basis text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS alerts_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_75_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS alert_90_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS alert_100_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS alert_over_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

-- Backfill end_date for any existing rows
UPDATE public.budgets
SET end_date = CASE
  WHEN lower(coalesce(period, 'monthly')) = 'annual'
    THEN (start_date + interval '1 year' - interval '1 day')::date
  ELSE (date_trunc('month', start_date) + interval '1 month' - interval '1 day')::date
END
WHERE end_date IS NULL;

-- Ensure index for fast period/user queries
CREATE INDEX IF NOT EXISTS idx_budgets_user_period
  ON public.budgets (user_id, start_date, end_date)
  WHERE is_active = true;

-- Ensure RLS is enabled and user owns their budget rows
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'budgets' AND policyname = 'Users can manage own budgets'
  ) THEN
    CREATE POLICY "Users can manage own budgets"
      ON public.budgets
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
