-- ============================================================================
-- ROVA SME Accounting Suite Migration
-- Features:
--   1. Customer Directory & Statements of Account
--   2. Sales Credit Notes & Refunds
--   3. Accounting Period Locking (Lock Dates + DB Triggers)
--   4. Recurring Invoices & Recurring Bills
--   5. Automated Overdue Invoice Reminders & Reminder Logs
--   6. Operational Fixed Asset Register & Monthly Auto-Depreciation
-- ============================================================================

-- ── 1. CUSTOMER DIRECTORY ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  company_name text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  tax_id text DEFAULT '',
  payment_terms_days integer DEFAULT 14,
  notes text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own/collaborator customers" ON public.customers;
CREATE POLICY "Users can manage own/collaborator customers"
  ON public.customers FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id));

CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(user_id, name);

-- Link invoices optionally to customers & track credited amount
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credited_amount numeric(15,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);

-- ── 2. SALES CREDIT NOTES & REFUNDS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_note_number text NOT NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL DEFAULT '',
  customer_email text DEFAULT '',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text DEFAULT 'Goods returned / Price adjustment',
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  vat_rate numeric(6,2) DEFAULT 0,
  vat_amount numeric(15,2) DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'applied', 'refunded', 'void')),
  refund_recorded boolean DEFAULT false,
  refund_date date,
  refund_method text DEFAULT 'Bank Transfer',
  refund_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  refund_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own/collaborator credit notes" ON public.credit_notes;
CREATE POLICY "Users can manage own/collaborator credit notes"
  ON public.credit_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id));

CREATE INDEX IF NOT EXISTS idx_credit_notes_user_id ON public.credit_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id ON public.credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_customer_id ON public.credit_notes(customer_id);

CREATE TABLE IF NOT EXISTS public.credit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own/collaborator credit note items" ON public.credit_note_items;
CREATE POLICY "Users can manage own/collaborator credit note items"
  ON public.credit_note_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.credit_notes cn
      WHERE cn.id = credit_note_items.credit_note_id
      AND (auth.uid() = cn.user_id OR public.is_owner_or_collaborator(cn.user_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.credit_notes cn
      WHERE cn.id = credit_note_items.credit_note_id
      AND (auth.uid() = cn.user_id OR public.is_owner_or_collaborator(cn.user_id))
    )
  );

CREATE INDEX IF NOT EXISTS idx_credit_note_items_cn_id ON public.credit_note_items(credit_note_id);

-- ── 3. PERIOD LOCKING (LOCK DATES & DB ENFORCEMENT TRIGGERS) ─────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS accounting_lock_date date,
  ADD COLUMN IF NOT EXISTS accounting_lock_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accounting_lock_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_accounting_lock_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_lock_date date;
  v_new_date date;
  v_old_date date;
  v_col text := TG_ARGV[0];
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  SELECT accounting_lock_date INTO v_lock_date
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_lock_date IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    EXECUTE format('SELECT ($1).%I::date', v_col) INTO v_new_date USING NEW;
    IF v_new_date IS NOT NULL AND v_new_date <= v_lock_date THEN
      RAISE EXCEPTION 'ACCOUNTING_PERIOD_LOCKED: Period is locked through %. Cannot save record dated %.', v_lock_date, v_new_date;
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    EXECUTE format('SELECT ($1).%I::date', v_col) INTO v_old_date USING OLD;
    IF v_old_date IS NOT NULL AND v_old_date <= v_lock_date THEN
      RAISE EXCEPTION 'ACCOUNTING_PERIOD_LOCKED: Period is locked through %. Cannot modify or delete record dated %.', v_lock_date, v_old_date;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_transactions ON public.transactions;
CREATE TRIGGER trg_lock_transactions
  BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_accounting_lock_date('date');

DROP TRIGGER IF EXISTS trg_lock_invoices ON public.invoices;
CREATE TRIGGER trg_lock_invoices
  BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_accounting_lock_date('issue_date');

DROP TRIGGER IF EXISTS trg_lock_bills ON public.bills;
CREATE TRIGGER trg_lock_bills
  BEFORE INSERT OR UPDATE OR DELETE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.enforce_accounting_lock_date('bill_date');

DROP TRIGGER IF EXISTS trg_lock_journal_entries ON public.journal_entries;
CREATE TRIGGER trg_lock_journal_entries
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_accounting_lock_date('date');

DROP TRIGGER IF EXISTS trg_lock_credit_notes ON public.credit_notes;
CREATE TRIGGER trg_lock_credit_notes
  BEFORE INSERT OR UPDATE OR DELETE ON public.credit_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_accounting_lock_date('issue_date');

-- ── 4. RECURRING INVOICES & RECURRING BILLS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recurring_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('invoice', 'bill')),
  title text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text DEFAULT '',
  customer_email text DEFAULT '',
  vendor_name text DEFAULT '',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_run_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  auto_send boolean DEFAULT false,
  default_status text NOT NULL DEFAULT 'draft' CHECK (default_status IN ('draft', 'sent', 'unpaid')),
  currency text DEFAULT 'NGN',
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  vat_rate numeric(6,2) DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  items_json jsonb DEFAULT '[]'::jsonb,
  notes text DEFAULT '',
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  runs_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.recurring_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own/collaborator recurring schedules" ON public.recurring_schedules;
CREATE POLICY "Users can manage own/collaborator recurring schedules"
  ON public.recurring_schedules FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id));

CREATE INDEX IF NOT EXISTS idx_recurring_schedules_user ON public.recurring_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_due ON public.recurring_schedules(is_active, next_run_date);

-- ── 5. AUTOMATED OVERDUE INVOICE REMINDERS & LOGS ────────────────────────────
CREATE TABLE IF NOT EXISTS public.invoice_reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  days_before_due integer[] DEFAULT ARRAY[3],
  remind_on_due_date boolean DEFAULT true,
  days_after_due integer[] DEFAULT ARRAY[3, 7, 14],
  channel_email boolean DEFAULT true,
  channel_whatsapp boolean DEFAULT false,
  channel_in_app boolean DEFAULT true,
  custom_message text DEFAULT 'Friendly reminder regarding your invoice. Please use the payment link below to settle at your convenience.',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.invoice_reminder_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own/collaborator reminder rules" ON public.invoice_reminder_rules;
CREATE POLICY "Users can manage own/collaborator reminder rules"
  ON public.invoice_reminder_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id));

CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app',
  recipient text DEFAULT '',
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message text DEFAULT '',
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own/collaborator reminder logs" ON public.reminder_logs;
CREATE POLICY "Users can view own/collaborator reminder logs"
  ON public.reminder_logs FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id));

CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_logs_unique_rule ON public.reminder_logs(invoice_id, rule_key);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_user ON public.reminder_logs(user_id, sent_at DESC);

-- ── 6. OPERATIONAL FIXED ASSET REGISTER & AUTO-DEPRECIATION ──────────────────
ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS asset_name text DEFAULT '',
  ADD COLUMN IF NOT EXISTS salvage_value numeric(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS useful_life_months integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS depreciation_method text DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line', 'reducing_balance')),
  ADD COLUMN IF NOT EXISTS annual_rate_pct numeric(6,2) DEFAULT 20,
  ADD COLUMN IF NOT EXISTS accumulated_depreciation numeric(18,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_depreciation_date date,
  ADD COLUMN IF NOT EXISTS disposal_date date,
  ADD COLUMN IF NOT EXISTS disposal_proceeds numeric(18,2),
  ADD COLUMN IF NOT EXISTS disposal_gain_loss numeric(18,2);

-- Backfill asset_name from description where empty
UPDATE public.fixed_assets SET asset_name = description WHERE (asset_name IS NULL OR asset_name = '') AND description IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.fixed_asset_depreciation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fixed_asset_id uuid NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  period_month text NOT NULL, -- YYYY-MM
  depreciation_date date NOT NULL,
  depreciation_amount numeric(18,2) NOT NULL DEFAULT 0,
  accumulated_after numeric(18,2) NOT NULL DEFAULT 0,
  net_book_value_after numeric(18,2) NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.fixed_asset_depreciation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own/collaborator depreciation runs" ON public.fixed_asset_depreciation_runs;
CREATE POLICY "Users can manage own/collaborator depreciation runs"
  ON public.fixed_asset_depreciation_runs FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id))
  WITH CHECK (auth.uid() = user_id OR public.is_owner_or_collaborator(user_id));

CREATE UNIQUE INDEX IF NOT EXISTS idx_fa_depr_unique_asset_month
  ON public.fixed_asset_depreciation_runs(fixed_asset_id, period_month);
CREATE INDEX IF NOT EXISTS idx_fa_depr_user_month
  ON public.fixed_asset_depreciation_runs(user_id, period_month DESC);
