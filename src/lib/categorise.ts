export type AutoResult = { type: 'income' | 'expense'; categoryName: string };

const INCOME_KEYWORDS: { keywords: string[]; category: string }[] = [
  { keywords: ['capital injection', 'owner equity', 'share capital', 'founder investment', 'equity contribution'], category: 'Owner Capital Injection' },
  { keywords: ['customer payment', 'invoice payment', 'against invoice', 'settle invoice', 'client payment'], category: 'Customer Payment (against an invoice)' },
  { keywords: ['customer deposit', 'advance payment', 'deposit received', 'retainer fee'], category: 'Customer Deposit / Advance' },
  { keywords: ['interest income', 'bank interest', 'yield', 'savings interest', 'treasury'], category: 'Interest Income' },
  { keywords: ['grant', 'commission received', 'other income', 'bursary', 'subsidy'], category: 'Other Income (grants, commissions, misc.)' },
  { keywords: ['supplier refund', 'vendor refund', 'rebate', 'expense reversal', 'refund received'], category: 'Supplier Refund' },
  { keywords: ['loan received', 'loan disbursement', 'credit facility', 'borrowing'], category: 'Loan Received' },
  { keywords: ['director loan', 'shareholder loan', 'director contribution'], category: 'Director / Shareholder Loan' },
  { keywords: ['asset sale', 'disposal of asset', 'equipment sale', 'vehicle sale'], category: 'Asset Sale Proceeds' },
  { keywords: ['transfer in', 'internal transfer'], category: 'Transfer In (own account)' },
  { keywords: ['uncategorized in', 'unknown inflow'], category: 'Uncategorized In' },
  { keywords: ['sales', 'service revenue', 'revenue', 'turnover', 'consulting fee', 'freelance', 'project fee'], category: 'Sales / Service Revenue' },
];

const EXPENSE_KEYWORDS: { keywords: string[]; category: string }[] = [
  { keywords: ['hosting', 'aws', 'gcp', 'subcontractor', 'direct material', 'cogs', 'cost of sales'], category: 'Direct Costs / Cost of Sales (hosting, subcontractors, materials used)' },
  { keywords: ['inventory', 'stock purchase', 'goods for resale'], category: 'Inventory Purchase' },
  { keywords: ['salary', 'wages', 'payroll', 'staff pay', 'stipend'], category: 'Salaries & Wages' },
  { keywords: ['rent', 'lease', 'office space', 'shop rent'], category: 'Rent' },
  { keywords: ['nepa', 'phcn', 'electricity', 'power bill', 'water bill'], category: 'Utilities (electricity, water)' },
  { keywords: ['internet', 'telecoms', 'broadband', 'airtime', 'data recharge', 'mtn', 'airtel', 'glo', 'spectranet'], category: 'Internet & Telecoms' },
  { keywords: ['software', 'subscription', 'saas', 'cloud subscription', 'figma', 'github', 'slack'], category: 'Software & Subscriptions' },
  { keywords: ['marketing', 'advertising', 'ads', 'google ads', 'meta ads', 'promotion', 'billboard'], category: 'Marketing & Advertising' },
  { keywords: ['travel', 'transport', 'flight', 'airfare', 'uber', 'bolt', 'hotel'], category: 'Travel & Transport' },
  { keywords: ['fuel', 'diesel', 'petrol', 'generator'], category: 'Fuel & Generator' },
  { keywords: ['repairs', 'maintenance', 'servicing', 'fixing'], category: 'Repairs & Maintenance' },
  { keywords: ['insurance', 'premium', 'hmo', 'health insurance'], category: 'Insurance' },
  { keywords: ['stationery', 'office supplies', 'paper', 'toner', 'pens'], category: 'Office Supplies' },
  { keywords: ['legal', 'audit', 'accounting fee', 'consulting', 'retainer', 'professional fees'], category: 'Professional Fees' },
  { keywords: ['bank charge', 'transfer fee', 'sms charge', 'stamp duty', 'card fee'], category: 'Bank Charges' },
  { keywords: ['cac', 'license', 'licence', 'registration fee', 'permit', 'filing fee'], category: 'Licences & Registration Fees' },
  { keywords: ['training', 'workshop', 'seminar', 'certification', 'course'], category: 'Training' },
  { keywords: ['welfare', 'staff lunch', 'meals', 'refreshment', 'team lunch'], category: 'Staff Welfare / Meals' },
  { keywords: ['logistics', 'delivery', 'courier', 'dispatch', 'freight'], category: 'Delivery & Logistics' },
  { keywords: ['commission paid', 'agent commission', 'brokerage'], category: 'Commissions Paid' },
  { keywords: ['fine', 'penalty', 'traffic fine', 'sanction'], category: 'Fines & Penalties' },
  { keywords: ['supplier payment', 'bill payment', 'pay vendor', 'settle bill'], category: 'Supplier Payment (against a bill)' },
  { keywords: ['prepayment', 'rent advance', 'advance rent', 'insurance in advance'], category: 'Prepayment (rent, insurance paid in advance)' },
  { keywords: ['laptop', 'computer', 'fixed asset', 'equipment purchase', 'machinery', 'furniture', 'vehicle purchase'], category: 'Fixed Asset Purchase (laptops, vehicles, equipment, furniture)' },
  { keywords: ['loan repayment', 'principal repayment', 'debt repayment'], category: 'Loan Repayment: Principal' },
  { keywords: ['loan interest', 'finance cost', 'interest paid'], category: 'Loan Interest' },
  { keywords: ['dividend', 'dividends paid'], category: 'Dividends' },
  { keywords: ['director withdrawal', 'drawing', 'director drawings'], category: "Director's Withdrawal" },
  { keywords: ['customer refund', 'sales return', 'refund to client'], category: 'Customer Refund' },
  { keywords: ['transfer out', 'internal transfer out'], category: 'Transfer Out (own account)' },
  { keywords: ['uncategorized out', 'unknown expense', 'suspense out'], category: 'Uncategorized Out' },
  { keywords: ['misc', 'miscellaneous', 'other expense', 'general'], category: 'Miscellaneous Expense' },
];

export function autoClassify(description: string): AutoResult {
  const lower = description.toLowerCase().trim();

  for (const { keywords, category } of INCOME_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) {
      return { type: 'income', categoryName: category };
    }
  }

  for (const { keywords, category } of EXPENSE_KEYWORDS) {
    if (keywords.some(k => lower.includes(k))) {
      return { type: 'expense', categoryName: category };
    }
  }

  return { type: 'expense', categoryName: '' };
}
