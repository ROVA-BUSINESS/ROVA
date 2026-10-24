-- Add pdf_url to invoices table if not present
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS pdf_url text DEFAULT '';
