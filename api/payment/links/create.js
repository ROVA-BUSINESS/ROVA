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
    const {
      userId,
      title,
      description = '',
      amount,
      currency = 'NGN',
      allowCustomAmount = false,
      provider = 'paystack',
      settlementAccountId,
      customerName,
      customerEmail,
      customerPhone,
      expiresAt,
      invoiceId,
    } = req.body || {};

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User ID is required.' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required for creating a payment link.' });
    }

    // Lookup settlement account and Paystack subaccount if provided
    let subaccountCode = null;
    let settlementBankName = null;
    let settlementAccountNum = null;
    if (settlementAccountId) {
      const { data: settlAcct } = await supabase
        .from('settlement_accounts')
        .select('*')
        .eq('id', settlementAccountId)
        .eq('user_id', userId)
        .maybeSingle();

      if (settlAcct) {
        subaccountCode = settlAcct.paystack_subaccount_code || null;
        settlementBankName = settlAcct.bank_name || null;
        settlementAccountNum = settlAcct.account_number || null;
      }
    } else {
      // Check if user has a primary settlement account
      const { data: primaryAcct } = await supabase
        .from('settlement_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .maybeSingle();

      if (primaryAcct) {
        subaccountCode = primaryAcct.paystack_subaccount_code || null;
        settlementBankName = primaryAcct.bank_name || null;
        settlementAccountNum = primaryAcct.account_number || null;
      }
    }

    const slug = `rova-${Math.random().toString(36).substring(2, 9).toLowerCase()}`;
    let paymentUrl = `https://www.rovabusiness.com/pay/${slug}`;
    let providerLinkId = `PLK_${slug.toUpperCase()}`;

    // If live Paystack secret key is configured, create an official Paystack Page
    if (paystackSecretKey && provider === 'paystack') {
      try {
        const pagePayload = {
          name: title,
          description: description || 'Payment via ROVA',
          amount: allowCustomAmount ? undefined : Math.round(Number(amount) * 100),
          currency,
          ...(subaccountCode ? { split_code: undefined, subaccount: subaccountCode } : {}),
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

    const linkMetadata = {
      generated_by: 'rova_unified_payment_tab',
      subaccount_code: subaccountCode,
      settlement_account_id: settlementAccountId || null,
      settlement_bank: settlementBankName,
      settlement_account_number: settlementAccountNum,
      customer_name: customerName || null,
      customer_email: customerEmail || null,
      customer_phone: customerPhone || null,
      expires_at: expiresAt || null,
      invoice_id: invoiceId || null,
    };

    const { data: linkRecord, error: dbError } = await supabase
      .from('payment_links')
      .insert({
        user_id: userId,
        provider,
        provider_link_id: providerLinkId,
        provider_slug: slug,
        title,
        description,
        amount: allowCustomAmount ? null : Number(amount),
        currency,
        allow_custom_amount: allowCustomAmount,
        payment_url: paymentUrl,
        status: 'active',
        total_collected: 0,
        payments_count: 0,
        metadata: linkMetadata,
      })
      .select()
      .single();

    if (dbError) {
      console.warn('Database insert error in payment_links, returning memory link fallback:', dbError.message);
      return res.status(200).json({
        success: true,
        link: {
          id: `tmp_${slug}`,
          user_id: userId,
          provider,
          provider_link_id: providerLinkId,
          provider_slug: slug,
          title,
          description,
          amount: allowCustomAmount ? null : Number(amount),
          currency,
          allow_custom_amount: allowCustomAmount,
          payment_url: paymentUrl,
          status: 'active',
          total_collected: 0,
          payments_count: 0,
          metadata: linkMetadata,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });
    }

    return res.status(201).json({
      success: true,
      link: {
        ...linkRecord,
        payment_url: linkRecord.payment_url || paymentUrl,
        total_collected: Number(linkRecord.total_collected || 0),
        payments_count: Number(linkRecord.payments_count || 0),
      },
    });
  } catch (err) {
    console.error('Create link error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

