-- Create rate limits table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 1,
  UNIQUE(user_id, endpoint, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rate limits" ON public.rate_limits FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Create rate limit checker function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_max_hits integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_hits integer;
BEGIN
  -- Calculate fixed window start time
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  -- Upsert hits for current window
  INSERT INTO public.rate_limits (user_id, endpoint, window_start, hits)
  VALUES (p_user_id, p_endpoint, v_window_start, 1)
  ON CONFLICT (user_id, endpoint, window_start)
  DO UPDATE SET hits = public.rate_limits.hits + 1
  RETURNING hits INTO v_hits;

  -- Clean up expired windows for this endpoint/user to maintain storage scaling
  DELETE FROM public.rate_limits
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND window_start < now() - (p_window_seconds || ' seconds')::interval;

  -- Return true if limit exceeded
  RETURN v_hits > p_max_hits;
END;
$$;
