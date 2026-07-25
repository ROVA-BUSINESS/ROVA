ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_rate numeric(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount numeric(15,2) DEFAULT 0;
