import ExcelJS from 'exceljs';
import type { FinancialStatementModel } from './financialStatementEngine';

const CURRENCY_FMT = '₦#,##0.00;(₦#,##0.00);"-"';

function styleHeaderRow(row: ExcelJS.Row, fillArgb = 'FF1B4332') {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
    cell.alignment = { vertical: 'middle' };
  });
  row.height = 22;
}

function styleSectionBanner(ws: ExcelJS.Worksheet, title: string, colCount = 6) {
  const row = ws.addRow([title]);
  ws.mergeCells(row.number, 1, row.number, colCount);
  row.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF064E3B' } };
  row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
  row.height = 24;
  return row;
}

function applyCurrencyColumns(ws: ExcelJS.Worksheet, colIndexes: number[], startRow = 2) {
  for (let r = startRow; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    colIndexes.forEach((c) => {
      const cell = row.getCell(c);
      if (typeof cell.value === 'number') {
        cell.numFmt = CURRENCY_FMT;
      }
    });
  }
}

export async function generateFinancialStatementsWorkbookBytes(
  model: FinancialStatementModel
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ROVA Financial OS';
  wb.created = new Date();

  const {
    profile,
    trialBalance,
    journalRegister,
    suspenseLog,
    bankReconciliation,
    fixedAssets,
    incomeStatement,
    balanceSheet,
    changesInEquity,
    cashFlowIndirect,
    notes,
    subSchedules,
    taxComputation,
    whtSchedule,
    auditChecks,
    filingChecklist,
    filingReadiness,
  } = model;

  // ── 1. COMPANY_SETTINGS ────────────────────────────────────────────────────
  const s1 = wb.addWorksheet('1_Company_Settings');
  s1.columns = [{ width: 38 }, { width: 34 }, { width: 46 }];
  styleSectionBanner(s1, 'ROVA FINANCIAL STATEMENTS — COMPANY INFORMATION & SETTINGS', 3);
  s1.addRow([]);
  styleHeaderRow(s1.addRow(['Setting / Parameter', 'Configured Value', 'Statutory Description / Reference']));
  const profileRows: [string, string | number, string][] = [
    ['Company Legal Name', profile.company_legal_name || '[COMPANY LEGAL NAME]', 'Full registered legal entity name under CAMA 2020'],
    ['RC Registration Number', profile.rc_number || 'RC [NUMBER]', 'CAC registration number'],
    ['Tax Identification Number (TIN)', profile.tin || '[TIN NUMBER]', 'Nigeria Revenue Service (NRS) TIN'],
    ['Financial Year Start Date', profile.fy_start_date, 'Start of accounting period'],
    ['Financial Year End Date', profile.fy_end_date, 'Current reporting period close'],
    ['Reporting Currency', profile.reporting_currency, 'Functional & presentation currency'],
    ['Nature of Business Operations', profile.nature_of_business || profile.sector, 'Core commercial activities'],
    ['Business Sector', profile.sector || 'General', 'NRS CIT sector classification'],
    ['Accounting Framework', profile.accounting_framework, 'IFRS / IFRS for SMEs'],
    ['Governing Tax Legislation', profile.tax_regime, 'Enacted Federal tax regime'],
    ['Statutory Audit Status', profile.audit_status, 'Audited / Exempt under CAMA 2020 / Unaudited'],
    ['Independent Auditor Firm', profile.auditor_firm || 'N/A', 'Appointed external audit firm'],
    ['First Signatory Director', profile.director_1 || '[Managing Director]', 'Signing director'],
    ['Second Signatory Director', profile.director_2 || '[Director]', 'Second signing director'],
    ['CFO / Head of Finance', profile.cfo_name || '[CFO Name]', 'Principal finance officer'],
    ['Small Company Turnover Threshold (₦)', profile.small_turnover_threshold, 'NTA 2025 small company ceiling'],
    ['Small Company Asset Threshold (₦)', profile.small_asset_threshold, 'NTA 2025 gross PPE ceiling'],
    ['Professional Services Exclusion', profile.professional_services_flag ? 'Yes' : 'No', 'Ineligible for 0% small company rate if Yes'],
    ['Standard CIT Rate', `${(profile.cit_rate_standard * 100).toFixed(1)}%`, 'NTA 2025 standard rate (27.5%)'],
    ['Harmonized Development Levy Rate', `${(profile.dev_levy_rate * 100).toFixed(1)}%`, 'Unified levy on assessable profit (4.0%)'],
    ['Capital Allowance Restriction Cap', `${(profile.ca_restriction_cap * 100).toFixed(2)}%`, 'Maximum CA claim vs assessable profit'],
  ];
  profileRows.forEach((r) => s1.addRow(r));
  applyCurrencyColumns(s1, [2]);

  // ── 2. ACCOUNTING_RECORDS (COA + SUSPENSE + JOURNAL) ───────────────────────
  const s2 = wb.addWorksheet('2_Accounting_Records');
  s2.columns = [
    { width: 14 },
    { width: 42 },
    { width: 14 },
    { width: 28 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
  ];
  styleSectionBanner(s2, 'SECTION 2.1: CHART OF ACCOUNTS & OPENING BALANCES', 7);
  styleHeaderRow(
    s2.addRow(['Account Code', 'Account Name', 'Type', 'Statement Mapping', 'Classification', 'Opening Dr (₦)', 'Opening Cr (₦)'])
  );
  trialBalance.forEach((r) => {
    s2.addRow([r.code, r.name, r.accountType, r.statementLineMapping, r.currentClassification, r.openingDr, r.openingCr]);
  });
  s2.addRow(['TOTAL OPENING', '', '', '', '', model.totalOpeningDr, model.totalOpeningCr]).font = { bold: true };
  s2.addRow([]);

  styleSectionBanner(s2, 'SECTION 2.3: UNRESOLVED & UNCLASSIFIED TRANSACTIONS (ACCOUNT 9999 SUSPENSE LOG)', 7);
  styleHeaderRow(s2.addRow(['Date', 'Description', 'Amount (₦)', 'Direction', 'Status', 'Clarification Required', 'Source']));
  if (suspenseLog.length === 0) {
    s2.addRow(['-', 'No unresolved suspense items', 0, '-', 'Resolved', 'All entries classified', '-']);
  } else {
    suspenseLog.forEach((item) => {
      s2.addRow([
        item.date,
        item.description,
        item.amount,
        item.direction,
        item.resolutionStatus,
        item.clarificationQuestion || 'Needs classification',
        item.source,
      ]);
    });
  }
  s2.addRow([]);

  styleSectionBanner(s2, 'SECTION 2.4: GENERAL JOURNAL TRANSACTION REGISTER', 7);
  styleHeaderRow(s2.addRow(['Date', 'Journal No', 'Account Code', 'Account Name', 'Description', 'Debit (₦)', 'Credit (₦)']));
  journalRegister.forEach((j) => {
    s2.addRow([j.date, j.journalNo, j.accountCode, j.accountName, j.description, j.debit, j.credit]);
  });
  applyCurrencyColumns(s2, [3, 6, 7]);

  // ── 3. TRIAL_BALANCE_AND_CONTROLS ──────────────────────────────────────────
  const s3 = wb.addWorksheet('3_Trial_Balance_Controls');
  s3.columns = [
    { width: 14 },
    { width: 42 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
  styleSectionBanner(s3, 'SECTION 3.1: TRIAL BALANCE (OPENING + MOVEMENTS = CLOSING)', 9);
  styleHeaderRow(
    s3.addRow(['Code', 'Account Name', 'Type', 'Opening Dr', 'Opening Cr', 'Movement Dr', 'Movement Cr', 'Closing Dr', 'Closing Cr'])
  );
  trialBalance.forEach((r) => {
    if (r.openingDr || r.openingCr || r.movementDr || r.movementCr || r.closingDr || r.closingCr) {
      s3.addRow([r.code, r.name, r.accountType, r.openingDr, r.openingCr, r.movementDr, r.movementCr, r.closingDr, r.closingCr]);
    }
  });
  const tbTotalRow = s3.addRow([
    'TOTAL',
    '',
    '',
    model.totalOpeningDr,
    model.totalOpeningCr,
    model.totalMovementDr,
    model.totalMovementCr,
    model.totalClosingDr,
    model.totalClosingCr,
  ]);
  tbTotalRow.font = { bold: true };
  s3.addRow([]);

  styleSectionBanner(s3, 'SECTION 3.2: MULTI-BANK RECONCILIATION', 6);
  styleHeaderRow(s3.addRow(['Bank Account', 'GL Code', 'Statement Ending (₦)', 'GL Book Balance (₦)', 'Variance (₦)', 'Status']));
  bankReconciliation.forEach((b) => {
    s3.addRow([b.bankName, b.glCode, b.statementEndingBalance, b.glBookBalance, b.variance, b.status]);
  });
  s3.addRow([]);

  styleSectionBanner(s3, 'SECTION 3.3: MASTER INTEGRITY & AUDIT CONTROL DASHBOARD (CHK-01 TO CHK-11)', 6);
  styleHeaderRow(s3.addRow(['Test No.', 'Accounting Integrity Test', 'Component A (₦)', 'Component B (₦)', 'Variance (₦)', 'Status']));
  auditChecks.forEach((chk) => {
    s3.addRow([chk.testNo, chk.testName, chk.componentA, chk.componentB, chk.variance, chk.status]);
  });
  applyCurrencyColumns(s3, [3, 4, 5, 6, 7, 8, 9]);

  // ── 4. FIXED_ASSETS_REGISTER ───────────────────────────────────────────────
  const s4 = wb.addWorksheet('4_Fixed_Assets');
  s4.columns = [
    { width: 14 },
    { width: 32 },
    { width: 28 },
    { width: 14 },
    { width: 18 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];
  styleSectionBanner(s4, 'SECTION 4.1: FIXED ASSET REGISTER', 10);
  styleHeaderRow(
    s4.addRow([
      'Asset ID',
      'Description',
      'Asset Class',
      'Date Acquired',
      'Cost (₦)',
      'Depr Rate',
      'Prior Accum Depr',
      'CY Depr Charge',
      'Total Accum Depr',
      'NBV (₦)',
    ])
  );
  fixedAssets.register.forEach((a) => {
    s4.addRow([
      a.assetCode,
      a.description,
      a.assetClass,
      a.dateAcquired,
      a.historicalCost,
      `${(a.deprRate * 100).toFixed(2)}%`,
      a.priorAccumDepr,
      a.cyDeprCharge,
      a.totalAccumDepr,
      a.nbv,
    ]);
  });
  s4.addRow([]);
  styleSectionBanner(s4, 'SECTION 4.3: PPE ROLL-FORWARD & ACCOUNTING DEPR VS TAX CAPITAL ALLOWANCES', 10);
  styleHeaderRow(
    s4.addRow([
      'Asset Class',
      'Gross Cost (₦)',
      'CY Depr (₦)',
      'Accum Depr (₦)',
      'NBV (₦)',
      'QCE Additions (₦)',
      'Initial Allow (₦)',
      'Annual Allow (₦)',
      'Total CA (₦)',
      'Depr - CA (₦)',
    ])
  );
  fixedAssets.byClass.forEach((c) => {
    s4.addRow([
      c.assetClass,
      c.grossCost,
      c.cyDeprCharge,
      c.accumDepr,
      c.nbv,
      c.qceAdditions,
      c.initialAllow,
      c.annualAllow,
      c.totalCa,
      c.deprVsCaDiff,
    ]);
  });
  applyCurrencyColumns(s4, [2, 3, 4, 5, 6, 7, 8, 9, 10]);

  // ── 5. FINANCIAL_STATEMENTS ────────────────────────────────────────────────
  const s5 = wb.addWorksheet('5_Financial_Statements');
  s5.columns = [{ width: 48 }, { width: 14 }, { width: 22 }, { width: 22 }];
  styleSectionBanner(s5, 'SECTION 5.1: STATEMENT OF PROFIT OR LOSS AND OTHER COMPREHENSIVE INCOME', 4);
  styleHeaderRow(s5.addRow(['Financial Line Item', 'Note', 'Current Year (₦)', '']));
  [
    ['Revenue from Contracts with Customers', 'Note 4', incomeStatement.revenue],
    ['Cost of Sales', 'Note 5', -incomeStatement.costOfSales],
    ['GROSS PROFIT', '', incomeStatement.grossProfit],
    ['Other Operating Income', 'Note 4', incomeStatement.otherOperatingIncome],
    ['Operating & Administrative Expenses', 'Note 6', -incomeStatement.operatingExpenses],
    ['OPERATING PROFIT / (EBIT)', '', incomeStatement.operatingProfit],
    ['Finance Income', 'Note 6', incomeStatement.financeIncome],
    ['Finance Costs', 'Note 6', -incomeStatement.financeCosts],
    ['PROFIT BEFORE TAXATION (PBT)', '', incomeStatement.profitBeforeTax],
    ['Income Tax Expense (CIT & Dev Levy)', 'Note 13', -incomeStatement.incomeTaxExpense],
    ['PROFIT FOR THE YEAR', '', incomeStatement.profitForYear],
    ['Other Comprehensive Income', '', incomeStatement.oci],
    ['TOTAL COMPREHENSIVE INCOME', '', incomeStatement.totalComprehensiveIncome],
  ].forEach((r) => s5.addRow(r));
  s5.addRow([]);

  styleSectionBanner(s5, 'SECTION 5.2: STATEMENT OF FINANCIAL POSITION (BALANCE SHEET)', 4);
  styleHeaderRow(s5.addRow(['Assets, Equity & Liabilities', 'Note', 'Amount (₦)', '']));
  [
    ['Property, Plant and Equipment', 'Note 7', balanceSheet.ppe],
    ['Intangible Assets', 'Note 7', balanceSheet.intangibles],
    ['Total Non-Current Assets', '', balanceSheet.totalNonCurrentAssets],
    ['Inventories', 'Note 8', balanceSheet.inventories],
    ['Trade and Other Receivables', 'Note 9', balanceSheet.tradeAndOtherReceivables],
    ['Prepayments and Other Current Assets', 'Note 10', balanceSheet.prepaymentsAndOtherAssets],
    ['Cash and Cash Equivalents', 'Note 11', balanceSheet.cashAndCashEquivalents],
    ['Total Current Assets', '', balanceSheet.totalCurrentAssets],
    ['TOTAL ASSETS', '', balanceSheet.totalAssets],
    ['Ordinary Share Capital', 'Note 15', balanceSheet.ordinaryShareCapital],
    ['Retained Earnings', 'Note 15', balanceSheet.retainedEarnings],
    ['Total Equity', '', balanceSheet.totalEquity],
    ['Long-Term Borrowings', 'Note 14', balanceSheet.longTermBorrowings],
    ['Current Tax Liabilities', 'Note 13', balanceSheet.currentTaxLiabilities],
    ['Trade and Other Payables', 'Note 12', balanceSheet.tradeAndOtherPayables],
    ['Short-Term Borrowings & Director Current Account', 'Note 14', balanceSheet.shortTermBorrowings],
    ['TOTAL LIABILITIES', '', balanceSheet.totalLiabilities],
    ['TOTAL EQUITY AND LIABILITIES', '', balanceSheet.totalEquityAndLiabilities],
  ].forEach((r) => s5.addRow(r));
  s5.addRow([]);

  styleSectionBanner(s5, 'SECTION 5.3: STATEMENT OF CHANGES IN EQUITY', 4);
  styleHeaderRow(s5.addRow(['Equity Movement', 'Share Capital (₦)', 'Retained Earnings (₦)', 'Total Equity (₦)']));
  s5.addRow(['Opening Balance', changesInEquity.openingShareCapital, changesInEquity.openingRetainedEarnings, changesInEquity.openingTotal]);
  s5.addRow(['Profit for the Year', 0, changesInEquity.profitForYear, changesInEquity.profitForYear]);
  s5.addRow(['Dividends / Drawings', 0, -changesInEquity.dividends, -changesInEquity.dividends]);
  s5.addRow(['Capital Contributions', changesInEquity.capitalInjections, 0, changesInEquity.capitalInjections]);
  s5.addRow(['Closing Balance', changesInEquity.closingShareCapital, changesInEquity.closingRetainedEarnings, changesInEquity.closingTotal]);
  s5.addRow([]);

  styleSectionBanner(s5, 'SECTION 5.4: STATEMENT OF CASH FLOWS (INDIRECT METHOD)', 4);
  styleHeaderRow(s5.addRow(['Cash Flow Line Item', 'Note', 'Amount (₦)', '']));
  [
    ['Profit Before Taxation', '', cashFlowIndirect.profitBeforeTax],
    ['Depreciation of PPE', 'Note 7', cashFlowIndirect.depreciationAddBack],
    ['Finance Costs Expensed', 'Note 6', cashFlowIndirect.financeCostsAddBack],
    ['Finance Income Recognized', 'Note 6', -cashFlowIndirect.financeIncomeDeduct],
    ['Working Capital — Inventories', 'Note 8', cashFlowIndirect.deltaInventories],
    ['Working Capital — Trade & Other Receivables', 'Note 9', cashFlowIndirect.deltaReceivables],
    ['Working Capital — Prepayments', 'Note 10', cashFlowIndirect.deltaPrepayments],
    ['Working Capital — Trade & Other Payables', 'Note 12', cashFlowIndirect.deltaPayables],
    ['Income Taxes & Interest Paid', '', -(cashFlowIndirect.incomeTaxesPaid + cashFlowIndirect.interestPaid)],
    ['Net Cash from Operating Activities', '', cashFlowIndirect.netOperatingCashFlow],
    ['Net Cash from Investing Activities', '', cashFlowIndirect.netInvestingCashFlow],
    ['Net Cash from Financing Activities', '', cashFlowIndirect.netFinancingCashFlow],
    ['Net Change in Cash & Cash Equivalents', '', cashFlowIndirect.netChangeInCash],
    ['Opening Cash & Cash Equivalents', 'Note 11', cashFlowIndirect.openingCash],
    ['CLOSING CASH & CASH EQUIVALENTS', 'Note 11', cashFlowIndirect.closingCash],
  ].forEach((r) => s5.addRow(r));
  applyCurrencyColumns(s5, [2, 3, 4]);

  // ── 6. NOTES_AND_SUBSCHEDULES ──────────────────────────────────────────────
  const s6 = wb.addWorksheet('6_Notes_SubSchedules');
  s6.columns = [{ width: 42 }, { width: 16 }, { width: 22 }, { width: 22 }];
  styleSectionBanner(s6, 'PART B: FINANCIAL STATEMENT DISCLOSURE NOTES (NOTES 4–15)', 4);
  styleHeaderRow(s6.addRow(['Disclosure Line', 'Account Code', 'Current Year (₦)', '']));
  Object.values(notes.note6Opex).forEach((item) => {
    s6.addRow([`Note 6: ${item.name}`, item.code, item.amount]);
  });
  s6.addRow([]);
  styleSectionBanner(s6, 'SCHEDULE 6.B: CUSTOMERS (AR) & 6.C: SUPPLIERS (AP)', 4);
  styleHeaderRow(s6.addRow(['Entity Name', 'Type', 'Invoiced / Billed (₦)', 'Closing Balance (₦)']));
  subSchedules.customers.forEach((c) => s6.addRow([c.name, 'Customer (AR)', c.invoiced, c.closing]));
  subSchedules.suppliers.forEach((s) => s6.addRow([s.name, 'Supplier (AP)', s.billed, s.closing]));
  applyCurrencyColumns(s6, [3, 4]);

  // ── 7. TAX_COMPUTATION_NTA_2025 ────────────────────────────────────────────
  const s7 = wb.addWorksheet('7_Tax_Computation');
  s7.columns = [{ width: 48 }, { width: 22 }, { width: 38 }];
  styleSectionBanner(s7, 'SECTION 7.1 & 7.2: SMALL COMPANY TEST & TAX COMPUTATION (NTA 2025)', 3);
  styleHeaderRow(s7.addRow(['Tax Computation Line Item', 'Amount / Value', 'Statutory Reference']));
  [
    ['Annual Turnover from Operations', taxComputation.annualTurnover, 'P&L Gross Turnover'],
    ['Small Company Turnover Ceiling', taxComputation.smallTurnoverCeiling, 'NTA 2025 Ceiling (₦100M)'],
    ['Gross Fixed Assets at Cost', taxComputation.grossFixedAssets, 'Balance Sheet Gross PPE'],
    ['Small Company Asset Ceiling', taxComputation.smallAssetCeiling, 'NTA 2025 Ceiling (₦250M)'],
    ['Professional Services Excluded', taxComputation.professionalServicesFlag ? 'Yes' : 'No', 'Excluded if Yes'],
    ['Qualifies for 0% Small Company CIT', taxComputation.qualifiesSmallCompanyExemption ? 'YES (0%)' : 'NO (27.5%)', 'Section 23, NTA 2025'],
    ['Profit Before Taxation (PBT)', taxComputation.pbt, 'Statement of Profit or Loss'],
    ['Add Back: Accounting Depreciation', taxComputation.addBackDepreciation, 'Disallowed for Tax'],
    ['Add Back: Fines & Non-Allowable Items', taxComputation.addBackFinesAndNonAllowable, 'Section 27, NTA 2025'],
    ['Deduct: Franked / Exempt Income', -taxComputation.deductFrankedInvestmentIncome, 'Exempt under NTA 2025'],
    ['ASSESSABLE PROFIT FOR THE YEAR', taxComputation.assessableProfit, 'Before Capital Allowances'],
    ['Less: Unrelieved Tax Losses Utilized', -taxComputation.unrelievedLossesUsed, 'Loss relief'],
    ['Less: Capital Allowances Claimed (Max 66.67%)', -taxComputation.capitalAllowancesClaimed, `Cap: ₦${taxComputation.caRestrictionCapAmount.toLocaleString()}`],
    ['TAXABLE (TOTAL) PROFIT', taxComputation.taxableProfit, 'Net corporate tax base'],
    [`Company Income Tax (${(taxComputation.applicableCitRate * 100).toFixed(1)}%)`, taxComputation.citCharged, 'NTA 2025 CIT'],
    ['Harmonized Development Levy (4.0%)', taxComputation.developmentLevyCharged, 'TET, Police Fund, NASENI unified levy'],
    ['TOTAL CORPORATE TAX LIABILITY', taxComputation.totalCorporateTaxLiability, 'Total NRS corporate tax'],
    ['Less: WHT Credit Notes Utilized', -taxComputation.whtCreditsUtilized, 'Section 8.2 WHT Schedule'],
    ['Less: Advance CIT Paid', -taxComputation.advanceCitPaid, 'Provisional tax remitted'],
    ['NET CURRENT TAX PAYABLE TO NRS', taxComputation.netCurrentTaxPayable, 'Ties to Balance Sheet Account 2070'],
    ['Closing Unrelieved Tax Losses Carried Forward', taxComputation.closingUnrelievedLosses, 'Section 7.4'],
    ['Closing Unutilized Capital Allowances Carried Forward', taxComputation.closingUnutilizedCa, 'Section 7.4'],
  ].forEach((r) => s7.addRow(r));
  applyCurrencyColumns(s7, [2]);

  // ── 8. FILING_CHECKLIST_AND_WHT ────────────────────────────────────────────
  const s8 = wb.addWorksheet('8_Filing_Checklist_WHT');
  s8.columns = [{ width: 14 }, { width: 44 }, { width: 28 }, { width: 18 }, { width: 32 }];
  styleSectionBanner(s8, 'SECTION 8.1: STATUTORY CIT FILING PACKAGE CHECKLIST', 5);
  styleHeaderRow(s8.addRow(['Doc No.', 'Filing Component', 'Statutory Reference', 'Status', 'Notes']));
  filingChecklist.forEach((d) => s8.addRow([d.docNo, d.component, d.reference, d.status, d.notes]));
  s8.addRow(['Due Date', filingReadiness.dueDate, 'Days Remaining', filingReadiness.daysRemaining, `Readiness: ${filingReadiness.readinessScore}%`]);
  s8.addRow([]);

  styleSectionBanner(s8, 'SECTION 8.2: SCHEDULE OF WITHHOLDING TAX (WHT) CREDIT NOTES CLAIMED', 5);
  styleHeaderRow(s8.addRow(['Customer / Client', 'Credit Note No.', 'Date', 'WHT Deducted (₦)', 'Amount Utilized (₦)']));
  whtSchedule.rows.forEach((w) => s8.addRow([w.client_name, w.credit_note_no, w.deduction_date, w.wht_deducted, w.amount_utilized]));
  applyCurrencyColumns(s8, [4, 5]);

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
