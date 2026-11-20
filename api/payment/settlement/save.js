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
    const { userId, bankName, bankCode, accountNumber, accountName } = req.body || {};

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID is required.' });
    }
    if (!accountNumber || !accountName) {
      return res.status(400).json({ success: false, error: 'accountNumber and accountName are required.' });
    }

    // Attempt to create a Paystack subaccount (non-blocking)
    let paystackSubaccountCode = null;
    if (paystackSecretKey) {
      try {
        const subRes = await fetch('https://api.paystack.co/subaccount', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            business_name: accountName,
            settlement_bank: bankCode,
            account_number: accountNumber,
            percentage_charge: 0,
          }),
        });

        if (subRes.ok) {
          const subData = await subRes.json();
          if (subData.status && subData.data?.subaccount_code) {
            paystackSubaccountCode = subData.data.subaccount_code;
          }
        }
      } catch (subErr) {
        // Non-blocking — log and continue
        console.warn('Paystack subaccount creation failed (non-blocking):', subErr.message);
      }
    }

    // Upsert into settlement_accounts (match on user_id + account_number)
    const record = {
      user_id: userId,
      bank_name: bankName || null,
      bank_code: bankCode || null,
      account_number: accountNumber,
      account_name: accountName,
      is_verified: true,
      ...(paystackSubaccountCode ? { paystack_subaccount_code: paystackSubaccountCode } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: dbError } = await supabase
      .from('settlement_accounts')
      .upsert(record, { onConflict: 'user_id,account_number' })
      .select()
      .single();

    if (dbError) {
      console.error('DB upsert error:', dbError.message, dbError.code);
      return res.status(500).json({
        success: false,
        error: `Database error: ${dbError.message}. Please ensure the settlement_accounts table exists in Supabase.`,
      });
    }

    return res.status(200).json({ success: true, account: saved });
  } catch (err) {
    console.error('Save settlement account error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
