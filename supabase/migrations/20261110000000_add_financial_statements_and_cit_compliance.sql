-- Step 1: Financial Statements, NTA 2025 CIT Compliance, Fixed Assets, WHT Credits & Tax Intake Sessions

-- 1. Extend chart_of_accounts with statement mapping metadata
ALTER TABLE public.chart_of_accounts
  ADD COLUMN IF NOT EXISTS statement_line_mapping text DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_classification text DEFAULT 'Current',
  ADD COLUMN IF NOT EXISTS cash_flow_category text DEFAULT 'Operating';

-- 2. Financial Statement & Tax Regime Profiles (Sections 1, 2 & 3 of ROVA FS Template)
CREATE TABLE IF NOT EXISTS public.financial_statement_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL DEFAULT 2026,
  company_legal_name text DEFAULT '',
  rc_number text DEFAULT '',
  tin text DEFAULT '',
  fy_start_date date NOT NULL DEFAULT '2026-01-01',
  fy_end_date date NOT NULL DEFAULT '2026-12-31',
  prior_year_end_date date,
  reporting_currency text DEFAULT 'Nigerian Naira (₦)',
  currency_symbol text DEFAULT '₦',
  nature_of_business text DEFAULT '',
  sector text DEFAULT '',
  accounting_framework text DEFAULT 'IFRS' CHECK (accounting_framework IN ('IFRS', 'IFRS for SMEs')),
  tax_regime text DEFAULT 'Nigeria Tax Act 2025 & NTAA 2025',
  tax_authority text DEFAULT 'Nigeria Revenue Service (NRS)',
  -- Statutory Audit & Governance (Section 2 & 5.5)
  audit_status text DEFAULT 'Exempt under CAMA 2020' CHECK (audit_status IN ('Audited', 'Exempt under CAMA 2020', 'Unaudited')),
  auditor_firm text DEFAULT 'N/A',
  auditor_partner text DEFAULT 'N/A',
  auditor_frc text DEFAULT 'N/A',
  audit_opinion text DEFAULT 'N/A',
  director_1 text DEFAULT '',
  director_2 text DEFAULT '',
  cfo_name text DEFAULT '',
  cfo_frc text DEFAULT '',
  approval_date date,
  -- NTA 2025 Tax Regime Parameters (Section 3)
  small_turnover_threshold numeric(18,2) DEFAULT 100000000,
  small_asset_threshold numeric(18,2) DEFAULT 250000000,
  professional_services_flag boolean DEFAULT false,
  cit_rate_small numeric(6,4) DEFAULT 0,
  cit_rate_standard numeric(6,4) DEFAULT 0.275,
  dev_levy_rate numeric(6,4) DEFAULT 0.04,
  vat_rate numeric(6,4) DEFAULT 0.075,
  wht_rate_supplies numeric(6,4) DEFAULT 0.05,
  wht_rate_services numeric(6,4) DEFAULT 0.10,
  ca_restriction_cap numeric(6,4) DEFAULT 0.6667,
  notes_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, fiscal_year)
);

ALTER TABLE public.financial_statement_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own fs profiles" ON public.financial_statement_profiles;
CREATE POLICY "Users can manage own fs profiles"
  ON public.financial_statement_profiles FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. COA Opening Balances per fiscal year (Section 2.1)
CREATE TABLE IF NOT EXISTS public.coa_opening_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL DEFAULT 2026,
  account_code text NOT NULL,
  opening_debit numeric(18,2) DEFAULT 0,
  opening_credit numeric(18,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, fiscal_year, account_code)
);

ALTER TABLE public.coa_opening_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own opening balances" ON public.coa_opening_balances;
CREATE POLICY "Users can manage own opening balances"
  ON public.coa_opening_balances FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Fixed Assets Register (Section 4.1)
CREATE TABLE IF NOT EXISTS public.fixed_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_code text NOT NULL DEFAULT '',
  description text NOT NULL,
  asset_class text NOT NULL CHECK (asset_class IN (
    'Leasehold Land & Buildings',
    'Plant & Heavy Machinery',
    'Commercial Motor Vehicles',
    'Office Furniture & Equipment',
    'Computer & IT Infrastructure'
  )),
  date_acquired date NOT NULL DEFAULT CURRENT_DATE,
  historical_cost numeric(18,2) NOT NULL DEFAULT 0,
  prior_accum_depr numeric(18,2) DEFAULT 0,
  opening_twdv numeric(18,2) DEFAULT 0,
  status text DEFAULT 'Active' CHECK (status IN ('Active', 'Disposed')),
  source_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own fixed assets" ON public.fixed_assets;
CREATE POLICY "Users can manage own fixed assets"
  ON public.fixed_assets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Fixed Asset Disposals Schedule (Section 4.2)
CREATE TABLE IF NOT EXISTS public.fixed_asset_disposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fixed_asset_id uuid REFERENCES public.fixed_assets(id) ON DELETE SET NULL,
  asset_code text DEFAULT '',
  disposal_date date NOT NULL DEFAULT CURRENT_DATE,
  original_cost numeric(18,2) NOT NULL DEFAULT 0,
  accum_depr_at_disposal numeric(18,2) NOT NULL DEFAULT 0,
  disposal_proceeds numeric(18,2) NOT NULL DEFAULT 0,
  remarks text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fixed_asset_disposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own asset disposals" ON public.fixed_asset_disposals;
CREATE POLICY "Users can manage own asset disposals"
  ON public.fixed_asset_disposals FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. WHT Credit Notes Tracker (Section 8.2)
CREATE TABLE IF NOT EXISTS public.wht_credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL DEFAULT 2026,
  client_name text NOT NULL DEFAULT '',
  credit_note_no text DEFAULT '',
  deduction_date date NOT NULL DEFAULT CURRENT_DATE,
  nature_of_supply text DEFAULT 'Supplies / Contracts',
  gross_amount numeric(18,2) NOT NULL DEFAULT 0,
  wht_rate numeric(6,4) NOT NULL DEFAULT 0.05,
  wht_deducted numeric(18,2) NOT NULL DEFAULT 0,
  verification_status text DEFAULT 'Pending Verification' CHECK (verification_status IN ('Pending Verification', 'Verified', 'Rejected')),
  amount_utilized numeric(18,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.wht_credit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own wht credit notes" ON public.wht_credit_notes;
CREATE POLICY "Users can manage own wht credit notes"
  ON public.wht_credit_notes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Tax Carry-Forwards & Manual Statutory Adjustments (Section 7.2 & 7.4)
CREATE TABLE IF NOT EXISTS public.tax_carryforwards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL DEFAULT 2026,
  opening_unrelieved_losses numeric(18,2) DEFAULT 0,
  opening_unutilized_ca numeric(18,2) DEFAULT 0,
  advance_cit_paid numeric(18,2) DEFAULT 0,
  non_allowable_fines numeric(18,2) DEFAULT 0,
  franked_investment_income numeric(18,2) DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, fiscal_year)
);

ALTER TABLE public.tax_carryforwards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own tax carryforwards" ON public.tax_carryforwards;
CREATE POLICY "Users can manage own tax carryforwards"
  ON public.tax_carryforwards FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. Tax Intake Sessions & CIT Filing Drafts (Branch A/B Workflow + Section 8.1)
CREATE TABLE IF NOT EXISTS public.tax_intake_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fiscal_year integer NOT NULL DEFAULT 2026,
  has_prepared_fs boolean,
  intake_status text DEFAULT 'questionnaire' CHECK (intake_status IN (
    'questionnaire',
    'collecting_evidence',
    'reviewing_entries',
    'ready_for_wizard',
    'completed'
  )),
  uploaded_files jsonb DEFAULT '[]'::jsonb,
  extracted_entries jsonb DEFAULT '[]'::jsonb,
  suspense_resolutions jsonb DEFAULT '{}'::jsonb,
  checklist_status jsonb DEFAULT '{}'::jsonb,
  wizard_state jsonb DEFAULT '{}'::jsonb,
  fs_snapshot jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, fiscal_year)
);

ALTER TABLE public.tax_intake_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own tax intake sessions" ON public.tax_intake_sessions;
CREATE POLICY "Users can manage own tax intake sessions"
  ON public.tax_intake_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fs_profiles_user_year ON public.financial_statement_profiles(user_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_coa_opening_user_year ON public.coa_opening_balances(user_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_fixed_assets_user ON public.fixed_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_wht_credits_user_year ON public.wht_credit_notes(user_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_tax_intake_user_year ON public.tax_intake_sessions(user_id, fiscal_year);
