import assert from 'node:assert/strict';
import {
  PIT_JURISDICTION_LIST,
  PIT_JURISDICTIONS,
  resolvePitJurisdiction,
} from '../src/config/pitJurisdictions.ts';
import {
  assessBusinessReconstructionGaps,
  buildComplianceAdvisories,
  computePitReturn,
  deriveBusinessSummaryFromTransactions,
  reconcileBusinessFinancials,
  validatePitClassification,
} from '../src/lib/pitEngine.ts';

console.log('Testing ROVA Four-State PIT Engine & Jurisdiction Config...');

// 1. Classification guard
assert.equal(validatePitClassification('individual').allowed, true);
assert.equal(validatePitClassification('business_name').allowed, true);
assert.equal(validatePitClassification('llc').allowed, false);
assert.equal(validatePitClassification('ltd').allowed, false);

// 2. Four-state routing & configuration completeness
assert.equal(PIT_JURISDICTION_LIST.length, 4);
assert.equal(resolvePitJurisdiction('Lagos')?.authorityCode, 'LIRS');
assert.equal(resolvePitJurisdiction('Kano')?.authorityCode, 'KIRS');
assert.equal(resolvePitJurisdiction('Abuja')?.authorityCode, 'FCT-IRS');
assert.equal(resolvePitJurisdiction('Port Harcourt')?.authorityCode, 'RIRS');

for (const j of PIT_JURISDICTION_LIST) {
  assert.ok(j.officialWebsite.startsWith('https://'), `${j.authorityCode} missing officialWebsite`);
  assert.ok(j.portalUrl.startsWith('https://'), `${j.authorityCode} missing portalUrl`);
  assert.equal(j.adminStatus.apiAvailable, false, `${j.authorityCode} should reflect no public filing API`);
  assert.equal(j.adminStatus.filingTemplateAvailable, true, `${j.authorityCode} should have Form A template`);
  assert.equal(j.adminStatus.lastVerificationDate, '2026-11-11');
  assert.ok(j.filingProcedureSteps.length >= 4, `${j.authorityCode} missing filing steps`);
}

assert.equal(PIT_JURISDICTIONS.LAGOS.portalUrl, 'https://etax.lirs.net');
assert.equal(PIT_JURISDICTIONS.KANO.portalUrl, 'https://etax.kirs.gov.ng');
assert.equal(PIT_JURISDICTIONS.FCT.portalUrl, 'https://taxporta.fctirs.gov.ng');
assert.equal(PIT_JURISDICTIONS.RIVERS.portalUrl, 'https://rivtamis.riversbirs.gov.ng');

// 3. PITA 2025 individual salaried computation
const pitaResult = computePitReturn({
  taxYear: 2025,
  classification: 'individual',
  stateCode: 'LAGOS',
  income: {
    salaryAndWages: 6_000_000,
    bonusesAndAllowances: 0,
    benefitsInKind: 0,
    businessNameGrossRevenue: 0,
    businessNameAllowableExpenses: 0,
    rentalIncome: 0,
    freelanceAndOtherTaxableIncome: 0,
    taxExemptOrFinalWhtIncome: 0,
    payeAlreadyRemitted: 500_000,
    whtCreditNotes: 0,
  },
  deductions: {
    pensionContribution: 480_000,
    nhfContribution: 0,
    nhisContribution: 0,
    lifeAssurancePremium: 0,
    annualRentPaid: 0,
    isHomeowner: false,
    hasRentReceipts: false,
  },
});

assert.equal(pitaResult.regimeId, 'PITA_2011_FA2020');
assert.equal(pitaResult.incomeAfterStatutoryDeductions, 5_520_000);
assert.equal(pitaResult.consolidatedReliefAllowance, 1_304_000);
assert.equal(pitaResult.chargeableIncome, 4_216_000);
assert.equal(pitaResult.grossAnnualTax, 803_840);
assert.equal(pitaResult.netTaxPayable, 303_840);

// Minimum wage exemption (<= 360k under PITA/FA2020)
const minWage2025 = computePitReturn({
  taxYear: 2025,
  classification: 'individual',
  stateCode: 'KANO',
  income: {
    salaryAndWages: 360_000,
    bonusesAndAllowances: 0,
    benefitsInKind: 0,
    businessNameGrossRevenue: 0,
    businessNameAllowableExpenses: 0,
    rentalIncome: 0,
    freelanceAndOtherTaxableIncome: 0,
    taxExemptOrFinalWhtIncome: 0,
    payeAlreadyRemitted: 0,
    whtCreditNotes: 0,
  },
  deductions: {
    pensionContribution: 0,
    nhfContribution: 0,
    nhisContribution: 0,
    lifeAssurancePremium: 0,
    annualRentPaid: 0,
    isHomeowner: false,
    hasRentReceipts: false,
  },
});
assert.equal(minWage2025.grossAnnualTax, 0);

// 4. NTA 2025 (2026+) Business Name owner with capped Rent Relief (500k)
const ntaResult = computePitReturn({
  taxYear: 2026,
  classification: 'business_name',
  stateCode: 'FCT',
  income: {
    salaryAndWages: 0,
    bonusesAndAllowances: 0,
    benefitsInKind: 0,
    businessNameGrossRevenue: 10_000_000,
    businessNameAllowableExpenses: 4_000_000,
    rentalIncome: 0,
    freelanceAndOtherTaxableIncome: 0,
    taxExemptOrFinalWhtIncome: 250_000,
    payeAlreadyRemitted: 0,
    whtCreditNotes: 100_000,
  },
  deductions: {
    pensionContribution: 400_000,
    nhfContribution: 0,
    nhisContribution: 0,
    lifeAssurancePremium: 0,
    annualRentPaid: 3_000_000,
    isHomeowner: false,
    hasRentReceipts: true,
  },
});

assert.equal(ntaResult.regimeId, 'NTA_2025');
assert.equal(ntaResult.businessNetProfit, 6_000_000);
assert.equal(ntaResult.consolidatedReliefAllowance, 0);
assert.equal(ntaResult.rentRelief, 500_000);
assert.equal(ntaResult.chargeableIncome, 5_100_000);
assert.equal(ntaResult.grossAnnualTax, 708_000); // 800k*0 + 2.2M*15% + 2.1M*18%
assert.equal(ntaResult.netTaxPayable, 608_000);

// Homeowner receives zero Rent Relief under NTA 2025
const homeownerNta = computePitReturn({
  taxYear: 2026,
  classification: 'individual',
  stateCode: 'RIVERS',
  income: {
    salaryAndWages: 800_000,
    bonusesAndAllowances: 0,
    benefitsInKind: 0,
    businessNameGrossRevenue: 0,
    businessNameAllowableExpenses: 0,
    rentalIncome: 0,
    freelanceAndOtherTaxableIncome: 0,
    taxExemptOrFinalWhtIncome: 0,
    payeAlreadyRemitted: 0,
    whtCreditNotes: 0,
  },
  deductions: {
    pensionContribution: 0,
    nhfContribution: 0,
    nhisContribution: 0,
    lifeAssurancePremium: 0,
    annualRentPaid: 2_000_000,
    isHomeowner: true,
    hasRentReceipts: true,
  },
});
assert.equal(homeownerNta.rentRelief, 0);
assert.equal(homeownerNta.grossAnnualTax, 0); // First 800k @ 0%

// 5. Ledger derivation helper
const ledger = deriveBusinessSummaryFromTransactions(
  [
    { date: '2026-02-10', type: 'income', amount: 1_500_000 },
    { date: '2026-06-15', type: 'expense', amount: 450_000 },
    { date: '2025-12-30', type: 'income', amount: 900_000 },
  ],
  2026,
);
assert.equal(ledger.businessRevenue, 1_500_000);
assert.equal(ledger.allowableBusinessExpenses, 450_000);
assert.equal(ledger.matchedCount, 2);

// 6. Itemized Business Name Financials (Equipment CapEx excluded + Section 13 gap check)
const bizFinancials = {
  totalAnnualSales: 12_000_000,
  costOfGoodsSold: 3_000_000,
  operatingExpenses: 1_000_000,
  staffSalaries: 1_200_000,
  businessRent: 600_000,
  transport: 200_000,
  utilities: 150_000,
  equipmentPurchases: 1_500_000, // CapEx — must NOT reduce profit directly
  otherBusinessExpenses: 50_000,
  otherIncomeOutsideBusiness: 500_000,
};
const rec = reconcileBusinessFinancials(bizFinancials);
assert.equal(rec.grossProfit, 9_000_000);
assert.equal(rec.totalAllowableOperatingExpenses, 3_200_000);
assert.equal(rec.netBusinessProfit, 5_800_000);
assert.equal(rec.equipmentPurchasesNotExpensed, 1_500_000);

const gaps = assessBusinessReconstructionGaps({ financials: bizFinancials, uploadedDocKeys: [] });
assert.ok(gaps.length >= 4, 'Expected missing FS, sales/expense evidence, equipment CapEx, and CAC doc gaps');

const advisories = buildComplianceAdvisories({
  hasEmployees: true,
  deductsPaye: true,
  paysContractorsWht: true,
  vatRegistered: false,
  multipleBusinessLocations: true,
});
assert.equal(advisories.length, 3);

const bizPit = computePitReturn({
  taxYear: 2026,
  classification: 'business_name',
  stateCode: 'LAGOS',
  income: {
    salaryAndWages: 0,
    bonusesAndAllowances: 0,
    benefitsInKind: 0,
    businessNameGrossRevenue: 0,
    businessNameAllowableExpenses: 0,
    rentalIncome: 0,
    freelanceAndOtherTaxableIncome: 0,
    taxExemptOrFinalWhtIncome: 0,
    payeAlreadyRemitted: 0,
    whtCreditNotes: 0,
  },
  deductions: {
    pensionContribution: 300_000,
    nhfContribution: 0,
    nhisContribution: 0,
    lifeAssurancePremium: 0,
    annualRentPaid: 0,
    isHomeowner: true,
    hasRentReceipts: false,
  },
  businessFinancials: bizFinancials,
});
assert.equal(bizPit.businessNetProfit, 5_800_000);
assert.equal(bizPit.otherTaxableIncomeTotal, 500_000);
assert.equal(bizPit.totalAssessableIncome, 6_300_000);
assert.equal(bizPit.chargeableIncome, 6_000_000);

console.log('ALL PIT ENGINE & FOUR-STATE JURISDICTION TESTS PASSED');
