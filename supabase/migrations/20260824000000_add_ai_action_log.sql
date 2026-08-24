/*
  # Add AI Action Log Table

  ## Overview
  Creates an immutable audit log for every action the ROVA AI executes,
  whether initiated from the web app or WhatsApp. This satisfies the
  full AI functionality spec requirement for complete auditability.

  ## Table: ai_action_log
  - Records every tool call made by the AI
  - Tracks user_id, source (web | whatsapp), tool name, parameters, result
  - confirmation_status: auto (read-only), confirmed (user approved), skipped, high_risk_blocked
  - result_status: success | error | pending_confirmation
*/

CREATE TABLE IF NOT EXISTS ai_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  source text DEFAULT 'web' CHECK (source IN ('web', 'whatsapp')),
  user_request text NOT NULL DEFAULT '',
  tool_called text NOT NULL DEFAULT '',
  parameters jsonb DEFAULT '{}',
  confirmation_status text DEFAULT 'auto' CHECK (
    confirmation_status IN ('auto', 'confirmed', 'skipped', 'high_risk_blocked', 'pending')
  ),
  result_status text DEFAULT 'success' CHECK (
    result_status IN ('success', 'error', 'pending_confirmation', 'cancelled')
  ),
  record_id text DEFAULT '',
  error_message text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_action_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own AI audit log
CREATE POLICY "Users can view own ai action log"
  ON ai_action_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can insert (edge functions use service role key)
CREATE POLICY "Service role can insert ai action log"
  ON ai_action_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Also allow authenticated inserts for web-initiated actions
CREATE POLICY "Authenticated users can insert ai action log"
  ON ai_action_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_ai_action_log_user_id ON ai_action_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_log_timestamp ON ai_action_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_action_log_tool ON ai_action_log(tool_called);
CREATE INDEX IF NOT EXISTS idx_ai_action_log_source ON ai_action_log(source);
