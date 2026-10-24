-- ROVA COMPLETE DATABASE SCHEMA MIGRATION
-- Generated from supabase/migrations



-- ==========================================
-- MIGRATION: 20260415195038_create_kolo_schema.sql
-- ==========================================

/*
  # KOLO Financial OS — Initial Schema

  ## Overview
  Creates the full database schema for KOLO, an AI-driven financial operating system.

  ## New Tables

  ### 1. profiles
  - User profile data extending auth.users
  - Stores display name, business name, mode (personal/business), currency, phone

  ### 2. accounts
  - Financial accounts (bank, wallet, cash, etc.)
  - Tracks balance, account type, institution name

  ### 3. transactions
  - All financial transactions
  - Stores amount, type (income/expense/transfer), category, description, date, account_id
  - AI classification fields: ai_category, ai_confidence, is_verified

  ### 4. categories
  - Transaction categories (both system and user-defined)
  - Supports income and expense types

  ### 5. invoices
  - Invoice management for businesses
  - Tracks client, items, amounts, status, due dates

  ### 6. invoice_items
  - Line items for invoices

  ### 7. tax_records
  - Tax filing records and calculations
  - Tracks period, tax type, calculated amount, status

  ### 8. budgets
  - Budget tracking per category
  - Monthly budget limits vs actual spend

  ## Security
  - RLS enabled on all tables
  - All policies restrict access to authenticated users' own data
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  business_name text DEFAULT '',
  mode text DEFAULT 'personal' CHECK (mode IN ('personal', 'business')),
  currency text DEFAULT 'NGN',
  phone text DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'bank' CHECK (type IN ('bank', 'wallet', 'cash', 'investment', 'credit')),
  institution text DEFAULT '',
  balance numeric(15,2) DEFAULT 0,
  currency text DEFAULT 'NGN',
  color text DEFAULT '#9333ea',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  icon text DEFAULT 'circle',
  color text DEFAULT '#9333ea',
  is_system boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and system categories"
  ON categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_system = true);

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_system = false);

-- Seed system categories
INSERT INTO categories (name, type, icon, color, is_system) VALUES
  ('Salary', 'income', 'briefcase', '#22c55e', true),
  ('Business Revenue', 'income', 'trending-up', '#16a34a', true),
  ('Investment Returns', 'income', 'bar-chart', '#15803d', true),
  ('Freelance', 'income', 'laptop', '#4ade80', true),
  ('Rent Received', 'income', 'home', '#86efac', true),
  ('Other Income', 'income', 'plus-circle', '#bbf7d0', true),
  ('Rent & Housing', 'expense', 'home', '#ef4444', true),
  ('Food & Dining', 'expense', 'utensils', '#dc2626', true),
  ('Transportation', 'expense', 'car', '#b91c1c', true),
  ('Utilities', 'expense', 'zap', '#f97316', true),
  ('Healthcare', 'expense', 'heart', '#ec4899', true),
  ('Entertainment', 'expense', 'tv', '#a855f7', true),
  ('Education', 'expense', 'book', '#3b82f6', true),
  ('Shopping', 'expense', 'shopping-bag', '#f59e0b', true),
  ('Inventory', 'expense', 'package', '#8b5cf6', true),
  ('Payroll', 'expense', 'users', '#06b6d4', true),
  ('Marketing', 'expense', 'megaphone', '#14b8a6', true),
  ('Tax Payment', 'expense', 'file-text', '#64748b', true),
  ('Loan Repayment', 'expense', 'credit-card', '#475569', true),
  ('Other Expenses', 'expense', 'minus-circle', '#94a3b8', true)
ON CONFLICT DO NOTHING;

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  amount numeric(15,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  description text DEFAULT '',
  notes text DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  reference text DEFAULT '',
  ai_category text DEFAULT '',
  ai_confidence numeric(5,2) DEFAULT 0,
  is_verified boolean DEFAULT false,
  is_recurring boolean DEFAULT false,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  client_name text NOT NULL,
  client_email text DEFAULT '',
  client_address text DEFAULT '',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  subtotal numeric(15,2) DEFAULT 0,
  tax_rate numeric(5,2) DEFAULT 0,
  tax_amount numeric(15,2) DEFAULT 0,
  total numeric(15,2) DEFAULT 0,
  notes text DEFAULT '',
  currency text DEFAULT 'NGN',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
  ON invoices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices"
  ON invoices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity numeric(10,2) DEFAULT 1,
  unit_price numeric(15,2) NOT NULL,
  amount numeric(15,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own invoice items"
  ON invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own invoice items"
  ON invoice_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own invoice items"
  ON invoice_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND invoices.user_id = auth.uid()
    )
  );

-- Tax records table
CREATE TABLE IF NOT EXISTS tax_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  tax_type text NOT NULL DEFAULT 'VAT' CHECK (tax_type IN ('VAT', 'PIT', 'CIT', 'WHT', 'CGT', 'other')),
  gross_income numeric(15,2) DEFAULT 0,
  deductions numeric(15,2) DEFAULT 0,
  taxable_income numeric(15,2) DEFAULT 0,
  calculated_tax numeric(15,2) DEFAULT 0,
  paid_tax numeric(15,2) DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'filed', 'paid', 'overdue')),
  due_date date,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tax_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tax records"
  ON tax_records FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tax records"
  ON tax_records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tax records"
  ON tax_records FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tax records"
  ON tax_records FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(15,2) NOT NULL,
  period text DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budgets"
  ON budgets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_tax_records_user_id ON tax_records(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);



-- ==========================================
-- MIGRATION: 20260417143546_add_accounting_tables.sql
-- ==========================================

/*
  # Add Accounting Tables

  ## Overview
  Adds double-entry bookkeeping and chart of accounts support to KOLO.

  ## New Tables

  ### 1. chart_of_accounts
  - Stores all account codes (assets, liabilities, equity, income, expenses)
  - Customizable by user, with system defaults seeded
  - account_type: asset | liability | equity | income | expense
  - normal_balance: debit | credit

  ### 2. journal_entries
  - Manual and automated journal entry headers
  - Each entry has a reference, date, description, and source (manual/auto)

  ### 3. journal_entry_lines
  - Individual debit/credit lines for each journal entry
  - Must balance (total debits = total credits per entry)

  ## Security
  - RLS enabled on all three tables
  - All policies restrict to authenticated users' own data
*/

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  normal_balance text NOT NULL DEFAULT 'debit' CHECK (normal_balance IN ('debit', 'credit')),
  description text DEFAULT '',
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  parent_id uuid REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts"
  ON chart_of_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
  ON chart_of_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON chart_of_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON chart_of_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_system = false);

-- Journal Entries (header)
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL DEFAULT '',
  reference text DEFAULT '',
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'transaction', 'invoice', 'auto')),
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  is_posted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entries"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own journal entries"
  ON journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal entries"
  ON journal_entries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal entries"
  ON journal_entries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Journal Entry Lines (debit/credit lines)
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  account_name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  debit numeric(15,2) DEFAULT 0,
  credit numeric(15,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal entry lines"
  ON journal_entry_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_lines.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own journal entry lines"
  ON journal_entry_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_lines.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own journal entry lines"
  ON journal_entry_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_lines.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_lines.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own journal entry lines"
  ON journal_entry_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries
      WHERE journal_entries.id = journal_entry_lines.journal_entry_id
      AND journal_entries.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coa_user_id ON chart_of_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry_id ON journal_entry_lines(journal_entry_id);



-- ==========================================
-- MIGRATION: 20260418074846_add_payroll_and_ai_tables.sql
-- ==========================================

/*
  # Add Payroll & AI Insights Tables

  ## Overview
  Adds payroll management and AI insights infrastructure to KOLO.

  ## New Tables

  ### 1. employees
  - Employee records: name, role, department, start date, status
  - Stores salary, PAYE rate, pension rate
  - Linked to user account

  ### 2. payroll_runs
  - A payroll run represents one month/period of salary processing
  - Tracks period, status (draft/processed), total gross, total net, total deductions
  - Links to a transaction when salary is paid out

  ### 3. payslips
  - Individual payslip per employee per payroll run
  - Gross salary, PAYE deduction, pension deduction, net pay
  - Links to transaction for the salary expense

  ### 4. ai_insights
  - Stores auto-generated financial insights for the user
  - Type: overspend | drop | opportunity | summary
  - Severity: info | warning | critical

  ## Security
  - RLS enabled on all tables
  - All policies restrict to authenticated users' own data
*/

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  role text DEFAULT '',
  department text DEFAULT '',
  employment_type text DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'part_time', 'contract')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  gross_salary numeric(15,2) NOT NULL DEFAULT 0,
  paye_rate numeric(5,2) DEFAULT 7.5,
  pension_rate numeric(5,2) DEFAULT 8.0,
  bank_name text DEFAULT '',
  bank_account text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own employees"
  ON employees FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own employees"
  ON employees FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own employees"
  ON employees FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Payroll runs table
CREATE TABLE IF NOT EXISTS payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_label text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'processed', 'cancelled')),
  total_gross numeric(15,2) DEFAULT 0,
  total_paye numeric(15,2) DEFAULT 0,
  total_pension numeric(15,2) DEFAULT 0,
  total_net numeric(15,2) DEFAULT 0,
  employee_count integer DEFAULT 0,
  notes text DEFAULT '',
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payroll runs"
  ON payroll_runs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payroll runs"
  ON payroll_runs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payroll runs"
  ON payroll_runs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payroll runs"
  ON payroll_runs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Payslips table
CREATE TABLE IF NOT EXISTS payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gross_salary numeric(15,2) NOT NULL DEFAULT 0,
  paye_deduction numeric(15,2) DEFAULT 0,
  pension_deduction numeric(15,2) DEFAULT 0,
  other_deductions numeric(15,2) DEFAULT 0,
  net_pay numeric(15,2) NOT NULL DEFAULT 0,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payslips"
  ON payslips FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payslips"
  ON payslips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payslips"
  ON payslips FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own payslips"
  ON payslips FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- AI Insights table
CREATE TABLE IF NOT EXISTS ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('overspend', 'drop', 'opportunity', 'summary', 'warning', 'positive')),
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'positive')),
  title text NOT NULL,
  body text NOT NULL,
  metric_key text DEFAULT '',
  metric_value numeric(15,2) DEFAULT 0,
  is_read boolean DEFAULT false,
  generated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights"
  ON ai_insights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights"
  ON ai_insights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights"
  ON ai_insights FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights"
  ON ai_insights FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_runs_user_id ON payroll_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_payslips_user_id ON payslips(user_id);
CREATE INDEX IF NOT EXISTS idx_payslips_run_id ON payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_generated ON ai_insights(generated_at DESC);



-- ==========================================
-- MIGRATION: 20260418094312_add_inventory_tables.sql
-- ==========================================

/*
  # Add Inventory Management Tables

  ## Overview
  Adds full inventory management to KOLO for product/stock tracking.

  ## New Tables

  ### 1. suppliers
  - Supplier/vendor directory linked to user
  - Name, contact, email, phone, address, payment terms

  ### 2. inventory_items
  - Individual product/stock records
  - SKU, name, category, unit, cost price, selling price
  - Current stock qty, reorder level (for low-stock alerts)
  - Linked to supplier

  ### 3. inventory_transactions
  - Every stock movement: purchase (in), sale (out), adjustment, return
  - Links to main transactions table for COGS accounting
  - Tracks quantity change and unit cost at time of movement

  ## Security
  - RLS enabled on all tables
  - All policies restrict to authenticated owners only
*/

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  payment_terms text DEFAULT 'net_30',
  notes text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own suppliers"
  ON suppliers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own suppliers"
  ON suppliers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own suppliers"
  ON suppliers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own suppliers"
  ON suppliers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Inventory items table
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  sku text DEFAULT '',
  name text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT '',
  unit text DEFAULT 'unit',
  cost_price numeric(15,2) DEFAULT 0,
  selling_price numeric(15,2) DEFAULT 0,
  current_stock numeric(15,3) DEFAULT 0,
  reorder_level numeric(15,3) DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inventory"
  ON inventory_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inventory"
  ON inventory_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inventory"
  ON inventory_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own inventory"
  ON inventory_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Inventory transactions (stock movements)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('purchase', 'sale', 'adjustment', 'return', 'write_off')),
  quantity numeric(15,3) NOT NULL,
  unit_cost numeric(15,2) DEFAULT 0,
  total_cost numeric(15,2) DEFAULT 0,
  reference text DEFAULT '',
  notes text DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inventory transactions"
  ON inventory_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own inventory transactions"
  ON inventory_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inventory transactions"
  ON inventory_transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own inventory transactions"
  ON inventory_transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_stock ON inventory_items(current_stock);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_user_id ON inventory_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tx_item_id ON inventory_transactions(item_id);



-- ==========================================
-- MIGRATION: 20260418094340_add_team_and_notifications_tables.sql
-- ==========================================

/*
  # Add Team Access Control & Notifications Tables

  ## Overview
  Adds multi-user team management and a notifications/automation system.

  ## New Tables

  ### 1. team_members
  - Links users to a business "owner" account
  - Role: admin | accountant | staff | viewer
  - Status: pending (invite) | active | suspended
  - invite_email for pending invitations

  ### 2. activity_logs
  - Immutable audit log of user actions within the system
  - action: created | updated | deleted | viewed | processed
  - entity_type: transaction | invoice | employee | payroll | inventory | etc.
  - Stores before/after metadata as JSON

  ### 3. notifications
  - User notification inbox
  - type: payment_reminder | tax_deadline | low_stock | cash_warning | invoice_due | payroll | info
  - severity: info | warning | critical
  - is_read, action_url for deep-linking

  ## Security
  - RLS enabled on all tables
  - Team members can only view their own membership records
  - Activity logs visible to business owner and admins
  - Notifications are strictly per-user
*/

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_email text DEFAULT '',
  role text DEFAULT 'staff' CHECK (role IN ('admin', 'accountant', 'staff', 'viewer')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  permissions jsonb DEFAULT '{}',
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their team"
  ON team_members FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = member_id);
CREATE POLICY "Owners can insert team members"
  ON team_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update team members"
  ON team_members FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete team members"
  ON team_members FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'viewed', 'processed', 'sent', 'paid', 'approved')),
  entity_type text NOT NULL,
  entity_id text DEFAULT '',
  entity_label text DEFAULT '',
  metadata jsonb DEFAULT '{}',
  ip_address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity logs"
  ON activity_logs FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert activity logs"
  ON activity_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND auth.uid() = owner_id);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('payment_reminder', 'tax_deadline', 'low_stock', 'cash_warning', 'invoice_due', 'payroll', 'info', 'success', 'error')),
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'success')),
  title text NOT NULL,
  body text DEFAULT '',
  action_url text DEFAULT '',
  action_label text DEFAULT '',
  is_read boolean DEFAULT false,
  is_dismissed boolean DEFAULT false,
  scheduled_for timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_members_owner_id ON team_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_owner_id ON activity_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;



-- ==========================================
-- MIGRATION: 20260504160800_add_connected_banks.sql
-- ==========================================

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



-- ==========================================
-- MIGRATION: 20260506010000_add_mono_account_id_to_accounts.sql
-- ==========================================

/*
  # Add mono_account_id to accounts table

  Allows upserting on mono_account_id so reconnecting the same bank
  updates the existing account instead of creating a duplicate.
*/

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS mono_account_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_accounts_mono_account_id ON accounts(mono_account_id)
  WHERE mono_account_id IS NOT NULL;



-- ==========================================
-- MIGRATION: 20260510104300_add_email_sync.sql
-- ==========================================

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



-- ==========================================
-- MIGRATION: 20260523000001_add_ai_clarification_table.sql
-- ==========================================

-- ================================================================
-- AI Pending Clarifications table
-- Stores transactions that the AI flagged as ambiguous and need
-- a human to confirm the intent before actions are taken.
-- ================================================================

create table if not exists public.ai_pending_clarifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  original_description text not null default '',
  suggested_intent text not null default '',   -- e.g. 'salary_payment', 'inventory_purchase', 'income', 'expense'
  suggested_employee text,                      -- if payroll intent detected
  suggested_item text,                          -- if inventory intent detected
  suggested_quantity numeric,
  suggested_amount numeric,
  ai_question text not null default '',        -- human-readable question for the user
  status text not null default 'pending'        -- 'pending' | 'resolved' | 'dismissed'
    check (status in ('pending','resolved','dismissed')),
  notification_id uuid references public.notifications(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.ai_pending_clarifications enable row level security;

create policy "Users manage own clarifications"
  on public.ai_pending_clarifications
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for quick lookups of pending items per user
create index if not exists idx_ai_clarifications_user_status
  on public.ai_pending_clarifications(user_id, status);

-- ================================================================
-- Extend notifications type to include 'ai_clarification'
-- (Supabase text check is simpler than enum alteration)
-- ================================================================
-- The notifications.type column already uses a text CHECK constraint
-- or the frontend reads it as string — no enum change needed.
-- We simply document the new value 'ai_clarification' here.



-- ==========================================
-- MIGRATION: 20260617082400_add_discount_to_invoices.sql
-- ==========================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_rate numeric(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount numeric(15,2) DEFAULT 0;



-- ==========================================
-- MIGRATION: 20260617095300_add_inventory_item_id_to_invoice_items.sql
-- ==========================================

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL;



-- ==========================================
-- MIGRATION: 20260617132100_add_amount_paid_to_invoices.sql
-- ==========================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid numeric(15,2) DEFAULT 0;



-- ==========================================
-- MIGRATION: 20260617150000_add_external_payments.sql
-- ==========================================

-- 1. Create external_workers table
CREATE TABLE IF NOT EXISTS external_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  business_name text,
  phone text,
  email text,
  category text NOT NULL, -- Freelancer, Contractor, Vendor, Consultant, Service Provider, Other
  bank_name text,
  account_number text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE external_workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own external workers"
  ON external_workers FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own external workers"
  ON external_workers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own external workers"
  ON external_workers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own external workers"
  ON external_workers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Create service_agreements table
CREATE TABLE IF NOT EXISTS service_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES external_workers(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL,
  description text,
  agreed_amount numeric(15,2) NOT NULL DEFAULT 0,
  start_date date,
  due_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE service_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own service agreements"
  ON service_agreements FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own service agreements"
  ON service_agreements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own service agreements"
  ON service_agreements FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own service agreements"
  ON service_agreements FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Create contractor_payments table
CREATE TABLE IF NOT EXISTS contractor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_id uuid NOT NULL REFERENCES service_agreements(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  payment_method text,
  reference_number text,
  notes text,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contractor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contractor payments"
  ON contractor_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contractor payments"
  ON contractor_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own contractor payments"
  ON contractor_payments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own contractor payments"
  ON contractor_payments FOR DELETE TO authenticated USING (auth.uid() = user_id);



-- ==========================================
-- MIGRATION: 20260617160000_add_expenses_and_bills.sql
-- ==========================================

-- 1. Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  vendor text NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  payment_method text,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  description text,
  attachment_url text,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses" ON expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Create bills table
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_number text NOT NULL,
  vendor text NOT NULL,
  description text,
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'overdue')),
  notes text,
  attachment_url text,
  agreement_id uuid REFERENCES service_agreements(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bills" ON bills FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bills" ON bills FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bills" ON bills FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bills" ON bills FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Create bill_payments table
CREATE TABLE IF NOT EXISTS bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(15,2) NOT NULL DEFAULT 0,
  payment_method text,
  reference_number text,
  notes text,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bill payments" ON bill_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bill payments" ON bill_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bill payments" ON bill_payments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own bill payments" ON bill_payments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Seed missing system categories
INSERT INTO categories (name, type, icon, color, is_system) VALUES
  ('Internet', 'expense', 'globe', '#3b82f6', true),
  ('Fuel', 'expense', 'fuel', '#f59e0b', true),
  ('Professional Services', 'expense', 'briefcase', '#10b981', true),
  ('Technology', 'expense', 'laptop', '#6366f1', true),
  ('Maintenance', 'expense', 'tool', '#64748b', true),
  ('Office Supplies', 'expense', 'paperclip', '#ec4899', true)
ON CONFLICT DO NOTHING;



-- ==========================================
-- MIGRATION: 20260621100000_add_automatic_activity_logs.sql
-- ==========================================

-- Create automatic activity logging trigger function
CREATE OR REPLACE FUNCTION public.log_activity_trigger()
RETURNS TRIGGER AS $$
DECLARE
  owner_uuid uuid;
  user_uuid uuid;
  action_name text;
  entity_lbl text;
  meta jsonb;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    action_name := 'created';
    
    -- Try to get owner_id or user_id
    IF NEW.user_id IS NOT NULL THEN
      user_uuid := NEW.user_id;
      owner_uuid := NEW.user_id;
    ELSE
      user_uuid := auth.uid();
      owner_uuid := auth.uid();
    END IF;
    
    -- Set entity label and metadata based on table
    IF TG_TABLE_NAME = 'transactions' THEN
      entity_lbl := COALESCE(NEW.description, '');
      meta := jsonb_build_object('amount', NEW.amount, 'type', NEW.type);
    ELSIF TG_TABLE_NAME = 'invoices' THEN
      entity_lbl := COALESCE(NEW.invoice_number, '');
      meta := jsonb_build_object('total', NEW.total, 'client', NEW.client_name);
    ELSIF TG_TABLE_NAME = 'inventory_items' THEN
      entity_lbl := COALESCE(NEW.name, '');
      meta := jsonb_build_object('sku', NEW.sku, 'stock', NEW.current_stock);
    ELSIF TG_TABLE_NAME = 'employees' THEN
      entity_lbl := COALESCE(NEW.full_name, '');
      meta := jsonb_build_object('role', NEW.role, 'salary', NEW.gross_salary);
    ELSE
      entity_lbl := TG_TABLE_NAME;
      meta := '{}'::jsonb;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'updated';
    
    IF NEW.user_id IS NOT NULL THEN
      user_uuid := NEW.user_id;
      owner_uuid := NEW.user_id;
    ELSE
      user_uuid := auth.uid();
      owner_uuid := auth.uid();
    END IF;
    
    IF TG_TABLE_NAME = 'transactions' THEN
      entity_lbl := COALESCE(NEW.description, '');
      meta := jsonb_build_object('old_amount', OLD.amount, 'new_amount', NEW.amount);
    ELSIF TG_TABLE_NAME = 'invoices' THEN
      entity_lbl := COALESCE(NEW.invoice_number, '');
      meta := jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status);
    ELSIF TG_TABLE_NAME = 'inventory_items' THEN
      entity_lbl := COALESCE(NEW.name, '');
      meta := jsonb_build_object('old_stock', OLD.current_stock, 'new_stock', NEW.current_stock);
    ELSE
      entity_lbl := TG_TABLE_NAME;
      meta := '{}'::jsonb;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'deleted';
    
    IF OLD.user_id IS NOT NULL THEN
      user_uuid := OLD.user_id;
      owner_uuid := OLD.user_id;
    ELSE
      user_uuid := auth.uid();
      owner_uuid := auth.uid();
    END IF;
    
    IF TG_TABLE_NAME = 'transactions' THEN
      entity_lbl := COALESCE(OLD.description, '');
      meta := jsonb_build_object('amount', OLD.amount);
    ELSIF TG_TABLE_NAME = 'invoices' THEN
      entity_lbl := COALESCE(OLD.invoice_number, '');
      meta := jsonb_build_object('total', OLD.total);
    ELSIF TG_TABLE_NAME = 'inventory_items' THEN
      entity_lbl := COALESCE(OLD.name, '');
      meta := jsonb_build_object('sku', OLD.sku);
    ELSE
      entity_lbl := TG_TABLE_NAME;
      meta := '{}'::jsonb;
    END IF;
  END IF;

  -- Ensure user_uuid defaults to active authenticated user or owner_uuid
  IF user_uuid IS NULL THEN
    user_uuid := COALESCE(auth.uid(), owner_uuid);
  END IF;

  -- Log action if both owner and user are identified
  IF owner_uuid IS NOT NULL AND user_uuid IS NOT NULL THEN
    INSERT INTO public.activity_logs (user_id, owner_id, action, entity_type, entity_id, entity_label, metadata)
    VALUES (user_uuid, owner_uuid, action_name, TG_TABLE_NAME, COALESCE(NEW.id::text, OLD.id::text), entity_lbl, meta);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers to core tables
DROP TRIGGER IF EXISTS trg_log_transactions_activity ON public.transactions;
CREATE TRIGGER trg_log_transactions_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger();

DROP TRIGGER IF EXISTS trg_log_invoices_activity ON public.invoices;
CREATE TRIGGER trg_log_invoices_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger();

DROP TRIGGER IF EXISTS trg_log_inventory_items_activity ON public.inventory_items;
CREATE TRIGGER trg_log_inventory_items_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger();

DROP TRIGGER IF EXISTS trg_log_employees_activity ON public.employees;
CREATE TRIGGER trg_log_employees_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.log_activity_trigger();



-- ==========================================
-- MIGRATION: 20260621110000_add_rbac_and_collaboration_rls.sql
-- ==========================================

-- Create public.is_owner_or_collaborator helper function
CREATE OR REPLACE FUNCTION public.is_owner_or_collaborator(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT (auth.uid() = target_user_id) OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE owner_id = target_user_id
      AND member_id = auth.uid()
      AND status = 'active'
  );
$$;

-- 1. Profiles Table Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view own or collaborator profile" ON public.profiles FOR SELECT TO authenticated USING (public.is_owner_or_collaborator(id));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. Accounts Table Policies
DROP POLICY IF EXISTS "Users can view own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.accounts;
CREATE POLICY "Users can manage own/collaborator accounts" ON public.accounts FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 3. Categories Table Policies
DROP POLICY IF EXISTS "Users can view own and system categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can view own/collaborator/system categories" ON public.categories FOR SELECT TO authenticated USING (public.is_owner_or_collaborator(user_id) OR is_system = true);
CREATE POLICY "Users can manage own/collaborator categories" ON public.categories FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id) AND is_system = false) WITH CHECK (public.is_owner_or_collaborator(user_id) AND is_system = false);

-- 4. Transactions Table Policies
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can manage own/collaborator transactions" ON public.transactions FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 5. Invoices Table Policies
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete own invoices" ON public.invoices;
CREATE POLICY "Users can manage own/collaborator invoices" ON public.invoices FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 6. Invoice Items Table Policies
DROP POLICY IF EXISTS "Users can view own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete own invoice items" ON public.invoice_items;
CREATE POLICY "Users can manage own/collaborator invoice items" ON public.invoice_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND public.is_owner_or_collaborator(invoices.user_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.invoices WHERE invoices.id = invoice_items.invoice_id AND public.is_owner_or_collaborator(invoices.user_id)));

-- 7. Tax Records Table Policies
DROP POLICY IF EXISTS "Users can view own tax records" ON public.tax_records;
DROP POLICY IF EXISTS "Users can insert own tax records" ON public.tax_records;
DROP POLICY IF EXISTS "Users can update own tax records" ON public.tax_records;
DROP POLICY IF EXISTS "Users can delete own tax records" ON public.tax_records;
CREATE POLICY "Users can manage own/collaborator tax records" ON public.tax_records FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 8. Budgets Table Policies
DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;
CREATE POLICY "Users can manage own/collaborator budgets" ON public.budgets FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 9. Chart of Accounts Table Policies
DROP POLICY IF EXISTS "Users can view own accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON public.chart_of_accounts;
CREATE POLICY "Users can manage own/collaborator chart of accounts" ON public.chart_of_accounts FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 10. Journal Entries Table Policies
DROP POLICY IF EXISTS "Users can view own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can insert own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can update own journal entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Users can delete own journal entries" ON public.journal_entries;
CREATE POLICY "Users can manage own/collaborator journal entries" ON public.journal_entries FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 11. Journal Entry Lines Table Policies
DROP POLICY IF EXISTS "Users can view own journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can insert own journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can update own journal entry lines" ON public.journal_entry_lines;
DROP POLICY IF EXISTS "Users can delete own journal entry lines" ON public.journal_entry_lines;
CREATE POLICY "Users can manage own/collaborator journal entry lines" ON public.journal_entry_lines FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.journal_entries WHERE journal_entries.id = journal_entry_lines.journal_entry_id AND public.is_owner_or_collaborator(journal_entries.user_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.journal_entries WHERE journal_entries.id = journal_entry_lines.journal_entry_id AND public.is_owner_or_collaborator(journal_entries.user_id)));

-- 12. Employees Table Policies
DROP POLICY IF EXISTS "Users can view own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can insert own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can update own employees" ON public.employees;
DROP POLICY IF EXISTS "Users can delete own employees" ON public.employees;
CREATE POLICY "Users can manage own/collaborator employees" ON public.employees FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 13. Payroll Runs Table Policies
DROP POLICY IF EXISTS "Users can view own payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Users can insert own payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Users can update own payroll runs" ON public.payroll_runs;
DROP POLICY IF EXISTS "Users can delete own payroll runs" ON public.payroll_runs;
CREATE POLICY "Users can manage own/collaborator payroll runs" ON public.payroll_runs FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 14. Payslips Table Policies
DROP POLICY IF EXISTS "Users can view own payslips" ON public.payslips;
DROP POLICY IF EXISTS "Users can insert own payslips" ON public.payslips;
DROP POLICY IF EXISTS "Users can update own payslips" ON public.payslips;
DROP POLICY IF EXISTS "Users can delete own payslips" ON public.payslips;
CREATE POLICY "Users can manage own/collaborator payslips" ON public.payslips FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 15. Suppliers Table Policies
DROP POLICY IF EXISTS "Users can view own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can insert own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can update own suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Users can delete own suppliers" ON public.suppliers;
CREATE POLICY "Users can manage own/collaborator suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 16. Inventory Items Table Policies
DROP POLICY IF EXISTS "Users can view own inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can insert own inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can update own inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Users can delete own inventory" ON public.inventory_items;
CREATE POLICY "Users can manage own/collaborator inventory items" ON public.inventory_items FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 17. Inventory Transactions Table Policies
DROP POLICY IF EXISTS "Users can view own inventory transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Users can insert own inventory transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Users can update own inventory transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Users can delete own inventory transactions" ON public.inventory_transactions;
CREATE POLICY "Users can manage own/collaborator inventory transactions" ON public.inventory_transactions FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 18. Connected Banks Table Policies
DROP POLICY IF EXISTS "Users manage own connected banks" ON public.connected_banks;
CREATE POLICY "Users manage own/collaborator connected banks" ON public.connected_banks FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 19. Bank Email Sync Settings Table Policies
DROP POLICY IF EXISTS "Users can manage their own email sync settings" ON public.bank_email_sync_settings;
CREATE POLICY "Users manage own/collaborator email sync settings" ON public.bank_email_sync_settings FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 20. AI Pending Clarifications Table Policies
DROP POLICY IF EXISTS "Users manage own clarifications" ON public.ai_pending_clarifications;
CREATE POLICY "Users manage own/collaborator clarifications" ON public.ai_pending_clarifications FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 21. AI Insights Table Policies
DROP POLICY IF EXISTS "Users can view own insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can insert own insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can update own insights" ON public.ai_insights;
DROP POLICY IF EXISTS "Users can delete own insights" ON public.ai_insights;
CREATE POLICY "Users manage own/collaborator insights" ON public.ai_insights FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 22. External Workers Table Policies
DROP POLICY IF EXISTS "Users can view own external workers" ON public.external_workers;
DROP POLICY IF EXISTS "Users can insert own external workers" ON public.external_workers;
DROP POLICY IF EXISTS "Users can update own external workers" ON public.external_workers;
DROP POLICY IF EXISTS "Users can delete own external workers" ON public.external_workers;
CREATE POLICY "Users manage own/collaborator external workers" ON public.external_workers FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 23. Service Agreements Table Policies
DROP POLICY IF EXISTS "Users can view own service agreements" ON public.service_agreements;
DROP POLICY IF EXISTS "Users can insert own service agreements" ON public.service_agreements;
DROP POLICY IF EXISTS "Users can update own service agreements" ON public.service_agreements;
DROP POLICY IF EXISTS "Users can delete own service agreements" ON public.service_agreements;
CREATE POLICY "Users manage own/collaborator service agreements" ON public.service_agreements FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 24. Contractor Payments Table Policies
DROP POLICY IF EXISTS "Users can view own contractor payments" ON public.contractor_payments;
DROP POLICY IF EXISTS "Users can insert own contractor payments" ON public.contractor_payments;
DROP POLICY IF EXISTS "Users can update own contractor payments" ON public.contractor_payments;
DROP POLICY IF EXISTS "Users can delete own contractor payments" ON public.contractor_payments;
CREATE POLICY "Users manage own/collaborator contractor payments" ON public.contractor_payments FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 25. Expenses Table Policies
DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;
CREATE POLICY "Users manage own/collaborator expenses" ON public.expenses FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 26. Bills Table Policies
DROP POLICY IF EXISTS "Users can view own bills" ON public.bills;
DROP POLICY IF EXISTS "Users can insert own bills" ON public.bills;
DROP POLICY IF EXISTS "Users can update own bills" ON public.bills;
DROP POLICY IF EXISTS "Users can delete own bills" ON public.bills;
CREATE POLICY "Users manage own/collaborator bills" ON public.bills FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));

-- 27. Bill Payments Table Policies
DROP POLICY IF EXISTS "Users can view own bill payments" ON public.bill_payments;
DROP POLICY IF EXISTS "Users can insert own bill payments" ON public.bill_payments;
DROP POLICY IF EXISTS "Users can update own bill payments" ON public.bill_payments;
DROP POLICY IF EXISTS "Users can delete own bill payments" ON public.bill_payments;
CREATE POLICY "Users manage own/collaborator bill payments" ON public.bill_payments FOR ALL TO authenticated USING (public.is_owner_or_collaborator(user_id)) WITH CHECK (public.is_owner_or_collaborator(user_id));



-- ==========================================
-- MIGRATION: 20260621120000_add_rate_limiting.sql
-- ==========================================

-- Create rate limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 1,
  UNIQUE(user_id, endpoint, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rate limits" ON public.rate_limits FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Create rate limit checker function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_hits integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_hits integer;
BEGIN
  -- Calculate fixed window start time
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  -- Upsert hits for current window
  INSERT INTO public.rate_limits (user_id, endpoint, window_start, hits)
  VALUES (p_user_id, p_endpoint, v_window_start, 1)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET hits = public.rate_limits.hits + 1
  RETURNING hits INTO v_hits;

  -- Clean up expired windows for this endpoint/user to maintain storage scaling
  DELETE FROM public.rate_limits
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND window_start < now() - (p_window_seconds || ' seconds')::interval;

  -- Return true if limit exceeded
  RETURN v_hits > p_max_hits;
END;
$$;



-- ==========================================
-- MIGRATION: 20260621130000_add_receipts_storage.sql
-- ==========================================

-- Create storage bucket for receipts if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false,
  5242880, -- 5MB limit at storage level
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload receipts to their own user_id directory
CREATE POLICY "Users can upload receipts to their own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to view receipts in their own user_id directory
CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete receipts in their own user_id directory
CREATE POLICY "Users can delete their own receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);



-- ==========================================
-- MIGRATION: 20260621140000_add_missing_performance_indexes.sql
-- ==========================================

-- Create indexes for external payments (contractors) table columns
CREATE INDEX IF NOT EXISTS idx_external_workers_user_id ON public.external_workers(user_id);

CREATE INDEX IF NOT EXISTS idx_service_agreements_user_id ON public.service_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_service_agreements_worker_id ON public.service_agreements(worker_id);

CREATE INDEX IF NOT EXISTS idx_contractor_payments_user_id ON public.contractor_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_agreement_id ON public.contractor_payments(agreement_id);

-- Create indexes for expenses, bills, and bill payments table columns
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date DESC);

CREATE INDEX IF NOT EXISTS idx_bills_user_id ON public.bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_category_id ON public.bills(category_id);
CREATE INDEX IF NOT EXISTS idx_bills_agreement_id ON public.bills(agreement_id);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON public.bills(due_date DESC);

CREATE INDEX IF NOT EXISTS idx_bill_payments_user_id ON public.bill_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_bill_id ON public.bill_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON public.bill_payments(payment_date DESC);



-- ==========================================
-- MIGRATION: 20260621150000_add_advanced_performance_indexes.sql
-- ==========================================

-- Create index on invoice_items foreign keys to speed up invoice details load
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inventory_item_id ON public.invoice_items(inventory_item_id);

-- Create indexes on transactions foreign keys to optimize reports and balance calculations
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);

-- Create index on team_members member_id to optimize RLS security lookup performance
CREATE INDEX IF NOT EXISTS idx_team_members_member_id ON public.team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_team_members_owner_member ON public.team_members(owner_id, member_id);



-- ==========================================
-- MIGRATION: 20260808000000_fix_account_balance_triggers.sql
-- ==========================================

/*
  # Fix Account Balance Real-time Triggers & Recalculation

  1. Enhancements to `accounts` table:
    - Ensure `last_synced_at` column exists
    - Ensure `mono_account_id` index exists

  2. Triggers:
    - Automatically update `accounts.balance` whenever a transaction is inserted, updated, or deleted.

  3. Functions:
    - `recalculate_account_balance`: Helper function to recalculate exact account balance from linked transactions.
*/

-- Ensure columns exist
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS mono_account_id text;

-- Create index on mono_account_id if not exists
CREATE INDEX IF NOT EXISTS idx_accounts_mono_account_id ON public.accounts(mono_account_id)
  WHERE mono_account_id IS NOT NULL;

-- Trigger Function to update account balance on transaction change
CREATE OR REPLACE FUNCTION public.update_account_balance_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. On INSERT
  IF (TG_OP = 'INSERT') THEN
    IF NEW.account_id IS NOT NULL THEN
      IF NEW.type = 'income' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) + NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      ELSIF NEW.type = 'expense' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) - NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;

  -- 2. On DELETE
  ELSIF (TG_OP = 'DELETE') THEN
    IF OLD.account_id IS NOT NULL THEN
      IF OLD.type = 'income' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) - OLD.amount,
            updated_at = now()
        WHERE id = OLD.account_id;
      ELSIF OLD.type = 'expense' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) + OLD.amount,
            updated_at = now()
        WHERE id = OLD.account_id;
      END IF;
    END IF;
    RETURN OLD;

  -- 3. On UPDATE
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Revert OLD effect
    IF OLD.account_id IS NOT NULL THEN
      IF OLD.type = 'income' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) - OLD.amount,
            updated_at = now()
        WHERE id = OLD.account_id;
      ELSIF OLD.type = 'expense' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) + OLD.amount,
            updated_at = now()
        WHERE id = OLD.account_id;
      END IF;
    END IF;

    -- Apply NEW effect
    IF NEW.account_id IS NOT NULL THEN
      IF NEW.type = 'income' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) + NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      ELSIF NEW.type = 'expense' THEN
        UPDATE public.accounts
        SET balance = COALESCE(balance, 0) - NEW.amount,
            updated_at = now()
        WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to transactions table
DROP TRIGGER IF EXISTS trg_update_account_balance ON public.transactions;

CREATE TRIGGER trg_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_account_balance_on_transaction();

-- Recalculate helper function
CREATE OR REPLACE FUNCTION public.recalculate_account_balance(target_account_id uuid)
RETURNS numeric AS $$
DECLARE
  total_income numeric := 0;
  total_expense numeric := 0;
  calculated_balance numeric := 0;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_income
  FROM public.transactions
  WHERE account_id = target_account_id AND type = 'income';

  SELECT COALESCE(SUM(amount), 0) INTO total_expense
  FROM public.transactions
  WHERE account_id = target_account_id AND type = 'expense';

  calculated_balance := total_income - total_expense;

  UPDATE public.accounts
  SET balance = calculated_balance,
      updated_at = now()
  WHERE id = target_account_id;

  RETURN calculated_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



-- ==========================================
-- MIGRATION: 20260824000000_add_ai_action_log.sql
-- ==========================================

/*
  # Add AI Action Log Table

  ## Overview
  Creates an immutable audit log for every action the ROVA AI executes,
  whether initiated from the web app or WhatsApp. This satisfies the
  full AI functionality spec requirement for complete auditability.

  ## Table: ai_action_log
  - Records every tool call made by the AI
  - Tracks user_id, source (web | whatsapp), tool name, parameters, result
  - confirmation_status: auto (read-only), confirmed (user approved), skipped, high_risk_blocked
  - result_status: success | error | pending_confirmation
*/

CREATE TABLE IF NOT EXISTS ai_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  source text DEFAULT 'web' CHECK (source IN ('web', 'whatsapp')),
  user_request text NOT NULL DEFAULT '',
  tool_called text NOT NULL DEFAULT '',
  parameters jsonb DEFAULT '{}',
  confirmation_status text DEFAULT 'auto' CHECK (
    confirmation_status IN ('auto', 'confirmed', 'skipped', 'high_risk_blocked', 'pending')
  ),
  result_status text DEFAULT 'success' CHECK (
    result_status IN ('success', 'error', 'pending_confirmation', 'cancelled')
  ),
  record_id text DEFAULT '',
  error_message text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_action_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own AI audit log
CREATE POLICY "Users can view own ai action log"
  ON ai_action_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can insert (edge functions use service role key)
CREATE POLICY "Service role can insert ai action log"
  ON ai_action_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Also allow authenticated inserts for web-initiated actions
CREATE POLICY "Authenticated users can insert ai action log"
  ON ai_action_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_ai_action_log_user_id ON ai_action_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_log_timestamp ON ai_action_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_action_log_tool ON ai_action_log(tool_called);
CREATE INDEX IF NOT EXISTS idx_ai_action_log_source ON ai_action_log(source);



-- ==========================================
-- MIGRATION: 20260909220000_add_subscription_and_billing.sql
-- ==========================================

-- ============================================================
-- ROVA Subscription & Billing Tables
-- ============================================================

-- 1. ROVA Subscriptions
--    Tracks which plan a user is on (basic_daily, basic_monthly,
--    business_daily, business_monthly) and its lifecycle.
-- ============================================================
CREATE TABLE IF NOT EXISTS rova_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name          TEXT,
  plan                   TEXT NOT NULL CHECK (plan IN ('basic_daily','basic_monthly','business_daily','business_monthly')),
  amount                 NUMERIC(12,2) NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','expired')),
  payment_reference      TEXT,
  paystack_transaction_id TEXT,
  payment_date           TIMESTAMPTZ,
  start_date             DATE NOT NULL DEFAULT CURRENT_DATE,
  next_payment_date      DATE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rova_subscriptions_user_id ON rova_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_rova_subscriptions_status  ON rova_subscriptions(status);

ALTER TABLE rova_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscriptions"
  ON rova_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own subscriptions"
  ON rova_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own subscriptions"
  ON rova_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. ROVA Service Payments
--    Tracks one-time professional service purchases such as
--    Tax Filing (₦5,000). Extensible for future services.
-- ============================================================
CREATE TABLE IF NOT EXISTS rova_service_payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name          TEXT,
  service_type           TEXT NOT NULL DEFAULT 'tax_filing',
  service_name           TEXT NOT NULL,
  tax_year               INTEGER,
  filing_type            TEXT,
  amount                 NUMERIC(12,2) NOT NULL DEFAULT 5000,
  payment_reference      TEXT,
  paystack_transaction_id TEXT,
  payment_date           TIMESTAMPTZ,
  payment_status         TEXT NOT NULL DEFAULT 'unpaid'
                         CHECK (payment_status IN ('unpaid','paid','processing','filed')),
  filing_status          TEXT NOT NULL DEFAULT 'pending'
                         CHECK (filing_status IN ('pending','processing','filed','rejected')),
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rova_service_payments_user_id ON rova_service_payments(user_id);

ALTER TABLE rova_service_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own service payments"
  ON rova_service_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own service payments"
  ON rova_service_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own service payments"
  ON rova_service_payments FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. ROVA Services Catalog
--    Future-proof service registry. Seed with initial services.
-- ============================================================
CREATE TABLE IF NOT EXISTS rova_services_catalog (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT,
  price            NUMERIC(12,2) NOT NULL,
  payment_type     TEXT NOT NULL CHECK (payment_type IN ('recurring','one_time')),
  billing_frequency TEXT CHECK (billing_frequency IN ('daily','monthly','one_time')),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed initial services
INSERT INTO rova_services_catalog (name, description, price, payment_type, billing_frequency) VALUES
  ('ROVA Basic — Daily',    'Full ROVA platform access billed daily',            100,  'recurring', 'daily'),
  ('ROVA Basic — Monthly',  'Full ROVA platform access billed monthly',          3000, 'recurring', 'monthly'),
  ('ROVA Business — Daily', 'Full ROVA Business plan billed daily',              500,  'recurring', 'daily'),
  ('ROVA Business — Monthly','Full ROVA Business plan billed monthly',           15000,'recurring', 'monthly'),
  ('Tax Filing Service',    'ROVA handles your tax filing with FIRS — one-time', 5000, 'one_time',  'one_time')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Helper trigger: auto-update updated_at on subscriptions
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rova_subscriptions_updated_at ON rova_subscriptions;
CREATE TRIGGER trg_rova_subscriptions_updated_at
  BEFORE UPDATE ON rova_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_rova_service_payments_updated_at ON rova_service_payments;
CREATE TRIGGER trg_rova_service_payments_updated_at
  BEFORE UPDATE ON rova_service_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();



-- ==========================================
-- MIGRATION: 20260911200000_add_receipts_system.sql
-- ==========================================

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



-- ==========================================
-- MIGRATION: 20260929000000_add_rova_memories.sql
-- ==========================================

/*
  # Add ROVA Memory System

  ## Overview
  Creates the `rova_memories` table that powers persistent user context
  for the ROVA AI (WhatsApp and web). Each memory is strictly owned by
  one user — RLS policies prevent any cross-user data access.

  ## Table: rova_memories
  - Stores useful information extracted from past AI conversations
  - memory_type categorises the kind of information (preference, instruction, etc.)
  - importance (1–10) allows retrieval to prioritise more relevant memories
  - is_active lets us "soft-delete" memories when the user says "forget that"
  - source_summary is a short note about the conversation that created the memory

  ## RLS
  - SELECT: own rows only (auth.uid() = user_id)
  - INSERT: own rows only
  - UPDATE: own rows only
  - DELETE: own rows only
  - Service role: unrestricted (edge functions run as service role)
*/

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rova_memories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Type of memory: what category of information this represents
  memory_type   text        NOT NULL DEFAULT 'general'
                CHECK (memory_type IN (
                  'preference',       -- e.g. "User prefers to receive daily sales summaries"
                  'business_detail',  -- e.g. "Business opens at 8am, closes 6pm Monday-Saturday"
                  'instruction',      -- e.g. "Always add 10% service charge to invoices"
                  'recurring_contact',-- e.g. "MTN is the main airtime supplier"
                  'decision',         -- e.g. "Agreed to move payroll date to 25th each month"
                  'general'           -- anything else worth remembering
                )),

  -- The actual remembered content (plain text, concise)
  content       text        NOT NULL,

  -- Short note of the conversation context that created this memory
  source_summary text       DEFAULT '',

  -- Soft-delete flag — set false when user says "forget that"
  is_active     boolean     DEFAULT true,

  -- Relevance weight (1 = low, 10 = critical) — used to prioritise retrieval
  importance    integer     DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE rova_memories ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view only their own memories
CREATE POLICY "Users can view own memories"
  ON rova_memories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated users can insert their own memories
CREATE POLICY "Users can insert own memories"
  ON rova_memories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update their own memories
CREATE POLICY "Users can update own memories"
  ON rova_memories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own memories
CREATE POLICY "Users can delete own memories"
  ON rova_memories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role (edge functions) can do anything — needed for WhatsApp webhook
-- which runs under service_role key, not an authenticated user session
CREATE POLICY "Service role full access to memories"
  ON rova_memories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Primary lookup: all active memories for a user
CREATE INDEX IF NOT EXISTS idx_rova_memories_user_active
  ON rova_memories(user_id, is_active, importance DESC);

-- Lookup by type for targeted retrieval
CREATE INDEX IF NOT EXISTS idx_rova_memories_user_type
  ON rova_memories(user_id, memory_type);

-- Time-based ordering
CREATE INDEX IF NOT EXISTS idx_rova_memories_created
  ON rova_memories(user_id, created_at DESC);

-- ── Auto-update updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_rova_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rova_memories_updated_at
  BEFORE UPDATE ON rova_memories
  FOR EACH ROW EXECUTE FUNCTION update_rova_memories_updated_at();



-- ==========================================
-- MIGRATION: 20260930000000_add_pdf_url_to_invoices.sql
-- ==========================================

-- Add pdf_url to invoices table if not present
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS pdf_url text DEFAULT '';



-- ==========================================
-- MIGRATION: 20261014170000_update_paystack_billing_system.sql
-- ==========================================

-- ============================================================
-- Migration: Update ROVA Paystack Billing System
-- Monthly One-Time & Daily Recurring Payment Architecture
-- ============================================================

-- 1. Add schema fields to rova_subscriptions
ALTER TABLE rova_subscriptions
  ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('one_time', 'recurring')) DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS billing_interval TEXT CHECK (billing_interval IN ('daily', 'monthly')) DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_subscription_code TEXT,
  ADD COLUMN IF NOT EXISTS paystack_email_token TEXT,
  ADD COLUMN IF NOT EXISTS paystack_plan_code TEXT,
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- 2. Indexes for fast lookup by Paystack identifiers and expiry
CREATE INDEX IF NOT EXISTS idx_rova_subscriptions_sub_code ON rova_subscriptions(paystack_subscription_code);
CREATE INDEX IF NOT EXISTS idx_rova_subscriptions_cus_code ON rova_subscriptions(paystack_customer_code);
CREATE INDEX IF NOT EXISTS idx_rova_subscriptions_expires_at ON rova_subscriptions(access_expires_at);

-- 3. Dedicated Payment History Table for audit log and idempotency
CREATE TABLE IF NOT EXISTS rova_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES rova_subscriptions(id) ON DELETE SET NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('one_time', 'recurring')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('daily', 'monthly')),
  plan TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'refunded')),
  payment_reference TEXT UNIQUE NOT NULL,
  paystack_transaction_id TEXT,
  paystack_customer_code TEXT,
  paystack_subscription_code TEXT,
  paystack_plan_code TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rova_payment_history_user_id ON rova_payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_rova_payment_history_ref ON rova_payment_history(payment_reference);
CREATE INDEX IF NOT EXISTS idx_rova_payment_history_sub_id ON rova_payment_history(subscription_id);

-- Enable RLS
ALTER TABLE rova_payment_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rova_payment_history' AND policyname = 'Users view own payment history'
  ) THEN
    CREATE POLICY "Users view own payment history"
      ON rova_payment_history FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Safely migrate existing records without converting monthly into recurring
-- Migrate existing monthly customers (One-time, 30 days access, no auto-charge)
UPDATE rova_subscriptions
SET
  payment_type = 'one_time',
  billing_interval = 'monthly',
  access_expires_at = COALESCE(payment_date, created_at) + INTERVAL '30 days',
  last_payment_date = COALESCE(payment_date, created_at)
WHERE plan IN ('basic_monthly', 'business_monthly')
  AND (payment_type IS NULL OR access_expires_at IS NULL);

-- Migrate existing daily customers (Marked daily recurring, initial access 1 day, no unauthorized auto charges)
UPDATE rova_subscriptions
SET
  payment_type = 'recurring',
  billing_interval = 'daily',
  access_expires_at = COALESCE(payment_date, created_at) + INTERVAL '1 day',
  last_payment_date = COALESCE(payment_date, created_at)
WHERE plan IN ('basic_daily', 'business_daily')
  AND (payment_type IS NULL OR access_expires_at IS NULL);

-- 5. Backfill historical records into rova_payment_history
INSERT INTO rova_payment_history (
  user_id, subscription_id, payment_type, billing_interval, plan,
  amount, status, payment_reference, paystack_transaction_id,
  period_start, period_end, created_at
)
SELECT
  user_id,
  id,
  payment_type,
  billing_interval,
  plan,
  amount,
  'success',
  payment_reference,
  paystack_transaction_id,
  COALESCE(payment_date, created_at),
  access_expires_at,
  COALESCE(payment_date, created_at)
FROM rova_subscriptions
WHERE payment_reference IS NOT NULL
ON CONFLICT (payment_reference) DO NOTHING;

-- 6. Ensure rova_services_catalog table exists and is updated
CREATE TABLE IF NOT EXISTS rova_services_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('recurring','one_time')),
  billing_frequency TEXT CHECK (billing_frequency IN ('daily','monthly','one_time')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO rova_services_catalog (name, description, price, payment_type, billing_frequency) VALUES
  ('ROVA Basic — Daily',    'Full ROVA platform access billed daily (recurring)',    100,   'recurring', 'daily'),
  ('ROVA Basic — Monthly',  'Full ROVA platform access billed monthly (one-time)',    3000,  'one_time',  'monthly'),
  ('ROVA Business — Daily', 'Full ROVA Business plan billed daily (recurring)',      500,   'recurring', 'daily'),
  ('ROVA Business — Monthly','Full ROVA Business plan billed monthly (one-time)',   15000, 'one_time',  'monthly'),
  ('Tax Filing Service',    'ROVA handles your tax filing with FIRS — one-time',     5000,  'one_time',  'one_time')
ON CONFLICT DO NOTHING;

UPDATE rova_services_catalog
SET payment_type = 'one_time', billing_frequency = 'monthly'
WHERE name IN ('ROVA Basic — Monthly', 'ROVA Business — Monthly');

UPDATE rova_services_catalog
SET payment_type = 'recurring', billing_frequency = 'daily'
WHERE name IN ('ROVA Basic — Daily', 'ROVA Business — Daily');



-- ==========================================
-- MIGRATION: 20261021000000_add_chat_conversations.sql
-- ==========================================

/*
  # Add Chat Conversations Table

  ## Overview
  Creates `chat_conversations` to store ChatGPT-style persistent conversations
  and history for authenticated users of ROVA AI.

  ## RLS
  - Strictly owned by user: auth.uid() = user_id
*/

CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_pinned boolean DEFAULT false,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON chat_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON chat_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON chat_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated ON chat_conversations(user_id, updated_at DESC);

