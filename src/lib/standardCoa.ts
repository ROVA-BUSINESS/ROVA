import type { StatutoryAssetClass } from './supabase';

export type CoaAccountDefinition = {
  code: string;
  name: string;
  accountType: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  normalBalance: 'debit' | 'credit';
  statementLineMapping: string;
  currentClassification: 'Current' | 'Non-Current' | 'Equity' | 'Operating';
  cashFlowCategory: string;
  nrsSection?: 'revenue' | 'cos' | 'other_income' | 'admin' | 'sfp' | 'tax' | 'none';
  nrsDefaultLabel?: string;
};

export const STATUTORY_ASSET_RATES: Record<
  StatutoryAssetClass,
  { usefulLifeYears: number; deprRate: number; initialAllowanceRate: number; annualAllowanceRate: number; costCode: string; accumDeprCode: string; citCategory: string }
> = {
  'Leasehold Land & Buildings': {
    usefulLifeYears: 50,
    deprRate: 0.02,
    initialAllowanceRate: 0.15,
    annualAllowanceRate: 0.10,
    costCode: '1510',
    accumDeprCode: '1519',
    citCategory: 'Building Industrial',
  },
  'Plant & Heavy Machinery': {
    usefulLifeYears: 10,
    deprRate: 0.10,
    initialAllowanceRate: 0.50,
    annualAllowanceRate: 0.25,
    costCode: '1520',
    accumDeprCode: '1529',
    citCategory: 'Plants (excluding Furniture & Fittings)',
  },
  'Commercial Motor Vehicles': {
    usefulLifeYears: 5,
    deprRate: 0.20,
    initialAllowanceRate: 0.50,
    annualAllowanceRate: 0.25,
    costCode: '1530',
    accumDeprCode: '1539',
    citCategory: 'Motor Vehicles Expenditure',
  },
  'Office Furniture & Equipment': {
    usefulLifeYears: 5,
    deprRate: 0.20,
    initialAllowanceRate: 0.25,
    annualAllowanceRate: 0.20,
    costCode: '1540',
    accumDeprCode: '1549',
    citCategory: 'Furniture & Fittings Expenditure',
  },
  'Computer & IT Infrastructure': {
    usefulLifeYears: 3,
    deprRate: 0.3333,
    initialAllowanceRate: 0.50,
    annualAllowanceRate: 0.25,
    costCode: '1550',
    accumDeprCode: '1559',
    citCategory: 'Others',
  },
};

export const STANDARD_NIGERIA_COA: CoaAccountDefinition[] = [
  // Cash & Current Assets
  { code: '1010', name: 'Cash on Hand', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Cash and Cash Equivalents', currentClassification: 'Current', cashFlowCategory: 'Cash & Cash Equivalent', nrsSection: 'sfp', nrsDefaultLabel: 'Cash in hand' },
  { code: '1020', name: 'Zenith Bank Current Account', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Cash and Cash Equivalents', currentClassification: 'Current', cashFlowCategory: 'Cash & Cash Equivalent', nrsSection: 'sfp', nrsDefaultLabel: 'Cash at Bank' },
  { code: '1030', name: 'GTBank Operating Account', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Cash and Cash Equivalents', currentClassification: 'Current', cashFlowCategory: 'Cash & Cash Equivalent', nrsSection: 'sfp', nrsDefaultLabel: 'Cash at Bank' },
  { code: '1040', name: 'Short-Term Call Placements', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Cash and Cash Equivalents', currentClassification: 'Current', cashFlowCategory: 'Cash & Cash Equivalent', nrsSection: 'sfp', nrsDefaultLabel: 'marketable securities' },
  { code: '1110', name: 'Trade Accounts Receivable', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Trade and Other Receivables', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Trade Receivables' },
  { code: '1120', name: 'Allowance for ECL (Trade Debtors)', accountType: 'asset', normalBalance: 'credit', statementLineMapping: 'Trade and Other Receivables', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Trade Receivables' },
  { code: '1130', name: 'Other Receivables & Unallocated Sales Receipts Clearing', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Trade and Other Receivables', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Other receivables' },
  { code: '1140', name: 'Withholding Tax (WHT) Credit Notes', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Trade and Other Receivables', currentClassification: 'Current', cashFlowCategory: 'Tax Paid / Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Withholding tax receivables' },
  { code: '1210', name: 'Inventory - Goods for Resale', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Inventories', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Inventories' },
  { code: '1310', name: 'Prepaid Expenses (Rent & Insurance)', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Prepayments and Other Assets', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Prepaid Expenses' },
  { code: '1410', name: 'Value Added Tax (VAT) Input Recoverable', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Prepayments and Other Assets', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Other receivables' },
  { code: '1420', name: 'Security Deposits & Statutory Retentions', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Prepayments and Other Assets', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Advance payment to vendor' },

  // Non-Current Assets (PPE & Intangibles)
  { code: '1510', name: 'PPE Cost - Land & Buildings', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Property, Plant and Equipment', currentClassification: 'Non-Current', cashFlowCategory: 'Investing', nrsSection: 'sfp', nrsDefaultLabel: 'PPE' },
  { code: '1519', name: 'Accumulated Depreciation - Buildings', accountType: 'asset', normalBalance: 'credit', statementLineMapping: 'Property, Plant and Equipment', currentClassification: 'Non-Current', cashFlowCategory: 'Investing', nrsSection: 'sfp', nrsDefaultLabel: 'PPE' },
  { code: '1520', name: 'PPE Cost - Plant & Machinery', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Property, Plant and Equipment', currentClassification: 'Non-Current', cashFlowCategory: 'Investing', nrsSection: 'sfp', nrsDefaultLabel: 'PPE' },
  { code: '1529', name: 'Accumulated Depreciation - Plant & Machinery', accountType: 'asset', normalBalance: 'credit', statementLineMapping: 'Property, Plant and Equipment', currentClassification: 'Non-Current', cashFlowCategory: 'Investing', nrsSection: 'sfp', nrsDefaultLabel: 'PPE' },
  { code: '1530', name: 'PPE Cost - Motor Vehicles', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Property, Plant and Equipment', currentClassification: 'Non-Current', cashFlowCategory: 'Investing', nrsSection: 'sfp', nrsDefaultLabel: 'PPE' },
  { code: '1539', name: 'Accumulated Depreciation - Motor Vehicles', accountType: 'asset', normalBalance: 'credit', statementLineMapping: 'Property, Plant and Equipment', currentClassification: 'Non-Current', cashFlowCategory: 'Investing', nrsSection: 'sfp', nrsDefaultLabel: 'PPE' },
  { code: '1540', name: 'PPE Cost - Office Furniture & Equipment', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Property, Plant and Equipment', currentClassification: 'Non-Current', cashFlowCategory: 'Investing', nrsSection: 'sfp', nrsDefaultLabel: 'PPE' },
  { code: '1549', name: 'Accumulated Depreciation - Office Furniture', accountType: 'asset', normalBalance: 'credit', statementLineMapping: 'Property, Plant and Equipment', currentClassification: 'Non-Current', cashFlowCategory: 'Investing', nrsSection: 'sfp', nrsDefaultLabel: 'PPE' },
  { code: '1550', name: 'PPE Cost - Computer & IT Equipment', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Property, Plant and Equipment', currentClassification: 'Non-Current', cashFlowCategory: 'Investing', nrsSection: 'sfp', nrsDefaultLabel: 'PPE' },
  { code: '1559', name: 'Accumulated Depreciation - Computer & IT', accountType: 'asset', normalBalance: 'credit', statementLineMapping: 'Property, Plant and Equipment', currentClassification: 'Non-Current', cashFlowCategory: 'Investing', nrsSection: 'sfp', nrsDefaultLabel: 'PPE' },
  { code: '1610', name: 'Intangible Assets - Software & ERP Licenses', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Intangible Assets', currentClassification: 'Non-Current', cashFlowCategory: 'Investing', nrsSection: 'sfp', nrsDefaultLabel: 'Others' },

  // Current & Non-Current Liabilities
  { code: '2010', name: 'Trade Accounts Payable', accountType: 'liability', normalBalance: 'credit', statementLineMapping: 'Trade and Other Payables', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Trade Payables' },
  { code: '2020', name: 'Accrued Audit & Professional Fees', accountType: 'liability', normalBalance: 'credit', statementLineMapping: 'Trade and Other Payables', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Accruals' },
  { code: '2030', name: 'Accrued Salaries & Statutory Payroll', accountType: 'liability', normalBalance: 'credit', statementLineMapping: 'Trade and Other Payables', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Provision for bonuses and employee benefits' },
  { code: '2040', name: 'Value Added Tax (VAT) Output Payable', accountType: 'liability', normalBalance: 'credit', statementLineMapping: 'Trade and Other Payables', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Other payables' },
  { code: '2050', name: 'Withholding Tax (WHT) Payable', accountType: 'liability', normalBalance: 'credit', statementLineMapping: 'Trade and Other Payables', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Other payables' },
  { code: '2060', name: 'PAYE Tax Payable', accountType: 'liability', normalBalance: 'credit', statementLineMapping: 'Trade and Other Payables', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Other payables' },
  { code: '2070', name: 'Current Tax Liabilities (CIT & Levy)', accountType: 'liability', normalBalance: 'credit', statementLineMapping: 'Current Tax Liabilities', currentClassification: 'Current', cashFlowCategory: 'Tax Paid / Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Current tax liabilities' },
  { code: '2080', name: 'Customer Advances & Deferred Contract Revenue', accountType: 'liability', normalBalance: 'credit', statementLineMapping: 'Trade and Other Payables', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'sfp', nrsDefaultLabel: 'Unearned income (advance from customers)' },
  { code: '2510', name: 'Long-Term Bank Loan (5-yr Facility)', accountType: 'liability', normalBalance: 'credit', statementLineMapping: 'Borrowings (Non-Current)', currentClassification: 'Non-Current', cashFlowCategory: 'Financing', nrsSection: 'sfp', nrsDefaultLabel: 'Long term Borrowings' },
  { code: '2520', name: 'Director / Shareholder Current Account (Payable)', accountType: 'liability', normalBalance: 'credit', statementLineMapping: 'Short-Term Borrowings', currentClassification: 'Current', cashFlowCategory: 'Financing', nrsSection: 'sfp', nrsDefaultLabel: 'Other payables' },
  { code: '2530', name: 'Commercial Paper / Short-Term Facility', accountType: 'liability', normalBalance: 'credit', statementLineMapping: 'Short-Term Borrowings', currentClassification: 'Current', cashFlowCategory: 'Financing', nrsSection: 'sfp', nrsDefaultLabel: 'Short-term debt' },

  // Equity
  { code: '3010', name: 'Ordinary Share Capital', accountType: 'equity', normalBalance: 'credit', statementLineMapping: 'Share Capital', currentClassification: 'Equity', cashFlowCategory: 'Financing', nrsSection: 'sfp', nrsDefaultLabel: 'Issued Share Capital' },
  { code: '3020', name: 'Retained Earnings', accountType: 'equity', normalBalance: 'credit', statementLineMapping: 'Retained Earnings', currentClassification: 'Equity', cashFlowCategory: 'Financing', nrsSection: 'sfp', nrsDefaultLabel: 'Retained earnings' },
  { code: '3030', name: 'Owner Capital Contributions & Equity Injections', accountType: 'equity', normalBalance: 'credit', statementLineMapping: 'Share Capital', currentClassification: 'Equity', cashFlowCategory: 'Financing', nrsSection: 'sfp', nrsDefaultLabel: 'Equity contribution to shareholders/ Equity holders' },
  { code: '3040', name: 'Owner Drawings (Contra-Equity)', accountType: 'equity', normalBalance: 'debit', statementLineMapping: 'Retained Earnings', currentClassification: 'Equity', cashFlowCategory: 'Financing', nrsSection: 'sfp', nrsDefaultLabel: 'Retained earnings' },

  // Revenue
  { code: '4010', name: 'Revenue - Sale of Goods & Supply Contracts', accountType: 'income', normalBalance: 'credit', statementLineMapping: 'Revenue from Contracts', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'revenue' },
  { code: '4020', name: 'Revenue - Technical & Logistics Services', accountType: 'income', normalBalance: 'credit', statementLineMapping: 'Revenue from Contracts', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'revenue' },
  { code: '4090', name: 'Other Operating Income', accountType: 'income', normalBalance: 'credit', statementLineMapping: 'Other Operating Income', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'other_income', nrsDefaultLabel: 'Others' },

  // Cost of Sales
  { code: '5010', name: 'Cost of Goods Sold - Materials / Purchases', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Cost of Sales', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'cos', nrsDefaultLabel: 'Local Purchases' },
  { code: '5020', name: 'Direct Subcontracting & Technical Labour', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Cost of Sales', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'cos', nrsDefaultLabel: 'Direct wages' },
  { code: '5030', name: 'Direct Freight & Inward Haulage', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Cost of Sales', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'cos', nrsDefaultLabel: 'Carriage Inwards' },

  // Operating Expenses
  { code: '6010', name: 'Salaries & Wages', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Salary and Wages' },
  { code: '6020', name: 'Staff Welfare, Pensions & HMO', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Employee Benefit Expenses' },
  { code: '6030', name: 'Office Rent & Premises Rates', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Rent & Rates' },
  { code: '6040', name: 'Electricity, Diesel & Utilities', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Electricity & Power' },
  { code: '6050', name: 'Repairs & Facility Maintenance', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Repairs and Maintenance' },
  { code: '6060', name: 'Advertising & Marketing', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Advertisement & Promotion' },
  { code: '6070', name: 'Audit, Tax Advisory & Legal Fees', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Audit fees' },
  { code: '6080', name: 'IT, Software Subscriptions & Telecoms', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Software maintenance' },
  { code: '6090', name: 'Travel, Transport & Logistics', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Travel Expenses' },
  { code: '6100', name: 'Insurance Expenses', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Others' },
  { code: '6110', name: 'Printing, Stationery & Office Supplies', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Stationeries expenses' },
  { code: '6120', name: 'Bank Charges & Transaction Fees', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Bank charges' },
  { code: '6130', name: 'Depreciation Expense (P&L)', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'depreciation' },
  { code: '6140', name: 'Impairment Loss on Receivables (ECL)', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Operating Expenses', currentClassification: 'Operating', cashFlowCategory: 'Operating', nrsSection: 'admin', nrsDefaultLabel: 'Bad Debt written off' },

  // Finance & Tax
  { code: '7010', name: 'Finance Costs (Loan Interest)', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Finance Costs', currentClassification: 'Operating', cashFlowCategory: 'Financing', nrsSection: 'admin', nrsDefaultLabel: 'Interest Expense' },
  { code: '7020', name: 'Finance Income (Deposit Interest)', accountType: 'income', normalBalance: 'credit', statementLineMapping: 'Finance Income', currentClassification: 'Operating', cashFlowCategory: 'Investing', nrsSection: 'other_income', nrsDefaultLabel: 'Interest Income' },
  { code: '8010', name: 'Income Tax Expense (CIT & Dev Levy)', accountType: 'expense', normalBalance: 'debit', statementLineMapping: 'Taxation', currentClassification: 'Operating', cashFlowCategory: 'Tax Paid / Operating', nrsSection: 'tax' },

  // Suspense Clearing (Section 2.3)
  { code: '9999', name: 'Suspense & Unclassified Transactions Clearing', accountType: 'asset', normalBalance: 'debit', statementLineMapping: 'Trade and Other Receivables', currentClassification: 'Current', cashFlowCategory: 'Working Capital - Operating', nrsSection: 'none' },
];

export const COA_BY_CODE: Record<string, CoaAccountDefinition> = Object.fromEntries(
  STANDARD_NIGERIA_COA.map((a) => [a.code, a])
);

/** Maps Rova accountingRules category IDs -> standardized 4-digit COA code */
export const CATEGORY_ID_TO_COA_CODE: Record<string, string> = {
  cat_in_sales: '4010',
  cat_in_customer_payment: '1110',
  cat_in_customer_deposit: '2080',
  cat_in_interest_income: '7020',
  cat_in_other_income: '4090',
  cat_in_supplier_refund: '4090',
  cat_in_owner_capital: '3030',
  cat_in_loan_received: '2510',
  cat_in_director_loan: '2520',
  cat_in_asset_sale: '1530',
  cat_in_transfer: '1020',
  cat_in_uncategorized: '9999',

  cat_out_direct_costs: '5010',
  cat_out_inventory: '1210',
  cat_out_salaries: '6010',
  cat_out_rent: '6030',
  cat_out_utilities: '6040',
  cat_out_internet: '6080',
  cat_out_software: '6080',
  cat_out_marketing: '6060',
  cat_out_travel: '6090',
  cat_out_fuel: '6040',
  cat_out_repairs: '6050',
  cat_out_insurance: '6100',
  cat_out_supplies: '6110',
  cat_out_professional: '6070',
  cat_out_bank_charges: '6120',
  cat_out_licences: '6070',
  cat_out_training: '6020',
  cat_out_welfare: '6020',
  cat_out_logistics: '5030',
  cat_out_commissions: '6060',
  cat_out_fines: '6070',
  cat_out_misc: '6110',
  cat_out_supplier_payment: '2010',
  cat_out_prepayment: '1310',
  cat_out_ppe: '1550',
  cat_out_loan_principal: '2510',
  cat_out_loan_interest: '7010',
  cat_out_dividends: '3040',
  cat_out_director_withdrawal: '2520',
  cat_out_customer_refund: '4010',
  cat_out_transfer: '1020',
  cat_out_uncategorized: '9999',
};

/** Maps Rova category IDs -> NRS Admin Expense / Profit Adjustment labels */
export const CATEGORY_ID_TO_NRS_ADMIN_LABEL: Record<string, string> = {
  cat_out_salaries: 'Salary and Wages',
  cat_out_rent: 'Rent & Rates',
  cat_out_utilities: 'Electricity & Power',
  cat_out_internet: 'Internet Cost',
  cat_out_software: 'Software maintenance',
  cat_out_marketing: 'Advertisement & Promotion',
  cat_out_travel: 'Travel Expenses',
  cat_out_fuel: 'AGO-Diesel',
  cat_out_repairs: 'Repairs and Maintenance',
  cat_out_insurance: 'Others',
  cat_out_supplies: 'Stationeries expenses',
  cat_out_professional: 'other professional fees',
  cat_out_bank_charges: 'Bank charges',
  cat_out_licences: 'Licences & leases charges',
  cat_out_training: 'Training and Development',
  cat_out_welfare: 'Employee Benefit Expenses',
  cat_out_logistics: 'Freight & Transport Expenses',
  cat_out_commissions: 'Selling & Distribution Expenses',
  cat_out_fines: 'Fines',
  cat_out_misc: 'Others',
  cat_out_loan_interest: 'Interest Expense',
};
