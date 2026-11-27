-- ============================================================================
-- Add persistent Interactive Product Onboarding Tour status to profiles
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_tour_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_tour_completed_at timestamptz;

-- Do not automatically force the first-time tour on pre-existing established accounts;
-- existing users can still launch it anytime via "Take a Product Tour" in Settings or Support.
UPDATE public.profiles
SET onboarding_tour_completed = true
WHERE business_profile_completed = true
  AND created_at < now() - interval '1 day'
  AND onboarding_tour_completed = false;
