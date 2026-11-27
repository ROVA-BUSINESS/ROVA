-- ============================================================================
-- RovaFlow Contextual Feature Onboarding — Per-feature & subfeature tracking
-- Persists independent completion/skip status across logins and devices.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_tours_state jsonb NOT NULL DEFAULT '{}'::jsonb;
