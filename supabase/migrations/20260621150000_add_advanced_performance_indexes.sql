-- Create index on invoice_items foreign keys to speed up invoice details load
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inventory_item_id ON public.invoice_items(inventory_item_id);

-- Create indexes on transactions foreign keys to optimize reports and balance calculations
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);

-- Create index on team_members member_id to optimize RLS security lookup performance
CREATE INDEX IF NOT EXISTS idx_team_members_member_id ON public.team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_team_members_owner_member ON public.team_members(owner_id, member_id);
