import crypto from 'crypto';
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
    const signature = req.headers['x-paystack-signature'];
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    if (paystackSecretKey && signature) {
      const hash = crypto
        .createHmac('sha512', paystackSecretKey)
        .update(rawBody)
        .digest('hex');

      if (hash !== signature) {
        console.warn('Invalid Paystack webhook signature rejected');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { event: eventType, data } = event;

    if (eventType === 'charge.success' && data) {
      const {
        reference,
        amount,
        currency,
        customer,
        metadata,
        paid_at,
        channel,
      } = data;

      const userId = metadata?.userId || metadata?.user_id;

      if (userId && reference) {
        await supabase
          .from('payment_transactions')
          .upsert(
            {
              user_id: userId,
              provider: 'paystack',
              provider_reference: reference,
              amount: Number(amount) / 100,
              currency: currency || 'NGN',
              type: 'credit',
              description: metadata?.title || `Paystack Payment ${reference}`,
              counterparty_name: customer?.first_name ? `${customer.first_name} ${customer.last_name || ''}`.trim() : customer?.email,
              counterparty_email: customer?.email || null,
              provider_status: 'success',
              verification_status: 'verified',
              source: 'webhook',
              channel: channel || null,
              metadata: {
                paystack_id: data.id,
                gateway_response: data.gateway_response,
                fees: data.fees ? Number(data.fees) / 100 : 0,
                paid_at,
              },
              transacted_at: paid_at || new Date().toISOString(),
            },
            { onConflict: 'user_id,provider,provider_reference' }
          );
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Paystack webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
