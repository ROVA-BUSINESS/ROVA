ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid numeric(15,2) DEFAULT 0;
