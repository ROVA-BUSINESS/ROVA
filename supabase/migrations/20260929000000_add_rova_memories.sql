/*
  # Add ROVA Memory System

  ## Overview
  Creates the `rova_memories` table that powers persistent user context
  for the ROVA AI (WhatsApp and web). Each memory is strictly owned by
  one user — RLS policies prevent any cross-user data access.

  ## Table: rova_memories
  - Stores useful information extracted from past AI conversations
  - memory_type categorises the kind of information (preference, instruction, etc.)
  - importance (1–10) allows retrieval to prioritise more relevant memories
  - is_active lets us "soft-delete" memories when the user says "forget that"
  - source_summary is a short note about the conversation that created the memory

  ## RLS
  - SELECT: own rows only (auth.uid() = user_id)
  - INSERT: own rows only
  - UPDATE: own rows only
  - DELETE: own rows only
  - Service role: unrestricted (edge functions run as service role)
*/

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rova_memories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Type of memory: what category of information this represents
  memory_type   text        NOT NULL DEFAULT 'general'
                CHECK (memory_type IN (
                  'preference',       -- e.g. "User prefers to receive daily sales summaries"
                  'business_detail',  -- e.g. "Business opens at 8am, closes 6pm Monday-Saturday"
                  'instruction',      -- e.g. "Always add 10% service charge to invoices"
                  'recurring_contact',-- e.g. "MTN is the main airtime supplier"
                  'decision',         -- e.g. "Agreed to move payroll date to 25th each month"
                  'general'           -- anything else worth remembering
                )),

  -- The actual remembered content (plain text, concise)
  content       text        NOT NULL,

  -- Short note of the conversation context that created this memory
  source_summary text       DEFAULT '',

  -- Soft-delete flag — set false when user says "forget that"
  is_active     boolean     DEFAULT true,

  -- Relevance weight (1 = low, 10 = critical) — used to prioritise retrieval
  importance    integer     DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE rova_memories ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view only their own memories
CREATE POLICY "Users can view own memories"
  ON rova_memories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated users can insert their own memories
CREATE POLICY "Users can insert own memories"
  ON rova_memories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update their own memories
CREATE POLICY "Users can update own memories"
  ON rova_memories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own memories
CREATE POLICY "Users can delete own memories"
  ON rova_memories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role (edge functions) can do anything — needed for WhatsApp webhook
-- which runs under service_role key, not an authenticated user session
CREATE POLICY "Service role full access to memories"
  ON rova_memories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Indexes ───────────────────────────────────────────────────────────────────
-- Primary lookup: all active memories for a user
CREATE INDEX IF NOT EXISTS idx_rova_memories_user_active
  ON rova_memories(user_id, is_active, importance DESC);

-- Lookup by type for targeted retrieval
CREATE INDEX IF NOT EXISTS idx_rova_memories_user_type
  ON rova_memories(user_id, memory_type);

-- Time-based ordering
CREATE INDEX IF NOT EXISTS idx_rova_memories_created
  ON rova_memories(user_id, created_at DESC);

-- ── Auto-update updated_at ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_rova_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rova_memories_updated_at
  BEFORE UPDATE ON rova_memories
  FOR EACH ROW EXECUTE FUNCTION update_rova_memories_updated_at();
