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
      const invoiceId = metadata?.invoice_id || metadata?.invoiceId;
      const amountNaira = Number(amount) / 100;
      const payerName = customer?.first_name ? `${customer.first_name} ${customer.last_name || ''}`.trim() : customer?.email;

      // 1. If linked to an invoice, record the instalment atomically
      if (invoiceId && reference) {
        try {
          await supabase.rpc('record_invoice_payment_atomic', {
            p_invoice_id: invoiceId,
            p_amount: amountNaira,
            p_payment_reference: reference,
            p_payment_method: channel ? `Paystack (${channel})` : 'Paystack',
            p_payer_name: payerName,
            p_payer_email: customer?.email || null,
            p_notes: metadata?.notes || `Online payment via Paystack (${reference})`,
            p_raw_payload: data,
          });
        } catch (invPaymentErr) {
          console.error('Failed to atomically record invoice payment from webhook:', invPaymentErr);
        }
      }

      if (userId && reference) {
        await supabase
          .from('payment_transactions')
          .upsert(
            {
              user_id: userId,
              provider: 'paystack',
              provider_reference: reference,
              amount: amountNaira,
              currency: currency || 'NGN',
              type: 'credit',
              description: metadata?.title || (invoiceId ? `Invoice payment ${reference}` : `Paystack Payment ${reference}`),
              counterparty_name: payerName,
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
                invoice_id: invoiceId || null,
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

