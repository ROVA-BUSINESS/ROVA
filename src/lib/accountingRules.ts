/**
 * Rova Accounting Rules & Standards Engine
 * Implements strict double-entry accounting principles per the Rova Accounting Hub specification:
 * - Capital items (equity, loans, assets, dividends) never hit P&L.
 * - Transfers between own accounts never affect P&L or total cash.
 * - Uncategorized items route to Suspense on Balance Sheet without touching P&L.
 * - Customer & Supplier settlements clear receivables/payables without creating duplicate revenue/expense.
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export type AccountingCategoryRule = {
  id: string;
  name: string;
  direction: 'income' | 'expense' | 'transfer';
  accountName: string;
  accountType: AccountType;
  debitAccount: string;
  creditAccount: string;
  affectsPL: boolean;
  plSection: 'revenue' | 'cost_of_sales' | 'operating_expense' | 'other_income' | 'finance_cost' | 'sales_returns' | null;
  profitEffect: 1 | -1 | 0;
  cashEffect: 1 | -1 | 0;
  balanceSheetLine:
    | 'cash'
    | 'receivables'
    | 'inventory'
    | 'prepayments'
    | 'ppe'
    | 'suspense_asset'
    | 'payables'
    | 'customer_deposits'
    | 'loan_payable'
    | 'director_loan'
    | 'suspense_liability'
    | 'share_capital'
    | 'retained_earnings'
    | 'other_reserves';
  cashFlowSection: 'operating' | 'investing' | 'financing' | 'none';
  noteAffected: string;
  description: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// 12 MONEY IN CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
export const MONEY_IN_CATEGORIES: AccountingCategoryRule[] = [
  {
    id: 'cat_in_sales',
    name: 'Sales / Service Revenue',
    direction: 'income',
    accountName: 'Revenue',
    accountType: 'income',
    debitAccount: 'Bank/Cash',
    creditAccount: 'Revenue',
    affectsPL: true,
    plSection: 'revenue',
    profitEffect: 1,
    cashEffect: 1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Revenue',
    description: 'Revenue from core sales and services rendered.',
  },
  {
    id: 'cat_in_customer_payment',
    name: 'Customer Payment (against an invoice)',
    direction: 'income',
    accountName: 'Accounts Receivable',
    accountType: 'asset',
    debitAccount: 'Bank/Cash',
    creditAccount: 'Accounts Receivable',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: 1,
    balanceSheetLine: 'receivables',
    cashFlowSection: 'operating',
    noteAffected: 'Receivables',
    description: 'Collection of an open invoice. Decreases receivables, does not duplicate revenue.',
  },
  {
    id: 'cat_in_customer_deposit',
    name: 'Customer Deposit / Advance',
    direction: 'income',
    accountName: 'Customer Deposits (liability)',
    accountType: 'liability',
    debitAccount: 'Bank/Cash',
    creditAccount: 'Customer Deposits (liability)',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: 1,
    balanceSheetLine: 'customer_deposits',
    cashFlowSection: 'operating',
    noteAffected: 'Other payables',
    description: 'Advance payment received before goods/services delivered. Recorded as liability.',
  },
  {
    id: 'cat_in_interest_income',
    name: 'Interest Income',
    direction: 'income',
    accountName: 'Interest Income',
    accountType: 'income',
    debitAccount: 'Bank/Cash',
    creditAccount: 'Interest Income',
    affectsPL: true,
    plSection: 'other_income',
    profitEffect: 1,
    cashEffect: 1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Other income',
    description: 'Interest earned from bank balances or treasury investments.',
  },
  {
    id: 'cat_in_other_income',
    name: 'Other Income (grants, commissions, misc.)',
    direction: 'income',
    accountName: 'Other Income',
    accountType: 'income',
    debitAccount: 'Bank/Cash',
    creditAccount: 'Other Income',
    affectsPL: true,
    plSection: 'other_income',
    profitEffect: 1,
    cashEffect: 1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Other income',
    description: 'Non-operating inflows like grants, subsidies, and side commissions.',
  },
  {
    id: 'cat_in_supplier_refund',
    name: 'Supplier Refund',
    direction: 'income',
    accountName: 'Original expense account (or Supplier Prepayment)',
    accountType: 'income',
    debitAccount: 'Bank/Cash',
    creditAccount: 'Original expense account (or Supplier Prepayment)',
    affectsPL: true,
    plSection: 'other_income',
    profitEffect: 1,
    cashEffect: 1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expense line',
    description: 'Reimbursement or refund from a vendor, offsetting original expense.',
  },
  {
    id: 'cat_in_owner_capital',
    name: 'Owner Capital Injection',
    direction: 'income',
    accountName: 'Share Capital',
    accountType: 'equity',
    debitAccount: 'Bank/Cash',
    creditAccount: 'Share Capital',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: 1,
    balanceSheetLine: 'share_capital',
    cashFlowSection: 'financing',
    noteAffected: 'Share capital',
    description: 'Capital injected by owners/shareholders. Increases equity directly without touching P&L.',
  },
  {
    id: 'cat_in_loan_received',
    name: 'Loan Received',
    direction: 'income',
    accountName: 'Loan Payable',
    accountType: 'liability',
    debitAccount: 'Bank/Cash',
    creditAccount: 'Loan Payable',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: 1,
    balanceSheetLine: 'loan_payable',
    cashFlowSection: 'financing',
    noteAffected: 'Borrowings',
    description: 'Disbursement of borrowed capital from banks or lenders. Increases liability.',
  },
  {
    id: 'cat_in_director_loan',
    name: 'Director / Shareholder Loan',
    direction: 'income',
    accountName: "Director's Loan Account (liability)",
    accountType: 'liability',
    debitAccount: 'Bank/Cash',
    creditAccount: "Director's Loan Account (liability)",
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: 1,
    balanceSheetLine: 'director_loan',
    cashFlowSection: 'financing',
    noteAffected: 'Related parties',
    description: 'Temporary funding provided by a director or shareholder.',
  },
  {
    id: 'cat_in_asset_sale',
    name: 'Asset Sale Proceeds',
    direction: 'income',
    accountName: 'PPE (cost)',
    accountType: 'asset',
    debitAccount: 'Bank/Cash',
    creditAccount: 'PPE (cost)',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: 1,
    balanceSheetLine: 'ppe',
    cashFlowSection: 'investing',
    noteAffected: 'PPE (disposals)',
    description: 'Proceeds from the disposal of fixed assets (Property, Plant and Equipment).',
  },
  {
    id: 'cat_in_transfer',
    name: 'Transfer In (own account)',
    direction: 'transfer',
    accountName: 'Bank/Cash (sending account)',
    accountType: 'asset',
    debitAccount: 'Bank/Cash (receiving account)',
    creditAccount: 'Bank/Cash (sending account)',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: 0,
    balanceSheetLine: 'cash',
    cashFlowSection: 'none',
    noteAffected: 'Cash breakdown',
    description: 'Internal transfer between own business bank or cash accounts. Net change 0.',
  },
  {
    id: 'cat_in_uncategorized',
    name: 'Uncategorized In',
    direction: 'income',
    accountName: 'Suspense (liability)',
    accountType: 'liability',
    debitAccount: 'Bank/Cash',
    creditAccount: 'Suspense (liability)',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: 1,
    balanceSheetLine: 'suspense_liability',
    cashFlowSection: 'operating',
    noteAffected: 'Unresolved items',
    description: 'Unidentified inflow held in Suspense. P&L remains untouched until classified.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 32 MONEY OUT CATEGORIES
// ─────────────────────────────────────────────────────────────────────────────
export const MONEY_OUT_CATEGORIES: AccountingCategoryRule[] = [
  {
    id: 'cat_out_direct_costs',
    name: 'Direct Costs / Cost of Sales (hosting, subcontractors, materials used)',
    direction: 'expense',
    accountName: 'Cost of Sales',
    accountType: 'expense',
    debitAccount: 'Cost of Sales',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'cost_of_sales',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Cost of sales',
    description: 'Direct expenditures directly tied to delivering products or services.',
  },
  {
    id: 'cat_out_inventory',
    name: 'Inventory Purchase',
    direction: 'expense',
    accountName: 'Inventory (asset)',
    accountType: 'asset',
    debitAccount: 'Inventory (asset)',
    creditAccount: 'Bank/Cash',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: -1,
    balanceSheetLine: 'inventory',
    cashFlowSection: 'operating',
    noteAffected: 'Inventory',
    description: 'Purchase of goods held for sale. Increases asset; does not hit P&L until sold.',
  },
  // The 20 Standard Operating Expenses
  {
    id: 'cat_out_salaries',
    name: 'Salaries & Wages',
    direction: 'expense',
    accountName: 'Salaries & Wages (expense)',
    accountType: 'expense',
    debitAccount: 'Salaries & Wages (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Staff payroll, wages, stipends, and compensation.',
  },
  {
    id: 'cat_out_rent',
    name: 'Rent',
    direction: 'expense',
    accountName: 'Rent (expense)',
    accountType: 'expense',
    debitAccount: 'Rent (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Office, retail space, or facility rent.',
  },
  {
    id: 'cat_out_utilities',
    name: 'Utilities (electricity, water)',
    direction: 'expense',
    accountName: 'Utilities (electricity, water) (expense)',
    accountType: 'expense',
    debitAccount: 'Utilities (electricity, water) (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Power, electricity, water, and municipal utilities.',
  },
  {
    id: 'cat_out_internet',
    name: 'Internet & Telecoms',
    direction: 'expense',
    accountName: 'Internet & Telecoms (expense)',
    accountType: 'expense',
    debitAccount: 'Internet & Telecoms (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Broadband, cellular data, and telephone services.',
  },
  {
    id: 'cat_out_software',
    name: 'Software & Subscriptions',
    direction: 'expense',
    accountName: 'Software & Subscriptions (expense)',
    accountType: 'expense',
    debitAccount: 'Software & Subscriptions (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'SaaS tools, cloud infrastructure, and software licenses.',
  },
  {
    id: 'cat_out_marketing',
    name: 'Marketing & Advertising',
    direction: 'expense',
    accountName: 'Marketing & Advertising (expense)',
    accountType: 'expense',
    debitAccount: 'Marketing & Advertising (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Online ads, media campaigns, branding, and promotional activities.',
  },
  {
    id: 'cat_out_travel',
    name: 'Travel & Transport',
    direction: 'expense',
    accountName: 'Travel & Transport (expense)',
    accountType: 'expense',
    debitAccount: 'Travel & Transport (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Business travel, flights, accommodation, and transit fares.',
  },
  {
    id: 'cat_out_fuel',
    name: 'Fuel & Generator',
    direction: 'expense',
    accountName: 'Fuel & Generator (expense)',
    accountType: 'expense',
    debitAccount: 'Fuel & Generator (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Diesel, petrol, and generator operating costs.',
  },
  {
    id: 'cat_out_repairs',
    name: 'Repairs & Maintenance',
    direction: 'expense',
    accountName: 'Repairs & Maintenance (expense)',
    accountType: 'expense',
    debitAccount: 'Repairs & Maintenance (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Servicing of equipment, vehicle maintenance, and facility repairs.',
  },
  {
    id: 'cat_out_insurance',
    name: 'Insurance',
    direction: 'expense',
    accountName: 'Insurance (expense)',
    accountType: 'expense',
    debitAccount: 'Insurance (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Asset, health, fire, and general liability insurance premiums.',
  },
  {
    id: 'cat_out_supplies',
    name: 'Office Supplies',
    direction: 'expense',
    accountName: 'Office Supplies (expense)',
    accountType: 'expense',
    debitAccount: 'Office Supplies (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Stationery, paper, toner, and small consumable office items.',
  },
  {
    id: 'cat_out_professional',
    name: 'Professional Fees',
    direction: 'expense',
    accountName: 'Professional Fees (expense)',
    accountType: 'expense',
    debitAccount: 'Professional Fees (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Legal, accounting, audit, tax advisory, and consulting services.',
  },
  {
    id: 'cat_out_bank_charges',
    name: 'Bank Charges',
    direction: 'expense',
    accountName: 'Bank Charges (expense)',
    accountType: 'expense',
    debitAccount: 'Bank Charges (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Transfer fees, maintenance fees, stamp duties, and banking costs.',
  },
  {
    id: 'cat_out_licences',
    name: 'Licences & Registration Fees',
    direction: 'expense',
    accountName: 'Licences & Registration Fees (expense)',
    accountType: 'expense',
    debitAccount: 'Licences & Registration Fees (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Statutory fees, CAC filings, regulatory permits, and business licenses.',
  },
  {
    id: 'cat_out_training',
    name: 'Training',
    direction: 'expense',
    accountName: 'Training (expense)',
    accountType: 'expense',
    debitAccount: 'Training (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Staff development, workshops, professional exams, and seminars.',
  },
  {
    id: 'cat_out_welfare',
    name: 'Staff Welfare / Meals',
    direction: 'expense',
    accountName: 'Staff Welfare / Meals (expense)',
    accountType: 'expense',
    debitAccount: 'Staff Welfare / Meals (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Office meals, team lunches, refreshments, and employee welfare.',
  },
  {
    id: 'cat_out_logistics',
    name: 'Delivery & Logistics',
    direction: 'expense',
    accountName: 'Delivery & Logistics (expense)',
    accountType: 'expense',
    debitAccount: 'Delivery & Logistics (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Dispatch riders, freight, courier, and shipping expenses.',
  },
  {
    id: 'cat_out_commissions',
    name: 'Commissions Paid',
    direction: 'expense',
    accountName: 'Commissions Paid (expense)',
    accountType: 'expense',
    debitAccount: 'Commissions Paid (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Sales commissions paid to agents, distributors, and brokers.',
  },
  {
    id: 'cat_out_fines',
    name: 'Fines & Penalties',
    direction: 'expense',
    accountName: 'Fines & Penalties (expense)',
    accountType: 'expense',
    debitAccount: 'Fines & Penalties (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Traffic fines, late filing penalties, or statutory sanctions.',
  },
  {
    id: 'cat_out_misc',
    name: 'Miscellaneous Expense',
    direction: 'expense',
    accountName: 'Miscellaneous Expense (expense)',
    accountType: 'expense',
    debitAccount: 'Miscellaneous Expense (expense)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'operating_expense',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Expenses by nature',
    description: 'Incidental operating costs not falling under other defined lines.',
  },
  // Capital, Settlement & Non-P&L Outflows
  {
    id: 'cat_out_supplier_payment',
    name: 'Supplier Payment (against a bill)',
    direction: 'expense',
    accountName: 'Accounts Payable',
    accountType: 'liability',
    debitAccount: 'Accounts Payable',
    creditAccount: 'Bank/Cash',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: -1,
    balanceSheetLine: 'payables',
    cashFlowSection: 'operating',
    noteAffected: 'Payables',
    description: 'Settlement of vendor invoice/bill. Decreases liability; no new P&L impact.',
  },
  {
    id: 'cat_out_prepayment',
    name: 'Prepayment (rent, insurance paid in advance)',
    direction: 'expense',
    accountName: 'Prepaid Expense (asset)',
    accountType: 'asset',
    debitAccount: 'Prepaid Expense (asset)',
    creditAccount: 'Bank/Cash',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: -1,
    balanceSheetLine: 'prepayments',
    cashFlowSection: 'operating',
    noteAffected: 'Prepayments',
    description: 'Expense paid in advance for future periods. Assets increase; released monthly.',
  },
  {
    id: 'cat_out_ppe',
    name: 'Fixed Asset Purchase (laptops, vehicles, equipment, furniture)',
    direction: 'expense',
    accountName: 'PPE (by asset class)',
    accountType: 'asset',
    debitAccount: 'PPE (by asset class)',
    creditAccount: 'Bank/Cash',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: -1,
    balanceSheetLine: 'ppe',
    cashFlowSection: 'investing',
    noteAffected: 'PPE (additions)',
    description: 'Capital expenditure on equipment or machinery. Added to PPE on Balance Sheet.',
  },
  {
    id: 'cat_out_loan_principal',
    name: 'Loan Repayment: Principal',
    direction: 'expense',
    accountName: 'Loan Payable',
    accountType: 'liability',
    debitAccount: 'Loan Payable',
    creditAccount: 'Bank/Cash',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: -1,
    balanceSheetLine: 'loan_payable',
    cashFlowSection: 'financing',
    noteAffected: 'Borrowings',
    description: 'Repayment of loan principal. Reduces loan liability without affecting P&L.',
  },
  {
    id: 'cat_out_loan_interest',
    name: 'Loan Interest',
    direction: 'expense',
    accountName: 'Finance Cost',
    accountType: 'expense',
    debitAccount: 'Finance Cost',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'finance_cost',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Finance cost',
    description: 'Interest and finance charges on debt. Charged as finance expense on P&L.',
  },
  {
    id: 'cat_out_dividends',
    name: 'Dividends',
    direction: 'expense',
    accountName: 'Retained Earnings (Dividends)',
    accountType: 'equity',
    debitAccount: 'Retained Earnings (Dividends)',
    creditAccount: 'Bank/Cash',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'financing',
    noteAffected: 'Dividends',
    description: 'Distribution of profits to shareholders. Decreases equity directly without hitting P&L.',
  },
  {
    id: 'cat_out_director_withdrawal',
    name: "Director's Withdrawal",
    direction: 'expense',
    accountName: "Director's Loan Account",
    accountType: 'liability',
    debitAccount: "Director's Loan Account",
    creditAccount: 'Bank/Cash',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: -1,
    balanceSheetLine: 'director_loan',
    cashFlowSection: 'financing',
    noteAffected: 'Related parties',
    description: 'Drawings or withdrawals made by directors. Reduces director loan balance.',
  },
  {
    id: 'cat_out_customer_refund',
    name: 'Customer Refund',
    direction: 'expense',
    accountName: 'Sales Returns (or Customer Deposits if refunding a deposit)',
    accountType: 'income',
    debitAccount: 'Sales Returns (or Customer Deposits if refunding a deposit)',
    creditAccount: 'Bank/Cash',
    affectsPL: true,
    plSection: 'sales_returns',
    profitEffect: -1,
    cashEffect: -1,
    balanceSheetLine: 'retained_earnings',
    cashFlowSection: 'operating',
    noteAffected: 'Revenue',
    description: 'Refund given to customers for returns or cancellations. Reduces revenue on P&L.',
  },
  {
    id: 'cat_out_transfer',
    name: 'Transfer Out (own account)',
    direction: 'transfer',
    accountName: 'Bank/Cash (sending account)',
    accountType: 'asset',
    debitAccount: 'Bank/Cash (receiving account)',
    creditAccount: 'Bank/Cash (sending account)',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: 0,
    balanceSheetLine: 'cash',
    cashFlowSection: 'none',
    noteAffected: 'Cash breakdown',
    description: 'Outflow to another company bank account. Net cash change is 0.',
  },
  {
    id: 'cat_out_uncategorized',
    name: 'Uncategorized Out',
    direction: 'expense',
    accountName: 'Suspense (asset)',
    accountType: 'asset',
    debitAccount: 'Suspense (asset)',
    creditAccount: 'Bank/Cash',
    affectsPL: false,
    plSection: null,
    profitEffect: 0,
    cashEffect: -1,
    balanceSheetLine: 'suspense_asset',
    cashFlowSection: 'operating',
    noteAffected: 'Unresolved items',
    description: 'Unidentified outflow held in Suspense. P&L remains untouched until classified.',
  },
];

// Unified list of all 44 official categories
export const ALL_ACCOUNTING_CATEGORIES: AccountingCategoryRule[] = [
  ...MONEY_IN_CATEGORIES,
  ...MONEY_OUT_CATEGORIES,
];

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY RESOLVER & MATCHER
// ─────────────────────────────────────────────────────────────────────────────
export function getCategoryRule(
  categoryName?: string | null,
  txType?: 'income' | 'expense' | 'transfer',
  description?: string | null
): AccountingCategoryRule {
  const normCat = (categoryName || '').toLowerCase().trim();
  const normDesc = (description || '').toLowerCase().trim();

  // 1. Direct exact name match
  const exact = ALL_ACCOUNTING_CATEGORIES.find(
    c => c.name.toLowerCase() === normCat
  );
  if (exact) return exact;

  // 2. Directional checks & aliases
  if (txType === 'transfer' || normCat.includes('transfer') || normDesc.includes('transfer')) {
    if (txType === 'expense' || normDesc.includes('transfer out')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_transfer')!;
    }
    return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_transfer')!;
  }

  // Check specific Money IN rules
  if (txType === 'income') {
    if (normCat.includes('capital') || normCat.includes('injection') || normCat.includes('shareholder investment') || normDesc.includes('capital injection') || normDesc.includes('founder funding')) {
      return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_owner_capital')!;
    }
    if (normCat.includes('loan received') || (normCat.includes('loan') && !normCat.includes('director') && !normCat.includes('interest')) || normDesc.includes('loan received') || normDesc.includes('loan disbursement')) {
      return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_loan_received')!;
    }
    if (normCat.includes('director') || normDesc.includes('director loan') || normDesc.includes('shareholder loan')) {
      return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_director_loan')!;
    }
    if (normCat.includes('customer payment') || normCat.includes('against an invoice') || normDesc.includes('invoice payment') || normDesc.includes('settle invoice')) {
      return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_customer_payment')!;
    }
    if (normCat.includes('deposit') || normCat.includes('advance') || normDesc.includes('customer deposit') || normDesc.includes('advance payment')) {
      return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_customer_deposit')!;
    }
    if (normCat.includes('interest') || normDesc.includes('interest income') || normDesc.includes('bank interest')) {
      return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_interest_income')!;
    }
    if (normCat.includes('refund') || normDesc.includes('supplier refund') || normDesc.includes('vendor refund')) {
      return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_supplier_refund')!;
    }
    if (normCat.includes('asset sale') || normDesc.includes('asset sale') || normDesc.includes('disposal proceed')) {
      return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_asset_sale')!;
    }
    if (normCat.includes('uncategorized') || normCat === '' || normCat === 'unknown') {
      return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_uncategorized')!;
    }
    if (normCat.includes('grant') || normCat.includes('commission') || normCat.includes('other income')) {
      return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_other_income')!;
    }
    // Default fallback for income is Sales / Service Revenue
    return MONEY_IN_CATEGORIES.find(c => c.id === 'cat_in_sales')!;
  }

  // Check specific Money OUT rules
  if (txType === 'expense' || !txType) {
    if (normCat.includes('direct cost') || normCat.includes('cost of sales') || normCat.includes('cogs') || normDesc.includes('cost of sales') || normDesc.includes('hosting') || normDesc.includes('subcontractor')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_direct_costs')!;
    }
    if (normCat.includes('inventory') || normDesc.includes('inventory purchase') || normDesc.includes('stock purchase')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_inventory')!;
    }
    if (normCat.includes('salary') || normCat.includes('salaries') || normCat.includes('wage') || normCat.includes('payroll')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_salaries')!;
    }
    if (normCat.includes('rent')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_rent')!;
    }
    if (normCat.includes('utility') || normCat.includes('utilities') || normCat.includes('electricity') || normCat.includes('water')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_utilities')!;
    }
    if (normCat.includes('telecom') || normCat.includes('internet') || normCat.includes('airtime') || normCat.includes('data')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_internet')!;
    }
    if (normCat.includes('software') || normCat.includes('subscription') || normCat.includes('saas') || normCat.includes('app')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_software')!;
    }
    if (normCat.includes('marketing') || normCat.includes('advert')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_marketing')!;
    }
    if (normCat.includes('travel') || normCat.includes('transport') || normCat.includes('uber') || normCat.includes('bolt') || normCat.includes('flight')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_travel')!;
    }
    if (normCat.includes('fuel') || normCat.includes('diesel') || normCat.includes('petrol') || normCat.includes('generator')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_fuel')!;
    }
    if (normCat.includes('repair') || normCat.includes('maintenance')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_repairs')!;
    }
    if (normCat.includes('insurance')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_insurance')!;
    }
    if (normCat.includes('supplies') || normCat.includes('stationery')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_supplies')!;
    }
    if (normCat.includes('professional') || normCat.includes('legal') || normCat.includes('audit') || normCat.includes('consult')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_professional')!;
    }
    if (normCat.includes('bank charge') || normCat.includes('bank fee') || normCat.includes('transfer fee')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_bank_charges')!;
    }
    if (normCat.includes('licence') || normCat.includes('license') || normCat.includes('registration') || normCat.includes('cac fee')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_licences')!;
    }
    if (normCat.includes('training') || normCat.includes('course') || normCat.includes('seminar')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_training')!;
    }
    if (normCat.includes('welfare') || normCat.includes('meal') || normCat.includes('lunch') || normCat.includes('food')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_welfare')!;
    }
    if (normCat.includes('delivery') || normCat.includes('logistics') || normCat.includes('shipping') || normCat.includes('freight')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_logistics')!;
    }
    if (normCat.includes('commission')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_commissions')!;
    }
    if (normCat.includes('fine') || normCat.includes('penalty')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_fines')!;
    }
    if (normCat.includes('supplier payment') || normCat.includes('against a bill') || normDesc.includes('bill payment') || normDesc.includes('vendor payment')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_supplier_payment')!;
    }
    if (normCat.includes('prepayment') || normDesc.includes('prepaid')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_prepayment')!;
    }
    if (normCat.includes('fixed asset') || normCat.includes('asset purchase') || normCat.includes('equipment') || normCat.includes('laptop') || normCat.includes('furniture') || normCat.includes('vehicle')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_ppe')!;
    }
    if (normCat.includes('loan repayment') || (normCat.includes('principal') && normCat.includes('loan')) || normDesc.includes('loan principal')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_loan_principal')!;
    }
    if (normCat.includes('loan interest') || normCat.includes('finance cost') || normDesc.includes('loan interest')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_loan_interest')!;
    }
    if (normCat.includes('dividend') || normDesc.includes('dividend')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_dividends')!;
    }
    if (normCat.includes('director') || normDesc.includes("director's withdrawal") || normDesc.includes('drawing')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_director_withdrawal')!;
    }
    if (normCat.includes('refund') || normCat.includes('customer refund') || normDesc.includes('sales return')) {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_customer_refund')!;
    }
    if (normCat.includes('uncategorized') || normCat === '' || normCat === 'unknown') {
      return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_uncategorized')!;
    }
    // Default fallback for expense
    return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_misc')!;
  }

  return MONEY_OUT_CATEGORIES.find(c => c.id === 'cat_out_misc')!;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPREHENSIVE ACCOUNTING ENGINE FOR HUB & STATEMENTS
// ─────────────────────────────────────────────────────────────────────────────

export type AccountingTransaction = {
  id?: string;
  date: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description?: string;
  category?: { name?: string; id?: string } | null;
  account?: { name?: string; id?: string; type?: string } | null;
};

export type AccountingHubSummary = {
  // Profit & Loss
  pl: {
    revenue: number;
    salesReturns: number;
    netRevenue: number;
    costOfSales: number;
    grossProfit: number;
    operatingExpensesByCategory: Record<string, number>;
    totalOperatingExpenses: number;
    operatingProfit: number;
    otherIncomeByCategory: Record<string, number>;
    totalOtherIncome: number;
    financeCosts: number;
    netProfit: number;
    profitMargin: number;
  };

  // Balance Sheet
  bs: {
    // Current Assets
    cashAndBank: number;
    accountsReceivable: number;
    inventory: number;
    prepayments: number;
    suspenseAsset: number;
    totalCurrentAssets: number;

    // Non-Current Assets
    ppe: number;
    totalNonCurrentAssets: number;
    totalAssets: number;

    // Current Liabilities
    accountsPayable: number;
    customerDeposits: number;
    directorLoanPayable: number;
    suspenseLiability: number;
    totalCurrentLiabilities: number;

    // Non-Current Liabilities
    loanPayable: number;
    totalNonCurrentLiabilities: number;
    totalLiabilities: number;

    // Equity
    shareCapital: number;
    retainedEarnings: number;
    otherReserves: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;

    // Balance check
    isBalanced: boolean;
    difference: number;
  };

  // Cash Flow
  cashFlow: {
    operatingInflows: number;
    operatingOutflows: number;
    netOperating: number;
    investingInflows: number;
    investingOutflows: number;
    netInvesting: number;
    financingInflows: number;
    financingOutflows: number;
    netFinancing: number;
    netChangeInCash: number;
    closingCash: number;
  };

  // Changes in Equity
  soce: {
    openingShareCapital: number;
    capitalInjections: number;
    closingShareCapital: number;
    openingRetainedEarnings: number;
    currentProfit: number;
    dividends: number;
    closingRetainedEarnings: number;
    closingEquity: number;
  };

  // Suspense / Closing status
  suspense: {
    inflowSuspense: number;
    outflowSuspense: number;
    netSuspense: number;
    isClear: boolean;
  };

  // General Ledger accounts & lines
  ledgerAccounts: {
    name: string;
    type: AccountType;
    totalDebit: number;
    totalCredit: number;
    balance: number;
    entries: {
      date: string;
      description: string;
      debit: number;
      credit: number;
      balance: number;
      ref?: string;
    }[];
  }[];

  // Trial Balance lines
  trialBalanceLines: {
    account: string;
    type: AccountType;
    debit: number;
    credit: number;
  }[];
  totalTrialDebits: number;
  totalTrialCredits: number;
  isTrialBalanced: boolean;
};

export function computeAccountingHubFinancials(
  transactions: AccountingTransaction[],
  priorTransactions: AccountingTransaction[] = [],
  options: {
    baselineCash?: number;
    baselineShareCapital?: number;
    baselineRetainedEarnings?: number;
  } = {}
): AccountingHubSummary {
  // ── Profit & Loss accumulators ──
  let revenue = 0;
  let salesReturns = 0;
  let costOfSales = 0;
  const operatingExpensesByCategory: Record<string, number> = {};
  const otherIncomeByCategory: Record<string, number> = {};
  let financeCosts = 0;

  // ── Balance Sheet position accumulators ──
  let cashAndBank = options.baselineCash || 0;
  let accountsReceivable = 0;
  let inventory = 0;
  let prepayments = 0;
  let suspenseAsset = 0;
  let ppe = 0;

  let accountsPayable = 0;
  let customerDeposits = 0;
  let directorLoanPayable = 0;
  let suspenseLiability = 0;
  let loanPayable = 0;

  let shareCapital = options.baselineShareCapital || 0;
  let capitalInjections = 0;
  let dividends = 0;

  // Prior retained earnings
  const priorSummary = priorTransactions.length > 0
    ? computeAccountingHubFinancials(priorTransactions)
    : null;
  const openingRetainedEarnings = options.baselineRetainedEarnings ?? (priorSummary ? priorSummary.pl.netProfit : 0);

  // ── Cash Flow accumulators ──
  let operatingInflows = 0;
  let operatingOutflows = 0;
  let investingInflows = 0;
  let investingOutflows = 0;
  let financingInflows = 0;
  let financingOutflows = 0;

  // ── Ledger map ──
  const ledgerMap = new Map<
    string,
    {
      name: string;
      type: AccountType;
      totalDebit: number;
      totalCredit: number;
      balance: number;
      entries: { date: string; description: string; debit: number; credit: number; balance: number; ref?: string }[];
    }
  >();

  function getOrCreateLedger(name: string, type: AccountType) {
    if (!ledgerMap.has(name)) {
      ledgerMap.set(name, {
        name,
        type,
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
        entries: [],
      });
    }
    return ledgerMap.get(name)!;
  }

  // Process all transactions chronologically
  const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  sorted.forEach(tx => {
    const amt = Number(tx.amount) || 0;
    if (amt <= 0) return;

    const catName = tx.category?.name || 'Uncategorized';
    const rule = getCategoryRule(catName, tx.type, tx.description);
    const bankAccountName = tx.account?.name || 'Bank/Cash';
    const desc = tx.description || rule.name;

    // ── 1. Double-Entry General Ledger Posting ──
    if (rule.direction === 'income') {
      // Money IN: Debit Bank/Cash, Credit Category Account
      const debitAcc = getOrCreateLedger(bankAccountName, 'asset');
      const creditAcc = getOrCreateLedger(rule.accountName, rule.accountType);

      debitAcc.totalDebit += amt;
      debitAcc.balance += amt;
      debitAcc.entries.push({
        date: tx.date,
        description: desc,
        debit: amt,
        credit: 0,
        balance: debitAcc.balance,
      });

      creditAcc.totalCredit += amt;
      creditAcc.balance += amt;
      creditAcc.entries.push({
        date: tx.date,
        description: desc,
        debit: 0,
        credit: amt,
        balance: creditAcc.balance,
      });

      // Cash flow & Cash position
      cashAndBank += amt;
      if (rule.cashFlowSection === 'operating') operatingInflows += amt;
      else if (rule.cashFlowSection === 'investing') investingInflows += amt;
      else if (rule.cashFlowSection === 'financing') financingInflows += amt;

      // Balance Sheet & P&L specific effects
      switch (rule.id) {
        case 'cat_in_sales':
          revenue += amt;
          break;
        case 'cat_in_customer_payment':
          // Receivables reduced
          accountsReceivable -= amt;
          break;
        case 'cat_in_customer_deposit':
          customerDeposits += amt;
          break;
        case 'cat_in_interest_income':
          otherIncomeByCategory['Interest Income'] = (otherIncomeByCategory['Interest Income'] || 0) + amt;
          break;
        case 'cat_in_other_income':
          otherIncomeByCategory[desc || 'Other Income'] = (otherIncomeByCategory[desc || 'Other Income'] || 0) + amt;
          break;
        case 'cat_in_supplier_refund':
          otherIncomeByCategory['Supplier Refund / Expense Recovery'] = (otherIncomeByCategory['Supplier Refund / Expense Recovery'] || 0) + amt;
          break;
        case 'cat_in_owner_capital':
          shareCapital += amt;
          capitalInjections += amt;
          break;
        case 'cat_in_loan_received':
          loanPayable += amt;
          break;
        case 'cat_in_director_loan':
          directorLoanPayable += amt;
          break;
        case 'cat_in_asset_sale':
          ppe -= amt;
          break;
        case 'cat_in_uncategorized':
          suspenseLiability += amt;
          break;
      }
    } else if (rule.direction === 'expense') {
      // Money OUT: Debit Category Account, Credit Bank/Cash
      const debitAcc = getOrCreateLedger(rule.accountName, rule.accountType);
      const creditAcc = getOrCreateLedger(bankAccountName, 'asset');

      debitAcc.totalDebit += amt;
      debitAcc.balance += amt;
      debitAcc.entries.push({
        date: tx.date,
        description: desc,
        debit: amt,
        credit: 0,
        balance: debitAcc.balance,
      });

      creditAcc.totalCredit += amt;
      creditAcc.balance -= amt;
      creditAcc.entries.push({
        date: tx.date,
        description: desc,
        debit: 0,
        credit: amt,
        balance: creditAcc.balance,
      });

      // Cash flow & Cash position
      cashAndBank -= amt;
      if (rule.cashFlowSection === 'operating') operatingOutflows += amt;
      else if (rule.cashFlowSection === 'investing') investingOutflows += amt;
      else if (rule.cashFlowSection === 'financing') financingOutflows += amt;

      // Balance Sheet & P&L specific effects
      switch (rule.id) {
        case 'cat_out_direct_costs':
          costOfSales += amt;
          break;
        case 'cat_out_inventory':
          inventory += amt;
          break;
        case 'cat_out_supplier_payment':
          accountsPayable -= amt;
          break;
        case 'cat_out_prepayment':
          prepayments += amt;
          break;
        case 'cat_out_ppe':
          ppe += amt;
          break;
        case 'cat_out_loan_principal':
          loanPayable -= amt;
          break;
        case 'cat_out_loan_interest':
          financeCosts += amt;
          break;
        case 'cat_out_dividends':
          dividends += amt;
          break;
        case 'cat_out_director_withdrawal':
          directorLoanPayable -= amt;
          break;
        case 'cat_out_customer_refund':
          salesReturns += amt;
          break;
        case 'cat_out_uncategorized':
          suspenseAsset += amt;
          break;
        default:
          // The 20 operating expenses
          if (rule.plSection === 'operating_expense') {
            const expLabel = rule.name;
            operatingExpensesByCategory[expLabel] = (operatingExpensesByCategory[expLabel] || 0) + amt;
          }
          break;
      }
    } else {
      // Transfer between own accounts
      const debitAcc = getOrCreateLedger(rule.debitAccount, 'asset');
      const creditAcc = getOrCreateLedger(rule.creditAccount, 'asset');

      debitAcc.totalDebit += amt;
      debitAcc.balance += amt;
      debitAcc.entries.push({ date: tx.date, description: desc, debit: amt, credit: 0, balance: debitAcc.balance });

      creditAcc.totalCredit += amt;
      creditAcc.balance -= amt;
      creditAcc.entries.push({ date: tx.date, description: desc, debit: 0, credit: amt, balance: creditAcc.balance });
    }
  });

  // ── Profit & Loss totals ──
  const netRevenue = revenue - salesReturns;
  const grossProfit = netRevenue - costOfSales;
  const totalOperatingExpenses = Object.values(operatingExpensesByCategory).reduce((s, v) => s + v, 0);
  const operatingProfit = grossProfit - totalOperatingExpenses;
  const totalOtherIncome = Object.values(otherIncomeByCategory).reduce((s, v) => s + v, 0);
  const netProfit = operatingProfit + totalOtherIncome - financeCosts;
  const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  // ── Equity & Balance Sheet reconciliation ──
  const retainedEarnings = openingRetainedEarnings + netProfit - dividends;
  const totalCurrentAssets = cashAndBank + accountsReceivable + inventory + prepayments + suspenseAsset;
  const totalNonCurrentAssets = ppe;
  const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

  const totalCurrentLiabilities = accountsPayable + customerDeposits + directorLoanPayable + suspenseLiability;
  const totalNonCurrentLiabilities = loanPayable;
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

  const otherReserves = 0;
  const totalEquity = shareCapital + retainedEarnings + otherReserves;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  const difference = Math.abs(totalAssets - totalLiabilitiesAndEquity);
  const isBalanced = difference < 0.01;

  // ── Cash Flow net change ──
  const netOperating = operatingInflows - operatingOutflows;
  const netInvesting = investingInflows - investingOutflows;
  const netFinancing = financingInflows - financingOutflows;
  const netChangeInCash = netOperating + netInvesting + netFinancing;

  // ── Trial Balance summary from Ledger ──
  const trialBalanceLines: { account: string; type: AccountType; debit: number; credit: number }[] = [];
  let totalTrialDebits = 0;
  let totalTrialCredits = 0;

  ledgerMap.forEach((acc) => {
    let debit = 0;
    let credit = 0;

    if (acc.type === 'asset' || acc.type === 'expense') {
      const net = acc.totalDebit - acc.totalCredit;
      if (net >= 0) debit = net;
      else credit = Math.abs(net);
    } else {
      const net = acc.totalCredit - acc.totalDebit;
      if (net >= 0) credit = net;
      else debit = Math.abs(net);
    }

    totalTrialDebits += debit;
    totalTrialCredits += credit;
    trialBalanceLines.push({
      account: acc.name,
      type: acc.type,
      debit,
      credit,
    });
  });

  const typeOrder: Record<AccountType, number> = { asset: 1, liability: 2, equity: 3, income: 4, expense: 5 };
  trialBalanceLines.sort((a, b) => typeOrder[a.type] - typeOrder[b.type] || a.account.localeCompare(b.account));

  const isTrialBalanced = Math.abs(totalTrialDebits - totalTrialCredits) < 0.01;

  return {
    pl: {
      revenue,
      salesReturns,
      netRevenue,
      costOfSales,
      grossProfit,
      operatingExpensesByCategory,
      totalOperatingExpenses,
      operatingProfit,
      otherIncomeByCategory,
      totalOtherIncome,
      financeCosts,
      netProfit,
      profitMargin,
    },
    bs: {
      cashAndBank,
      accountsReceivable,
      inventory,
      prepayments,
      suspenseAsset,
      totalCurrentAssets,
      ppe,
      totalNonCurrentAssets,
      totalAssets,
      accountsPayable,
      customerDeposits,
      directorLoanPayable,
      suspenseLiability,
      totalCurrentLiabilities,
      loanPayable,
      totalNonCurrentLiabilities,
      totalLiabilities,
      shareCapital,
      retainedEarnings,
      otherReserves,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced,
      difference,
    },
    cashFlow: {
      operatingInflows,
      operatingOutflows,
      netOperating,
      investingInflows,
      investingOutflows,
      netInvesting,
      financingInflows,
      financingOutflows,
      netFinancing,
      netChangeInCash,
      closingCash: cashAndBank,
    },
    soce: {
      openingShareCapital: options.baselineShareCapital || 0,
      capitalInjections,
      closingShareCapital: shareCapital,
      openingRetainedEarnings,
      currentProfit: netProfit,
      dividends,
      closingRetainedEarnings: retainedEarnings,
      closingEquity: totalEquity,
    },
    suspense: {
      inflowSuspense: suspenseLiability,
      outflowSuspense: suspenseAsset,
      netSuspense: suspenseLiability - suspenseAsset,
      isClear: suspenseLiability === 0 && suspenseAsset === 0,
    },
    ledgerAccounts: Array.from(ledgerMap.values()).sort(
      (a, b) => typeOrder[a.type] - typeOrder[b.type] || a.name.localeCompare(b.name)
    ),
    trialBalanceLines,
    totalTrialDebits,
    totalTrialCredits,
    isTrialBalanced,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY SEEDING & SYNC HELPER
// ─────────────────────────────────────────────────────────────────────────────
export async function ensureStandardAccountingCategories(
  supabaseClient: any,
  userId: string,
  existingCategories: any[]
): Promise<any[]> {
  if (!userId) return existingCategories;

  const existingNames = new Set(
    existingCategories.map(c => (c.name || '').toLowerCase().trim())
  );
  const missing = ALL_ACCOUNTING_CATEGORIES.filter(
    c => !existingNames.has(c.name.toLowerCase().trim())
  );

  if (missing.length === 0) return existingCategories;

  try {
    const toInsert = missing.map(c => ({
      user_id: userId,
      name: c.name,
      type: c.direction === 'transfer' ? 'both' : c.direction,
      icon: c.direction === 'income' ? 'trending-up' : c.direction === 'expense' ? 'credit-card' : 'arrow-right-left',
      color: c.direction === 'income' ? '#10b981' : c.direction === 'expense' ? '#ef4444' : '#6366f1',
      is_system: false,
    }));

    const { data, error } = await supabaseClient.from('categories').insert(toInsert).select();
    if (!error && data) {
      return [...existingCategories, ...data];
    }
  } catch (err) {
    console.warn('Could not batch-insert categories into Supabase:', err);
  }

  // Fallback virtual categories
  const virtual = missing.map(c => ({
    id: `virt_${c.id}`,
    name: c.name,
    type: c.direction === 'transfer' ? 'both' : c.direction,
    icon: 'tag',
    color: '#6366f1',
    is_system: false,
    user_id: userId,
  }));
  return [...existingCategories, ...virtual];
}
