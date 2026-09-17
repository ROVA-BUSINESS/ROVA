import { supabase, type Receipt, type Profile } from './supabase';
import { formatCurrency, formatDate } from './format';

export type CreateReceiptInput = {
  userId: string;
  transaction_id?: string | null;
  customer_id?: string | null;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  payment_method: string;
  payment_reference?: string;
  description?: string;
  receipt_date?: string;
  created_by?: string;
  items: Array<{
    product_id?: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    discount?: number;
  }>;
};

/**
  Generate next sequential receipt number per user (e.g. RCPT-000001)
*/
export async function getNextReceiptNumber(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('generate_next_receipt_number', {
      target_user_id: userId,
    });
    if (!error && data) return data as string;
  } catch (e) {
    console.warn('RPC generate_next_receipt_number fallback:', e);
  }

  // Fallback if RPC function is not yet created in live schema
  const { data: latest } = await supabase
    .from('receipts')
    .select('receipt_number')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest && latest.receipt_number) {
    const match = latest.receipt_number.match(/RCPT-(\d+)/i);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `RCPT-${String(nextNum).padStart(6, '0')}`;
    }
  }

  return 'RCPT-000001';
}

/**
 * Check if a receipt already exists for an existing transaction ID
 */
export async function checkExistingReceiptForTransaction(userId: string, transactionId: string): Promise<Receipt | null> {
  if (!transactionId) return null;
  const { data } = await supabase
    .from('receipts')
    .select('*, items:receipt_items(*)')
    .eq('user_id', userId)
    .eq('transaction_id', transactionId)
    .neq('status', 'cancelled')
    .maybeSingle();

  return (data as Receipt) || null;
}

/**
 * Create a new payment receipt with line items
 */
export async function createReceipt(input: CreateReceiptInput): Promise<Receipt> {
  const {
    userId,
    transaction_id = null,
    customer_id = null,
    customer_name,
    customer_phone = '',
    customer_email = '',
    payment_method = 'Bank Transfer',
    payment_reference = '',
    description = '',
    receipt_date = new Date().toISOString().split('T')[0],
    created_by = 'Admin',
    items = [],
  } = input;

  if (!customer_name || !customer_name.trim()) {
    throw new Error('Customer name is required to create a receipt');
  }

  if (!items || items.length === 0) {
    throw new Error('At least one item is required on a receipt');
  }

  // Generate unique verification code
  const verification_code = `ROVA-RCPT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

  // Server-side sequential receipt number
  const receipt_number = await getNextReceiptNumber(userId);

  // Calculate totals deterministically
  let subtotal = 0;
  let totalDiscount = 0;

  const preparedItems = items.map((item) => {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unit_price) || 0;
    const itemDiscount = Number(item.discount) || 0;
    const lineTotal = qty * price - itemDiscount;

    subtotal += qty * price;
    totalDiscount += itemDiscount;

    return {
      product_id: item.product_id || null,
      description: item.description || 'Payment item',
      quantity: qty,
      unit_price: price,
      discount: itemDiscount,
      total: Math.max(0, lineTotal),
    };
  });

  const total = Math.max(0, subtotal - totalDiscount);

  // 1. Insert receipt header record
  const { data: receiptRecord, error: receiptErr } = await supabase
    .from('receipts')
    .insert({
      user_id: userId,
      transaction_id,
      customer_id,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      customer_email: customer_email.trim(),
      receipt_number,
      amount: total,
      currency: 'NGN',
      payment_method,
      payment_reference: payment_reference.trim(),
      description: description.trim(),
      receipt_date,
      subtotal,
      discount: totalDiscount,
      total,
      status: 'generated',
      verification_code,
      created_by,
    })
    .select()
    .single();

  if (receiptErr) {
    console.error('Failed to insert receipt:', receiptErr);
    throw new Error(`Receipt creation failed: ${receiptErr.message}`);
  }

  // 2. Insert line items
  const itemRows = preparedItems.map((item) => ({
    receipt_id: receiptRecord.id,
    ...item,
  }));

  const { data: insertedItems, error: itemsErr } = await supabase
    .from('receipt_items')
    .insert(itemRows)
    .select();

  if (itemsErr) {
    console.error('Failed to insert receipt items:', itemsErr);
  }

  return {
    ...receiptRecord,
    items: insertedItems || [],
  };
}

/**
 * Fetch receipts for a user/business with optional filtering
 */
export async function getReceipts(
  userId: string,
  options?: {
    search?: string;
    payment_method?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<Receipt[]> {
  let query = supabase
    .from('receipts')
    .select('*, items:receipt_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options?.payment_method && options.payment_method !== 'all') {
    query = query.eq('payment_method', options.payment_method);
  }

  if (options?.status && options.status !== 'all') {
    query = query.eq('status', options.status);
  }

  if (options?.startDate) {
    query = query.gte('receipt_date', options.startDate);
  }

  if (options?.endDate) {
    query = query.lte('receipt_date', options.endDate);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to fetch receipts:', error);
    return [];
  }

  let receipts = (data as Receipt[]) || [];

  if (options?.search && options.search.trim()) {
    const q = options.search.trim().toLowerCase();
    receipts = receipts.filter(
      (r) =>
        r.receipt_number?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q) ||
        r.customer_phone?.toLowerCase().includes(q) ||
        r.payment_reference?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );
  }

  return receipts;
}

/**
 * Cancel a receipt (preserving financial audit history)
 */
export async function cancelReceipt(receiptId: string): Promise<boolean> {
  const { error } = await supabase
    .from('receipts')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', receiptId);

  return !error;
}

/**
 * Printable & Mobile PDF Generator for Receipts
 */
export function downloadReceiptPDF(receipt: Receipt, profile?: Profile | null) {
  const businessName = profile?.business_name || profile?.full_name || 'ROVA Business';
  const businessPhone = profile?.phone || '';
  const items = receipt.items || [];

  const itemRows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;font-weight:500;color:#111827;">${item.description}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#4b5563;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#4b5563;">${formatCurrency(item.unit_price)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#111827;">${formatCurrency(item.total)}</td>
    </tr>
  `
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${receipt.receipt_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; background: #fff; font-size: 13px; line-height: 1.5; }
    .page { max-width: 700px; margin: 0 auto; padding: 40px; }
    .top-bar { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .brand-title { font-size: 24px; font-weight: 800; color: #7c3aed; letter-spacing: -0.5px; }
    .brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
    .badge { display: inline-block; padding: 4px 12px; background: #22c55e18; color: #16a34a; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .receipt-title-box { text-align: center; margin: 20px 0 28px; padding: 12px; background: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6; }
    .receipt-title { font-size: 16px; font-weight: 800; letter-spacing: 1px; color: #111827; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; font-size: 12px; }
    .info-card { padding: 12px; background: #fafafa; border-radius: 6px; border: 1px solid #f3f4f6; }
    .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px; }
    .info-val { font-size: 13px; font-weight: 600; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f9fafb; padding: 10px 12px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    .totals { margin-left: auto; width: 260px; font-size: 13px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; color: #6b7280; }
    .totals-row.grand { font-size: 16px; font-weight: 800; color: #111827; border-top: 2px solid #e5e7eb; padding-top: 8px; margin-top: 4px; }
    .totals-row.grand span:last-child { color: #7c3aed; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 16px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="top-bar">
      <div>
        <div class="brand-title">${businessName}</div>
        ${businessPhone ? `<div class="brand-sub">Tel: ${businessPhone}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <span class="badge">Payment Received</span>
        <div style="font-size:12px;color:#6b7280;margin-top:6px;">No: <strong>${receipt.receipt_number}</strong></div>
      </div>
    </div>

    <div class="receipt-title-box">
      <div class="receipt-title">OFFICIAL PAYMENT RECEIPT</div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <div class="info-label">Received From (Customer)</div>
        <div class="info-val">${receipt.customer_name}</div>
        ${receipt.customer_phone ? `<div style="color:#6b7280;margin-top:2px;">${receipt.customer_phone}</div>` : ''}
        ${receipt.customer_email ? `<div style="color:#6b7280;">${receipt.customer_email}</div>` : ''}
      </div>
      <div class="info-card">
        <div class="info-label">Payment Details</div>
        <div>Date: <strong>${formatDate(receipt.receipt_date)}</strong></div>
        <div>Method: <strong>${receipt.payment_method}</strong></div>
        ${receipt.payment_reference ? `<div>Ref: <strong>${receipt.payment_reference}</strong></div>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:50%;">Item / Description</th>
          <th style="text-align:right;">Qty</th>
          <th style="text-align:right;">Unit Price</th>
          <th style="text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || `<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:16px;">Payment</td></tr>`}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(receipt.subtotal || receipt.amount)}</span></div>
      ${receipt.discount > 0 ? `<div class="totals-row" style="color:#16a34a"><span>Discount</span><span>-${formatCurrency(receipt.discount)}</span></div>` : ''}
      <div class="totals-row grand"><span>TOTAL PAID</span><span>${formatCurrency(receipt.total || receipt.amount)}</span></div>
    </div>

    <div class="footer">
      <p style="font-weight:600;color:#374151;margin-bottom:4px;">Thank you for your business!</p>
      <p>Verified Payment Record · Generated via ROVA Financial Operating System</p>
      ${receipt.verification_code ? `<p style="font-size:9px;color:#cbd5e1;margin-top:4px;">Code: ${receipt.verification_code}</p>` : ''}
    </div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}

/**
 * Generate mobile-friendly canvas receipt image data URL
 */
export async function generateReceiptImageDataUrl(receipt: Receipt, profile?: Profile | null): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = 600;

  const items = receipt.items || [];
  const baseHeight = 440 + items.length * 36;
  canvas.height = baseHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const businessName = profile?.business_name || profile?.full_name || 'ROVA Business';

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header banner
  ctx.fillStyle = '#7c3aed';
  ctx.fillRect(0, 0, canvas.width, 90);

  // Header text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(businessName, 24, 42);

  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#e9d5ff';
  ctx.fillText('PAYMENT RECEIPT', 24, 68);

  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(receipt.receipt_number, canvas.width - 24, 52);
  ctx.textAlign = 'left';

  // Customer Card Box
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(24, 110, canvas.width - 48, 80, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('RECEIVED FROM', 40, 132);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(receipt.customer_name, 40, 154);

  ctx.fillStyle = '#64748b';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Date: ${formatDate(receipt.receipt_date)} | Method: ${receipt.payment_method}`, 40, 174);

  // Items Table Header
  let y = 215;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(24, y, canvas.width - 48, 28);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('ITEM', 36, y + 18);
  ctx.textAlign = 'right';
  ctx.fillText('QTY', 360, y + 18);
  ctx.fillText('PRICE', 460, y + 18);
  ctx.fillText('TOTAL', canvas.width - 36, y + 18);
  ctx.textAlign = 'left';

  // Items Rows
  y += 36;
  ctx.font = '13px sans-serif';
  items.forEach((item) => {
    ctx.fillStyle = '#1e293b';
    ctx.fillText(item.description.length > 28 ? item.description.substring(0, 25) + '...' : item.description, 36, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.fillText(String(item.quantity), 360, y);
    ctx.fillText(formatCurrency(item.unit_price), 460, y);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(formatCurrency(item.total), canvas.width - 36, y);
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';

    ctx.strokeStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(24, y + 10);
    ctx.lineTo(canvas.width - 24, y + 10);
    ctx.stroke();

    y += 34;
  });

  // Totals Section
  y += 10;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(24, y, canvas.width - 48, 70);

  ctx.fillStyle = '#64748b';
  ctx.font = '12px sans-serif';
  ctx.fillText('Subtotal:', 300, y + 25);
  ctx.textAlign = 'right';
  ctx.fillText(formatCurrency(receipt.subtotal || receipt.amount), canvas.width - 40, y + 25);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('TOTAL PAID:', 300, y + 54);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7c3aed';
  ctx.fillText(formatCurrency(receipt.total || receipt.amount), canvas.width - 40, y + 54);
  ctx.textAlign = 'left';

  // Footer
  y += 95;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Thank you for your business!', canvas.width / 2, y);
  ctx.fillText('Generated by ROVA · www.rovabusiness.com', canvas.width / 2, y + 18);

  return canvas.toDataURL('image/png');
}
