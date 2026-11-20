import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://aooujupyoyyvolztbzjt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvb3VqdXB5b3l5dm9senRiemp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NTc1NjYsImV4cCI6MjEwODIzMzU2Nn0.3dX9lTJU0r6phEFnz8oUVEP6LgLM34kEG420h3OxGzs';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  // GET: Fetch public link details
  if (req.method === 'GET') {
    try {
      const { slug } = req.query;
      if (!slug) {
        return res.status(400).json({ error: 'Missing slug parameter' });
      }

      // Query by slug or ID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
      let query = supabase.from('payment_links').select('*');

      if (isUUID) {
        query = query.or(`id.eq.${slug},provider_slug.eq.${slug}`);
      } else {
        query = query.eq('provider_slug', slug);
      }

      const { data: link, error } = await query.single();

      if (error || !link) {
        return res.status(404).json({ error: 'Payment link not found or inactive.' });
      }

      // Fetch merchant profile name
      let merchantName = 'ROVA Business Merchant';
      if (link.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('business_name, full_name')
          .eq('id', link.user_id)
          .single();
        if (profile) {
          merchantName = profile.business_name || profile.full_name || merchantName;
        }
      }

      return res.status(200).json({
        success: true,
        link: {
          id: link.id,
          title: link.title,
          description: link.description,
          amount: link.amount,
          currency: link.currency || 'NGN',
          allow_custom_amount: link.allow_custom_amount,
          payment_url: link.payment_url,
          status: link.status,
          merchant_name: merchantName,
          metadata: link.metadata || {},
          subaccount_code: link.metadata?.subaccount_code || null,
          settlement_bank: link.metadata?.settlement_bank || null,
          customer_name: link.metadata?.customer_name || null,
          customer_email: link.metadata?.customer_email || null,
          customer_phone: link.metadata?.customer_phone || null,
          expires_at: link.metadata?.expires_at || null,
        },
      });
    } catch (err) {
      console.error('Error fetching public link:', err);
      return res.status(500).json({ error: 'Failed to retrieve payment link.' });
    }
  }

  // POST: Record payment completion from public link
  if (req.method === 'POST') {
    try {
      const { linkId, reference, amount, currency = 'NGN', payerName, payerEmail, payerPhone } = req.body || {};

      if (!linkId || !reference || !amount) {
        return res.status(400).json({ error: 'Missing required payment details' });
      }

      // Fetch the link
      const { data: link, error: linkErr } = await supabase
        .from('payment_links')
        .select('*')
        .eq('id', linkId)
        .single();

      if (linkErr || !link) {
        return res.status(404).json({ error: 'Payment link not found.' });
      }

      const numericAmount = Number(amount);

      // 1. Update link stats
      await supabase
        .from('payment_links')
        .update({
          total_collected: Number(link.total_collected || 0) + numericAmount,
          payments_count: Number(link.payments_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', linkId);

      // 2. Insert into Rova general accounting ledger (transactions table)
      let rovaTxId = null;
      try {
        const { data: rovaTx } = await supabase
          .from('transactions')
          .insert({
            user_id: link.user_id,
            amount: numericAmount,
            type: 'income',
            description: `Payment for "${link.title}" via Payment Link`,
            reference: reference,
            date: new Date().toISOString().split('T')[0],
            notes: `Received from ${payerName || 'Customer'} (${payerEmail || 'no-email'}) via Paystack`,
            is_verified: true,
            ai_category: 'Sales & Revenue',
          })
          .select()
          .maybeSingle();

        if (rovaTx) {
          rovaTxId = rovaTx.id;
        }

        // If this link was associated with an invoice, record the invoice instalment atomically
        if (link.metadata?.invoice_id) {
          try {
            await supabase.rpc('record_invoice_payment_atomic', {
              p_invoice_id: link.metadata.invoice_id,
              p_amount: numericAmount,
              p_payment_reference: reference,
              p_payment_method: 'Paystack (Payment Link)',
              p_payer_name: payerName || link.metadata?.customer_name || 'Customer',
              p_payer_email: payerEmail || link.metadata?.customer_email || null,
              p_notes: `Paid via Banking & Payment link: ${link.title}`,
              p_raw_payload: req.body,
            });
          } catch (rpcErr) {
            console.warn('Could not record invoice payment atomically:', rpcErr);
            const { data: currentInv } = await supabase.from('invoices').select('amount_paid, total').eq('id', link.metadata.invoice_id).maybeSingle();
            const newAmt = (Number(currentInv?.amount_paid) || 0) + numericAmount;
            const newStatus = newAmt >= (Number(currentInv?.total) || 0) ? 'paid' : 'partially_paid';
            await supabase
              .from('invoices')
              .update({
                status: newStatus,
                amount_paid: newAmt,
                updated_at: new Date().toISOString(),
              })
              .eq('id', link.metadata.invoice_id);
          }
        }
      } catch (accErr) {
        console.warn('Accounting ledger record warning:', accErr.message);
      }

      // 3. Insert into payment_transactions
      await supabase.from('payment_transactions').insert({
        user_id: link.user_id,
        provider: link.provider || 'paystack',
        payment_link_id: linkId,
        provider_reference: reference,
        transaction_date: new Date().toISOString(),
        amount: numericAmount,
        currency,
        type: 'credit',
        provider_status: 'success',
        verification_status: 'verified',
        accounting_status: 'classified_income',
        rova_transaction_id: rovaTxId,
        source: 'payment_link',
        description: `Payment for "${link.title}" via Payment Link`,
        counterparty_name: payerName || 'Customer',
        counterparty_email: payerEmail || null,
        counterparty_phone: payerPhone || null,
        metadata: {
          link_id: linkId,
          link_title: link.title,
          reference,
          via: 'rova_public_checkout',
          subaccount_code: link.metadata?.subaccount_code || null,
        },
      });

      return res.status(200).json({ success: true, message: 'Payment recorded successfully' });
    } catch (err) {
      console.error('Error recording public payment:', err);
      return res.status(500).json({ error: 'Failed to record payment' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

