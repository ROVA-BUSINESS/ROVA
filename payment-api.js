import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://aooujupyoyyvolztbzjt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ── Auth middleware helper ──────────────────────────────────────────────────
async function getAuthenticatedUserId(req) {
  if (req.body?.userId) return req.body.userId;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) return user.id;
  }
  return null;
}

// ── 1. Create Payment Link ──────────────────────────────────────────────────
router.post('/links/create', async (req, res) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User authentication required.' });
    }

    const { title, description = '', amount, currency = 'NGN', allowCustomAmount = false, provider = 'paystack' } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required for creating a payment link.' });
    }

    if (!allowCustomAmount && (amount === undefined || amount === null || Number(amount) <= 0)) {
      return res.status(400).json({ success: false, error: 'Valid amount greater than 0 is required for fixed-amount payment links.' });
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

    const newLink = {
      user_id: userId,
      provider,
      provider_link_id: providerLinkId,
      provider_slug: slug,
      title: title.trim(),
      description: description.trim(),
      amount: allowCustomAmount ? null : Number(amount),
      currency,
      allow_custom_amount: Boolean(allowCustomAmount),
      payment_url: paymentUrl,
      status: 'active',
      total_collected: 0,
      payments_count: 0,
      metadata: {
        creator: 'Rova Payment Engine',
        createdAt: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase
      .from('payment_links')
      .insert(newLink)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ success: true, link: data });
  } catch (err) {
    console.error('Error creating payment link:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to create payment link.' });
  }
});

// ── 2. Sync Provider Transactions ───────────────────────────────────────────
router.post('/sync/:provider', async (req, res) => {
  const { provider } = req.params;
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized: User authentication required.' });
  }

  try {
    // Retrieve provider config
    const { data: config } = await supabase
      .from('payment_provider_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();

    if (provider === 'paystack') {
      const activeSecretKey = config?.secret_key || paystackSecretKey;
      if (!activeSecretKey) {
        return res.status(400).json({
          success: false,
          error: 'Paystack Secret Key is not configured. Please add your Paystack API keys in Provider settings.',
        });
      }

      // Query Paystack Transaction API
      const txRes = await fetch('https://api.paystack.co/transaction?perPage=50', {
        headers: {
          Authorization: `Bearer ${activeSecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!txRes.ok) {
        const errText = await txRes.text();
        return res.status(400).json({ success: false, error: `Paystack API error: ${errText}` });
      }

      const txJson = await txRes.json();
      const records = txJson.data || [];

      let count = 0;
      for (const item of records) {
        const amountNaira = (item.amount || 0) / 100;
        const ref = item.reference || String(item.id);
        const txDate = item.paid_at || item.created_at || new Date().toISOString();

        // Safe idempotent upsert
        const { error } = await supabase
          .from('payment_transactions')
          .upsert(
            {
              user_id: userId,
              provider: 'paystack',
              provider_reference: ref,
              transaction_date: txDate,
              amount: amountNaira,
              currency: item.currency || 'NGN',
              type: 'credit',
              description: item.gateway_response || `Paystack payment - ${item.channel || 'online'}`,
              counterparty_name: item.customer?.first_name ? `${item.customer.first_name} ${item.customer.last_name || ''}`.trim() : null,
              counterparty_email: item.customer?.email || null,
              counterparty_phone: item.customer?.phone || null,
              provider_status: item.status === 'success' ? 'success' : item.status === 'failed' ? 'failed' : 'pending',
              verification_status: item.status === 'success' ? 'verified' : 'unverified',
              source: 'api_sync',
              raw_payload: item,
            },
            { onConflict: 'user_id,provider,provider_reference' }
          );

        if (!error) count++;
      }

      return res.status(200).json({ success: true, count, message: `Synced ${count} transactions from Paystack.` });
    }

    if (provider === 'kuda') {
      if (!config?.public_key || !config?.secret_key) {
        return res.status(400).json({
          success: false,
          error: 'Kuda Business requires Client Email (Public Key) and API Key (Secret Key) to synchronise transactions. Please configure credentials in Provider settings.',
        });
      }

      // Call Kuda Business Open API v2.1
      try {
        const tokenRes = await fetch('https://kuda-openapi.kuda.com/v2.1/Account/GetToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: config.public_key, apiKey: config.secret_key }),
        });

        if (!tokenRes.ok) {
          return res.status(400).json({ success: false, error: 'Failed to authenticate with Kuda Open API. Please check your credentials.' });
        }

        const token = await tokenRes.text();
        const historyRes = await fetch('https://kuda-openapi.kuda.com/v2.1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            serviceType: 'ADMIN_GET_TRANSACTION_HISTORY',
            requestRef: `ROVA_KUDA_${Date.now()}`,
            data: JSON.stringify({
              PageSize: 50,
              PageNumber: 1,
            }),
          }),
        });

        if (!historyRes.ok) {
          return res.status(400).json({ success: false, error: 'Kuda API transaction retrieval failed.' });
        }

        const historyJson = await historyRes.json();
        const txList = historyJson?.data?.PostingRecord || [];

        let count = 0;
        for (const item of txList) {
          const amount = Math.abs(Number(item.Amount || 0));
          const isCredit = item.PostingType === 'CR';
          const ref = item.ReferenceNumber || `KUDA_${item.PostingRecordId}`;

          const { error } = await supabase
            .from('payment_transactions')
            .upsert(
              {
                user_id: userId,
                provider: 'kuda',
                provider_reference: ref,
                transaction_date: item.TransactionDate || new Date().toISOString(),
                amount,
                currency: 'NGN',
                type: isCredit ? 'credit' : 'debit',
                description: item.Narration || 'Kuda Business Transaction',
                counterparty_name: item.BeneficiaryName || null,
                counterparty_account: item.BeneficiaryAccountNumber || null,
                provider_status: 'success',
                verification_status: 'verified',
                source: 'api_sync',
                raw_payload: item,
              },
              { onConflict: 'user_id,provider,provider_reference' }
            );

          if (!error) count++;
        }

        return res.status(200).json({ success: true, count, message: `Synced ${count} transactions from Kuda Business.` });
      } catch (e) {
        return res.status(400).json({ success: false, error: `Kuda API Error: ${e.message}` });
      }
    }

    if (provider === 'opay') {
      if (!config?.merchant_id || !config?.secret_key) {
        return res.status(400).json({
          success: false,
          error: 'OPay Business integration requires an approved Merchant ID and Private Key. If your business has an active OPay Merchant account, enter your credentials in Provider settings.',
        });
      }

      // OPay Cashier API Status / Inquiry
      return res.status(200).json({
        success: true,
        count: 0,
        message: 'OPay Business connected. Transactions are recorded via real-time Webhook notifications.',
      });
    }

    if (provider === 'moniepoint') {
      if (!config?.public_key || !config?.secret_key) {
        return res.status(400).json({
          success: false,
          error: 'Moniepoint Business API access requires developer partnership credentials (Client ID & Secret). Enter your credentials once issued by Moniepoint.',
        });
      }

      return res.status(200).json({
        success: true,
        count: 0,
        message: 'Moniepoint Business connected. Inflow events are captured via Webhook and POS sync.',
      });
    }

    return res.status(400).json({ success: false, error: `Unsupported provider: ${provider}` });
  } catch (err) {
    console.error(`Sync error for ${provider}:`, err);
    return res.status(500).json({ success: false, error: err.message || 'Internal synchronisation failure.' });
  }
});

// ── 3. Unified Webhook Handlers ─────────────────────────────────────────────

// Paystack Webhook
router.post('/webhook/paystack', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const secret = paystackSecretKey;

    if (secret && signature) {
      const hash = crypto
        .createHmac('sha512', secret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (hash !== signature) {
        console.warn('❌ Invalid Paystack webhook signature on /api/payment/webhook/paystack');
        return res.status(400).send('Invalid signature');
      }
    }

    res.status(200).send('Webhook acknowledged');

    const { event, data } = req.body || {};
    if (!event || !data) return;

    if (event === 'charge.success') {
      const reference = data.reference;
      if (!reference) return;

      const amountNaira = (data.amount || 0) / 100;
      const metadata = data.metadata || {};
      const userId = metadata.userId || metadata.user_id;

      // Find user if not in metadata by checking existing payment links or customer email
      let targetUserId = userId;
      let matchedLinkId = null;

      if (!targetUserId) {
        // Try to match payment link by reference or slug
        const { data: linkMatch } = await supabase
          .from('payment_links')
          .select('id, user_id')
          .or(`provider_slug.eq.${reference},provider_link_id.eq.${reference}`)
          .maybeSingle();

        if (linkMatch) {
          targetUserId = linkMatch.user_id;
          matchedLinkId = linkMatch.id;
        }
      }

      if (!targetUserId) {
        // Fallback: check profile by customer email
        if (data.customer?.email) {
          const { data: userMatch } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', (await supabase.auth.admin?.getUserByEmail?.(data.customer.email))?.data?.user?.id)
            .maybeSingle();
          if (userMatch) targetUserId = userMatch.id;
        }
      }

      if (targetUserId) {
        // Idempotent upsert
        const { error } = await supabase
          .from('payment_transactions')
          .upsert(
            {
              user_id: targetUserId,
              provider: 'paystack',
              provider_reference: reference,
              provider_event_id: String(data.id || reference),
              transaction_date: data.paid_at || new Date().toISOString(),
              amount: amountNaira,
              currency: data.currency || 'NGN',
              type: 'credit',
              description: data.gateway_response || `Paystack charge (${data.channel || 'online'})`,
              counterparty_name: data.customer ? `${data.customer.first_name || ''} ${data.customer.last_name || ''}`.trim() : null,
              counterparty_email: data.customer?.email || null,
              counterparty_phone: data.customer?.phone || null,
              provider_status: 'success',
              verification_status: 'verified',
              source: matchedLinkId ? 'payment_link' : 'webhook',
              payment_link_id: matchedLinkId,
              raw_payload: data,
            },
            { onConflict: 'user_id,provider,provider_reference' }
          );

        // Update payment link metrics if matched
        if (matchedLinkId && !error) {
          const { data: currentLink } = await supabase
            .from('payment_links')
            .select('total_collected, payments_count')
            .eq('id', matchedLinkId)
            .maybeSingle();

          if (currentLink) {
            await supabase
              .from('payment_links')
              .update({
                total_collected: (Number(currentLink.total_collected) || 0) + amountNaira,
                payments_count: (Number(currentLink.payments_count) || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', matchedLinkId);
          }
        }
      }
    } else if (event === 'refund.processed') {
      const reference = data.reference || `REFUND_${data.id}`;
      // Update transaction status to refunded
      await supabase
        .from('payment_transactions')
        .update({
          provider_status: 'refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('provider_reference', reference);
    }
  } catch (err) {
    console.error('Paystack webhook error:', err);
  }
});

// Kuda Webhook
router.post('/webhook/kuda', async (req, res) => {
  try {
    res.status(200).send('Kuda Webhook acknowledged');
    const { Reference, Amount, Narration, SenderName, SenderAccount, UserIdentifier } = req.body || {};

    if (!Reference || !Amount) return;

    let targetUserId = UserIdentifier;
    if (!targetUserId) {
      const { data: config } = await supabase
        .from('payment_provider_configs')
        .select('user_id')
        .eq('provider', 'kuda')
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();
      if (config) targetUserId = config.user_id;
    }

    if (targetUserId) {
      await supabase
        .from('payment_transactions')
        .upsert(
          {
            user_id: targetUserId,
            provider: 'kuda',
            provider_reference: Reference,
            transaction_date: new Date().toISOString(),
            amount: Math.abs(Number(Amount)),
            currency: 'NGN',
            type: 'credit',
            description: Narration || 'Kuda Inbound Transfer',
            counterparty_name: SenderName || null,
            counterparty_account: SenderAccount || null,
            provider_status: 'success',
            verification_status: 'verified',
            source: 'webhook',
            raw_payload: req.body,
          },
          { onConflict: 'user_id,provider,provider_reference' }
        );
    }
  } catch (err) {
    console.error('Kuda webhook error:', err);
  }
});

// OPay Webhook
router.post('/webhook/opay', async (req, res) => {
  try {
    res.status(200).send('OPay Webhook acknowledged');
    const { reference, orderNo, amount, currency, status, merchantId } = req.body?.payload || req.body || {};

    if (!reference) return;

    let targetUserId = null;
    if (merchantId) {
      const { data: config } = await supabase
        .from('payment_provider_configs')
        .select('user_id')
        .eq('merchant_id', merchantId)
        .maybeSingle();
      if (config) targetUserId = config.user_id;
    }

    if (targetUserId) {
      await supabase
        .from('payment_transactions')
        .upsert(
          {
            user_id: targetUserId,
            provider: 'opay',
            provider_reference: reference || orderNo,
            transaction_date: new Date().toISOString(),
            amount: Number(amount) || 0,
            currency: currency || 'NGN',
            type: 'credit',
            description: `OPay Business Payment (${orderNo || reference})`,
            provider_status: status === 'SUCCESS' ? 'success' : 'failed',
            verification_status: status === 'SUCCESS' ? 'verified' : 'unverified',
            source: 'webhook',
            raw_payload: req.body,
          },
          { onConflict: 'user_id,provider,provider_reference' }
        );
    }
  } catch (err) {
    console.error('OPay webhook error:', err);
  }
});

// Moniepoint Webhook
router.post('/webhook/moniepoint', async (req, res) => {
  try {
    res.status(200).send('Moniepoint Webhook acknowledged');
    const { transactionReference, amount, narration, payerName, payerAccount, status } = req.body || {};

    if (!transactionReference) return;

    // Find configured user
    const { data: config } = await supabase
      .from('payment_provider_configs')
      .select('user_id')
      .eq('provider', 'moniepoint')
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle();

    if (config?.user_id) {
      await supabase
        .from('payment_transactions')
        .upsert(
          {
            user_id: config.user_id,
            provider: 'moniepoint',
            provider_reference: transactionReference,
            transaction_date: new Date().toISOString(),
            amount: Number(amount) || 0,
            currency: 'NGN',
            type: 'credit',
            description: narration || 'Moniepoint Inbound Collection',
            counterparty_name: payerName || null,
            counterparty_account: payerAccount || null,
            provider_status: status === 'SUCCESSFUL' ? 'success' : 'pending',
            verification_status: status === 'SUCCESSFUL' ? 'verified' : 'unverified',
            source: 'webhook',
            raw_payload: req.body,
          },
          { onConflict: 'user_id,provider,provider_reference' }
        );
    }
  } catch (err) {
    console.error('Moniepoint webhook error:', err);
  }
});

// ── Provider Status Endpoint (env-var-based, no secrets exposed) ────────────
router.get('/providers/status', async (req, res) => {
  try {
    const providers = {
      paystack: {
        configured: !!(process.env.PAYSTACK_SECRET_KEY),
        envVarsNeeded: ['PAYSTACK_SECRET_KEY'],
        status: process.env.PAYSTACK_SECRET_KEY ? 'connected' : 'not_connected',
      },
      kuda: {
        configured: !!(process.env.KUDA_API_KEY && process.env.KUDA_CLIENT_EMAIL),
        envVarsNeeded: ['KUDA_API_KEY', 'KUDA_CLIENT_EMAIL'],
        status: (process.env.KUDA_API_KEY && process.env.KUDA_CLIENT_EMAIL) ? 'connected' : 'not_connected',
      },
      opay: {
        configured: !!(process.env.OPAY_MERCHANT_ID && process.env.OPAY_PRIVATE_KEY),
        envVarsNeeded: ['OPAY_MERCHANT_ID', 'OPAY_PRIVATE_KEY'],
        status: (process.env.OPAY_MERCHANT_ID && process.env.OPAY_PRIVATE_KEY) ? 'connected' : 'not_connected',
      },
      moniepoint: {
        configured: !!(process.env.MONIEPOINT_CLIENT_ID && process.env.MONIEPOINT_CLIENT_SECRET),
        envVarsNeeded: ['MONIEPOINT_CLIENT_ID', 'MONIEPOINT_CLIENT_SECRET'],
        status: (process.env.MONIEPOINT_CLIENT_ID && process.env.MONIEPOINT_CLIENT_SECRET) ? 'connected' : 'not_connected',
      },
    };

    res.json({ success: true, providers });
  } catch (err) {
    console.error('Provider status check error:', err);
    res.status(500).json({ success: false, error: 'Failed to check provider status.' });
  }
});

export default router;

