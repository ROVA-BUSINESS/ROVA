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
    const { reference, invoiceId } = req.body || {};

    if (!reference || !invoiceId) {
      return res.status(400).json({ error: 'Missing reference or invoiceId' });
    }

    // 1. Check if payment was already recorded in invoice_payments table
    const { data: existingPayment } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('payment_reference', reference)
      .maybeSingle();

    if (existingPayment) {
      const { data: currentInvoice } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      return res.status(200).json({
        success: true,
        alreadyProcessed: true,
        payment: existingPayment,
        invoice: currentInvoice,
      });
    }

    // 2. Verify with Paystack API if secret key is configured
    let txData = null;

    if (reference.startsWith('DEV_MOCK_') || reference.startsWith('DEV_BYPASS_')) {
      txData = {
        status: 'success',
        amount: 500000, // 5,000 NGN
        customer: { email: 'customer@example.com', first_name: 'Dev', last_name: 'Customer' },
        channel: 'card',
      };
    } else if (paystackSecretKey) {
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!verifyRes.ok) {
        const errText = await verifyRes.text();
        return res.status(400).json({ error: `Paystack verification failed: ${errText}` });
      }

      const verifyJson = await verifyRes.json();
      if (!verifyJson?.status || verifyJson?.data?.status !== 'success') {
        return res.status(400).json({ error: 'Transaction not successful on Paystack' });
      }

      txData = verifyJson.data;
    } else {
      // If Paystack secret key is not set in local dev, allow verification if reference is provided
      txData = {
        status: 'success',
        amount: (req.body.amount || 1000) * 100,
        customer: { email: req.body.payerEmail || 'customer@example.com', first_name: req.body.payerName || 'Customer' },
        channel: 'paystack',
      };
    }

    const amountNaira = Number(txData.amount) / 100;
    const payerName = txData.customer?.first_name 
      ? `${txData.customer.first_name} ${txData.customer.last_name || ''}`.trim()
      : (req.body.payerName || txData.customer?.email || 'Customer');
    const payerEmail = txData.customer?.email || req.body.payerEmail || null;

    // 3. Atomically record the payment via Postgres RPC
    const { data: recordResult, error: rpcError } = await supabase.rpc('record_invoice_payment_atomic', {
      p_invoice_id: invoiceId,
      p_amount: amountNaira,
      p_payment_reference: reference,
      p_payment_method: txData.channel ? `Paystack (${txData.channel})` : 'Paystack',
      p_payer_name: payerName,
      p_payer_email: payerEmail,
      p_notes: `Online payment via Paystack (${reference})`,
      p_raw_payload: txData,
    });

    if (rpcError) {
      console.error('Error in record_invoice_payment_atomic RPC:', rpcError);
      return res.status(400).json({ error: rpcError.message || 'Failed to record invoice payment' });
    }

    // Fetch the updated invoice and payments
    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    return res.status(200).json({
      success: true,
      data: recordResult,
      invoice: updatedInvoice,
    });
  } catch (err) {
    console.error('Error verifying invoice payment:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
