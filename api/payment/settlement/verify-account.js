import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://aooujupyoyyvolztbzjt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { accountNumber, bankCode } = req.body || {};

    if (!accountNumber || !bankCode) {
      return res.status(400).json({ success: false, error: 'accountNumber and bankCode are required.' });
    }

    if (!paystackSecretKey) {
      return res.status(500).json({ success: false, error: 'Payment provider not configured.' });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      return res.status(400).json({
        success: false,
        error: paystackData.message || 'Could not verify account. Please check the details and try again.',
      });
    }

    return res.status(200).json({
      success: true,
      accountName: paystackData.data.account_name,
      accountNumber: paystackData.data.account_number,
      bankCode,
    });
  } catch (err) {
    console.error('Verify account error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
