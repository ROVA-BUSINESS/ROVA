-- ================================================================
-- AI Pending Clarifications table
-- Stores transactions that the AI flagged as ambiguous and need
-- a human to confirm the intent before actions are taken.
-- ================================================================

create table if not exists public.ai_pending_clarifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete cascade,
  original_description text not null default '',
  suggested_intent text not null default '',   -- e.g. 'salary_payment', 'inventory_purchase', 'income', 'expense'
  suggested_employee text,                      -- if payroll intent detected
  suggested_item text,                          -- if inventory intent detected
  suggested_quantity numeric,
  suggested_amount numeric,
  ai_question text not null default '',        -- human-readable question for the user
  status text not null default 'pending'        -- 'pending' | 'resolved' | 'dismissed'
    check (status in ('pending','resolved','dismissed')),
  notification_id uuid references public.notifications(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.ai_pending_clarifications enable row level security;

create policy "Users manage own clarifications"
  on public.ai_pending_clarifications
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for quick lookups of pending items per user
create index if not exists idx_ai_clarifications_user_status
  on public.ai_pending_clarifications(user_id, status);

-- ================================================================
-- Extend notifications type to include 'ai_clarification'
-- (Supabase text check is simpler than enum alteration)
-- ================================================================
-- The notifications.type column already uses a text CHECK constraint
-- or the frontend reads it as string — no enum change needed.
-- We simply document the new value 'ai_clarification' here.
