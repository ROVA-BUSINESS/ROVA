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
