import {
  PIT_JURISDICTIONS,
  type PitAuthorityCode,
  type PitJurisdictionConfig,
  type PitStateCode,
  type TaxpayerClassification,
} from '../config/pitJurisdictions.ts';

export type PitTaxRegimeId = 'PITA_2011_FA2020' | 'NTA_2025';

export type IndividualActivityType =
  | 'employed'
  | 'self_employed'
  | 'rental'
  | 'investment'
  | 'multiple_sources'
  | 'other';

export interface PersonalOnboardingProfile {
  fullName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  nin: string;
  taxId: string;
  hasNoTaxId: boolean;
  residentialAddress: string;
  stateOfResidence: PitStateCode;
  lga: string;
  taxYear: number;
}

export interface EmploymentDetailsInput {
  employerName: string;
  employerAddress: string;
  employerTaxId: string;
  annualSalary: number;
  bonusesAndAllowances: number;
  pensionDeductions: number;
  payeDeducted: number;
  otherEmploymentBenefits: number;
}

export interface BusinessDetailsInput {
  registeredBusinessName: string;
  cacRegistrationNumber: string;
  businessTaxId: string;
  dateOfRegistration: string;
  businessAddress: string;
  stateOfOperation: string;
  natureOfBusiness: string;
  currentlyOperating: boolean;
}

export interface BusinessFinancialsInput {
  totalAnnualSales: number;
  costOfGoodsSold: number;
  operatingExpenses: number;
  staffSalaries: number;
  businessRent: number;
  transport: number;
  utilities: number;
  equipmentPurchases: number;
  otherBusinessExpenses: number;
  otherIncomeOutsideBusiness: number;
}

export interface BusinessComplianceObligationsInput {
  hasEmployees: boolean;
  deductsPaye: boolean;
  paysContractorsWht: boolean;
  vatRegistered: boolean;
  multipleBusinessLocations: boolean;
}

export interface PitIncomeInput {
  salaryAndWages: number;
  bonusesAndAllowances: number;
  benefitsInKind: number;
  businessNameGrossRevenue: number;
  businessNameAllowableExpenses: number;
  rentalIncome: number;
  freelanceAndOtherTaxableIncome: number;
  /** Optional expanded streams for individual onboarding */
  investmentTaxableIncome?: number;
  commissionsIncome?: number;
  otherTaxableIncome?: number;
  /** Franked dividends / exempt income excluded from chargeable PIT base */
  taxExemptOrFinalWhtIncome: number;
  payeAlreadyRemitted: number;
  whtCreditNotes: number;
}

export interface PitDeductionsInput {
  pensionContribution: number;
  nhfContribution: number;
  nhisContribution: number;
  lifeAssurancePremium: number;
  otherRecognisedDeductions?: number;
  /** Annual residential rent paid (eligible for NTA 2025 Rent Relief from 2026+) */
  annualRentPaid: number;
  isHomeowner: boolean;
  hasRentReceipts: boolean;
}

export interface PitComputationInput {
  taxYear: number;
  classification: TaxpayerClassification;
  stateCode: PitStateCode;
  income: PitIncomeInput;
  deductions: PitDeductionsInput;
  businessFinancials?: BusinessFinancialsInput;
}

export interface PitBandBreakdown {
  label: string;
  limit: number; // Infinity for top bracket
  rate: number;
  taxableInBand: number;
  taxInBand: number;
}

export interface BusinessProfitReconciliation {
  totalAnnualSales: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  staffSalaries: number;
  businessRent: number;
  transport: number;
  utilities: number;
  otherBusinessExpenses: number;
  totalAllowableOperatingExpenses: number;
  equipmentPurchasesNotExpensed: number;
  netBusinessProfit: number;
  businessLossCarriedForward: number;
}

export interface PitComputationResult {
  taxYear: number;
  regimeId: PitTaxRegimeId;
  regimeLabel: string;
  stateCode: PitStateCode;
  authorityCode: PitAuthorityCode;
  classification: TaxpayerClassification;
  employmentIncomeTotal: number;
  businessNetProfit: number;
  businessLossUnabsorbed: number;
  businessReconciliation: BusinessProfitReconciliation;
  otherTaxableIncomeTotal: number;
  totalAssessableIncome: number;
  statutoryExemptDeductionsTotal: number;
  incomeAfterStatutoryDeductions: number;
  consolidatedReliefAllowance: number;
  rentRelief: number;
  totalReliefsAndDeductions: number;
  chargeableIncome: number;
  bandBreakdown: PitBandBreakdown[];
  computedProgressiveTax: number;
  minimumTaxApplied: boolean;
  minimumTaxAmount: number;
  grossAnnualTax: number;
  payeAlreadyRemitted: number;
  whtCreditsApplied: number;
  netTaxPayable: number;
  taxRefundOrCarryForwardCredit: number;
  payeReconciliationStatus: 'balanced' | 'under_deducted' | 'over_deducted' | 'not_applicable';
  effectiveTaxRatePct: number;
  eligibleReliefNotes: string[];
  preparedReturnSummary: {
    formName: string;
    statutoryDeadline: string;
    grossIncomeDeclared: number;
    allowableDeductionsAndReliefs: number;
    chargeableIncome: number;
    assessedTaxLiability: number;
    taxCreditsAndPaye: number;
    balancePayable: number;
  };
}

export interface RovaBookTransactionLike {
  date: string;
  type: 'income' | 'expense' | 'transfer' | string;
  amount: number;
  description?: string;
}

const PITA_BANDS: Array<{ label: string; limit: number; rate: number }> = [
  { label: 'First ₦300,000', limit: 300_000, rate: 0.07 },
  { label: 'Next ₦300,000', limit: 300_000, rate: 0.11 },
  { label: 'Next ₦500,000', limit: 500_000, rate: 0.15 },
  { label: 'Next ₦500,000', limit: 500_000, rate: 0.19 },
  { label: 'Next ₦1,600,000', limit: 1_600_000, rate: 0.21 },
  { label: 'Above ₦3,200,000', limit: Number.POSITIVE_INFINITY, rate: 0.24 },
];

const NTA_2025_BANDS: Array<{ label: string; limit: number; rate: number }> = [
  { label: 'First ₦800,000 (Tax-Free)', limit: 800_000, rate: 0.0 },
  { label: 'Next ₦2,200,000 (₦800k – ₦3m)', limit: 2_200_000, rate: 0.15 },
  { label: 'Next ₦9,000,000 (₦3m – ₦12m)', limit: 9_000_000, rate: 0.18 },
  { label: 'Next ₦13,000,000 (₦12m – ₦25m)', limit: 13_000_000, rate: 0.21 },
  { label: 'Next ₦25,000,000 (₦25m – ₦50m)', limit: 25_000_000, rate: 0.23 },
  { label: 'Above ₦50,000,000', limit: Number.POSITIVE_INFINITY, rate: 0.25 },
];

const nonNeg = (val: unknown): number => {
  const num = Number(val);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : 0;
};

export function validatePitClassification(entityType: string): {
  allowed: boolean;
  classification?: TaxpayerClassification;
  message: string;
} {
  if (entityType === 'individual') {
    return {
      allowed: true,
      classification: 'individual',
      message: 'Eligible for State IRS Personal Income Tax (Individual Form A).',
    };
  }
  if (entityType === 'business_name') {
    return {
      allowed: true,
      classification: 'business_name',
      message: 'Eligible for State IRS Personal Income Tax (Direct Assessment — CAC Business Name).',
    };
  }
  return {
    allowed: false,
    message:
      'Limited Liability Companies (LTD / PLC) are excluded from State Personal Income Tax. Please use the NRS CIT Wizard for corporate filing.',
  };
}

export function getPitRegimeForYear(taxYear: number): PitTaxRegimeId {
  return taxYear >= 2026 ? 'NTA_2025' : 'PITA_2011_FA2020';
}

export function reconcileBusinessFinancials(fin: BusinessFinancialsInput): BusinessProfitReconciliation {
  const totalAnnualSales = nonNeg(fin.totalAnnualSales);
  const costOfGoodsSold = nonNeg(fin.costOfGoodsSold);
  const grossProfit = Math.round((totalAnnualSales - costOfGoodsSold) * 100) / 100;

  const operatingExpenses = nonNeg(fin.operatingExpenses);
  const staffSalaries = nonNeg(fin.staffSalaries);
  const businessRent = nonNeg(fin.businessRent);
  const transport = nonNeg(fin.transport);
  const utilities = nonNeg(fin.utilities);
  const otherBusinessExpenses = nonNeg(fin.otherBusinessExpenses);
  // Equipment purchases are capital expenditure (tracked separately for capital allowances, not expensed 100% directly)
  const equipmentPurchasesNotExpensed = nonNeg(fin.equipmentPurchases);

  const totalAllowableOperatingExpenses =
    Math.round(
      (operatingExpenses + staffSalaries + businessRent + transport + utilities + otherBusinessExpenses) * 100,
    ) / 100;

  const netRaw = Math.round((grossProfit - totalAllowableOperatingExpenses) * 100) / 100;

  return {
    totalAnnualSales,
    costOfGoodsSold,
    grossProfit,
    operatingExpenses,
    staffSalaries,
    businessRent,
    transport,
    utilities,
    otherBusinessExpenses,
    totalAllowableOperatingExpenses,
    equipmentPurchasesNotExpensed,
    netBusinessProfit: netRaw > 0 ? netRaw : 0,
    businessLossCarriedForward: netRaw < 0 ? Math.abs(netRaw) : 0,
  };
}

export function assessBusinessReconstructionGaps(params: {
  financials: BusinessFinancialsInput;
  uploadedDocKeys: string[];
}): string[] {
  const { financials, uploadedDocKeys } = params;
  const gaps: string[] = [];
  const hasDoc = (key: string) => uploadedDocKeys.includes(key);

  if (!hasDoc('financial_statements')) {
    gaps.push(
      'No existing financial statements uploaded — ROVA has reconstructed a draft Statement of Accounts for your Section 13 NTAA 2025 attestation.',
    );
  }
  if (financials.totalAnnualSales > 0 && !hasDoc('bank_statements') && !hasDoc('sales_records')) {
    gaps.push('Sales figures declared without uploaded bank statements or sales records.');
  }
  const hasExpenses =
    financials.costOfGoodsSold +
      financials.operatingExpenses +
      financials.staffSalaries +
      financials.businessRent +
      financials.transport +
      financials.utilities +
      financials.otherBusinessExpenses >
    0;
  if (hasExpenses && !hasDoc('expense_receipts') && !hasDoc('purchase_records') && !hasDoc('supplier_invoices')) {
    gaps.push('Business expenses claimed without supporting purchase records, receipts, or supplier invoices.');
  }
  if (financials.equipmentPurchases > 0) {
    gaps.push(
      `Equipment purchases of ₦${nonNeg(financials.equipmentPurchases).toLocaleString()} are excluded from direct operating expenses and must be treated under capital allowances.`,
    );
  }
  if (!hasDoc('cac_certificate')) {
    gaps.push('CAC Business Name Certificate not yet attached (commonly required for Direct Assessment & TCC).');
  }
  return gaps;
}

export function buildComplianceAdvisories(obligations: BusinessComplianceObligationsInput): string[] {
  const advisories: string[] = [];
  if (obligations.hasEmployees || obligations.deductsPaye) {
    advisories.push(
      'PAYE Obligation: Remit deducted employee PAYE monthly to the relevant State IRS and file annual employer PAYE returns (Form H1) separately from your own PIT.',
    );
  }
  if (obligations.paysContractorsWht) {
    advisories.push(
      'Withholding Tax (WHT): Deduct and remit WHT on qualifying contractor/supplier payments by the 21st of the following month (tracked outside your PIT liability).',
    );
  }
  if (obligations.vatRegistered) {
    advisories.push(
      'VAT Returns: Registered businesses file monthly VAT returns with NRS by the 21st of the following month unless eligible for small-business exemption.',
    );
  }
  if (obligations.multipleBusinessLocations) {
    advisories.push(
      'Multiple Locations: Employee PAYE is payable to the state of residence of each employee; proprietor Direct Assessment goes to the proprietor’s state of residence.',
    );
  }
  return advisories;
}

export function applyProgressiveBands(
  chargeableIncome: number,
  bands: Array<{ label: string; limit: number; rate: number }>,
): { breakdown: PitBandBreakdown[]; totalTax: number } {
  let remaining = Math.max(0, chargeableIncome);
  let totalTax = 0;
  const breakdown: PitBandBreakdown[] = [];

  for (const band of bands) {
    if (remaining <= 0) {
      breakdown.push({
        label: band.label,
        limit: band.limit,
        rate: band.rate,
        taxableInBand: 0,
        taxInBand: 0,
      });
      continue;
    }

    const taxableInBand = band.limit === Number.POSITIVE_INFINITY ? remaining : Math.min(remaining, band.limit);
    const taxInBand = Math.round(taxableInBand * band.rate * 100) / 100;
    totalTax += taxInBand;
    remaining -= taxableInBand;

    breakdown.push({
      label: band.label,
      limit: band.limit,
      rate: band.rate,
      taxableInBand,
      taxInBand,
    });
  }

  return {
    breakdown,
    totalTax: Math.round(totalTax * 100) / 100,
  };
}

export function computePitReturn(input: PitComputationInput): PitComputationResult {
  const jurisdiction: PitJurisdictionConfig = PIT_JURISDICTIONS[input.stateCode];
  const regimeId = getPitRegimeForYear(input.taxYear);
  const regimeLabel =
    regimeId === 'NTA_2025'
      ? 'Nigeria Tax Act 2025 (Effective 1 Jan 2026)'
      : 'Personal Income Tax Act (PITA & Finance Act 2020)';

  const salaryAndWages = nonNeg(input.income.salaryAndWages);
  const bonusesAndAllowances = nonNeg(input.income.bonusesAndAllowances);
  const benefitsInKind = nonNeg(input.income.benefitsInKind);
  const employmentIncomeTotal = salaryAndWages + bonusesAndAllowances + benefitsInKind;

  const isBusinessName = input.classification === 'business_name';
  let businessReconciliation: BusinessProfitReconciliation;

  if (isBusinessName && input.businessFinancials) {
    businessReconciliation = reconcileBusinessFinancials(input.businessFinancials);
  } else {
    const rev = isBusinessName ? nonNeg(input.income.businessNameGrossRevenue) : 0;
    const exp = isBusinessName ? nonNeg(input.income.businessNameAllowableExpenses) : 0;
    const netRaw = Math.round((rev - exp) * 100) / 100;
    businessReconciliation = {
      totalAnnualSales: rev,
      costOfGoodsSold: 0,
      grossProfit: rev,
      operatingExpenses: exp,
      staffSalaries: 0,
      businessRent: 0,
      transport: 0,
      utilities: 0,
      otherBusinessExpenses: 0,
      totalAllowableOperatingExpenses: exp,
      equipmentPurchasesNotExpensed: 0,
      netBusinessProfit: netRaw > 0 ? netRaw : 0,
      businessLossCarriedForward: netRaw < 0 ? Math.abs(netRaw) : 0,
    };
  }

  const businessNetProfit = businessReconciliation.netBusinessProfit;
  const businessLossUnabsorbed = businessReconciliation.businessLossCarriedForward;

  const rentalIncome = nonNeg(input.income.rentalIncome);
  const freelanceOther = nonNeg(input.income.freelanceAndOtherTaxableIncome);
  const investmentTaxable = nonNeg(input.income.investmentTaxableIncome);
  const commissions = nonNeg(input.income.commissionsIncome);
  const otherTaxable = nonNeg(input.income.otherTaxableIncome);
  const outsideBizIncome =
    isBusinessName && input.businessFinancials ? nonNeg(input.businessFinancials.otherIncomeOutsideBusiness) : 0;

  const otherTaxableIncomeTotal =
    Math.round((rentalIncome + freelanceOther + investmentTaxable + commissions + otherTaxable + outsideBizIncome) * 100) /
    100;

  const totalAssessableIncome =
    Math.round((employmentIncomeTotal + businessNetProfit + otherTaxableIncomeTotal) * 100) / 100;

  const pensionContribution = nonNeg(input.deductions.pensionContribution);
  const nhfContribution = nonNeg(input.deductions.nhfContribution);
  const nhisContribution = nonNeg(input.deductions.nhisContribution);
  const lifeAssurancePremium = nonNeg(input.deductions.lifeAssurancePremium);
  const otherRecognisedDeductions = nonNeg(input.deductions.otherRecognisedDeductions);

  const rawStatutory =
    pensionContribution + nhfContribution + nhisContribution + lifeAssurancePremium + otherRecognisedDeductions;
  const statutoryExemptDeductionsTotal = Math.min(totalAssessableIncome, rawStatutory);
  const incomeAfterStatutoryDeductions = Math.max(0, totalAssessableIncome - statutoryExemptDeductionsTotal);

  const eligibleReliefNotes: string[] = [];
  let consolidatedReliefAllowance = 0;
  let rentRelief = 0;

  if (regimeId === 'NTA_2025') {
    const annualRentPaid = nonNeg(input.deductions.annualRentPaid);
    if (!input.deductions.isHomeowner && annualRentPaid > 0 && input.deductions.hasRentReceipts) {
      rentRelief = Math.min(500_000, Math.round(annualRentPaid * 0.2 * 100) / 100);
      eligibleReliefNotes.push(
        `NTA 2025 Rent Relief applied: 20% of ₦${annualRentPaid.toLocaleString()} capped at ₦500,000 = ₦${rentRelief.toLocaleString()}.`,
      );
    } else if (!input.deductions.isHomeowner && annualRentPaid > 0 && !input.deductions.hasRentReceipts) {
      eligibleReliefNotes.push(
        'Rent Relief (NTA 2025) requires valid rent payment receipts/tenancy proof before claiming.',
      );
    }
    eligibleReliefNotes.push('Consolidated Relief Allowance (CRA) is abolished under NTA 2025; first ₦800,000 is taxed at 0%.');
  } else {
    if (incomeAfterStatutoryDeductions > 0) {
      consolidatedReliefAllowance =
        Math.round((Math.max(200_000, incomeAfterStatutoryDeductions * 0.01) + incomeAfterStatutoryDeductions * 0.2) * 100) /
        100;
      eligibleReliefNotes.push(
        `PITA Consolidated Relief Allowance (CRA) applied: max(₦200k, 1%) + 20% of post-deduction income = ₦${consolidatedReliefAllowance.toLocaleString()}.`,
      );
    }
  }

  if (statutoryExemptDeductionsTotal > 0) {
    eligibleReliefNotes.push(
      `Statutory tax-exempt deductions (Pension/NHF/NHIS/Life Assurance/Other): ₦${statutoryExemptDeductionsTotal.toLocaleString()}.`,
    );
  }
  if (nonNeg(input.income.taxExemptOrFinalWhtIncome) > 0) {
    eligibleReliefNotes.push(
      `Franked dividends / exempt income (₦${nonNeg(input.income.taxExemptOrFinalWhtIncome).toLocaleString()}) excluded from PIT base.`,
    );
  }
  if (businessLossUnabsorbed > 0) {
    eligibleReliefNotes.push(
      `Business trading loss of ₦${businessLossUnabsorbed.toLocaleString()} is unabsorbed against other streams here and noted for carry-forward.`,
    );
  }

  const totalReliefsAndDeductions = Math.min(
    totalAssessableIncome,
    Math.round((statutoryExemptDeductionsTotal + consolidatedReliefAllowance + rentRelief) * 100) / 100,
  );
  const chargeableIncome = Math.max(0, Math.round((totalAssessableIncome - totalReliefsAndDeductions) * 100) / 100);

  const bands = regimeId === 'NTA_2025' ? NTA_2025_BANDS : PITA_BANDS;
  const { breakdown, totalTax: computedProgressiveTax } = applyProgressiveBands(chargeableIncome, bands);

  let minimumTaxApplied = false;
  let minimumTaxAmount = 0;
  let grossAnnualTax = computedProgressiveTax;

  if (regimeId === 'PITA_2011_FA2020' && totalAssessableIncome > 360_000) {
    minimumTaxAmount = Math.round(incomeAfterStatutoryDeductions * 0.01 * 100) / 100;
    if (computedProgressiveTax < minimumTaxAmount) {
      minimumTaxApplied = true;
      grossAnnualTax = minimumTaxAmount;
      eligibleReliefNotes.push(
        `PITA 1% minimum tax triggered (₦${minimumTaxAmount.toLocaleString()} exceeds progressive computation of ₦${computedProgressiveTax.toLocaleString()}).`,
      );
    }
  } else if (regimeId === 'PITA_2011_FA2020' && totalAssessableIncome <= 360_000) {
    grossAnnualTax = 0;
    eligibleReliefNotes.push('Gross income does not exceed ₦360,000 minimum wage exemption under Finance Act 2020.');
  }

  const payeAlreadyRemitted = nonNeg(input.income.payeAlreadyRemitted);
  const whtCreditsApplied = nonNeg(input.income.whtCreditNotes);
  const totalCredits = payeAlreadyRemitted + whtCreditsApplied;

  const netDiff = Math.round((grossAnnualTax - totalCredits) * 100) / 100;
  const netTaxPayable = netDiff > 0 ? netDiff : 0;
  const taxRefundOrCarryForwardCredit = netDiff < 0 ? Math.abs(netDiff) : 0;

  let payeReconciliationStatus: PitComputationResult['payeReconciliationStatus'] = 'not_applicable';
  if (employmentIncomeTotal > 0 || payeAlreadyRemitted > 0) {
    if (Math.abs(netDiff) < 1) payeReconciliationStatus = 'balanced';
    else if (netDiff > 0) payeReconciliationStatus = 'under_deducted';
    else payeReconciliationStatus = 'over_deducted';
  }

  const effectiveTaxRatePct =
    totalAssessableIncome > 0 ? Math.round((grossAnnualTax / totalAssessableIncome) * 10000) / 100 : 0;

  const primaryFormName = jurisdiction.returnTemplates[0]?.formName || `${jurisdiction.authorityCode} Form A`;

  return {
    taxYear: input.taxYear,
    regimeId,
    regimeLabel,
    stateCode: input.stateCode,
    authorityCode: jurisdiction.authorityCode,
    classification: input.classification,
    employmentIncomeTotal,
    businessNetProfit,
    businessLossUnabsorbed,
    businessReconciliation,
    otherTaxableIncomeTotal,
    totalAssessableIncome,
    statutoryExemptDeductionsTotal,
    incomeAfterStatutoryDeductions,
    consolidatedReliefAllowance,
    rentRelief,
    totalReliefsAndDeductions,
    chargeableIncome,
    bandBreakdown: breakdown,
    computedProgressiveTax,
    minimumTaxApplied,
    minimumTaxAmount,
    grossAnnualTax,
    payeAlreadyRemitted,
    whtCreditsApplied,
    netTaxPayable,
    taxRefundOrCarryForwardCredit,
    payeReconciliationStatus,
    effectiveTaxRatePct,
    eligibleReliefNotes,
    preparedReturnSummary: {
      formName: primaryFormName,
      statutoryDeadline: jurisdiction.statutoryDeadline,
      grossIncomeDeclared: totalAssessableIncome,
      allowableDeductionsAndReliefs: totalReliefsAndDeductions,
      chargeableIncome,
      assessedTaxLiability: grossAnnualTax,
      taxCreditsAndPaye: totalCredits,
      balancePayable: netTaxPayable,
    },
  };
}

export function deriveBusinessSummaryFromTransactions(
  transactions: RovaBookTransactionLike[],
  taxYear: number,
): {
  businessRevenue: number;
  allowableBusinessExpenses: number;
  matchedCount: number;
} {
  let businessRevenue = 0;
  let allowableBusinessExpenses = 0;
  let matchedCount = 0;

  const prefix = `${taxYear}-`;
  for (const tx of transactions) {
    if (!tx.date || !tx.date.startsWith(prefix)) continue;
    const amt = nonNeg(tx.amount);
    if (amt <= 0) continue;

    if (tx.type === 'income') {
      businessRevenue += amt;
      matchedCount += 1;
    } else if (tx.type === 'expense') {
      allowableBusinessExpenses += amt;
      matchedCount += 1;
    }
  }

  return {
    businessRevenue: Math.round(businessRevenue * 100) / 100,
    allowableBusinessExpenses: Math.round(allowableBusinessExpenses * 100) / 100,
    matchedCount,
  };
}
