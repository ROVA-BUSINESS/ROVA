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
