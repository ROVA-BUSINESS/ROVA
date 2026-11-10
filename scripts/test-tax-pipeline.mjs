import assert from 'node:assert/strict';
import { STANDARD_NIGERIA_COA } from '../src/lib/standardCoa.ts';
import { computeFinancialStatementsModel } from '../src/lib/financialStatementEngine.ts';
import { mapFinancialStatementsToCitState } from '../src/lib/fsToCitMapper.ts';
import { generateFinancialStatementsWorkbookBytes } from '../src/lib/financialWorkbookExport.ts';

console.log('Testing ROVA Bookkeeping -> Financial Statements -> CIT Pipeline...');

// 1. Verify COA count & key codes
assert.ok(STANDARD_NIGERIA_COA.length >= 55, 'Expected standardized Nigeria SME COA (>=55 accounts)');
assert.ok(STANDARD_NIGERIA_COA.some((a) => a.code === '9999'), 'Missing 9999 Suspense account');
assert.ok(STANDARD_NIGERIA_COA.some((a) => a.code === '2070'), 'Missing 2070 Current Tax Liabilities');

const baseProfile = {
  user_id: 'test-user',
  fiscal_year: 2026,
  company_legal_name: 'Rova Test Ventures Ltd',
  rc_number: 'RC 987654',
  tin: '12345678-0001',
  fy_start_date: '2026-01-01',
  fy_end_date: '2026-12-31',
  reporting_currency: 'Nigerian Naira (₦)',
  currency_symbol: '₦',
  nature_of_business: 'Wholesale Distribution',
  sector: 'WHOLESALE AND RETAIL TRADE',
  accounting_framework: 'IFRS',
  tax_regime: 'Nigeria Tax Act 2025 & NTAA 2025',
  tax_authority: 'Nigeria Revenue Service (NRS)',
  audit_status: 'Exempt under CAMA 2020',
  auditor_firm: 'N/A',
  auditor_partner: 'N/A',
  auditor_frc: 'N/A',
  audit_opinion: 'N/A',
  director_1: 'Jane Doe',
  director_2: 'John Doe',
  cfo_name: 'Akin CFO',
  cfo_frc: 'FRC/2026/ICAN/001',
  small_turnover_threshold: 100_000_000,
  small_asset_threshold: 250_000_000,
  professional_services_flag: false,
  cit_rate_small: 0,
  cit_rate_standard: 0.275,
  dev_levy_rate: 0.04,
  vat_rate: 0.075,
  wht_rate_supplies: 0.05,
  wht_rate_services: 0.1,
  ca_restriction_cap: 0.6667,
};

// 2. Test Small Company (Turnover <= 100M, Gross PPE <= 250M, Non-Prof) + Account 9999 Suspense exclusion
const smallModel = computeFinancialStatementsModel({
  profile: baseProfile,
  openingBalances: [
    { user_id: 'test-user', fiscal_year: 2026, account_code: '1020', opening_debit: 2_000_000, opening_credit: 0 },
    { user_id: 'test-user', fiscal_year: 2026, account_code: '3010', opening_debit: 0, opening_credit: 2_000_000 },
  ],
  transactions: [
    { id: 't1', date: '2026-03-10', amount: 50_000_000, type: 'income', description: 'Goods sold', category: { name: 'Sales / Service Revenue' } },
    { id: 't2', date: '2026-04-01', amount: 20_000_000, type: 'expense', description: 'Stock materials', category: { name: 'Direct Costs / Cost of Sales (hosting, subcontractors, materials used)' } },
    { id: 't3', date: '2026-05-01', amount: 5_000_000, type: 'expense', description: 'Staff payroll', category: { name: 'Salaries & Wages' } },
    { id: 't4', date: '2026-06-01', amount: 1_500_000, type: 'expense', description: 'Unexplained POS outflow', category: { name: 'Uncategorized Out' } },
  ],
  fixedAssets: [
    {
      id: 'fa1',
      user_id: 'test-user',
      asset_code: 'FA-001',
      description: 'Office Laptops',
      asset_class: 'Computer & IT Infrastructure',
      date_acquired: '2026-01-01',
      historical_cost: 3_000_000,
      prior_accum_depr: 0,
      opening_twdv: 0,
      status: 'Active',
    },
  ],
});

assert.equal(smallModel.incomeStatement.revenue, 50_000_000, 'Revenue should be 50M');
assert.equal(smallModel.suspenseLog.length, 1, 'Uncategorized outflow should route to 9999 Suspense Log');
assert.equal(smallModel.incomeStatement.operatingExpenses, 5_000_000 + smallModel.fixedAssets.totals.cyDeprCharge, 'Suspense must NOT hit Operating Expenses');
assert.equal(smallModel.taxComputation.qualifiesSmallCompanyExemption, true, 'Should qualify for Small Company Exemption');
assert.equal(smallModel.taxComputation.netCurrentTaxPayable, 0, 'Small company CIT & Dev Levy should be 0');
smallModel.auditChecks.forEach((chk) => {
  assert.equal(chk.status, 'PASS', `Small model audit check ${chk.testNo} failed: variance=${chk.variance}`);
});

// 3. Test Non-Small Company (>100M turnover -> 27.5% CIT + 4% Dev Levy + 66.67% CA Cap + WHT Offset)
const largeModel = computeFinancialStatementsModel({
  profile: baseProfile,
  openingBalances: [
    { user_id: 'test-user', fiscal_year: 2026, account_code: '1020', opening_debit: 10_000_000, opening_credit: 0 },
    { user_id: 'test-user', fiscal_year: 2026, account_code: '3010', opening_debit: 0, opening_credit: 10_000_000 },
  ],
  transactions: [
    { id: 'l1', date: '2026-02-15', amount: 150_000_000, type: 'income', description: 'Enterprise Supply', category: { name: 'Sales / Service Revenue' } },
    { id: 'l2', date: '2026-03-20', amount: 60_000_000, type: 'expense', description: 'Raw materials', category: { name: 'Direct Costs / Cost of Sales (hosting, subcontractors, materials used)' } },
    { id: 'l3', date: '2026-05-10', amount: 20_000_000, type: 'expense', description: 'Office Rent', category: { name: 'Rent' } },
    { id: 'l4', date: '2026-06-15', amount: 1_000_000, type: 'expense', description: 'Regulatory penalty', category: { name: 'Fines & Penalties' } },
  ],
  fixedAssets: [
    {
      id: 'fa2',
      user_id: 'test-user',
      asset_code: 'FA-002',
      description: 'Delivery Truck',
      asset_class: 'Commercial Motor Vehicles',
      date_acquired: '2026-01-10',
      historical_cost: 40_000_000,
      prior_accum_depr: 0,
      opening_twdv: 0,
      status: 'Active',
    },
  ],
  whtCreditNotes: [
    {
      id: 'w1',
      user_id: 'test-user',
      fiscal_year: 2026,
      client_name: 'Dangote Group',
      credit_note_no: 'WHT-2026-01',
      deduction_date: '2026-04-01',
      nature_of_supply: 'Supplies / Contracts',
      gross_amount: 40_000_000,
      wht_rate: 0.05,
      wht_deducted: 2_000_000,
      verification_status: 'Verified',
      amount_utilized: 2_000_000,
    },
  ],
});

assert.equal(largeModel.taxComputation.qualifiesSmallCompanyExemption, false, '150M turnover should NOT qualify for small exemption');
assert.equal(largeModel.taxComputation.applicableCitRate, 0.275, 'Standard CIT rate should be 27.5%');
assert.ok(largeModel.taxComputation.citCharged > 0, 'CIT should be > 0');
assert.ok(largeModel.taxComputation.developmentLevyCharged > 0, 'Dev Levy (4%) should be > 0');
assert.equal(largeModel.taxComputation.whtCreditsUtilized, 2_000_000, 'WHT credit of 2M should offset tax');
largeModel.auditChecks.forEach((chk) => {
  assert.equal(chk.status, 'PASS', `Large model audit check ${chk.testNo} failed: variance=${chk.variance}`);
});

// 4. Test FS -> CIT Wizard hydration
const citState = mapFinancialStatementsToCitState(largeModel);
assert.equal(citState.revenue, 150_000_000);
assert.equal(citState.adminExpense['Rent & Rates'], 20_000_000);
assert.equal(citState.profitAdjustment.addbacks['Penalty or fine imposed under any law'], 1_000_000);
assert.equal(citState.nta2025?.whtCreditsUtilized, 2_000_000);

// 5. Test 8-Tab Financial Statements Excel export
const xlsxBytes = await generateFinancialStatementsWorkbookBytes(largeModel);
assert.ok(xlsxBytes.length > 5000, 'Generated XLSX workbook should be non-empty');

console.log('ALL PIPELINE TESTS PASSED ✅');
console.log(`- Small company tax: ₦${smallModel.taxComputation.netCurrentTaxPayable}`);
console.log(`- Large company net tax payable (after ₦2M WHT credit): ₦${largeModel.taxComputation.netCurrentTaxPayable.toLocaleString()}`);
console.log(`- All 11 audit checks (CHK-01..CHK-11): PASS`);
console.log(`- Generated 8-tab FS workbook size: ${xlsxBytes.length} bytes`);
