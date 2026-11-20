-- Migration: 20261120100000_add_partial_invoice_payments.sql
-- Description: Partial Invoice Payments, Instalments Tracking, and Atomic Bookkeeping

-- 1. Extend invoices table with partial payment settings
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS allow_partial_payments boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partial_payment_type text DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS minimum_partial_amount numeric(15,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fixed_deposit_amount numeric(15,2) DEFAULT NULL;

-- Ensure check constraint for partial_payment_type
DO $$ BEGIN
  ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_partial_payment_type_check;
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_partial_payment_type_check 
    CHECK (partial_payment_type IN ('any', 'minimum', 'fixed_deposit'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Update status check constraint to include 'partially_paid' and 'unpaid'
DO $$ BEGIN
  ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
  ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check 
    CHECK (status IN ('draft', 'sent', 'unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. Create invoice_payments table to record each individual instalment
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(15,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'NGN',
  payment_method text NOT NULL DEFAULT 'Paystack',
  payment_reference text NOT NULL,
  payment_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('pending', 'verified', 'failed', 'refunded')),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  payer_name text,
  payer_email text,
  notes text,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_invoice_payments_ref UNIQUE (payment_reference)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON public.invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_user_id ON public.invoice_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_ref ON public.invoice_payments(payment_reference);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON public.invoice_payments(payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_allow_partial ON public.invoices(allow_partial_payments);

-- 3. Row Level Security
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoice_payments' AND policyname = 'Users can view own invoice payments'
  ) THEN
    CREATE POLICY "Users can view own invoice payments"
      ON public.invoice_payments FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoice_payments' AND policyname = 'Users can insert own invoice payments'
  ) THEN
    CREATE POLICY "Users can insert own invoice payments"
      ON public.invoice_payments FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Allow public to view payments for an invoice (used on customer payment page)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoice_payments' AND policyname = 'Public can view payments for invoice'
  ) THEN
    CREATE POLICY "Public can view payments for invoice"
      ON public.invoice_payments FOR SELECT
      TO anon
      USING (true);
  END IF;

  -- Allow public to select invoices (for customer checkout page)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Public can view invoices for payment'
  ) THEN
    CREATE POLICY "Public can view invoices for payment"
      ON public.invoices FOR SELECT
      TO anon
      USING (true);
  END IF;

  -- Allow public to view invoice items (for customer checkout summary)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoice_items' AND policyname = 'Public can view invoice items'
  ) THEN
    CREATE POLICY "Public can view invoice items"
      ON public.invoice_items FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- 4. Atomic Payment Processing Function
-- Enforces row locks, idempotency, overpayment prevention, accounts receivable & income recording
CREATE OR REPLACE FUNCTION public.record_invoice_payment_atomic(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_reference text,
  p_payment_method text DEFAULT 'Paystack',
  p_payer_name text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_raw_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice record;
  v_existing_payment record;
  v_remaining numeric;
  v_new_amount_paid numeric;
  v_new_status text;
  v_tx_id uuid;
  v_payment_id uuid;
BEGIN
  -- 1. Idempotency Check: if this payment reference already succeeded, return immediately
  SELECT * INTO v_existing_payment 
  FROM public.invoice_payments 
  WHERE payment_reference = p_payment_reference;

  IF FOUND THEN
    SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id;
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'payment_id', v_existing_payment.id,
      'transaction_id', v_existing_payment.transaction_id,
      'invoice_id', p_invoice_id,
      'amount_paid', v_invoice.amount_paid,
      'total', v_invoice.total,
      'outstanding_balance', GREATEST(0, v_invoice.total - v_invoice.amount_paid),
      'status', v_invoice.status
    );
  END IF;

  -- 2. Lock the invoice row for update to prevent concurrent race conditions
  SELECT * INTO v_invoice 
  FROM public.invoices 
  WHERE id = p_invoice_id 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  -- 3. Validate status
  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot make payments on a cancelled invoice');
  END IF;

  v_remaining := GREATEST(0, v_invoice.total - COALESCE(v_invoice.amount_paid, 0));

  IF v_remaining <= 0 OR v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice is already fully paid');
  END IF;

  -- 4. Overpayment check
  IF p_amount > (v_remaining + 0.01) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Payment amount (₦' || p_amount || ') exceeds outstanding balance (₦' || v_remaining || ')'
    );
  END IF;

  -- 5. Partial payment permissions check (if paying less than remaining balance)
  IF p_amount < v_remaining THEN
    IF NOT COALESCE(v_invoice.allow_partial_payments, false) THEN
      RETURN jsonb_build_object('success', false, 'error', 'This invoice does not accept partial payments. Full balance required.');
    END IF;

    IF v_invoice.partial_payment_type = 'minimum' 
       AND v_invoice.minimum_partial_amount IS NOT NULL 
       AND p_amount < v_invoice.minimum_partial_amount 
       AND v_remaining >= v_invoice.minimum_partial_amount THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Payment is below the minimum required amount of ₦' || v_invoice.minimum_partial_amount
      );
    END IF;

    IF v_invoice.partial_payment_type = 'fixed_deposit' 
       AND COALESCE(v_invoice.amount_paid, 0) = 0 
       AND v_invoice.fixed_deposit_amount IS NOT NULL 
       AND p_amount < v_invoice.fixed_deposit_amount THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'First payment must be at least the fixed deposit of ₦' || v_invoice.fixed_deposit_amount
      );
    END IF;
  END IF;

  -- 6. Record bookkeeping income transaction (Accounting Rule: only record actual received amount)
  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description,
    reference,
    date,
    notes,
    is_verified,
    ai_category
  ) VALUES (
    v_invoice.user_id,
    p_amount,
    'income',
    'Payment for ' || v_invoice.invoice_number || COALESCE(' — ' || p_payer_name, ''),
    p_payment_reference,
    CURRENT_DATE,
    COALESCE(p_notes, 'Invoice instalment payment for ' || v_invoice.invoice_number),
    true,
    'Sales Revenue'
  ) RETURNING id INTO v_tx_id;

  -- 7. Record individual payment in invoice_payments
  INSERT INTO public.invoice_payments (
    user_id,
    invoice_id,
    amount,
    currency,
    payment_method,
    payment_reference,
    payment_date,
    status,
    transaction_id,
    payer_name,
    payer_email,
    notes,
    raw_payload
  ) VALUES (
    v_invoice.user_id,
    p_invoice_id,
    p_amount,
    COALESCE(v_invoice.currency, 'NGN'),
    COALESCE(p_payment_method, 'Paystack'),
    p_payment_reference,
    now(),
    'verified',
    v_tx_id,
    COALESCE(p_payer_name, v_invoice.client_name),
    COALESCE(p_payer_email, v_invoice.client_email),
    p_notes,
    COALESCE(p_raw_payload, '{}'::jsonb)
  ) RETURNING id INTO v_payment_id;

  -- 8. Update invoice total amount paid and status
  v_new_amount_paid := COALESCE(v_invoice.amount_paid, 0) + p_amount;
  IF v_new_amount_paid >= (v_invoice.total - 0.01) THEN
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  UPDATE public.invoices SET
    amount_paid = v_new_amount_paid,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_invoice_id;

  -- 9. Record into payment_transactions for unified payment tracking
  BEGIN
    INSERT INTO public.payment_transactions (
      user_id,
      provider,
      provider_reference,
      amount,
      currency,
      type,
      description,
      counterparty_name,
      counterparty_email,
      provider_status,
      verification_status,
      source,
      rova_transaction_id,
      raw_payload
    ) VALUES (
      v_invoice.user_id,
      'paystack',
      p_payment_reference,
      p_amount,
      COALESCE(v_invoice.currency, 'NGN'),
      'credit',
      'Invoice ' || v_invoice.invoice_number || ' payment',
      COALESCE(p_payer_name, v_invoice.client_name),
      COALESCE(p_payer_email, v_invoice.client_email),
      'success',
      'verified',
      'payment_link',
      v_tx_id,
      COALESCE(p_raw_payload, '{}'::jsonb)
    ) ON CONFLICT (user_id, provider, provider_reference) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Never fail the main invoice payment if optional payment_transactions log fails
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'transaction_id', v_tx_id,
    'invoice_id', p_invoice_id,
    'amount_paid', v_new_amount_paid,
    'total', v_invoice.total,
    'outstanding_balance', GREATEST(0, v_invoice.total - v_new_amount_paid),
    'status', v_new_status
  );
END;
$$;
