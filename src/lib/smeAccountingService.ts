import { supabase, type Invoice } from './supabase';
import { formatCurrency, formatDate } from './format';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CustomerRecord {
  id: string;
  user_id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  payment_terms_days?: number;
  notes?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface CreditNoteItemInput {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface CreditNoteRecord {
  id: string;
  user_id: string;
  credit_note_number: string;
  invoice_id?: string | null;
  customer_id?: string | null;
  customer_name: string;
  customer_email?: string;
  issue_date: string;
  reason?: string;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  status: 'draft' | 'issued' | 'applied' | 'refunded' | 'void';
  refund_recorded?: boolean;
  refund_date?: string | null;
  refund_method?: string;
  refund_account_id?: string | null;
  refund_transaction_id?: string | null;
  journal_entry_id?: string | null;
  notes?: string;
  created_at?: string;
  items?: (CreditNoteItemInput & { id?: string; amount: number })[];
}

export interface RecurringScheduleRecord {
  id: string;
  user_id: string;
  entity_type: 'invoice' | 'bill';
  title: string;
  customer_id?: string | null;
  customer_name?: string;
  customer_email?: string;
  vendor_name?: string;
  category_id?: string | null;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  next_run_date: string;
  end_date?: string | null;
  auto_send: boolean;
  default_status: 'draft' | 'sent' | 'unpaid';
  currency: string;
  subtotal: number;
  vat_rate: number;
  total: number;
  items_json: { description: string; quantity: number; unit_price: number }[];
  notes?: string;
  is_active: boolean;
  last_run_at?: string | null;
  runs_count: number;
  created_at?: string;
}

export interface InvoiceReminderRuleRecord {
  id?: string;
  user_id: string;
  enabled: boolean;
  days_before_due: number[];
  remind_on_due_date: boolean;
  days_after_due: number[];
  channel_email: boolean;
  channel_whatsapp: boolean;
  channel_in_app: boolean;
  custom_message: string;
}

export interface ReminderLogRecord {
  id: string;
  user_id: string;
  invoice_id: string;
  rule_key: string;
  channel: string;
  recipient: string;
  status: 'sent' | 'failed' | 'skipped';
  error_message?: string;
  sent_at: string;
}

export interface OperationalFixedAsset {
  id: string;
  user_id: string;
  asset_code: string;
  asset_name?: string;
  description: string;
  asset_class:
    | 'Leasehold Land & Buildings'
    | 'Plant & Heavy Machinery'
    | 'Commercial Motor Vehicles'
    | 'Office Furniture & Equipment'
    | 'Computer & IT Infrastructure';
  date_acquired: string;
  historical_cost: number;
  salvage_value?: number;
  useful_life_months?: number;
  depreciation_method?: 'straight_line' | 'reducing_balance';
  annual_rate_pct?: number;
  prior_accum_depr?: number;
  accumulated_depreciation?: number;
  last_depreciation_date?: string | null;
  status: 'Active' | 'Disposed';
  disposal_date?: string | null;
  disposal_proceeds?: number | null;
  disposal_gain_loss?: number | null;
}

export interface DepreciationRunRecord {
  id: string;
  user_id: string;
  fixed_asset_id: string;
  period_month: string;
  depreciation_date: string;
  depreciation_amount: number;
  accumulated_after: number;
  net_book_value_after: number;
  journal_entry_id?: string | null;
  created_at?: string;
}

// ── 1. Period Locking Helpers ────────────────────────────────────────────────

export function isDateLocked(dateStr: string | null | undefined, lockDate: string | null | undefined): boolean {
  if (!dateStr || !lockDate) return false;
  return dateStr.slice(0, 10) <= lockDate.slice(0, 10);
}

export function getLockErrorMessage(dateStr: string, lockDate: string): string {
  return `Accounting period is locked through ${formatDate(lockDate)}. You cannot create, edit, or delete entries dated ${formatDate(dateStr)}.`;
}

export async function getAccountingLockDate(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('accounting_lock_date')
    .eq('id', userId)
    .maybeSingle();
  return (data as any)?.accounting_lock_date || null;
}

export async function setAccountingLockDate(userId: string, actorId: string, lockDate: string | null) {
  const { error } = await supabase
    .from('profiles')
    .update({
      accounting_lock_date: lockDate || null,
      accounting_lock_updated_by: actorId,
      accounting_lock_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw error;

  await logActivity(
    userId,
    actorId,
    'updated',
    'accounting_period_lock',
    userId,
    lockDate ? `Locked accounting period through ${lockDate}` : 'Cleared accounting period lock date',
    { accounting_lock_date: lockDate }
  );
}

// ── Activity Log Helper ──────────────────────────────────────────────────────

export async function logActivity(
  ownerId: string,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  entityLabel: string,
  metadata?: Record<string, any>
) {
  try {
    await supabase.from('activity_logs').insert({
      owner_id: ownerId,
      user_id: actorId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_label: entityLabel,
      metadata: metadata || {},
    });
  } catch (err) {
    console.warn('[ActivityLog] Non-fatal log error:', err);
  }
}

// ── Balanced Journal Entry Helper (flows into GL, Trial Balance, P&L, BS) ────

export async function postBalancedJournalEntry(params: {
  userId: string;
  date: string;
  description: string;
  reference: string;
  source?: 'manual' | 'transaction' | 'invoice' | 'auto';
  lines: { account_name: string; description: string; debit: number; credit: number }[];
}): Promise<string | null> {
  const totalDr = Math.round(params.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100;
  const totalCr = Math.round(params.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100;
  if (totalDr <= 0 || Math.abs(totalDr - totalCr) > 0.02) {
    throw new Error(`Unbalanced journal entry: Debits (${totalDr}) must equal Credits (${totalCr}).`);
  }

  const entryNumber = `JE-${Date.now().toString().slice(-6)}`;
  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .insert({
      user_id: params.userId,
      entry_number: entryNumber,
      date: params.date,
      description: params.description,
      reference: params.reference,
      source: params.source || 'auto',
      is_posted: true,
    })
    .select('id')
    .single();

  if (jeErr || !je) throw jeErr || new Error('Failed to insert journal entry');

  const { error: linesErr } = await supabase.from('journal_entry_lines').insert(
    params.lines
      .filter((l) => l.debit > 0 || l.credit > 0)
      .map((l) => ({
        journal_entry_id: je.id,
        account_name: l.account_name,
        description: l.description,
        debit: Math.round(l.debit * 100) / 100,
        credit: Math.round(l.credit * 100) / 100,
      }))
  );

  if (linesErr) throw linesErr;
  return je.id;
}

// ── 2. Statement of Account Builder & Printable PDF Generator ────────────────

export interface StatementLine {
  date: string;
  type: 'Invoice' | 'Payment' | 'Credit Note';
  reference: string;
  description: string;
  debit: number; // increases customer balance
  credit: number; // decreases customer balance
  runningBalance: number;
}

export function buildCustomerStatement(params: {
  invoices: Invoice[];
  payments: { id: string; invoice_id: string; payment_date: string; amount: number; reference?: string; payment_method?: string }[];
  creditNotes: CreditNoteRecord[];
  startDate: string;
  endDate: string;
}): {
  openingBalance: number;
  lines: StatementLine[];
  totalBilled: number;
  totalPaid: number;
  totalCredited: number;
  closingBalance: number;
} {
  const { invoices, payments, creditNotes, startDate, endDate } = params;
  const rawEvents: Omit<StatementLine, 'runningBalance'>[] = [];

  for (const inv of invoices) {
    if (inv.status === 'cancelled') continue;
    rawEvents.push({
      date: inv.issue_date,
      type: 'Invoice',
      reference: inv.invoice_number,
      description: `Invoice ${inv.invoice_number}${inv.due_date ? ` (Due ${formatDate(inv.due_date)})` : ''}`,
      debit: Number(inv.total) || 0,
      credit: 0,
    });
  }

  for (const pay of payments) {
    rawEvents.push({
      date: pay.payment_date,
      type: 'Payment',
      reference: pay.reference || 'PMT',
      description: `Payment received (${pay.payment_method || 'Bank Transfer'})`,
      debit: 0,
      credit: Number(pay.amount) || 0,
    });
  }

  for (const cn of creditNotes) {
    if (cn.status === 'void' || cn.status === 'draft') continue;
    rawEvents.push({
      date: cn.issue_date,
      type: 'Credit Note',
      reference: cn.credit_note_number,
      description: `Credit Note ${cn.credit_note_number}${cn.reason ? ` — ${cn.reason}` : ''}`,
      debit: 0,
      credit: Number(cn.total) || 0,
    });
  }

  rawEvents.sort((a, b) => a.date.localeCompare(b.date));

  let openingBalance = 0;
  const periodEvents: Omit<StatementLine, 'runningBalance'>[] = [];

  for (const ev of rawEvents) {
    if (ev.date < startDate) {
      openingBalance += ev.debit - ev.credit;
    } else if (ev.date <= endDate) {
      periodEvents.push(ev);
    }
  }

  let running = openingBalance;
  const lines: StatementLine[] = periodEvents.map((ev) => {
    running = Math.round((running + ev.debit - ev.credit) * 100) / 100;
    return { ...ev, runningBalance: running };
  });

  const totalBilled = lines.filter((l) => l.type === 'Invoice').reduce((s, l) => s + l.debit, 0);
  const totalPaid = lines.filter((l) => l.type === 'Payment').reduce((s, l) => s + l.credit, 0);
  const totalCredited = lines.filter((l) => l.type === 'Credit Note').reduce((s, l) => s + l.credit, 0);

  return {
    openingBalance: Math.round(openingBalance * 100) / 100,
    lines,
    totalBilled: Math.round(totalBilled * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalCredited: Math.round(totalCredited * 100) / 100,
    closingBalance: Math.round(running * 100) / 100,
  };
}

export function openPrintableStatement(params: {
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  customer: CustomerRecord;
  startDate: string;
  endDate: string;
  statement: ReturnType<typeof buildCustomerStatement>;
}) {
  const { businessName, businessAddress, businessPhone, customer, startDate, endDate, statement } = params;
  const rowsHtml = statement.lines
    .map(
      (l) => `
      <tr>
        <td>${formatDate(l.date)}</td>
        <td><strong>${l.type}</strong></td>
        <td>${l.reference}</td>
        <td>${l.description}</td>
        <td style="text-align:right">${l.debit > 0 ? formatCurrency(l.debit) : '—'}</td>
        <td style="text-align:right;color:#059669">${l.credit > 0 ? formatCurrency(l.credit) : '—'}</td>
        <td style="text-align:right;font-weight:700">${formatCurrency(l.runningBalance)}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Statement of Account — ${customer.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; margin: 0; padding: 32px; background: #fff; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #662D91; padding-bottom: 18px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 800; color: #662D91; margin: 0; }
    .meta { font-size: 12px; color: #475569; margin-top: 4px; line-height: 1.5; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .box { padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
    .box-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .box-val { font-size: 17px; font-weight: 800; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    th { background: #f1f5f9; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    .footer { margin-top: 28px; font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { padding: 12px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px;text-align:right">
    <button onclick="window.print()" style="padding:8px 18px;background:#662D91;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer">Print / Save as PDF</button>
  </div>
  <div class="header">
    <div>
      <h1 class="title">${businessName}</h1>
      <div class="meta">${businessAddress || ''}${businessPhone ? ` · ${businessPhone}` : ''}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:800">STATEMENT OF ACCOUNT</div>
      <div class="meta">Period: ${formatDate(startDate)} — ${formatDate(endDate)}</div>
      <div class="meta">Generated: ${formatDate(new Date().toISOString().slice(0, 10))}</div>
    </div>
  </div>
  <div style="margin-bottom:20px;font-size:13px">
    <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700">Customer</div>
    <div style="font-size:16px;font-weight:700;margin-top:2px">${customer.name}${customer.company_name ? ` (${customer.company_name})` : ''}</div>
    <div style="color:#475569">${[customer.email, customer.phone, customer.address].filter(Boolean).join(' · ')}</div>
  </div>
  <div class="summary">
    <div class="box"><div class="box-label">Opening Balance</div><div class="box-val">${formatCurrency(statement.openingBalance)}</div></div>
    <div class="box"><div class="box-label">Total Billed</div><div class="box-val">${formatCurrency(statement.totalBilled)}</div></div>
    <div class="box"><div class="box-label">Paid &amp; Credited</div><div class="box-val" style="color:#059669">${formatCurrency(statement.totalPaid + statement.totalCredited)}</div></div>
    <div class="box"><div class="box-label">Balance Due</div><div class="box-val" style="color:${statement.closingBalance > 0 ? '#dc2626' : '#059669'}">${formatCurrency(statement.closingBalance)}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Type</th><th>Reference</th><th>Description</th>
        <th style="text-align:right">Charges</th><th style="text-align:right">Credits</th><th style="text-align:right">Balance</th>
      </tr>
    </thead>
    <tbody>
      <tr style="background:#f8fafc">
        <td>${formatDate(startDate)}</td><td>Opening</td><td>—</td><td>Opening Balance Brought Forward</td>
        <td style="text-align:right">—</td><td style="text-align:right">—</td>
        <td style="text-align:right;font-weight:700">${formatCurrency(statement.openingBalance)}</td>
      </tr>
      ${rowsHtml || '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:20px">No activity during selected period.</td></tr>'}
    </tbody>
  </table>
  <div class="footer">Generated by ROVA Business Accounting · www.rovabusiness.com</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

// ── 3. Issue Sales Credit Note & Optional Cash Refund ────────────────────────

export async function issueSalesCreditNote(params: {
  userId: string;
  actorId: string;
  invoice?: Invoice | null;
  customerId?: string | null;
  customerName: string;
  customerEmail?: string;
  issueDate: string;
  reason: string;
  vatRate: number;
  items: CreditNoteItemInput[];
  recordRefund: boolean;
  refundMethod?: string;
  refundAccountId?: string;
  notes?: string;
}): Promise<CreditNoteRecord> {
  const lockDate = await getAccountingLockDate(params.userId);
  if (isDateLocked(params.issueDate, lockDate)) {
    throw new Error(getLockErrorMessage(params.issueDate, lockDate!));
  }

  const subtotal = Math.round(params.items.reduce((s, i) => s + i.quantity * i.unit_price, 0) * 100) / 100;
  const vatAmount = Math.round(subtotal * ((params.vatRate || 0) / 100) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;
  if (total <= 0) throw new Error('Credit note total must be greater than 0.');

  const cnNumber = `CN-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

  // 1. Post double-entry Journal Entry: Dr Revenue (+ Dr Output VAT) / Cr Trade Receivables
  const jeLines: { account_name: string; description: string; debit: number; credit: number }[] = [
    {
      account_name: '4010 Revenue - Sale of Goods & Supply Contracts',
      description: `Credit Note ${cnNumber} — ${params.customerName} (${params.reason})`,
      debit: subtotal,
      credit: 0,
    },
  ];
  if (vatAmount > 0) {
    jeLines.push({
      account_name: '2040 Value Added Tax (VAT) Output Payable',
      description: `VAT reversal on Credit Note ${cnNumber}`,
      debit: vatAmount,
      credit: 0,
    });
  }
  jeLines.push({
    account_name: '1110 Trade Accounts Receivable',
    description: `Reduce AR for Credit Note ${cnNumber}`,
    debit: 0,
    credit: total,
  });

  // If cash/bank refund recorded simultaneously, also post Dr AR / Cr Bank/Cash
  let refundTxId: string | null = null;
  if (params.recordRefund) {
    const { data: refundTx, error: txErr } = await supabase
      .from('transactions')
      .insert({
        user_id: params.userId,
        type: 'expense',
        amount: total,
        description: `Customer Refund — ${cnNumber} (${params.customerName})`,
        date: params.issueDate,
        account_id: params.refundAccountId || null,
        reference: cnNumber,
        notes: `Refund via ${params.refundMethod || 'Bank Transfer'} | Credit Note ${cnNumber}`,
      })
      .select('id')
      .single();
    if (txErr) throw txErr;
    refundTxId = refundTx?.id || null;

    jeLines.push(
      {
        account_name: '1110 Trade Accounts Receivable',
        description: `Clear AR refund on ${cnNumber}`,
        debit: total,
        credit: 0,
      },
      {
        account_name: params.refundMethod === 'Cash' ? '1010 Cash on Hand' : '1020 Zenith Bank Current Account',
        description: `Refund paid to ${params.customerName} (${cnNumber})`,
        debit: 0,
        credit: total,
      }
    );
  }

  const journalEntryId = await postBalancedJournalEntry({
    userId: params.userId,
    date: params.issueDate,
    description: `Sales Credit Note ${cnNumber} — ${params.customerName}`,
    reference: cnNumber,
    source: 'invoice',
    lines: jeLines,
  });

  // 2. Insert Credit Note header
  const { data: cn, error: cnErr } = await supabase
    .from('credit_notes')
    .insert({
      user_id: params.userId,
      credit_note_number: cnNumber,
      invoice_id: params.invoice?.id || null,
      customer_id: params.customerId || (params.invoice as any)?.customer_id || null,
      customer_name: params.customerName,
      customer_email: params.customerEmail || '',
      issue_date: params.issueDate,
      reason: params.reason,
      subtotal,
      vat_rate: params.vatRate || 0,
      vat_amount: vatAmount,
      total,
      status: params.recordRefund ? 'refunded' : 'applied',
      refund_recorded: params.recordRefund,
      refund_date: params.recordRefund ? params.issueDate : null,
      refund_method: params.refundMethod || 'Bank Transfer',
      refund_account_id: params.refundAccountId || null,
      refund_transaction_id: refundTxId,
      journal_entry_id: journalEntryId,
      notes: params.notes || '',
    })
    .select('*')
    .single();

  if (cnErr || !cn) throw cnErr || new Error('Failed to create credit note');

  // 3. Insert Credit Note items
  await supabase.from('credit_note_items').insert(
    params.items.map((it) => ({
      credit_note_id: cn.id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      amount: Math.round(it.quantity * it.unit_price * 100) / 100,
    }))
  );

  // 4. Update linked Invoice credited_amount (never hard-delete issued invoice)
  if (params.invoice?.id) {
    const prevCredited = Number((params.invoice as any).credited_amount || 0);
    const nextCredited = Math.round((prevCredited + total) * 100) / 100;
    const paidPlusCredit = Number(params.invoice.amount_paid || 0) + nextCredited;
    const nextStatus = paidPlusCredit >= Number(params.invoice.total || 0) ? 'paid' : params.invoice.status;
    await supabase
      .from('invoices')
      .update({ credited_amount: nextCredited, status: nextStatus })
      .eq('id', params.invoice.id);
  }

  await logActivity(
    params.userId,
    params.actorId,
    'created',
    'credit_note',
    cn.id,
    `Issued Credit Note ${cnNumber} for ${params.customerName} (${formatCurrency(total)})`,
    { credit_note_number: cnNumber, invoice_id: params.invoice?.id, total, refund_recorded: params.recordRefund }
  );

  return cn as CreditNoteRecord;
}

// ── 4. Recurring Schedule Helpers ────────────────────────────────────────────

export function computeNextRunDate(currentDateStr: string, frequency: RecurringScheduleRecord['frequency']): string {
  const d = new Date(`${currentDateStr}T00:00:00Z`);
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === 'biweekly') d.setUTCDate(d.getUTCDate() + 14);
  else if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else if (frequency === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3);
  else if (frequency === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export async function runRecurringScheduleOnce(schedule: RecurringScheduleRecord, actorId: string) {
  const runDate = schedule.next_run_date || new Date().toISOString().slice(0, 10);
  const lockDate = await getAccountingLockDate(schedule.user_id);
  if (isDateLocked(runDate, lockDate)) {
    throw new Error(getLockErrorMessage(runDate, lockDate!));
  }

  const dueDateObj = new Date(`${runDate}T00:00:00Z`);
  dueDateObj.setUTCDate(dueDateObj.getUTCDate() + 14);
  const dueDate = dueDateObj.toISOString().slice(0, 10);

  if (schedule.entity_type === 'invoice') {
    const invNo = `INV-REC-${String(Date.now()).slice(-5)}`;
    const vatAmt = Math.round(schedule.subtotal * ((schedule.vat_rate || 0) / 100) * 100) / 100;
    const { data: inv, error } = await supabase
      .from('invoices')
      .insert({
        user_id: schedule.user_id,
        invoice_number: invNo,
        customer_id: schedule.customer_id || null,
        client_name: schedule.customer_name || schedule.title,
        client_email: schedule.customer_email || '',
        issue_date: runDate,
        due_date: dueDate,
        subtotal: schedule.subtotal,
        tax_rate: schedule.vat_rate || 0,
        tax_amount: vatAmt,
        total: schedule.total,
        status: schedule.auto_send ? 'sent' : 'draft',
        notes: schedule.notes || `Auto-generated from recurring schedule: ${schedule.title}`,
      })
      .select('id')
      .single();
    if (error) throw error;

    if (inv && Array.isArray(schedule.items_json) && schedule.items_json.length > 0) {
      await supabase.from('invoice_items').insert(
        schedule.items_json.map((it) => ({
          invoice_id: inv.id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          amount: Math.round(it.quantity * it.unit_price * 100) / 100,
        }))
      );
    }

    await logActivity(schedule.user_id, actorId, 'created', 'recurring_invoice', inv?.id || schedule.id, `Generated recurring invoice ${invNo} (${formatCurrency(schedule.total)})`);
  } else {
    const billNo = `BILL-REC-${String(Date.now()).slice(-5)}`;
    const { data: bill, error } = await supabase
      .from('bills')
      .insert({
        user_id: schedule.user_id,
        bill_number: billNo,
        vendor: schedule.vendor_name || schedule.title,
        description: schedule.notes || schedule.title,
        bill_date: runDate,
        due_date: dueDate,
        amount: schedule.total,
        category_id: schedule.category_id || null,
        status: 'unpaid',
      })
      .select('id')
      .single();
    if (error) throw error;

    await logActivity(schedule.user_id, actorId, 'created', 'recurring_bill', bill?.id || schedule.id, `Generated recurring bill ${billNo} (${formatCurrency(schedule.total)})`);
  }

  const nextRun = computeNextRunDate(runDate, schedule.frequency);
  const reachedEnd = Boolean(schedule.end_date && nextRun > schedule.end_date);

  await supabase
    .from('recurring_schedules')
    .update({
      next_run_date: nextRun,
      last_run_at: new Date().toISOString(),
      runs_count: (schedule.runs_count || 0) + 1,
      is_active: reachedEnd ? false : schedule.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', schedule.id);
}

// ── 6. Fixed Asset Register & Auto-Depreciation Helpers ──────────────────────

export const ASSET_CLASS_COA: Record<
  OperationalFixedAsset['asset_class'],
  { costAccount: string; accumDeprAccount: string; defaultLifeMonths: number; defaultRatePct: number }
> = {
  'Leasehold Land & Buildings': {
    costAccount: '1510 PPE Cost - Land & Buildings',
    accumDeprAccount: '1519 Accumulated Depreciation - Buildings',
    defaultLifeMonths: 120,
    defaultRatePct: 10,
  },
  'Plant & Heavy Machinery': {
    costAccount: '1520 PPE Cost - Plant & Machinery',
    accumDeprAccount: '1529 Accumulated Depreciation - Plant & Machinery',
    defaultLifeMonths: 60,
    defaultRatePct: 20,
  },
  'Commercial Motor Vehicles': {
    costAccount: '1530 PPE Cost - Motor Vehicles',
    accumDeprAccount: '1539 Accumulated Depreciation - Motor Vehicles',
    defaultLifeMonths: 48,
    defaultRatePct: 25,
  },
  'Office Furniture & Equipment': {
    costAccount: '1540 PPE Cost - Office Furniture & Equipment',
    accumDeprAccount: '1549 Accumulated Depreciation - Office Furniture',
    defaultLifeMonths: 60,
    defaultRatePct: 20,
  },
  'Computer & IT Infrastructure': {
    costAccount: '1550 PPE Cost - Computer & IT Equipment',
    accumDeprAccount: '1559 Accumulated Depreciation - Computer & IT',
    defaultLifeMonths: 36,
    defaultRatePct: 33.33,
  },
};

export function computeMonthlyDepreciationAmount(asset: OperationalFixedAsset): number {
  if (asset.status !== 'Active') return 0;
  const cost = Number(asset.historical_cost) || 0;
  const salvage = Number(asset.salvage_value) || 0;
  const accum = Number(asset.accumulated_depreciation ?? asset.prior_accum_depr ?? 0);
  const depreciableRemaining = Math.max(0, cost - salvage - accum);
  if (depreciableRemaining <= 0.01) return 0;

  let monthly = 0;
  if (asset.depreciation_method === 'reducing_balance') {
    const nbv = Math.max(0, cost - accum);
    const rate = (Number(asset.annual_rate_pct) || 20) / 100;
    monthly = (nbv * rate) / 12;
  } else {
    const lifeMonths = Math.max(1, Number(asset.useful_life_months) || 60);
    monthly = Math.max(0, cost - salvage) / lifeMonths;
  }

  return Math.round(Math.min(monthly, depreciableRemaining) * 100) / 100;
}

export async function runMonthlyDepreciationBatch(params: {
  userId: string;
  actorId: string;
  periodMonth: string; // YYYY-MM
  assets: OperationalFixedAsset[];
}): Promise<{ postedCount: number; totalDepreciation: number; skippedCount: number }> {
  const { userId, actorId, periodMonth, assets } = params;
  const [y, m] = periodMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const deprDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const lockDate = await getAccountingLockDate(userId);
  if (isDateLocked(deprDate, lockDate)) {
    throw new Error(getLockErrorMessage(deprDate, lockDate!));
  }

  // Check existing runs for this month to prevent duplicate postings
  const { data: existingRuns } = await supabase
    .from('fixed_asset_depreciation_runs')
    .select('fixed_asset_id')
    .eq('user_id', userId)
    .eq('period_month', periodMonth);
  const alreadyRunIds = new Set((existingRuns || []).map((r: any) => r.fixed_asset_id));

  let postedCount = 0;
  let skippedCount = 0;
  let totalDepreciation = 0;

  for (const asset of assets) {
    if (asset.status !== 'Active' || alreadyRunIds.has(asset.id)) {
      skippedCount++;
      continue;
    }
    if (asset.date_acquired > deprDate) {
      skippedCount++;
      continue;
    }

    const monthlyAmt = computeMonthlyDepreciationAmount(asset);
    if (monthlyAmt <= 0) {
      skippedCount++;
      continue;
    }

    const coa = ASSET_CLASS_COA[asset.asset_class] || ASSET_CLASS_COA['Office Furniture & Equipment'];
    const name = asset.asset_name || asset.description;

    const jeId = await postBalancedJournalEntry({
      userId,
      date: deprDate,
      description: `Monthly Depreciation (${periodMonth}) — ${name}`,
      reference: `DEPR-${periodMonth}-${asset.asset_code || asset.id.slice(0, 4)}`,
      source: 'auto',
      lines: [
        {
          account_name: '6130 Depreciation Expense (P&L)',
          description: `Depreciation for ${name} (${periodMonth})`,
          debit: monthlyAmt,
          credit: 0,
        },
        {
          account_name: coa.accumDeprAccount,
          description: `Accumulated depreciation for ${name} (${periodMonth})`,
          debit: 0,
          credit: monthlyAmt,
        },
      ],
    });

    const prevAccum = Number(asset.accumulated_depreciation ?? asset.prior_accum_depr ?? 0);
    const nextAccum = Math.round((prevAccum + monthlyAmt) * 100) / 100;
    const nextNbv = Math.max(0, Math.round((Number(asset.historical_cost) - nextAccum) * 100) / 100);

    await supabase.from('fixed_asset_depreciation_runs').insert({
      user_id: userId,
      fixed_asset_id: asset.id,
      period_month: periodMonth,
      depreciation_date: deprDate,
      depreciation_amount: monthlyAmt,
      accumulated_after: nextAccum,
      net_book_value_after: nextNbv,
      journal_entry_id: jeId,
    });

    await supabase
      .from('fixed_assets')
      .update({
        accumulated_depreciation: nextAccum,
        prior_accum_depr: nextAccum,
        last_depreciation_date: deprDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', asset.id);

    postedCount++;
    totalDepreciation = Math.round((totalDepreciation + monthlyAmt) * 100) / 100;
  }

  if (postedCount > 0) {
    await logActivity(
      userId,
      actorId,
      'created',
      'depreciation_run',
      periodMonth,
      `Posted monthly depreciation for ${periodMonth}: ${postedCount} assets (${formatCurrency(totalDepreciation)})`,
      { period_month: periodMonth, postedCount, totalDepreciation }
    );
  }

  return { postedCount, totalDepreciation, skippedCount };
}

export async function disposeFixedAssetWithJournal(params: {
  userId: string;
  actorId: string;
  asset: OperationalFixedAsset;
  disposalDate: string;
  proceeds: number;
  remarks?: string;
}): Promise<{ gainOrLoss: number }> {
  const { userId, actorId, asset, disposalDate, proceeds, remarks } = params;

  const lockDate = await getAccountingLockDate(userId);
  if (isDateLocked(disposalDate, lockDate)) {
    throw new Error(getLockErrorMessage(disposalDate, lockDate!));
  }

  const cost = Number(asset.historical_cost) || 0;
  const accumDepr = Number(asset.accumulated_depreciation ?? asset.prior_accum_depr ?? 0);
  const nbv = Math.max(0, Math.round((cost - accumDepr) * 100) / 100);
  const gainOrLoss = Math.round((proceeds - nbv) * 100) / 100; // positive = gain, negative = loss

  const coa = ASSET_CLASS_COA[asset.asset_class] || ASSET_CLASS_COA['Office Furniture & Equipment'];
  const name = asset.asset_name || asset.description;

  const lines: { account_name: string; description: string; debit: number; credit: number }[] = [];
  if (proceeds > 0) {
    lines.push({
      account_name: '1020 Zenith Bank Current Account',
      description: `Disposal proceeds for ${name}`,
      debit: proceeds,
      credit: 0,
    });
  }
  if (accumDepr > 0) {
    lines.push({
      account_name: coa.accumDeprAccount,
      description: `Remove accumulated depreciation on disposal of ${name}`,
      debit: accumDepr,
      credit: 0,
    });
  }
  if (gainOrLoss < 0) {
    lines.push({
      account_name: '6050 Repairs & Facility Maintenance',
      description: `Loss on disposal of ${name}`,
      debit: Math.abs(gainOrLoss),
      credit: 0,
    });
  } else if (gainOrLoss > 0) {
    lines.push({
      account_name: '4090 Other Operating Income',
      description: `Gain on disposal of ${name}`,
      debit: 0,
      credit: gainOrLoss,
    });
  }
  lines.push({
    account_name: coa.costAccount,
    description: `Derecognize original cost of ${name}`,
    debit: 0,
    credit: cost,
  });

  await postBalancedJournalEntry({
    userId,
    date: disposalDate,
    description: `Fixed Asset Disposal — ${name}`,
    reference: `DISP-${asset.asset_code || asset.id.slice(0, 4)}`,
    source: 'auto',
    lines,
  });

  await supabase.from('fixed_asset_disposals').insert({
    user_id: userId,
    fixed_asset_id: asset.id,
    asset_code: asset.asset_code || '',
    disposal_date: disposalDate,
    original_cost: cost,
    accum_depr_at_disposal: accumDepr,
    disposal_proceeds: proceeds,
    remarks: remarks || (gainOrLoss >= 0 ? `Gain: ${formatCurrency(gainOrLoss)}` : `Loss: ${formatCurrency(Math.abs(gainOrLoss))}`),
  });

  await supabase
    .from('fixed_assets')
    .update({
      status: 'Disposed',
      disposal_date: disposalDate,
      disposal_proceeds: proceeds,
      disposal_gain_loss: gainOrLoss,
      updated_at: new Date().toISOString(),
    })
    .eq('id', asset.id);

  await logActivity(
    userId,
    actorId,
    'disposed',
    'fixed_asset',
    asset.id,
    `Disposed fixed asset ${name} for ${formatCurrency(proceeds)} (${gainOrLoss >= 0 ? 'Gain' : 'Loss'}: ${formatCurrency(Math.abs(gainOrLoss))})`,
    { proceeds, nbv, gainOrLoss }
  );

  return { gainOrLoss };
}
