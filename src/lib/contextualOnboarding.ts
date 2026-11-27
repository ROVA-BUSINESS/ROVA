/**
 * RovaFlow Contextual Feature Onboarding Definitions & State Persistence
 *
 * - 11 independent feature tours (each triggered on first visit to that feature).
 * - 13 contextual first-use subfeature tooltips.
 * - Completion/skip state persisted independently per user per feature in
 *   `profiles.onboarding_tours_state` (with localStorage mirror for instant reads).
 * - Never marks a tour complete on page close/unmount — only on explicit Finish or Skip.
 */

import { supabase } from './supabase';

export type FeatureTourKey =
  | 'dashboard'
  | 'transactions'
  | 'banking'
  | 'invoicing'
  | 'expenses'
  | 'accounting'
  | 'reports'
  | 'tax'
  | 'operations'
  | 'ai_productivity'
  | 'settings';

export type SubfeatureTipKey =
  | 'sub_loan_record'
  | 'sub_sales_inventory'
  | 'sub_invoice_create'
  | 'sub_bank_import'
  | 'sub_opening_balances'
  | 'sub_budget_create'
  | 'sub_fixed_asset_add'
  | 'sub_depreciation_run'
  | 'sub_journal_entry'
  | 'sub_period_lock'
  | 'sub_team_invite'
  | 'sub_recurring_bill'
  | 'sub_statement_of_account';

export interface OnboardingStepDef {
  id: string;
  title: string;
  description: string;
  /** Optional ordered fallback CSS selectors for spotlighting; omitted = centered modal */
  selectors?: string[];
  preferredPlacement?: 'right' | 'bottom' | 'top' | 'left';
  isFinal?: boolean;
}

export interface FeatureTourDef {
  key: FeatureTourKey;
  label: string;
  route: string;
  steps: OnboardingStepDef[];
}

export interface SubfeatureTipDef {
  key: SubfeatureTipKey;
  title: string;
  message: string;
}

export type OnboardingStateMap = Record<string, { status: 'completed' | 'skipped'; updated_at: string }>;

const LOCAL_STORAGE_KEY_PREFIX = 'rovaflow_contextual_onboarding_v1_';

export const FEATURE_TOURS: Record<FeatureTourKey, FeatureTourDef> = {
  dashboard: {
    key: 'dashboard',
    label: 'Dashboard & Overview',
    route: '/app/dashboard',
    steps: [
      {
        id: 'dash_welcome',
        title: 'Welcome to your Dashboard',
        description:
          "Welcome to your business command centre! This is where you get a quick overview of your business's financial health.",
      },
      {
        id: 'dash_kpis',
        title: 'Financial KPIs',
        description:
          'Monitor your Money In, Money Out, Connected Bank Balance and Profit Margin. These indicators help you understand how your business is performing.',
        selectors: ['[data-tour="dashboard-overview"]', '[data-tour="dashboard-money-in"]'],
        preferredPlacement: 'bottom',
      },
      {
        id: 'dash_cashflow',
        title: 'Cash Flow & Activity',
        description:
          'See how money moves through your business. Track income, expenses, recent transactions and financial activity.',
        selectors: ['[data-tour="dashboard-cashflow"]'],
        preferredPlacement: 'top',
      },
      {
        id: 'dash_quick_actions',
        title: 'Quick Actions',
        description:
          'Use these shortcuts to quickly record transactions and access frequently used features without navigating through multiple pages.',
        selectors: ['[data-tour="add-transaction-btn"]'],
        preferredPlacement: 'bottom',
      },
      {
        id: 'dash_search',
        title: 'Global Search',
        description:
          'Looking for something? Search across transactions, invoices, customers and other areas of your business.',
        selectors: ['[data-tour="global-search-btn"]'],
        preferredPlacement: 'bottom',
      },
      {
        id: 'dash_finish',
        title: "You're Ready!",
        description: "You're ready! Your business overview is just one click away.",
        isFinal: true,
      },
    ],
  },

  transactions: {
    key: 'transactions',
    label: 'Transactions & Smart Bookkeeping',
    route: '/app/transactions',
    steps: [
      {
        id: 'tx_welcome',
        title: 'Your Transaction Centre',
        description:
          'Every business transaction matters. Use this section to record and manage money entering and leaving your business.',
      },
      {
        id: 'tx_add',
        title: 'Add Transaction',
        description:
          'Click here to record Money In or Money Out. You can specify the amount, date, payment method, description and category.',
        selectors: ['[data-tour="add-transaction-btn"]', '[data-tour="mobile-nav-transactions"]'],
        preferredPlacement: 'bottom',
      },
      {
        id: 'tx_categories',
        title: 'Transaction Categories',
        description:
          "Choose the appropriate classification. You can record ordinary income and expenses, asset purchases, owner's drawings, capital contributions, loans and transfers.",
      },
      {
        id: 'tx_smart_cat',
        title: 'Smart Categorisation',
        description:
          "RovaFlow can automatically suggest categories for your transactions. When something is unclear, you'll be asked to clarify it before classification.",
      },
      {
        id: 'tx_assets',
        title: 'Asset Purchases',
        description:
          'When you record a qualifying equipment or asset purchase, RovaFlow can suggest adding it to your Fixed Asset Register instead of treating it as an ordinary expense.',
      },
      {
        id: 'tx_manage',
        title: 'Transaction Management',
        description: 'Search, filter, edit and review your transaction history whenever you need to.',
      },
      {
        id: 'tx_finish',
        title: 'Bookkeeping Ready',
        description: 'Your bookkeeping starts here. Keep your records accurate and up to date.',
        isFinal: true,
      },
    ],
  },

  banking: {
    key: 'banking',
    label: 'Banking & Payments',
    route: '/app/payment',
    steps: [
      {
        id: 'bank_connect',
        title: 'Connect Your Bank',
        description:
          'Connect your Nigerian business bank account through our supported banking integration to access balances and synchronise transactions.',
      },
      {
        id: 'bank_email',
        title: 'Bank Alert Synchronisation',
        description:
          'Connect your supported Gmail account to capture bank debit and credit alert emails and help record transactions.',
      },
      {
        id: 'bank_import',
        title: 'Import Bank Statements',
        description:
          'Have previous bank transactions? Upload a supported CSV bank statement to bring historical records into RovaFlow.',
      },
      {
        id: 'bank_links',
        title: 'Payment Links',
        description:
          'Create Paystack payment links that customers can use to pay your business through a public checkout page.',
      },
      {
        id: 'bank_settlement',
        title: 'Settlement Accounts',
        description: 'Manage the bank accounts designated to receive your Paystack settlements.',
      },
      {
        id: 'bank_finish',
        title: 'Banking Connected',
        description: 'Bring your business banking activity together in one place.',
        isFinal: true,
      },
    ],
  },

  invoicing: {
    key: 'invoicing',
    label: 'Invoicing, Sales & Receivables',
    route: '/app/invoices',
    steps: [
      {
        id: 'inv_welcome',
        title: 'Manage Your Sales',
        description:
          'Create professional invoices, track customer payments and manage outstanding balances from one place.',
      },
      {
        id: 'inv_create',
        title: 'Create an Invoice',
        description:
          'Create an invoice, add your customer, enter products or services, apply discounts or VAT where applicable, and generate a professional document.',
        selectors: ['[data-tour="nav-sales"]', '[data-tour="mobile-nav-invoice"]'],
        preferredPlacement: 'right',
      },
      {
        id: 'inv_payments',
        title: 'Payments & Receipts',
        description: 'Record full or partial payments and generate receipts to confirm payments received.',
      },
      {
        id: 'inv_customers',
        title: 'Customers',
        description:
          'Build your customer directory and monitor how much each customer has been billed, paid and still owes.',
      },
      {
        id: 'inv_statements',
        title: 'Statements of Account',
        description:
          'Generate customer statements showing invoices, payments, credit notes and running balances for a selected date range.',
      },
      {
        id: 'inv_credits',
        title: 'Credit Notes & Refunds',
        description:
          'Handle sales returns, invoice adjustments and refunds without deleting previously issued invoices.',
      },
      {
        id: 'inv_recurring',
        title: 'Recurring Invoices',
        description:
          'Automate invoices that repeat weekly, monthly, quarterly or annually. You can also configure overdue payment reminders.',
      },
      {
        id: 'inv_finish',
        title: 'Sales Tools Ready',
        description: 'You now have the tools to manage your sales and customer payments.',
        isFinal: true,
      },
    ],
  },

  expenses: {
    key: 'expenses',
    label: 'Bills, Expenses & Payables',
    route: '/app/expenses',
    steps: [
      {
        id: 'exp_welcome',
        title: 'Track Business Expenses',
        description:
          'Record the money your business spends. Add vendors, expense categories, payment methods and supporting receipts.',
        selectors: ['[data-tour="nav-expenses"]'],
        preferredPlacement: 'right',
      },
      {
        id: 'exp_bills',
        title: 'Vendor Bills',
        description:
          "Record bills you have received but haven't fully paid. Keep track of due dates, payments and outstanding balances.",
      },
      {
        id: 'exp_partial',
        title: 'Partial Payments',
        description:
          "Paid only part of a supplier's bill? Record the amount paid and RovaFlow will keep track of the remaining balance.",
      },
      {
        id: 'exp_recurring',
        title: 'Recurring Bills',
        description:
          "For expenses that repeat regularly, configure recurring bills so they're generated on their scheduled dates.",
      },
      {
        id: 'exp_suppliers',
        title: 'Suppliers & Contractors',
        description:
          'Manage your suppliers, external workers, service agreements and contractor payment balances.',
      },
      {
        id: 'exp_finish',
        title: 'Spending Under Control',
        description: 'Stay on top of your business spending and outstanding obligations.',
        isFinal: true,
      },
    ],
  },

  accounting: {
    key: 'accounting',
    label: 'Accounting Hub & Financial Statements',
    route: '/app/accounting',
    steps: [
      {
        id: 'acc_welcome',
        title: 'Welcome to Your Accounting Hub',
        description:
          'This is where your business records become structured financial information. Explore your financial statements, accounting books and reporting tools.',
      },
      {
        id: 'acc_statements',
        title: 'Financial Statements',
        description:
          'Understand your business performance and financial position through five key reports: Profit & Loss, Balance Sheet, Cash Flow Statement, Statement of Changes in Equity, and Notes to the Accounts.',
      },
      {
        id: 'acc_ledger',
        title: 'General Ledger & Books',
        description:
          'Access your underlying accounting records, including the General Ledger, Trial Balance, Chart of Accounts and Journal Entries.',
      },
      {
        id: 'acc_opening',
        title: 'Opening Balances',
        description:
          "Starting with RovaFlow from another accounting system or existing records? Enter your opening balances to establish your business's starting financial position.",
      },
      {
        id: 'acc_assets',
        title: 'Fixed Asset Register',
        description:
          'Track equipment, machinery, vehicles and other business assets. Configure useful lives, residual values and capitalisation thresholds.',
      },
      {
        id: 'acc_depreciation',
        title: 'Depreciation',
        description:
          'RovaFlow supports Straight-Line and Reducing Balance depreciation schedules and monthly depreciation journal runs.',
      },
      {
        id: 'acc_budgeting',
        title: 'SME Budgeting',
        description:
          'Create monthly or annual revenue and expense budgets. You can also generate a starter budget to get going.',
      },
      {
        id: 'acc_actual_vs_budget',
        title: 'Actual vs Budget',
        description:
          'Compare your actual business performance against your planned budget. Identify spending patterns and monitor budget alerts.',
      },
      {
        id: 'acc_locking',
        title: 'Accounting Period Locking',
        description:
          'Protect completed accounting periods by setting a lock date. Only authorised roles can manage this setting.',
      },
      {
        id: 'acc_finish',
        title: 'Accounting Organised',
        description: 'Your accounting records are now organised in one central hub.',
        isFinal: true,
      },
    ],
  },

  reports: {
    key: 'reports',
    label: 'Reports Hub',
    route: '/app/reports',
    steps: [
      {
        id: 'rep_welcome',
        title: 'Your Business Reports',
        description:
          'Get a clearer picture of your business performance through visual reports and downloadable summaries.',
        selectors: ['[data-tour="nav-reports"]'],
        preferredPlacement: 'right',
      },
      {
        id: 'rep_analytics',
        title: 'Visual Analytics',
        description: 'Explore income versus expenses, net cash flow trends and spending by category.',
      },
      {
        id: 'rep_period',
        title: 'Choose Your Reporting Period',
        description: 'Compare business activity over 3, 6 or 12 months to identify financial trends.',
      },
      {
        id: 'rep_export',
        title: 'Export Your Reports',
        description:
          'Download useful reports in CSV format, including monthly summaries, category breakdowns, expenses, outstanding bills, contractor spending and budgets.',
      },
      {
        id: 'rep_links',
        title: 'Quick Links',
        description:
          'Jump directly to important financial reports and related features without navigating through the entire application.',
      },
      {
        id: 'rep_finish',
        title: 'Insights Ready',
        description: 'Use your reports to make better-informed business decisions.',
        isFinal: true,
      },
    ],
  },

  tax: {
    key: 'tax',
    label: 'Tax & Compliance',
    route: '/app/tax',
    steps: [
      {
        id: 'tax_welcome',
        title: 'Welcome to Tax & Compliance',
        description: "Keep your business's tax information and statutory obligations organised in one place.",
      },
      {
        id: 'tax_overview',
        title: 'Tax Overview',
        description:
          'Monitor your VAT, Withholding Tax (WHT), PAYE and other applicable statutory tax obligations.',
      },
      {
        id: 'tax_gateways',
        title: 'Filing Gateways',
        description:
          'Explore the dedicated Corporate Income Tax (CIT) and Personal Income Tax (PIT) filing sections.',
      },
      {
        id: 'tax_coming_soon',
        title: 'Coming Soon',
        description:
          "Some self-filing capabilities are still under development. We'll make them available when they're ready.",
      },
      {
        id: 'tax_finish',
        title: 'Stay Tax-Informed',
        description: "Stay informed about your business's tax obligations.",
        isFinal: true,
      },
    ],
  },

  operations: {
    key: 'operations',
    label: 'Operations (Inventory, Payroll & Team)',
    route: '/app/inventory',
    steps: [
      {
        id: 'ops_welcome',
        title: 'Run Your Business',
        description: 'Manage important day-to-day business operations beyond your financial records.',
      },
      {
        id: 'ops_inventory',
        title: 'Inventory Management',
        description:
          'Add products, SKUs, quantities, cost prices and selling prices to keep your inventory organised.',
      },
      {
        id: 'ops_reconcile',
        title: 'Inventory Reconciliation',
        description:
          'Compare opening stock, restocks, recorded sales and closing stock to identify unexplained stock differences.',
      },
      {
        id: 'ops_payroll',
        title: 'Payroll',
        description:
          'Create employee profiles, manage monthly payroll, generate payslips and record salary disbursements.',
      },
      {
        id: 'ops_team',
        title: 'Team Management',
        description: 'Invite staff and accountants to collaborate on your business records.',
      },
      {
        id: 'ops_roles',
        title: 'Roles & Permissions',
        description:
          'Assign appropriate roles such as Owner, Admin, Accountant and Staff to control access to different areas.',
      },
      {
        id: 'ops_activity',
        title: 'Activity Log',
        description:
          'Review actions performed by team members to maintain accountability and visibility across your business.',
      },
      {
        id: 'ops_finish',
        title: 'Operations Organised',
        description: 'Your business operations are ready to be organised.',
        isFinal: true,
      },
    ],
  },

  ai_productivity: {
    key: 'ai_productivity',
    label: 'AI Assistant, Notes & Productivity',
    route: '/app/assistant',
    steps: [
      {
        id: 'ai_welcome',
        title: 'Meet Your RovaFlow AI Assistant',
        description:
          'Your business assistant is here to help you understand and manage your finances using everyday language.',
        selectors: ['[data-tour="nav-assistant"]', '[data-tour="floating-assistant-btn"]'],
        preferredPlacement: 'right',
      },
      {
        id: 'ai_questions',
        title: 'Ask Questions',
        description:
          'Ask questions about your recorded business finances and get answers without needing to navigate through accounting reports manually.',
      },
      {
        id: 'ai_record',
        title: 'Record Transactions with AI',
        description:
          'Describe a business transaction in plain English and let the assistant help you record and categorise it.',
      },
      {
        id: 'ai_insights',
        title: 'Financial Insights',
        description: 'Use your business records to explore financial patterns and get useful insights.',
      },
      {
        id: 'ai_notes',
        title: 'Notes Pad',
        description:
          'Keep business reminders, meeting notes and other important operational information in one convenient place.',
      },
      {
        id: 'ai_notifications',
        title: 'Notifications',
        description:
          'Stay informed about budget alerts, AI clarification requests, overdue invoices and scheduled reminders.',
      },
      {
        id: 'ai_push',
        title: 'Push Notifications',
        description:
          "Enable supported browser notifications to receive important updates even when you're not actively using RovaFlow.",
      },
      {
        id: 'ai_finish',
        title: 'Assistant Ready',
        description: 'Your business assistant is ready whenever you need it.',
        isFinal: true,
      },
    ],
  },

  settings: {
    key: 'settings',
    label: 'Settings, Billing, Support & PWA',
    route: '/app/settings',
    steps: [
      {
        id: 'set_profile',
        title: 'Manage Your Business Profile',
        description: 'Keep your business information up to date and manage your account preferences.',
      },
      {
        id: 'set_theme',
        title: 'Personalise RovaFlow',
        description: 'Choose your preferred light or dark theme and configure your notification preferences.',
      },
      {
        id: 'set_accounting',
        title: 'Accounting Preferences',
        description: 'Manage your accounting period lock date and other available business settings.',
      },
      {
        id: 'set_billing',
        title: 'Subscription & Billing',
        description:
          'View your subscription plan, manage your billing and access your Paystack payment history.',
      },
      {
        id: 'set_support',
        title: 'Support',
        description: 'Need assistance? Contact the RovaFlow support team directly through the support page.',
      },
      {
        id: 'set_replay',
        title: 'Replay Onboarding',
        description:
          'Want a refresher? You can replay the product walkthroughs to learn how different parts of RovaFlow work.',
      },
      {
        id: 'set_pwa',
        title: 'Install RovaFlow',
        description:
          'Install RovaFlow as a Progressive Web App on your supported mobile device or desktop for convenient access.',
      },
      {
        id: 'set_finish',
        title: "You're in Control",
        description: "You're in control of your RovaFlow experience.",
        isFinal: true,
      },
    ],
  },
};

export const FEATURE_TOUR_ORDER: FeatureTourKey[] = [
  'dashboard',
  'transactions',
  'banking',
  'invoicing',
  'expenses',
  'accounting',
  'reports',
  'tax',
  'operations',
  'ai_productivity',
  'settings',
];

export const SUBFEATURE_TIPS: Record<SubfeatureTipKey, SubfeatureTipDef> = {
  sub_loan_record: {
    key: 'sub_loan_record',
    title: 'Tip: Recording a Loan',
    message:
      'Record borrowed or lent money separately from ordinary business income and expenses. You can also add the counterparty and due date.',
  },
  sub_sales_inventory: {
    key: 'sub_sales_inventory',
    title: 'Tip: Sales Linked to Inventory',
    message:
      'Select the products sold to automatically calculate the sale and update your stock quantities.',
  },
  sub_invoice_create: {
    key: 'sub_invoice_create',
    title: 'Tip: Creating Your First Invoice',
    message:
      'Add a customer, list items or services, and apply VAT or discounts if needed. Once sent, RovaFlow tracks unpaid balances automatically.',
  },
  sub_bank_import: {
    key: 'sub_bank_import',
    title: 'Tip: Importing Bank Statements',
    message:
      'Upload a CSV bank statement to import historical transactions quickly without manual typing. Review categories before confirming.',
  },
  sub_opening_balances: {
    key: 'sub_opening_balances',
    title: 'Tip: Entering Opening Balances',
    message:
      'Enter your starting Assets, Liabilities and Equity as at your migration date. Total Debits must equal Total Credits — use Auto-Balance for any remaining difference.',
  },
  sub_budget_create: {
    key: 'sub_budget_create',
    title: 'Tip: Setting Up a Budget',
    message:
      'Budgets never create journal entries or alter your financial statements. Actual figures update automatically from your recorded transactions.',
  },
  sub_fixed_asset_add: {
    key: 'sub_fixed_asset_add',
    title: 'Tip: Adding a Fixed Asset',
    message:
      'Set the purchase cost, useful life, residual value and depreciation method. RovaFlow will calculate monthly depreciation and Net Book Value automatically.',
  },
  sub_depreciation_run: {
    key: 'sub_depreciation_run',
    title: 'Tip: Generating Monthly Depreciation',
    message:
      'Running depreciation posts a balanced journal entry (Debit Depreciation Expense, Credit Accumulated Depreciation) reflected in your P&L and Balance Sheet.',
  },
  sub_journal_entry: {
    key: 'sub_journal_entry',
    title: 'Tip: Creating a Journal Entry',
    message:
      'Every manual journal entry must balance (Total Debits = Total Credits). Use this for adjustments such as accruals, prepayments or corrections.',
  },
  sub_period_lock: {
    key: 'sub_period_lock',
    title: 'Tip: Locking an Accounting Period',
    message:
      'Setting a lock date prevents creating, editing or deleting records on or before that date — protecting finalised monthly or annual accounts.',
  },
  sub_team_invite: {
    key: 'sub_team_invite',
    title: 'Tip: Inviting a Team Member',
    message:
      'Assign the right role (Admin, Accountant or Staff) so team members only see and manage the areas relevant to their work.',
  },
  sub_recurring_bill: {
    key: 'sub_recurring_bill',
    title: 'Tip: Recurring Bills & Invoices',
    message:
      'Set the frequency and next run date once — RovaFlow automatically generates future bills or invoices on schedule.',
  },
  sub_statement_of_account: {
    key: 'sub_statement_of_account',
    title: 'Tip: Statements of Account',
    message:
      'Pick a date range to generate a customer Statement of Account showing invoices, payments, credit notes and the running balance.',
  },
};

/**
 * Maps an application pathname to its independent FeatureTourKey.
 */
export function getFeatureKeyForPath(pathname: string): FeatureTourKey | null {
  if (pathname === '/app' || pathname === '/app/' || pathname.startsWith('/app/dashboard')) return 'dashboard';
  if (pathname.startsWith('/app/transactions')) return 'transactions';
  if (pathname.startsWith('/app/payment')) return 'banking';
  if (
    pathname.startsWith('/app/invoices') ||
    pathname.startsWith('/app/receipts') ||
    pathname.startsWith('/app/customers') ||
    pathname.startsWith('/app/credit-notes')
  ) {
    return 'invoicing';
  }
  if (pathname.startsWith('/app/expenses') || pathname.startsWith('/app/bills')) return 'expenses';
  if (
    pathname.startsWith('/app/accounting') ||
    pathname.startsWith('/app/ledger') ||
    pathname.startsWith('/app/chart-of-accounts') ||
    pathname.startsWith('/app/journal-entries') ||
    pathname.startsWith('/app/trial-balance') ||
    pathname.startsWith('/app/profit-loss') ||
    pathname.startsWith('/app/balance-sheet') ||
    pathname.startsWith('/app/cash-flow') ||
    pathname.startsWith('/app/changes-in-equity') ||
    pathname.startsWith('/app/financial-notes') ||
    pathname.startsWith('/app/fixed-assets') ||
    pathname.startsWith('/app/budgets') ||
    pathname.startsWith('/app/opening-balances') ||
    pathname.startsWith('/app/recurring')
  ) {
    return 'accounting';
  }
  if (pathname.startsWith('/app/reports')) return 'reports';
  if (pathname.startsWith('/app/tax')) return 'tax';
  if (
    pathname.startsWith('/app/inventory') ||
    pathname.startsWith('/app/payroll') ||
    pathname.startsWith('/app/team')
  ) {
    return 'operations';
  }
  if (
    pathname.startsWith('/app/assistant') ||
    pathname.startsWith('/app/notes') ||
    pathname.startsWith('/app/notifications')
  ) {
    return 'ai_productivity';
  }
  if (
    pathname.startsWith('/app/settings') ||
    pathname.startsWith('/app/billing') ||
    pathname.startsWith('/app/support')
  ) {
    return 'settings';
  }
  return null;
}

export function getLocalOnboardingState(userId: string): OnboardingStateMap {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveLocalOnboardingState(userId: string, state: OnboardingStateMap) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

export async function loadOnboardingState(userId: string): Promise<OnboardingStateMap> {
  const local = getLocalOnboardingState(userId);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_tours_state')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data && data.onboarding_tours_state && typeof data.onboarding_tours_state === 'object') {
      const merged: OnboardingStateMap = { ...local, ...(data.onboarding_tours_state as OnboardingStateMap) };
      saveLocalOnboardingState(userId, merged);
      return merged;
    }
  } catch {
    // Fallback to local
  }
  return local;
}

export async function persistOnboardingKey(
  userId: string,
  key: FeatureTourKey | SubfeatureTipKey,
  status: 'completed' | 'skipped'
): Promise<OnboardingStateMap> {
  const current = await loadOnboardingState(userId);
  const next: OnboardingStateMap = {
    ...current,
    [key]: { status, updated_at: new Date().toISOString() },
  };
  saveLocalOnboardingState(userId, next);
  try {
    await supabase
      .from('profiles')
      .update({
        onboarding_tours_state: next,
        ...(key === 'dashboard'
          ? { onboarding_tour_completed: true, onboarding_tour_completed_at: new Date().toISOString() }
          : {}),
      })
      .eq('id', userId);
  } catch {
    // Non-fatal; local cache preserved
  }
  return next;
}

export async function resetAllOnboardingTours(userId: string): Promise<void> {
  saveLocalOnboardingState(userId, {});
  try {
    await supabase
      .from('profiles')
      .update({
        onboarding_tours_state: {},
        onboarding_tour_completed: false,
        onboarding_tour_completed_at: null,
      })
      .eq('id', userId);
  } catch {
    // Non-fatal
  }
}
