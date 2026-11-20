import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://aooujupyoyyvolztbzjt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, number } = req.query || {};
    if (!id && !number) {
      return res.status(400).json({ error: 'Invoice ID or number is required' });
    }

    let query = supabase.from('invoices').select('*');
    if (id) {
      query = query.eq('id', id);
    } else {
      query = query.eq('invoice_number', number);
    }

    const { data: invoice, error: invError } = await query.maybeSingle();

    if (invError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Fetch invoice items
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('id', { ascending: true });

    // Fetch payments made so far
    const { data: payments } = await supabase
      .from('invoice_payments')
      .select('id, amount, payment_date, payment_method, payment_reference, payer_name, status, notes')
      .eq('invoice_id', invoice.id)
      .in('status', ['verified', 'success'])
      .order('payment_date', { ascending: false });

    // Fetch merchant business profile
    let merchant = null;
    if (invoice.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('business_name, full_name, email, phone, address, logo_url')
        .eq('id', invoice.user_id)
        .maybeSingle();

      merchant = profile;
    }

    // Public sanitized invoice object
    const total = Number(invoice.total || 0);
    const amountPaid = Number(invoice.amount_paid || 0);
    const balanceDue = Math.max(0, total - amountPaid);

    return res.status(200).json({
      success: true,
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        user_id: invoice.user_id,
        client_name: invoice.client_name,
        client_email: invoice.client_email,
        client_phone: invoice.client_phone,
        client_address: invoice.client_address,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        discount: invoice.discount,
        total,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        status: invoice.status,
        currency: invoice.currency || 'NGN',
        notes: invoice.notes,
        payment_terms: invoice.payment_terms,
        allow_partial_payments: invoice.allow_partial_payments,
        partial_payment_type: invoice.partial_payment_type || 'any',
        minimum_partial_amount: invoice.minimum_partial_amount ? Number(invoice.minimum_partial_amount) : null,
        fixed_deposit_amount: invoice.fixed_deposit_amount ? Number(invoice.fixed_deposit_amount) : null,
      },
      items: items || [],
      payments: payments || [],
      merchant: merchant || {
        business_name: 'ROVA Merchant',
        full_name: '',
        email: '',
        phone: '',
      },
    });
  } catch (err) {
    console.error('Error fetching public invoice:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
