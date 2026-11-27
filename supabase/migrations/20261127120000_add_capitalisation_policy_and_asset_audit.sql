-- ============================================================================
-- RovaFlow: Capitalisation Policy, Transaction Classification & Asset Linkage
-- ============================================================================

-- 1. Configurable per-business Capitalisation Policy on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS capitalisation_threshold numeric(18,2) DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS capitalisation_policy_notes text DEFAULT 'Capitalise tangible assets with useful life > 12 months that meet materiality threshold; expense low-value consumables immediately.';

-- 2. Transaction Classification & Deduplicated GL/Asset Links
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS classification_type text DEFAULT 'ordinary'
    CHECK (classification_type IN ('ordinary', 'asset_purchase', 'owner_drawings', 'capital_contribution', 'loan', 'transfer')),
  ADD COLUMN IF NOT EXISTS fixed_asset_id uuid REFERENCES public.fixed_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_classification ON public.transactions(user_id, classification_type);
CREATE INDEX IF NOT EXISTS idx_transactions_fixed_asset ON public.transactions(fixed_asset_id);
