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
