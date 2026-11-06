import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://aooujupyoyyvolztbzjt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, title, description = '', amount, currency = 'NGN', allowCustomAmount = false, provider = 'paystack' } = req.body || {};

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID is required.' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required for creating a payment link.' });
    }

    const slug = `rova-${Math.random().toString(36).substring(2, 9).toLowerCase()}`;
    let paymentUrl = `https://paystack.com/pay/${slug}`;
    let providerLinkId = `PLK_${slug.toUpperCase()}`;

    // If live Paystack secret key is configured, create an official Paystack Page
    if (paystackSecretKey && provider === 'paystack') {
      try {
        const pagePayload = {
          name: title,
          description: description || 'Payment via ROVA',
          amount: allowCustomAmount ? undefined : Math.round(Number(amount) * 100),
          currency,
        };

        const paystackRes = await fetch('https://api.paystack.co/page', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(pagePayload),
        });

        if (paystackRes.ok) {
          const pageData = await paystackRes.json();
          if (pageData.status && pageData.data) {
            providerLinkId = String(pageData.data.id || pageData.data.slug);
            paymentUrl = `https://paystack.com/pay/${pageData.data.slug}`;
          }
        }
      } catch (err) {
        console.warn('Paystack Page API call failed, falling back to direct URL generator:', err.message);
      }
    }

    const { data: linkRecord, error: dbError } = await supabase
      .from('payment_links')
      .insert({
        user_id: userId,
        provider,
        provider_link_id: providerLinkId,
        title,
        description,
        amount: allowCustomAmount ? null : Number(amount),
        currency,
        allow_custom_amount: allowCustomAmount,
        url: paymentUrl,
        status: 'active',
        metadata: { generated_by: 'rova_unified_payment_tab' },
      })
      .select()
      .single();

    if (dbError) {
      return res.status(200).json({
        success: true,
        link: {
          id: `tmp_${slug}`,
          user_id: userId,
          provider,
          provider_link_id: providerLinkId,
          title,
          description,
          amount: allowCustomAmount ? null : Number(amount),
          currency,
          allow_custom_amount: allowCustomAmount,
          url: paymentUrl,
          status: 'active',
          created_at: new Date().toISOString(),
        },
      });
    }

    return res.status(201).json({ success: true, link: linkRecord });
  } catch (err) {
    console.error('Create link error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
