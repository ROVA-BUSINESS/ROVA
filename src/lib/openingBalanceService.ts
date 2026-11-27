/**
 * RovaFlow Opening Balances Engine
 *
 * Implements strict double-entry opening balance setup for businesses migrating
 * from spreadsheets, notebooks, or other accounting software:
 * - Uses existing Standard Nigeria Chart of Accounts (Assets 1xxx, Liabilities 2xxx, Equity 3xxx).
 * - Never includes P&L Revenue/Expense accounts so opening balances never distort current-period Profit & Loss.
 * - Preserves all user-entered Equity accounts; only allocates remaining difference to Retained Earnings / Opening Equity when requested.
 * - Prevents posting unbalanced entries or duplicate opening balance journals.
 * - Syncs individual Customer (AR) and Supplier (AP) opening balances into `customers`/`invoices` and `suppliers`/`bills` sub-ledgers.
 * - Supports optional opening Fixed Assets (`fixed_assets`) and Inventory (`inventory_items`).
 * - Once posted, corrections are made via balanced Adjustment Journal Entries (`OB-ADJ-...`), preserving full audit history.
 */

import { supabase } from './supabase';
import { STANDARD_NIGERIA_COA, type CoaAccountDefinition } from './standardCoa';

export type OpeningBalanceSection = 'asset' | 'liability' | 'equity';

export interface OpeningBalanceLine {
  id: string;
  account_code: string;
  account_name: string;
  account_type: OpeningBalanceSection;
  normal_balance: 'debit' | 'credit';
  amount: number; // Signed positive (normal side) or negative (contra/accumulated loss)
  debit: number;
  credit: number;
  notes?: string;
}

export interface CustomerOpeningBalance {
  id: string;
  customer_id?: string | null;
  customer_name: string;
  email?: string;
  phone?: string;
  amount: number;
  due_date?: string;
  invoice_id?: string | null;
}

export interface SupplierOpeningBalance {
  id: string;
  supplier_id?: string | null;
  supplier_name: string;
  email?: string;
  phone?: string;
  amount: number;
  due_date?: string;
  bill_id?: string | null;
}

export interface OpeningFixedAssetItem {
  id: string;
  asset_name: string;
  asset_class: string;
  purchase_date: string;
  cost: number;
  accumulated_depreciation: number;
  useful_life_years: number;
  fixed_asset_id?: string | null;
}

export interface OpeningInventoryItem {
  id: string;
  item_name: string;
  sku?: string;
  quantity: number;
  unit_cost: number;
  inventory_item_id?: string | null;
}

export interface OpeningBalanceRecord {
  id: string;
  user_id: string;
  opening_date: string;
  status: 'draft' | 'posted';
  notes: string | null;
  journal_entry_id: string | null;
  adjustment_journal_ids: string[];
  lines: OpeningBalanceLine[];
  customer_balances: CustomerOpeningBalance[];
  supplier_balances: SupplierOpeningBalance[];
  fixed_asset_items: OpeningFixedAssetItem[];
  inventory_items_data: OpeningInventoryItem[];
  total_debits: number;
  total_credits: number;
  posted_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OpeningBalanceValidation {
  isValid: boolean;
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number; // totalDebits - totalCredits
  errors: string[];
  warnings: string[];
}

/**
 * Default SME-friendly Balance Sheet accounts shown initially so a small business owner
 * can enter their opening position in minutes without hunting through a full COA.
 */
export const DEFAULT_OPENING_ACCOUNT_CODES = [
  // Assets
  '1010', // Cash on Hand
  '1020', // Bank Current Account
  '1110', // Trade Accounts Receivable
  '1210', // Inventory - Goods for Resale
  '1310', // Prepaid Expenses
  '1540', // PPE - Office Furniture & Equipment
  '1550', // PPE - Computer & IT Equipment
  // Liabilities
  '2010', // Trade Accounts Payable
  '2020', // Accrued / Outstanding Expenses
  '2510', // Long-Term Bank Loan
  // Equity
  '3010', // Ordinary Share Capital / Owner's Capital
  '3020', // Retained Earnings / Accumulated Profits or Losses
];

export function getBalanceSheetCoaAccounts(section?: OpeningBalanceSection): CoaAccountDefinition[] {
  return STANDARD_NIGERIA_COA.filter((acc) => {
    if (acc.code === '9999') return false;
    if (acc.accountType !== 'asset' && acc.accountType !== 'liability' && acc.accountType !== 'equity') return false;
    if (section && acc.accountType !== section) return false;
    return true;
  });
}

/**
 * Converts a user-entered signed amount on a Balance Sheet account into proper Debit/Credit columns.
 * - Normal Debit account (e.g. Assets, Owner Drawings): positive -> Debit; negative -> Credit.
 * - Normal Credit account (e.g. Liabilities, Equity, Accum. Depr): positive -> Credit; negative (e.g. Accumulated Loss) -> Debit.
 */
export function computeLineDebitCredit(
  normalBalance: 'debit' | 'credit',
  rawAmount: number
): { debit: number; credit: number } {
  const amt = Number(rawAmount) || 0;
  if (Math.abs(amt) < 0.005) return { debit: 0, credit: 0 };
  const abs = Math.round(Math.abs(amt) * 100) / 100;
  if (normalBalance === 'debit') {
    return amt >= 0 ? { debit: abs, credit: 0 } : { debit: 0, credit: abs };
  }
  return amt >= 0 ? { debit: 0, credit: abs } : { debit: abs, credit: 0 };
}

export function buildDefaultOpeningLines(): OpeningBalanceLine[] {
  return DEFAULT_OPENING_ACCOUNT_CODES.map((code) => {
    const acc = STANDARD_NIGERIA_COA.find((a) => a.code === code)!;
    return {
      id: `ob_${code}`,
      account_code: acc.code,
      account_name: acc.name,
      account_type: acc.accountType as OpeningBalanceSection,
      normal_balance: acc.normalBalance,
      amount: 0,
      debit: 0,
      credit: 0,
      notes: '',
    };
  });
}

export function validateOpeningBalances(
  openingDate: string,
  lines: OpeningBalanceLine[],
  customerBalances: CustomerOpeningBalance[],
  supplierBalances: SupplierOpeningBalance[]
): OpeningBalanceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!openingDate || !/^\d{4}-\d{2}-\d{2}$/.test(openingDate)) {
    errors.push('Please select a valid Opening Balance Date.');
  }

  const nonZeroLines = lines.filter((l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0);
  if (nonZeroLines.length === 0) {
    errors.push('Enter at least one opening account balance before posting.');
  }

  for (const l of nonZeroLines) {
    if (!l.account_code || !l.account_name) {
      errors.push('One or more opening balance rows are missing a Chart of Accounts selection.');
    }
    if ((Number(l.debit) || 0) < 0 || (Number(l.credit) || 0) < 0) {
      errors.push(`Invalid negative debit/credit on ${l.account_name}.`);
    }
  }

  const totalDebits = Math.round(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100;
  const totalCredits = Math.round(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100;
  const difference = Math.round((totalDebits - totalCredits) * 100) / 100;
  const isBalanced = Math.abs(difference) < 0.01 && totalDebits > 0;

  if (!isBalanced && nonZeroLines.length > 0) {
    errors.push(
      `Opening balances are out of balance by ₦${Math.abs(difference).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${
        difference > 0 ? 'Debits exceed Credits' : 'Credits exceed Debits'
      }). Use "Auto-Balance to Retained Earnings" or adjust your figures so Total Debits equal Total Credits.`
    );
  }

  // Check Customer sub-ledger consistency with 1110 Accounts Receivable
  const custTotal = Math.round(customerBalances.reduce((s, c) => s + (Number(c.amount) || 0), 0) * 100) / 100;
  const arLine = lines.find((l) => l.account_code === '1110');
  const arVal = arLine ? Number(arLine.debit || 0) : 0;
  if (custTotal > 0 && Math.abs(custTotal - arVal) > 0.01) {
    warnings.push(
      `Customer opening balances total ₦${custTotal.toLocaleString()}, while Trade Accounts Receivable (1110) is ₦${arVal.toLocaleString()}. Sync AR to match your customer list.`
    );
  }

  // Check Supplier sub-ledger consistency with 2010 Accounts Payable
  const supTotal = Math.round(supplierBalances.reduce((s, sup) => s + (Number(sup.amount) || 0), 0) * 100) / 100;
  const apLine = lines.find((l) => l.account_code === '2010');
  const apVal = apLine ? Number(apLine.credit || 0) : 0;
  if (supTotal > 0 && Math.abs(supTotal - apVal) > 0.01) {
    warnings.push(
      `Supplier opening balances total ₦${supTotal.toLocaleString()}, while Trade Accounts Payable (2010) is ₦${apVal.toLocaleString()}. Sync AP to match your supplier list.`
    );
  }

  // Validate customer/supplier names
  for (const c of customerBalances) {
    if (c.amount > 0 && !c.customer_name.trim()) {
      errors.push('Every customer opening balance must have a customer name.');
    }
  }
  for (const s of supplierBalances) {
    if (s.amount > 0 && !s.supplier_name.trim()) {
      errors.push('Every supplier opening balance must have a supplier name.');
    }
  }

  return {
    isValid: errors.length === 0 && isBalanced,
    isBalanced,
    totalDebits,
    totalCredits,
    difference,
    errors,
    warnings,
  };
}

/**
 * Auto-balances the opening balance lines by allocating ONLY the exact remaining difference
 * to Retained Earnings / Opening Equity (`3020`), strictly preserving any Owner's Capital (`3010`)
 * or other equity lines the user has already entered.
 */
export function autoBalanceOpeningLines(lines: OpeningBalanceLine[]): OpeningBalanceLine[] {
  const next = lines.map((l) => ({ ...l }));
  let reIdx = next.findIndex((l) => l.account_code === '3020');
  if (reIdx === -1) {
    const acc = STANDARD_NIGERIA_COA.find((a) => a.code === '3020')!;
    next.push({
      id: `ob_3020`,
      account_code: acc.code,
      account_name: acc.name,
      account_type: 'equity',
      normal_balance: 'credit',
      amount: 0,
      debit: 0,
      credit: 0,
      notes: 'Auto-calculated balancing Retained Earnings / Opening Equity',
    });
    reIdx = next.length - 1;
  }

  // Compute totals excluding current 3020 value so we compute the exact net balancing equity
  let otherDebits = 0;
  let otherCredits = 0;
  next.forEach((l, i) => {
    if (i === reIdx) return;
    otherDebits += Number(l.debit) || 0;
    otherCredits += Number(l.credit) || 0;
  });

  // Retained Earnings is normal credit: positive amount -> credit, negative amount (accumulated loss) -> debit
  const balancingAmount = Math.round((otherDebits - otherCredits) * 100) / 100;
  const { debit, credit } = computeLineDebitCredit('credit', balancingAmount);

  next[reIdx] = {
    ...next[reIdx],
    amount: balancingAmount,
    debit,
    credit,
    notes: balancingAmount >= 0
      ? 'Balancing Retained Earnings / Opening Equity'
      : 'Balancing Accumulated Loss (Opening Deficit)',
  };

  return next;
}

/**
 * Loads the user's opening balance record (draft or posted).
 */
export async function loadOpeningBalanceRecord(userId: string): Promise<OpeningBalanceRecord | null> {
  const { data, error } = await supabase
    .from('opening_balances')
    .select('*')
    .eq('user_id', userId)
    .order('status', { ascending: false }) // 'posted' before 'draft'
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    ...data,
    total_debits: Number(data.total_debits || 0),
    total_credits: Number(data.total_credits || 0),
    lines: Array.isArray(data.lines) ? data.lines : [],
    customer_balances: Array.isArray(data.customer_balances) ? data.customer_balances : [],
    supplier_balances: Array.isArray(data.supplier_balances) ? data.supplier_balances : [],
    fixed_asset_items: Array.isArray(data.fixed_asset_items) ? data.fixed_asset_items : [],
    inventory_items_data: Array.isArray(data.inventory_items_data) ? data.inventory_items_data : [],
    adjustment_journal_ids: Array.isArray(data.adjustment_journal_ids) ? data.adjustment_journal_ids : [],
  } as OpeningBalanceRecord;
}

/**
 * Saves opening balances as a Draft without posting any journal entries.
 */
export async function saveOpeningBalancesDraft(params: {
  userId: string;
  existingId?: string | null;
  openingDate: string;
  notes?: string;
  lines: OpeningBalanceLine[];
  customerBalances: CustomerOpeningBalance[];
  supplierBalances: SupplierOpeningBalance[];
  fixedAssetItems: OpeningFixedAssetItem[];
  inventoryItems: OpeningInventoryItem[];
}): Promise<OpeningBalanceRecord> {
  const totalDebits = Math.round(params.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) * 100) / 100;
  const totalCredits = Math.round(params.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) * 100) / 100;

  const payload = {
    user_id: params.userId,
    opening_date: params.openingDate,
    status: 'draft',
    notes: params.notes || null,
    lines: params.lines,
    customer_balances: params.customerBalances,
    supplier_balances: params.supplierBalances,
    fixed_asset_items: params.fixedAssetItems,
    inventory_items_data: params.inventoryItems,
    total_debits: totalDebits,
    total_credits: totalCredits,
    updated_at: new Date().toISOString(),
  };

  if (params.existingId) {
    const { data, error } = await supabase
      .from('opening_balances')
      .update(payload)
      .eq('id', params.existingId)
      .eq('status', 'draft')
      .select()
      .single();
    if (error) throw error;
    return data as OpeningBalanceRecord;
  }

  const { data, error } = await supabase
    .from('opening_balances')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as OpeningBalanceRecord;
}

/**
 * Posts balanced Opening Balances:
 * 1. Validates debits === credits and checks no prior posted opening balance exists.
 * 2. Inserts a balanced Journal Entry (`OB-OPENING`) into `journal_entries` & `journal_entry_lines`.
 * 3. Creates/links Customer AR opening invoices & Supplier AP opening bills.
 * 4. Creates optional Opening Fixed Assets & Inventory Items.
 * 5. Marks `opening_balances` record as `posted` and logs to `activity_logs`.
 */
export async function postOpeningBalances(params: {
  userId: string;
  existingId?: string | null;
  openingDate: string;
  notes?: string;
  lines: OpeningBalanceLine[];
  customerBalances: CustomerOpeningBalance[];
  supplierBalances: SupplierOpeningBalance[];
  fixedAssetItems: OpeningFixedAssetItem[];
  inventoryItems: OpeningInventoryItem[];
}): Promise<OpeningBalanceRecord> {
  // Prevent duplicate posted opening balances
  const { data: alreadyPosted } = await supabase
    .from('opening_balances')
    .select('id')
    .eq('user_id', params.userId)
    .eq('status', 'posted')
    .maybeSingle();

  if (alreadyPosted) {
    throw new Error('Opening balances have already been posted. Use "Record Adjustment Entry" to make corrections.');
  }

  const validation = validateOpeningBalances(
    params.openingDate,
    params.lines,
    params.customerBalances,
    params.supplierBalances
  );
  if (!validation.isValid) {
    throw new Error(validation.errors[0] || 'Opening balances must be valid and balanced before posting.');
  }

  const nonZeroLines = params.lines.filter((l) => (Number(l.debit) || 0) > 0 || (Number(l.credit) || 0) > 0);

  // 1. Insert Opening Balance Journal Entry
  const { data: jeData, error: jeErr } = await supabase
    .from('journal_entries')
    .insert({
      user_id: params.userId,
      date: params.openingDate,
      description: `Opening Balances as at ${params.openingDate}`,
      reference: `OB-${params.openingDate.replace(/-/g, '')}`,
      is_posted: true,
    })
    .select('id')
    .single();

  if (jeErr || !jeData) {
    throw new Error(jeErr?.message || 'Failed to create Opening Balance journal entry.');
  }

  const journalEntryId = jeData.id;

  const jeLinesPayload = nonZeroLines.map((l) => ({
    journal_entry_id: journalEntryId,
    account_name: `${l.account_code} - ${l.account_name}`,
    debit: Number(l.debit) || 0,
    credit: Number(l.credit) || 0,
    description: l.notes || `Opening balance — ${l.account_name}`,
  }));

  const { error: linesErr } = await supabase.from('journal_entry_lines').insert(jeLinesPayload);
  if (linesErr) {
    // Roll back orphan header if lines insert failed
    await supabase.from('journal_entries').delete().eq('id', journalEntryId);
    throw new Error(linesErr.message || 'Failed to insert Opening Balance journal lines.');
  }

  // 2. Sync Customer Opening Balances (AR sub-ledger)
  const syncedCustomers: CustomerOpeningBalance[] = [];
  for (let i = 0; i < params.customerBalances.length; i++) {
    const cb = params.customerBalances[i];
    if (!cb.customer_name.trim() || Number(cb.amount) <= 0) continue;

    let customerId = cb.customer_id || null;
    if (!customerId) {
      const { data: existingCust } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', params.userId)
        .ilike('name', cb.customer_name.trim())
        .maybeSingle();

      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const { data: newCust } = await supabase
          .from('customers')
          .insert({
            user_id: params.userId,
            name: cb.customer_name.trim(),
            email: cb.email?.trim() || null,
            phone: cb.phone?.trim() || null,
          })
          .select('id')
          .single();
        customerId = newCust?.id || null;
      }
    }

    // Create Opening Balance Receivable record in `invoices` (marked clearly as Opening Balance)
    const { data: obInv } = await supabase
      .from('invoices')
      .insert({
        user_id: params.userId,
        customer_id: customerId,
        client_name: cb.customer_name.trim(),
        client_email: cb.email?.trim() || null,
        invoice_number: `OB-AR-${params.openingDate.replace(/-/g, '')}-${i + 1}`,
        issue_date: params.openingDate,
        due_date: cb.due_date || params.openingDate,
        subtotal: Number(cb.amount),
        tax_rate: 0,
        tax_amount: 0,
        total: Number(cb.amount),
        amount_paid: 0,
        status: 'sent',
        notes: 'Opening Balance Receivable (migrated prior balance — not current-period revenue)',
      })
      .select('id')
      .single();

    syncedCustomers.push({
      ...cb,
      customer_id: customerId,
      invoice_id: obInv?.id || null,
    });
  }

  // 3. Sync Supplier Opening Balances (AP sub-ledger)
  const syncedSuppliers: SupplierOpeningBalance[] = [];
  for (let i = 0; i < params.supplierBalances.length; i++) {
    const sb = params.supplierBalances[i];
    if (!sb.supplier_name.trim() || Number(sb.amount) <= 0) continue;

    let supplierId = sb.supplier_id || null;
    if (!supplierId) {
      const { data: existingSup } = await supabase
        .from('suppliers')
        .select('id')
        .eq('user_id', params.userId)
        .ilike('name', sb.supplier_name.trim())
        .maybeSingle();

      if (existingSup) {
        supplierId = existingSup.id;
      } else {
        const { data: newSup } = await supabase
          .from('suppliers')
          .insert({
            user_id: params.userId,
            name: sb.supplier_name.trim(),
            email: sb.email?.trim() || null,
            phone: sb.phone?.trim() || null,
          })
          .select('id')
          .single();
        supplierId = newSup?.id || null;
      }
    }

    // Create Opening Balance Payable record in `bills`
    const { data: obBill } = await supabase
      .from('bills')
      .insert({
        user_id: params.userId,
        vendor: sb.supplier_name.trim(),
        bill_number: `OB-AP-${params.openingDate.replace(/-/g, '')}-${i + 1}`,
        bill_date: params.openingDate,
        due_date: sb.due_date || params.openingDate,
        amount: Number(sb.amount),
        status: 'unpaid',
        description: 'Opening Balance Payable (migrated prior balance — not current-period expense)',
      })
      .select('id')
      .single();

    syncedSuppliers.push({
      ...sb,
      supplier_id: supplierId,
      bill_id: obBill?.id || null,
    });
  }

  // 4. Sync optional Opening Fixed Assets
  const syncedAssets: OpeningFixedAssetItem[] = [];
  for (const fa of params.fixedAssetItems) {
    if (!fa.asset_name.trim() || Number(fa.cost) <= 0) continue;
    const { data: newFa } = await supabase
      .from('fixed_assets')
      .insert({
        user_id: params.userId,
        asset_name: fa.asset_name.trim(),
        asset_class: fa.asset_class || 'Office Furniture & Equipment',
        acquisition_date: fa.purchase_date || params.openingDate,
        acquisition_cost: Number(fa.cost),
        accumulated_depreciation: Number(fa.accumulated_depreciation) || 0,
        useful_life_years: Number(fa.useful_life_years) || 5,
        salvage_value: 0,
        depreciation_method: 'straight_line',
        status: 'active',
        notes: `Migrated Opening Balance Fixed Asset as at ${params.openingDate}`,
      })
      .select('id')
      .single();

    syncedAssets.push({ ...fa, fixed_asset_id: newFa?.id || null });
  }

  // 5. Sync optional Opening Inventory Items
  const syncedInventory: OpeningInventoryItem[] = [];
  for (const inv of params.inventoryItems) {
    if (!inv.item_name.trim() || Number(inv.quantity) <= 0) continue;
    const { data: newInv } = await supabase
      .from('inventory_items')
      .insert({
        user_id: params.userId,
        name: inv.item_name.trim(),
        sku: inv.sku?.trim() || null,
        quantity: Number(inv.quantity),
        cost_price: Number(inv.unit_cost) || 0,
        selling_price: Number(inv.unit_cost) || 0,
        unit: 'pcs',
      })
      .select('id')
      .single();

    syncedInventory.push({ ...inv, inventory_item_id: newInv?.id || null });
  }

  // 6. Persist Posted Opening Balance record
  const nowIso = new Date().toISOString();
  const recordPayload = {
    user_id: params.userId,
    opening_date: params.openingDate,
    status: 'posted',
    notes: params.notes || null,
    journal_entry_id: journalEntryId,
    lines: params.lines,
    customer_balances: syncedCustomers,
    supplier_balances: syncedSuppliers,
    fixed_asset_items: syncedAssets,
    inventory_items_data: syncedInventory,
    total_debits: validation.totalDebits,
    total_credits: validation.totalCredits,
    posted_at: nowIso,
    updated_at: nowIso,
  };

  let savedRecord: any;
  if (params.existingId) {
    const { data, error } = await supabase
      .from('opening_balances')
      .update(recordPayload)
      .eq('id', params.existingId)
      .select()
      .single();
    if (error) throw error;
    savedRecord = data;
  } else {
    const { data, error } = await supabase
      .from('opening_balances')
      .insert(recordPayload)
      .select()
      .single();
    if (error) throw error;
    savedRecord = data;
  }

  // 7. Activity Log
  try {
    await supabase.from('activity_logs').insert({
      owner_id: params.userId,
      user_id: params.userId,
      action: 'posted',
      entity_type: 'opening_balances',
      entity_id: savedRecord.id,
      entity_label: `Opening Balances posted as at ${params.openingDate} (₦${validation.totalDebits.toLocaleString()})`,
      metadata: {
        journal_entry_id: journalEntryId,
        total_debits: validation.totalDebits,
        total_credits: validation.totalCredits,
      },
    });
  } catch {
    // Non-fatal
  }

  return savedRecord as OpeningBalanceRecord;
}

/**
 * Records a proper accounting Adjustment Journal Entry for corrections after Opening Balances have been posted.
 * Never deletes or mutates the original posted opening journal entry.
 */
export async function postOpeningBalanceAdjustment(params: {
  userId: string;
  record: OpeningBalanceRecord;
  updatedLines: OpeningBalanceLine[];
  reason: string;
}): Promise<OpeningBalanceRecord> {
  const validation = validateOpeningBalances(
    params.record.opening_date,
    params.updatedLines,
    params.record.customer_balances,
    params.record.supplier_balances
  );
  if (!validation.isValid) {
    throw new Error(validation.errors[0] || 'Adjusted opening balances must balance (Total Debits = Total Credits).');
  }

  // Calculate net delta per account code: newNet (Dr - Cr) minus oldNet (Dr - Cr)
  const oldMap = new Map<string, { name: string; net: number }>();
  params.record.lines.forEach((l) => {
    oldMap.set(l.account_code, {
      name: l.account_name,
      net: (Number(l.debit) || 0) - (Number(l.credit) || 0),
    });
  });

  const allCodes = new Set<string>([
    ...params.record.lines.map((l) => l.account_code),
    ...params.updatedLines.map((l) => l.account_code),
  ]);

  const deltaLines: Array<{ account_name: string; debit: number; credit: number; description: string }> = [];
  allCodes.forEach((code) => {
    const oldEntry = oldMap.get(code);
    const newEntry = params.updatedLines.find((l) => l.account_code === code);
    const oldNet = oldEntry ? oldEntry.net : 0;
    const newNet = newEntry ? (Number(newEntry.debit) || 0) - (Number(newEntry.credit) || 0) : 0;
    const delta = Math.round((newNet - oldNet) * 100) / 100;
    if (Math.abs(delta) < 0.01) return;

    const accName = newEntry?.account_name || oldEntry?.name || code;
    deltaLines.push({
      account_name: `${code} - ${accName}`,
      debit: delta > 0 ? delta : 0,
      credit: delta < 0 ? Math.abs(delta) : 0,
      description: `Opening balance adjustment: ${params.reason || 'Correction'}`,
    });
  });

  if (deltaLines.length === 0) {
    throw new Error('No balance changes were detected to adjust.');
  }

  const adjNumber = (params.record.adjustment_journal_ids?.length || 0) + 1;
  const { data: adjJe, error: adjErr } = await supabase
    .from('journal_entries')
    .insert({
      user_id: params.userId,
      date: params.record.opening_date,
      description: `Opening Balance Adjustment #${adjNumber}: ${params.reason || 'Balance correction'}`,
      reference: `OB-ADJ-${adjNumber}`,
      is_posted: true,
    })
    .select('id')
    .single();

  if (adjErr || !adjJe) throw new Error(adjErr?.message || 'Failed to create adjustment journal entry.');

  const { error: lineErr } = await supabase
    .from('journal_entry_lines')
    .insert(deltaLines.map((dl) => ({ journal_entry_id: adjJe.id, ...dl })));

  if (lineErr) {
    await supabase.from('journal_entries').delete().eq('id', adjJe.id);
    throw new Error(lineErr.message || 'Failed to insert adjustment journal lines.');
  }

  const nextAdjIds = [...(params.record.adjustment_journal_ids || []), adjJe.id];
  const { data: updatedRec, error: updErr } = await supabase
    .from('opening_balances')
    .update({
      lines: params.updatedLines,
      total_debits: validation.totalDebits,
      total_credits: validation.totalCredits,
      adjustment_journal_ids: nextAdjIds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.record.id)
    .select()
    .single();

  if (updErr) throw updErr;

  try {
    await supabase.from('activity_logs').insert({
      owner_id: params.userId,
      user_id: params.userId,
      action: 'adjusted',
      entity_type: 'opening_balances',
      entity_id: params.record.id,
      entity_label: `Opening Balance Adjustment #${adjNumber} posted (${params.reason || 'Correction'})`,
      metadata: { adjustment_journal_id: adjJe.id, reason: params.reason },
    });
  } catch {
    // Non-fatal
  }

  return updatedRec as OpeningBalanceRecord;
}

/**
 * Fetches all posted manual/opening journal entries with their lines for integration
 * into Trial Balance, Balance Sheet, and General Ledger.
 */
export async function fetchPostedJournalEntriesWithLines(userId: string) {
  const { data: entries } = await supabase
    .from('journal_entries')
    .select('id, date, description, reference, is_posted')
    .eq('user_id', userId)
    .eq('is_posted', true)
    .order('date', { ascending: true });

  if (!entries || entries.length === 0) return [];
  const ids = entries.map((e) => e.id);
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('journal_entry_id, account_name, debit, credit, description')
    .in('journal_entry_id', ids);

  const linesByEntry = new Map<string, any[]>();
  (lines || []).forEach((l) => {
    const arr = linesByEntry.get(l.journal_entry_id) || [];
    arr.push(l);
    linesByEntry.set(l.journal_entry_id, arr);
  });

  return entries.map((e) => ({
    ...e,
    lines: linesByEntry.get(e.id) || [],
  }));
}
