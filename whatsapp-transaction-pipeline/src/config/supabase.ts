import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import { env } from './env';

// We use the service role key for backend-to-backend operations.
// This bypasses Row Level Security (RLS), which is intentional here
// as we are performing trusted server-side operations.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: ws as any },
});

