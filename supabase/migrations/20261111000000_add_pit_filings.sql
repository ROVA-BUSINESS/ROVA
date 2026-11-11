-- Four-State Personal Income Tax (PIT) Self-Filing Workflow (LIRS, KIRS, FCT-IRS, RIRS)

CREATE TABLE IF NOT EXISTS public.pit_filings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tax_year integer NOT NULL DEFAULT 2025,
  taxpayer_classification text NOT NULL CHECK (taxpayer_classification IN ('individual', 'business_name')),
  state_code text NOT NULL CHECK (state_code IN ('LAGOS', 'KANO', 'FCT', 'RIVERS')),
  authority_code text NOT NULL CHECK (authority_code IN ('LIRS', 'KIRS', 'FCT-IRS', 'RIRS')),
  tax_id_value text DEFAULT '',
  taxpayer_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  income_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  deductions_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  supporting_docs jsonb NOT NULL DEFAULT '[]'::jsonb,
  computation_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready_for_submission', 'submitted', 'acknowledged')),
  verified_by_taxpayer boolean NOT NULL DEFAULT false,
  acknowledgement_ref text DEFAULT '',
  acknowledgement_url text DEFAULT '',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tax_year, state_code)
);

ALTER TABLE public.pit_filings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pit filings" ON public.pit_filings;
CREATE POLICY "Users can manage own pit filings"
  ON public.pit_filings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pit_filings_user_year
  ON public.pit_filings (user_id, tax_year, state_code);
