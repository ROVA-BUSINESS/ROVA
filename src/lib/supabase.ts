import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🚀 CURRENT SUPABASE URL BEING USED BY THE APP:', supabaseUrl);
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.sessionStorage,
  },
});

export type Profile = {
  id: string;
  full_name: string;
  business_name: string;
  mode: 'personal' | 'business';
  currency: string;
  phone: string;
  whatsapp_number?: string;
  avatar_url: string;
  staff_visibility_limit: number;
  business_profile_completed?: boolean;
  registration_type?: 'registered' | 'unregistered';
  rc_bn_number?: string;
  business_type?: string;
  business_verification_status?: 'verified' | 'unverified' | 'pending' | 'failed';
  identity_verification_status?: 'verified' | 'unverified' | 'pending' | 'skipped';
  identity_verification_type?: 'nin' | 'bvn' | 'none';
  nin_last_4?: string;
  bvn_last_4?: string;
  city?: string;
  state?: string;
  address?: string;
  country?: string;
  logo_url?: string;
  onboarding_step?: number;
  created_at: string;
  updated_at: string;
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: 'bank' | 'wallet' | 'cash' | 'investment' | 'credit';
  institution: string;
  balance: number;
  currency: string;
  color: string;
  is_active: boolean;
  sync_source: 'manual' | 'mono' | 'email';
  sync_status: 'active' | 'error' | 'pending';
  last_synced_at: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  user_id: string | null;
  name: string;
  type: 'income' | 'expense' | 'both';
  icon: string;
  color: string;
  is_system: boolean;
};

export type Transaction = {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  notes: string;
  date: string;
  reference: string;
  ai_category: string;
  ai_confidence: number;
  is_verified: boolean;
  is_recurring: boolean;
  tags: string[];
  created_at: string;
  category?: Category;
  account?: Account;
};

export type Invoice = {
  id: string;
  user_id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  client_address: string;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  discount_rate?: number;
  discount_amount?: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  notes: string;
  currency: string;
  created_at: string;
  items?: InvoiceItem[];
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  description: string;
  inventory_item_id: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
};

export type Receipt = {
  id: string;
  user_id: string;
  transaction_id?: string | null;
  customer_id?: string | null;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  receipt_number: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_reference?: string;
  description?: string;
  receipt_date: string;
  subtotal: number;
  discount: number;
  total: number;
  status: 'draft' | 'generated' | 'sent' | 'viewed' | 'cancelled';
  pdf_url?: string;
  image_url?: string;
  verification_code?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  items?: ReceiptItem[];
  transaction?: Transaction;
};

export type ReceiptItem = {
  id: string;
  receipt_id: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  created_at?: string;
};

export type TaxRecord = {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  tax_type: 'VAT' | 'PIT' | 'CIT' | 'WHT' | 'CGT' | 'other';
  gross_income: number;
  deductions: number;
  taxable_income: number;
  calculated_tax: number;
  paid_tax: number;
  status: 'pending' | 'filed' | 'paid' | 'overdue';
  due_date: string | null;
  notes: string;
  created_at: string;
};

export type Budget = {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  amount: number;
  period: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  is_active: boolean;
  category?: Category;
};

export type ChartOfAccount = {
  id: string;
  user_id: string;
  code: string;
  name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  normal_balance: 'debit' | 'credit';
  description: string;
  is_system: boolean;
  is_active: boolean;
  parent_id: string | null;
  statement_line_mapping?: string;
  current_classification?: string;
  cash_flow_category?: string;
  created_at: string;
};

export type JournalEntry = {
  id: string;
  user_id: string;
  entry_number: string;
  date: string;
  description: string;
  reference: string;
  source: 'manual' | 'transaction' | 'invoice' | 'auto';
  transaction_id: string | null;
  is_posted: boolean;
  created_at: string;
  lines?: JournalEntryLine[];
};

export type JournalEntryLine = {
  id: string;
  journal_entry_id: string;
  account_id: string | null;
  account_name: string;
  description: string;
  debit: number;
  credit: number;
};

export type Employee = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  employment_type: 'full_time' | 'part_time' | 'contract';
  start_date: string;
  end_date: string | null;
  status: 'active' | 'inactive' | 'terminated';
  gross_salary: number;
  paye_rate: number;
  pension_rate: number;
  bank_name: string;
  bank_account: string;
  notes: string;
  created_at: string;
};

export type PayrollRun = {
  id: string;
  user_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'processed' | 'cancelled';
  total_gross: number;
  total_paye: number;
  total_pension: number;
  total_net: number;
  employee_count: number;
  notes: string;
  processed_at: string | null;
  created_at: string;
  payslips?: Payslip[];
};

export type Payslip = {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  user_id: string;
  gross_salary: number;
  paye_deduction: number;
  pension_deduction: number;
  other_deductions: number;
  net_pay: number;
  transaction_id: string | null;
  notes: string;
  created_at: string;
  employee?: Employee;
};

export type AiInsight = {
  id: string;
  user_id: string;
  type: 'overspend' | 'drop' | 'opportunity' | 'summary' | 'warning' | 'positive';
  severity: 'info' | 'warning' | 'critical' | 'positive';
  title: string;
  body: string;
  metric_key: string;
  metric_value: number;
  is_read: boolean;
  generated_at: string;
  expires_at: string | null;
};

export type Supplier = {
  id: string;
  user_id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  payment_terms: string;
  notes: string;
  is_active: boolean;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  user_id: string;
  supplier_id: string | null;
  sku: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  current_stock: number;
  reorder_level: number;
  status: 'active' | 'inactive' | 'discontinued';
  notes: string;
  created_at: string;
  supplier?: Supplier;
};

export type InventoryTransaction = {
  id: string;
  user_id: string;
  item_id: string;
  transaction_id: string | null;
  type: 'purchase' | 'sale' | 'adjustment' | 'return' | 'write_off';
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reference: string;
  notes: string;
  date: string;
  created_at: string;
  item?: InventoryItem;
};

export type TeamMember = {
  id: string;
  owner_id: string;
  member_id: string | null;
  invite_email: string;
  role: 'admin' | 'staff';
  status: 'pending' | 'active' | 'suspended';
  permissions: Record<string, boolean>;
  invited_at: string;
  joined_at: string | null;
  created_at: string;
};

export type ActivityLog = {
  id: string;
  user_id: string;
  owner_id: string;
  action: 'created' | 'updated' | 'deleted' | 'viewed' | 'processed' | 'sent' | 'paid' | 'approved';
  entity_type: string;
  entity_id: string;
  entity_label: string;
  metadata: Record<string, unknown>;
  ip_address: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type: 'payment_reminder' | 'tax_deadline' | 'low_stock' | 'cash_warning' | 'invoice_due' | 'payroll' | 'info' | 'success' | 'error' | 'ai_clarification';
  severity: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  body: string;
  action_url: string;
  action_label: string;
  is_read: boolean;
  is_dismissed: boolean;
  scheduled_for: string | null;
  created_at: string;
};

export type ExternalWorker = {
  id: string;
  user_id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  category: string;
  bank_name: string | null;
  account_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceAgreement = {
  id: string;
  user_id: string;
  worker_id: string;
  title: string;
  category: string;
  description: string | null;
  agreed_amount: number;
  start_date: string | null;
  due_date: string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  worker?: ExternalWorker;
  contractor_payments?: ContractorPayment[];
};

export type ContractorPayment = {
  id: string;
  user_id: string;
  agreement_id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  transaction_id: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  expense_number: string;
  date: string;
  vendor: string;
  category_id: string | null;
  amount: number;
  payment_method: string | null;
  account_id: string | null;
  description: string | null;
  attachment_url: string | null;
  transaction_id: string | null;
  created_at: string;
  category?: any;
  account?: any;
};

export type Bill = {
  id: string;
  user_id: string;
  bill_number: string;
  vendor: string;
  description: string | null;
  bill_date: string;
  due_date: string;
  amount: number;
  category_id: string | null;
  status: 'unpaid' | 'partially_paid' | 'paid' | 'overdue';
  notes: string | null;
  attachment_url: string | null;
  agreement_id: string | null;
  created_at: string;
  category?: any;
  agreement?: any;
};

export type BillPayment = {
  id: string;
  user_id: string;
  bill_id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  transaction_id: string | null;
  created_at: string;
};

export type RovaSubscription = {
  id: string;
  user_id: string;
  business_name: string | null;
  plan: 'basic_daily' | 'basic_monthly' | 'business_daily' | 'business_monthly';
  amount: number;
  payment_type: 'one_time' | 'recurring';
  billing_interval: 'daily' | 'monthly';
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  payment_reference: string | null;
  paystack_transaction_id: string | null;
  paystack_customer_code?: string | null;
  paystack_subscription_code?: string | null;
  paystack_email_token?: string | null;
  paystack_plan_code?: string | null;
  access_expires_at?: string | null;
  last_payment_date?: string | null;
  cancelled_at?: string | null;
  payment_date: string | null;
  start_date: string;
  next_payment_date: string | null;
  created_at: string;
  updated_at: string;
};

export type RovaPaymentHistory = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  payment_type: 'one_time' | 'recurring';
  billing_interval: 'daily' | 'monthly';
  plan: 'basic_daily' | 'basic_monthly' | 'business_daily' | 'business_monthly';
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'refunded';
  payment_reference: string;
  paystack_transaction_id: string | null;
  paystack_customer_code?: string | null;
  paystack_subscription_code?: string | null;
  paystack_plan_code?: string | null;
  period_start: string | null;
  period_end: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

export type RovaServicePayment = {
  id: string;
  user_id: string;
  business_name: string | null;
  service_type: string;
  service_name: string;
  tax_year: number | null;
  filing_type: string | null;
  amount: number;
  payment_reference: string | null;
  paystack_transaction_id: string | null;
  payment_date: string | null;
  payment_status: 'unpaid' | 'paid' | 'processing' | 'filed';
  filing_status: 'pending' | 'processing' | 'filed' | 'rejected';
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RovaServiceCatalog = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  payment_type: 'recurring' | 'one_time';
  billing_frequency: 'daily' | 'monthly' | 'one_time' | null;
  is_active: boolean;
  created_at: string;
};

export async function syncAllBanks(userId?: string) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { success: false, error: 'User not authenticated' };

    const [monoRes, emailRes] = await Promise.allSettled([
      supabase.functions.invoke('mono-sync', {
        body: { userId },
        headers: { Authorization: `Bearer ${token}` },
      }),
      supabase.functions.invoke('email-bank-sync', {
        body: { userId },
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    return { success: true, monoRes, emailRes };
  } catch (err: any) {
    console.error('Error syncing banks:', err);
    return { success: false, error: err.message };
  }
}

export async function recalculateAccountBalance(accountId: string) {
  try {
    const { data: txs, error: txError } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('account_id', accountId);

    if (txError) throw txError;

    const totalIncome = (txs || [])
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpense = (txs || [])
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const newBalance = totalIncome - totalExpense;

    const { error: updateError } = await supabase
      .from('accounts')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', accountId);

    if (updateError) throw updateError;
    return newBalance;
  } catch (err) {
    console.error(`Failed to recalculate balance for account ${accountId}:`, err);
    return null;
  }
}



export type BusinessNote = {
  id: string;
  user_id: string;
  title: string;
  content: string;       // plain text for search/preview
  content_html: string;  // HTML for rich text display
  is_pinned: boolean;
  color: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type StatutoryAssetClass =
  | 'Leasehold Land & Buildings'
  | 'Plant & Heavy Machinery'
  | 'Commercial Motor Vehicles'
  | 'Office Furniture & Equipment'
  | 'Computer & IT Infrastructure';

export type FinancialStatementProfile = {
  id?: string;
  user_id: string;
  fiscal_year: number;
  company_legal_name: string;
  rc_number: string;
  tin: string;
  fy_start_date: string;
  fy_end_date: string;
  prior_year_end_date?: string | null;
  reporting_currency: string;
  currency_symbol: string;
  nature_of_business: string;
  sector: string;
  accounting_framework: 'IFRS' | 'IFRS for SMEs';
  tax_regime: string;
  tax_authority: string;
  audit_status: 'Audited' | 'Exempt under CAMA 2020' | 'Unaudited';
  auditor_firm: string;
  auditor_partner: string;
  auditor_frc: string;
  audit_opinion: string;
  director_1: string;
  director_2: string;
  cfo_name: string;
  cfo_frc: string;
  approval_date?: string | null;
  small_turnover_threshold: number;
  small_asset_threshold: number;
  professional_services_flag: boolean;
  cit_rate_small: number;
  cit_rate_standard: number;
  dev_levy_rate: number;
  vat_rate: number;
  wht_rate_supplies: number;
  wht_rate_services: number;
  ca_restriction_cap: number;
  notes_config?: Record<string, any>;
};

export type CoaOpeningBalance = {
  id?: string;
  user_id: string;
  fiscal_year: number;
  account_code: string;
  opening_debit: number;
  opening_credit: number;
};

export type FixedAssetRecord = {
  id: string;
  user_id: string;
  asset_code: string;
  description: string;
  asset_class: StatutoryAssetClass;
  date_acquired: string;
  historical_cost: number;
  prior_accum_depr: number;
  opening_twdv: number;
  status: 'Active' | 'Disposed';
  source_transaction_id?: string | null;
};

export type FixedAssetDisposalRecord = {
  id: string;
  user_id: string;
  fixed_asset_id?: string | null;
  asset_code: string;
  disposal_date: string;
  original_cost: number;
  accum_depr_at_disposal: number;
  disposal_proceeds: number;
  remarks: string;
};

export type WhtCreditNoteRecord = {
  id: string;
  user_id: string;
  fiscal_year: number;
  client_name: string;
  credit_note_no: string;
  deduction_date: string;
  nature_of_supply: string;
  gross_amount: number;
  wht_rate: number;
  wht_deducted: number;
  verification_status: 'Pending Verification' | 'Verified' | 'Rejected';
  amount_utilized: number;
};

export type TaxCarryforwardRecord = {
  id?: string;
  user_id: string;
  fiscal_year: number;
  opening_unrelieved_losses: number;
  opening_unutilized_ca: number;
  advance_cit_paid: number;
  non_allowable_fines: number;
  franked_investment_income: number;
};

export type TaxIntakeSession = {
  id?: string;
  user_id: string;
  fiscal_year: number;
  has_prepared_fs: boolean | null;
  intake_status: 'questionnaire' | 'collecting_evidence' | 'reviewing_entries' | 'ready_for_wizard' | 'completed';
  uploaded_files: any[];
  extracted_entries: any[];
  suspense_resolutions: Record<string, any>;
  checklist_status: Record<string, string>;
  wizard_state: Record<string, any>;
  fs_snapshot: Record<string, any>;
};
