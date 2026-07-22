ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL;
