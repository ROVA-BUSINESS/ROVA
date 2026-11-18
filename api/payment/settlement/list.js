import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://aooujupyoyyvolztbzjt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query || {};

    if (!userId) {
      return res.status(401).json({ success: false, error: 'userId query parameter is required.' });
    }

    const { data: accounts, error: dbError } = await supabase
      .from('settlement_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('DB fetch error:', dbError.message);
      return res.status(500).json({ success: false, error: 'Failed to fetch settlement accounts.' });
    }

    return res.status(200).json({ success: true, accounts: accounts || [] });
  } catch (err) {
    console.error('List settlement accounts error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
