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
