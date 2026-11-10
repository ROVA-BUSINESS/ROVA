import type { FinancialStatementModel } from './financialStatementEngine';
import { STATUTORY_ASSET_RATES } from './standardCoa';
import type { AssetCategory, FixedAsset, RovaTaxState, Sector } from '../types/rovaTaxFlow';
import type { FinancialStatementProfile } from './supabase';

/** Maps the 8-section FinancialStatementModel into the NRS CIT Filing Wizard state */
export function mapFinancialStatementsToCitState(model: FinancialStatementModel): RovaTaxState {
  const { profile, incomeStatement, balanceSheet, fixedAssets, taxComputation, notes, suspenseLog, auditChecks } =
    model;

  const fy = String(profile.fiscal_year || new Date(profile.fy_end_date || '2026-12-31').getFullYear());
  const sector: Sector = (profile.sector as Sector) || 'WHOLESALE AND RETAIL TRADE';

  const mappedAssets: FixedAsset[] = fixedAssets.register
    .filter((r) => r.status !== 'Disposed' && r.historicalCost > 0)
    .map((r, idx) => {
      const rateInfo = STATUTORY_ASSET_RATES[r.assetClass];
      return {
        id: r.assetCode || `fa_${idx}`,
        dateFirstUsed: r.dateAcquired,
        cost: r.historicalCost,
        description: r.description,
        category: (rateInfo?.citCategory as AssetCategory) || 'Others',
        statutoryClass: r.assetClass,
        initialAllowanceRate: rateInfo?.initialAllowanceRate ?? 0.5,
        annualAllowanceRate: rateInfo?.annualAllowanceRate ?? 0.25,
      };
    });

  const qceAdditionsExist = fixedAssets.totals.qceAdditions > 0 || mappedAssets.length > 0;

  // Map Cost of Sales
  const purchases: Record<string, number> = {};
  if (notes.note5Cos.materials > 0) purchases['Local Purchases'] = notes.note5Cos.materials;

  const otherDirectCost: Record<string, number> = {};
  if (notes.note5Cos.directLabour > 0) otherDirectCost['Direct wages'] = notes.note5Cos.directLabour;
  if (notes.note5Cos.freight > 0) otherDirectCost['Carriage Inwards'] = notes.note5Cos.freight;

  // Map Other Income (Operating + Finance Income)
  const otherIncome: Record<string, number> = { ...incomeStatement.otherIncomeBreakdown };
  if (incomeStatement.financeIncome > 0) {
    otherIncome['Interest Income'] = (otherIncome['Interest Income'] || 0) + incomeStatement.financeIncome;
  }

  // Map Admin Expenses (preserve exact NRS labels, fallback to COA -> NRS labels)
  const adminExpense: Record<string, number> = { ...incomeStatement.adminBreakdown };
  if (Object.keys(adminExpense).length === 0 && incomeStatement.operatingExpenses > 0) {
    adminExpense['Others'] = incomeStatement.operatingExpenses;
  }
  if (incomeStatement.financeCosts > 0) {
    adminExpense['Interest Expense'] = (adminExpense['Interest Expense'] || 0) + incomeStatement.financeCosts;
  }

  // Map SFP (Statement of Financial Position)
  const otherCurrentAssets: Record<string, number> = {};
  if (notes.note10Prepayments.prepaid > 0) otherCurrentAssets['Prepaid Expenses'] = notes.note10Prepayments.prepaid;
  if (notes.note9Receivables.wht > 0) otherCurrentAssets['Withholding tax receivables'] = notes.note9Receivables.wht;
  const otherRec = notes.note9Receivables.other + notes.note9Receivables.suspense + notes.note10Prepayments.vatInput;
  if (otherRec > 0) otherCurrentAssets['Other receivables'] = otherRec;
  if (notes.note10Prepayments.deposits > 0) {
    otherCurrentAssets['Advance payment to vendor'] = notes.note10Prepayments.deposits;
  }

  const cashAndEquivalents: Record<string, number> = {};
  if (notes.note11Cash.cashOnHand > 0) cashAndEquivalents['Cash in hand'] = notes.note11Cash.cashOnHand;
  const bankCash = notes.note11Cash.zenith + notes.note11Cash.gtbank;
  if (bankCash > 0) cashAndEquivalents['Cash at Bank'] = bankCash;
  if (notes.note11Cash.callPlacements > 0) {
    cashAndEquivalents['marketable securities'] = notes.note11Cash.callPlacements;
  }

  const tradePayablesAndCurrentTax: Record<string, number> = {};
  if (notes.note12Payables.trade > 0) tradePayablesAndCurrentTax['Trade Payables'] = notes.note12Payables.trade;
  if (notes.note13CurrentTax > 0) tradePayablesAndCurrentTax['Current tax liabilities'] = notes.note13CurrentTax;

  const otherCurrentLiabilities: Record<string, number> = {};
  const accruals = notes.note12Payables.accruedAudit;
  if (accruals > 0) otherCurrentLiabilities['Accruals'] = accruals;
  if (notes.note12Payables.accruedPayroll > 0) {
    otherCurrentLiabilities['Provision for bonuses and employee benefits'] = notes.note12Payables.accruedPayroll;
  }
  if (notes.note12Payables.customerAdvances > 0) {
    otherCurrentLiabilities['Unearned income (advance from customers)'] = notes.note12Payables.customerAdvances;
  }
  const otherPayables =
    notes.note12Payables.vatOutput +
    notes.note12Payables.whtPayable +
    notes.note12Payables.paye +
    notes.note14Borrowings.directorCurrent;
  if (otherPayables > 0) otherCurrentLiabilities['Other payables'] = otherPayables;
  if (notes.note14Borrowings.shortTerm > 0) {
    otherCurrentLiabilities['Short-term debt'] = notes.note14Borrowings.shortTerm;
  }

  const nonCurrentLiabilities: Record<string, number> = {};
  if (notes.note14Borrowings.longTerm > 0) {
    nonCurrentLiabilities['Long term Borrowings'] = notes.note14Borrowings.longTerm;
  }

  const equity: Record<string, number> = {};
  if (notes.note15Equity.shareCapital > 0) equity['Issued Share Capital'] = notes.note15Equity.shareCapital;
  if (notes.note15Equity.retainedEarnings !== 0) equity['Retained earnings'] = notes.note15Equity.retainedEarnings;

  const intangibleAssets: Record<string, number> = {};
  if (balanceSheet.intangibles > 0) intangibleAssets['Others'] = balanceSheet.intangibles;

  // Profit Adjustments (Add-backs & Deductions)
  const addbacks: Record<string, number> = {};
  if (taxComputation.addBackDepreciation > 0) {
    addbacks['Depreciation'] = taxComputation.addBackDepreciation;
  }
  if (taxComputation.addBackFinesAndNonAllowable > 0) {
    addbacks['Penalty or fine imposed under any law'] = taxComputation.addBackFinesAndNonAllowable;
  }

  const deductions: Record<string, number> = {};
  if (taxComputation.deductFrankedInvestmentIncome > 0) {
    deductions['Frank Investment Income'] = taxComputation.deductFrankedInvestmentIncome;
  }

  const auditPassCount = auditChecks.filter((c) => c.status === 'PASS').length;

  return {
    hasNewFixedAssets: qceAdditionsExist,
    hasFixedAssets: mappedAssets.length > 0,
    assets: mappedAssets,
    mneCfc: { isMNE: false, isCFC: false },
    yearOfAssessment: fy,
    sector,
    sectors: [sector],
    sectorRevenues: { [sector]: incomeStatement.revenue },
    revenue: incomeStatement.revenue,
    costOfSales: {
      openingInventory: {},
      purchases,
      otherDirectCost,
      factoryOverheads: {},
      closingInventory: {},
    },
    sfp: {
      propertiesPlantsEquipment: balanceSheet.ppe,
      investments: {},
      intangibleAssets,
      otherNonCurrentAssets: {},
      inventories: balanceSheet.inventories,
      tradeReceivables: notes.note9Receivables.trade - notes.note9Receivables.ecl,
      otherCurrentAssets,
      cashAndEquivalents,
      otherCurrentLiabilities,
      nonCurrentLiabilities,
      otherReserves: {},
      tradePayablesAndCurrentTax,
      equity,
    },
    profitAdjustment: {
      hasAddbacks: Object.keys(addbacks).length > 0,
      addbacks,
      hasDeductions: Object.keys(deductions).length > 0,
      deductions,
    },
    otherIncome,
    adminExpense,
    nta2025: {
      professionalServicesFlag: profile.professional_services_flag,
      grossFixedAssets: taxComputation.grossFixedAssets,
      whtCreditsUtilized: taxComputation.whtCreditsUtilized,
      advanceCitPaid: taxComputation.advanceCitPaid,
      openingUnutilizedCa: Math.max(0, taxComputation.totalCaAvailable - fixedAssets.totals.totalCa),
      openingUnrelievedLosses: taxComputation.unrelievedLossesUsed,
      financeIncome: incomeStatement.financeIncome,
      financeCosts: incomeStatement.financeCosts,
      syncedFromFinancialStatements: true,
      companyLegalName: profile.company_legal_name,
      rcNumber: profile.rc_number,
      tin: profile.tin,
      suspenseCount: suspenseLog.length,
      auditPassCount,
    },
  };
}

/** Branch A: Converts DeepSeek-extracted Financial Statement JSON directly into RovaTaxState */
export function mapExtractedFsJsonToCitState(
  extracted: any,
  profile: FinancialStatementProfile
): RovaTaxState {
  const fy = String(profile.fiscal_year || 2026);
  const sector = (extracted?.companyProfile?.sector || profile.sector || 'WHOLESALE AND RETAIL TRADE') as Sector;
  const rev = Number(extracted?.revenue || 0);
  const cos = extracted?.costOfSales || {};
  const bs = extracted?.balanceSheet || {};
  const taxAdj = extracted?.taxAdjustments || {};

  const addbacks: Record<string, number> = {};
  if (Number(taxAdj.depreciationAddBack) > 0) addbacks['Depreciation'] = Number(taxAdj.depreciationAddBack);
  if (Number(taxAdj.finesAndPenalties) > 0) {
    addbacks['Penalty or fine imposed under any law'] = Number(taxAdj.finesAndPenalties);
  }

  const deductions: Record<string, number> = {};
  if (Number(taxAdj.exemptIncome) > 0) deductions['Deduct Non Taxable Items'] = Number(taxAdj.exemptIncome);

  return {
    hasNewFixedAssets: Number(taxAdj.capitalAllowances || 0) > 0,
    hasFixedAssets: Number(bs.ppe || 0) > 0,
    assets: [],
    mneCfc: { isMNE: false, isCFC: false },
    yearOfAssessment: fy,
    sector,
    sectors: [sector],
    sectorRevenues: { [sector]: rev },
    revenue: rev,
    costOfSales: {
      openingInventory: Number(cos.openingInventory) > 0 ? { 'Finished goods': Number(cos.openingInventory) } : {},
      purchases: Number(cos.purchases) > 0 ? { 'Local Purchases': Number(cos.purchases) } : {},
      otherDirectCost: Number(cos.otherDirectCost) > 0 ? { 'Direct expenses': Number(cos.otherDirectCost) } : {},
      factoryOverheads: Number(cos.factoryOverheads) > 0 ? { 'Other Factory Overheads': Number(cos.factoryOverheads) } : {},
      closingInventory: Number(cos.closingInventory) > 0 ? { 'Finished goods': Number(cos.closingInventory) } : {},
    },
    sfp: {
      propertiesPlantsEquipment: Number(bs.ppe || 0),
      investments: {},
      intangibleAssets: Number(bs.intangibles) > 0 ? { Others: Number(bs.intangibles) } : {},
      otherNonCurrentAssets: {},
      inventories: Number(bs.inventories || 0),
      tradeReceivables: Number(bs.tradeReceivables || 0),
      otherCurrentAssets: Number(bs.otherCurrentAssets) > 0 ? { 'Other receivables': Number(bs.otherCurrentAssets) } : {},
      cashAndEquivalents: Number(bs.cashAndEquivalents) > 0 ? { 'Cash at Bank': Number(bs.cashAndEquivalents) } : {},
      otherCurrentLiabilities:
        Number(bs.otherCurrentLiabilities) > 0 ? { 'Other payables': Number(bs.otherCurrentLiabilities) } : {},
      nonCurrentLiabilities:
        Number(bs.nonCurrentLiabilities) > 0 ? { 'Long term Borrowings': Number(bs.nonCurrentLiabilities) } : {},
      otherReserves: {},
      tradePayablesAndCurrentTax: {
        ...(Number(bs.tradePayables) > 0 ? { 'Trade Payables': Number(bs.tradePayables) } : {}),
        ...(Number(bs.currentTaxLiabilities) > 0 ? { 'Current tax liabilities': Number(bs.currentTaxLiabilities) } : {}),
      },
      equity: {
        ...(Number(bs.shareCapital) > 0 ? { 'Issued Share Capital': Number(bs.shareCapital) } : {}),
        ...(Number(bs.retainedEarnings) !== 0 ? { 'Retained earnings': Number(bs.retainedEarnings) } : {}),
      },
    },
    profitAdjustment: {
      hasAddbacks: Object.keys(addbacks).length > 0,
      addbacks,
      hasDeductions: Object.keys(deductions).length > 0,
      deductions,
    },
    otherIncome: extracted?.otherIncome || {},
    adminExpense: extracted?.adminExpenses || {},
    nta2025: {
      professionalServicesFlag: profile.professional_services_flag,
      grossFixedAssets: Number(bs.ppe || 0),
      whtCreditsUtilized: Number(taxAdj.whtCredits || 0),
      advanceCitPaid: 0,
      openingUnutilizedCa: Number(taxAdj.capitalAllowances || 0),
      openingUnrelievedLosses: 0,
      syncedFromFinancialStatements: true,
      companyLegalName: extracted?.companyProfile?.company_legal_name || profile.company_legal_name,
      rcNumber: extracted?.companyProfile?.rc_number || profile.rc_number,
      tin: extracted?.companyProfile?.tin || profile.tin,
    },
  };
}
