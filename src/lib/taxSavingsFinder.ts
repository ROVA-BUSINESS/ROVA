import { NTA2025_TAX_SAVINGS_CONFIG } from '../config/nta2025TaxSavingsConfig';
import type { FinancialStatementModel, IntakeAccountingEntry } from './financialStatementEngine';
import type { Employee, FixedAssetRecord, Invoice, Transaction, WhtCreditNoteRecord } from './supabase';

export type OpportunityStatus = 'eligible' | 'probably_eligible' | 'needs_confirmation';

export type TaxSavingOpportunity = {
  id: string;
  category:
    | 'exemption'
    | 'deduction'
    | 'incentive'
    | 'capital_allowance'
    | 'loss_relief'
    | 'vat_recovery'
    | 'wht_credit';
  title: string;
  status: OpportunityStatus;
  triggerInData: string;
  triggeredAmount: number;
  estimatedSaving: number;
  assumptions: string[];
  questionToAsk: string;
  evidenceRequired: string;
  contestedNote?: string;
  /** Optional deduction/credit amount that can be applied once confirmed */
  applicableDeductionAmount?: number;
};

export type DisallowedItemAlert = {
  id: string;
  title: string;
  reason: string;
  amount: number;
  sampleDescriptions: string[];
};

export type TaxSavingsReport = {
  opportunities: TaxSavingOpportunity[];
  disallowedAlerts: DisallowedItemAlert[];
  totalEstimatedTaxSavings: number;
  totalPotentialDeductions: number;
  isSmallCompanyEligible: boolean;
  disclaimer: string;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function runTaxSavingsFinder(params: {
  transactions?: Transaction[];
  intakeEntries?: IntakeAccountingEntry[];
  invoices?: Invoice[];
  employees?: Employee[];
  fixedAssets?: FixedAssetRecord[];
  whtCreditNotes?: WhtCreditNoteRecord[];
  fsModel?: FinancialStatementModel | null;
  sector?: string;
  turnover?: number;
  grossFixedAssets?: number;
  pbt?: number;
  professionalServicesFlag?: boolean;
}): TaxSavingsReport {
  const cfg = NTA2025_TAX_SAVINGS_CONFIG;
  const {
    transactions = [],
    intakeEntries = [],
    invoices = [],
    employees = [],
    fixedAssets = [],
    fsModel = null,
  } = params;

  const turnover = params.turnover ?? fsModel?.incomeStatement.revenue ?? 0;
  const grossPpe = params.grossFixedAssets ?? fsModel?.taxComputation.grossFixedAssets ?? 0;
  const pbt = params.pbt ?? fsModel?.incomeStatement.profitBeforeTax ?? 0;
  const sector = (params.sector ?? fsModel?.profile.sector ?? '').toUpperCase();
  const profFlag =
    params.professionalServicesFlag ??
    fsModel?.profile.professional_services_flag ??
    sector.includes('PROFESSIONAL');

  // Combine real expense/income descriptions from transactions + intakeEntries
  const allRecords = [
    ...transactions.map((t) => ({
      id: t.id,
      date: t.date,
      desc: `${t.description || ''} ${t.category?.name || ''} ${t.ai_category || ''}`.trim(),
      amount: Math.abs(Number(t.amount) || 0),
      type: t.type,
    })),
    ...intakeEntries.map((e) => ({
      id: e.id,
      date: e.date,
      desc: `${e.description || ''} ${e.nrsLabel || ''}`.trim(),
      amount: Math.abs(Number(e.amount) || 0),
      type: e.direction,
    })),
  ];

  const matchRecords = (regex: RegExp, typeFilter?: 'income' | 'expense') =>
    allRecords.filter((r) => (!typeFilter || r.type === typeFilter) && regex.test(r.desc));

  const opportunities: TaxSavingOpportunity[] = [];
  const disallowedAlerts: DisallowedItemAlert[] = [];

  // ── 1. Exemptions depending on company status ──────────────────────────────
  const isWithinSmallTurnover = turnover <= cfg.smallCompany.turnoverLimit;
  const isWithinSmallAssets = grossPpe <= cfg.smallCompany.fixedAssetLimit;
  const isSmallCompanyEligible = !profFlag && isWithinSmallTurnover && isWithinSmallAssets;
  const effectiveCorporateTaxRate = isSmallCompanyEligible ? 0 : cfg.standardRates.combinedCorporateRate;
  const savingRateIfNonSmall = cfg.standardRates.combinedCorporateRate;

  const isContestedTurnoverBand =
    !profFlag && turnover > cfg.smallCompany.contestedSecondaryTurnoverLimit && turnover <= cfg.smallCompany.turnoverLimit;

  if (!profFlag && (isSmallCompanyEligible || turnover <= cfg.smallCompany.turnoverLimit * 1.15)) {
    const estStandardTaxOnPositivePbt = Math.max(0, pbt) * cfg.standardRates.combinedCorporateRate;
    opportunities.push({
      id: 'opp_small_company',
      category: 'exemption',
      title: 'Small Company Exemption (0% CIT, CGT & 4% Development Levy)',
      status: isSmallCompanyEligible ? (isContestedTurnoverBand ? 'needs_confirmation' : 'eligible') : 'needs_confirmation',
      triggerInData: `Recorded Turnover ₦${turnover.toLocaleString()} and Gross Fixed Assets ₦${grossPpe.toLocaleString()}.`,
      triggeredAmount: turnover,
      estimatedSaving: isSmallCompanyEligible ? round2(estStandardTaxOnPositivePbt) : 0,
      assumptions: [
        `Turnover ≤ ₦${(cfg.smallCompany.turnoverLimit / 1_000_000).toFixed(0)}M and Gross Fixed Assets ≤ ₦${(cfg.smallCompany.fixedAssetLimit / 1_000_000).toFixed(0)}M.`,
        'Entity is not providing excluded professional/technical services.',
      ],
      questionToAsk: 'Is the company in professional services, and have your final fixed asset values been confirmed?',
      evidenceRequired: 'Prepared Financial Statements & Fixed Asset Schedule',
      contestedNote: isContestedTurnoverBand
        ? 'Contested item: One secondary law-firm overview cites a ₦50M turnover limit instead of ₦100M. Confirm against the final gazetted Act / NRS guidance.'
        : undefined,
    });
  }

  // VAT & WHT Small Company Relief
  if (isSmallCompanyEligible) {
    opportunities.push({
      id: 'opp_vat_wht_relief',
      category: 'exemption',
      title: 'Small Business VAT Filing & WHT Deduction Relief',
      status: 'probably_eligible',
      triggerInData: `Turnover (₦${turnover.toLocaleString()}) ≤ ₦100M and Fixed Assets (₦${grossPpe.toLocaleString()}) < ₦250M.`,
      triggeredAmount: turnover,
      estimatedSaving: 0,
      assumptions: [
        'Small businesses ≤ ₦100M turnover are exempt from monthly VAT filing.',
        `WHT deduction can be skipped on suppliers with valid TIN whose monthly payments total ≤ ₦${(cfg.smallCompany.whtReliefMonthlySupplierLimit / 1_000_000).toFixed(0)}M.`,
      ],
      questionToAsk: 'Do your suppliers have valid TINs and stay under ₦2M/month per supplier?',
      evidenceRequired: 'Supplier TIN records & monthly payment schedule',
    });
  }

  // Agriculture 5-year tax holiday / Labelled Start-Up
  if (sector.includes('AGRICULTURE')) {
    opportunities.push({
      id: 'opp_agri_holiday',
      category: 'exemption',
      title: 'Agricultural Business 5-Year Tax Holiday',
      status: 'needs_confirmation',
      triggerInData: `Business sector is registered as ${sector}.`,
      triggeredAmount: Math.max(0, pbt),
      estimatedSaving: round2(Math.max(0, pbt) * savingRateIfNonSmall),
      assumptions: ['Primary agricultural production business qualifies for the statutory 5-year tax holiday under NTA 2025.'],
      questionToAsk: 'Is your business engaged in primary agricultural production within its first 5 years?',
      evidenceRequired: 'CAC incorporation docs & agricultural business registration',
    });
  } else if (sector.includes('COMMUNICATION') || sector.includes('DIGITAL')) {
    opportunities.push({
      id: 'opp_labelled_startup',
      category: 'exemption',
      title: 'Labelled Start-Up Corporate Tax Exemption',
      status: 'needs_confirmation',
      triggerInData: `Tech / Digital sector detected (${sector}).`,
      triggeredAmount: Math.max(0, pbt),
      estimatedSaving: round2(Math.max(0, pbt) * savingRateIfNonSmall),
      assumptions: ['Company holds an official Nigeria Startup Act label during its exempt period.'],
      questionToAsk: 'Does the company hold an active NITDA Startup Label certificate?',
      evidenceRequired: 'NITDA Startup Label Certificate',
    });
  }

  // ── 2. Deductions triggered in real transactions ───────────────────────────
  // Staff Pension
  const pensionTxs = matchRecords(/\b(pension|pencom|rsa|retirement)\b/i, 'expense');
  const payrollPensionAmt = employees.reduce(
    (s, e) => s + ((Number(e.gross_salary) || 0) * ((Number(e.pension_rate) || 0) / 100) * 12),
    0
  );
  const pensionTotal = round2(pensionTxs.reduce((s, r) => s + r.amount, 0) || payrollPensionAmt);
  if (pensionTotal > 0) {
    opportunities.push({
      id: 'opp_staff_pension',
      category: 'deduction',
      title: 'Approved Staff Pension Contributions',
      status: 'probably_eligible',
      triggerInData: pensionTxs.length > 0
        ? `Found ${pensionTxs.length} pension transaction(s) totaling ₦${pensionTotal.toLocaleString()}.`
        : `Computed ₦${pensionTotal.toLocaleString()} annual pension from active employee payroll records.`,
      triggeredAmount: pensionTotal,
      estimatedSaving: round2(pensionTotal * effectiveCorporateTaxRate),
      assumptions: ['Contributions are remitted to a Pension Reform Act (PRA) approved PFA scheme.'],
      questionToAsk: 'Is the pension scheme approved under the Pension Reform Act?',
      evidenceRequired: 'Pension remittance schedules & PFA receipts',
      applicableDeductionAmount: pensionTotal,
    });
  }

  // Business Rent & Staff Costs
  const rentTxs = matchRecords(/\b(rent|lease|premises)\b/i, 'expense');
  const rentTotal = round2(rentTxs.reduce((s, r) => s + r.amount, 0));
  if (rentTotal > 0) {
    opportunities.push({
      id: 'opp_business_rent',
      category: 'deduction',
      title: 'Business Premises Rent Deduction',
      status: 'eligible',
      triggerInData: `Found ${rentTxs.length} rent/premises payment(s) totaling ₦${rentTotal.toLocaleString()}.`,
      triggeredAmount: rentTotal,
      estimatedSaving: round2(rentTotal * effectiveCorporateTaxRate),
      assumptions: ['Premises are used wholly and exclusively to produce business income.'],
      questionToAsk: 'Is this rent strictly for business premises (not private residence)?',
      evidenceRequired: 'Tenancy agreement & landlord rent receipts',
      applicableDeductionAmount: rentTotal,
    });
  }

  // Bad & Doubtful Debts
  const now = Date.now();
  const overdueInvoices = invoices.filter((inv) => {
    if (inv.status === 'paid' || inv.status === 'cancelled') return false;
    const due = new Date(inv.due_date).getTime();
    return (now - due) / (1000 * 60 * 60 * 24) > 90;
  });
  const badDebtTxs = matchRecords(/\b(bad debt|ecl|impairment|written off)\b/i, 'expense');
  const overdueTotal = round2(
    overdueInvoices.reduce((s, inv) => s + Math.max(0, (Number(inv.total) || 0) - (Number(inv.amount_paid) || 0)), 0) +
      badDebtTxs.reduce((s, r) => s + r.amount, 0)
  );
  if (overdueTotal > 0) {
    opportunities.push({
      id: 'opp_bad_debt',
      category: 'deduction',
      title: 'Bad & Doubtful Debt Deduction',
      status: 'needs_confirmation',
      triggerInData: `Found ${overdueInvoices.length} invoice(s) overdue > 90 days and ${badDebtTxs.length} bad-debt entry(ies) totaling ₦${overdueTotal.toLocaleString()}.`,
      triggeredAmount: overdueTotal,
      estimatedSaving: round2(overdueTotal * effectiveCorporateTaxRate),
      assumptions: [
        'Debt is estimated under IFRS/GAAP and proven unrecoverable to NRS.',
        'Related-party bad debts are excluded.',
      ],
      questionToAsk: 'Has the debt been formally written off, and is the customer an unrelated third party?',
      evidenceRequired: 'Collection attempts, demand notices & board write-off note',
      applicableDeductionAmount: overdueTotal,
    });
  }

  // Research & Development (capped at 5% of turnover)
  const rndTxs = matchRecords(/\b(r&d|research|development|lab|prototype|software dev|engineering)\b/i, 'expense');
  const rndRaw = round2(rndTxs.reduce((s, r) => s + r.amount, 0));
  if (rndRaw > 0) {
    const rndCap = turnover > 0 ? round2(turnover * cfg.deductionCaps.rndTurnoverCapPct) : rndRaw;
    const rndAllowed = Math.min(rndRaw, rndCap);
    opportunities.push({
      id: 'opp_rnd',
      category: 'deduction',
      title: 'Research & Development (R&D) Deduction (Capped at 5% of Turnover)',
      status: 'needs_confirmation',
      triggerInData: `Found ${rndTxs.length} R&D / developer / lab cost(s) totaling ₦${rndRaw.toLocaleString()}.`,
      triggeredAmount: rndAllowed,
      estimatedSaving: round2(rndAllowed * effectiveCorporateTaxRate),
      assumptions: [`Deductible up to 5% of annual turnover (cap: ₦${rndCap.toLocaleString()}).`],
      questionToAsk: 'Do these costs represent qualifying Research & Development activities?',
      evidenceRequired: 'R&D project records, timesheets & invoices',
      applicableDeductionAmount: rndAllowed,
    });
  }

  // Donations (capped at 10% of PBT)
  const donationTxs = matchRecords(/\b(donation|charity|ngo|foundation|csr)\b/i, 'expense');
  const donationRaw = round2(donationTxs.reduce((s, r) => s + r.amount, 0));
  if (donationRaw > 0) {
    const donationCap = pbt > 0 ? round2(pbt * cfg.deductionCaps.donationsPbtCapPct) : 0;
    const donationAllowed = Math.min(donationRaw, donationCap);
    opportunities.push({
      id: 'opp_donations',
      category: 'deduction',
      title: 'Qualifying Donations Deduction (Capped at 10% of PBT)',
      status: 'needs_confirmation',
      triggerInData: `Found ${donationTxs.length} donation/charity payment(s) totaling ₦${donationRaw.toLocaleString()}.`,
      triggeredAmount: donationAllowed,
      estimatedSaving: round2(donationAllowed * effectiveCorporateTaxRate),
      assumptions: [`Deductible (including capital-nature donations) up to 10% of PBT (cap: ₦${donationCap.toLocaleString()}).`],
      questionToAsk: 'Is the recipient an approved charitable/public body under the Act?',
      evidenceRequired: 'Official charity donation receipt & recipient registration details',
      applicableDeductionAmount: donationAllowed,
    });
  }

  // ── 3. Extra 50% Hiring & Pay Incentives ───────────────────────────────────
  const lowEarners = employees.filter(
    (e) => e.status === 'active' && Number(e.gross_salary) > 0 && Number(e.gross_salary) <= cfg.deductionCaps.lowEarnerMonthlyGrossThreshold
  );
  if (lowEarners.length > 0) {
    const annualLowEarnerPayroll = round2(lowEarners.reduce((s, e) => s + Number(e.gross_salary) * 12, 0));
    const potentialExtra50 = round2(annualLowEarnerPayroll * cfg.deductionCaps.payAndHiringIncentiveExtraPct);
    opportunities.push({
      id: 'opp_pay_hiring_incentive',
      category: 'incentive',
      title: '50% Extra Deduction on Low-Earner Pay Increases / Net-New Hires',
      status: 'needs_confirmation',
      triggerInData: `Found ${lowEarners.length} active employee(s) earning ≤ ₦100,000/month (annual gross: ₦${annualLowEarnerPayroll.toLocaleString()}).`,
      triggeredAmount: potentialExtra50,
      estimatedSaving: round2(potentialExtra50 * effectiveCorporateTaxRate),
      assumptions: [
        'Applies only to qualifying wage increases / transport subsidies for staff earning ≤ ₦100,000/month, or net-new hires retained ≥ 3 years.',
      ],
      questionToAsk: 'Were these qualifying wage raises, transport subsidies, or net-new hires retained for ≥ 3 years?',
      evidenceRequired: 'Employment contracts, payroll history & transport allowance records',
      contestedNote: 'Contested item: Exact statutory conditions for the 50% pay/hiring incentive differ across summaries — confirm against the Act before enabling.',
    });
  }

  // ── 4. Capital Allowances & Loss Carry-Forward ─────────────────────────────
  const ppePurchases = matchRecords(/\b(laptop|computer|vehicle|truck|machinery|generator|furniture|equipment|server)\b/i, 'expense');
  const modelAssetCount = fsModel?.fixedAssets.register.length ?? 0;
  const totalFixedAssetCost = round2(
    fixedAssets.reduce((s, a) => s + (Number(a.historical_cost) || 0), 0) ||
      (fsModel?.fixedAssets.totals.grossCost ?? 0) ||
      ppePurchases.reduce((s, r) => s + r.amount, 0)
  );
  if (totalFixedAssetCost > 0) {
    const estStraightLineCa = round2(
      fixedAssets.length > 0
        ? fixedAssets.reduce((s, a) => {
            const rate = cfg.capitalAllowance.annualRatesByClass[a.asset_class] ?? 0.20;
            const maxClaimable = a.historical_cost * (1 - cfg.capitalAllowance.residualRetentionPct);
            return s + Math.min(maxClaimable, a.historical_cost * rate);
          }, 0)
        : (fsModel?.fixedAssets.register.reduce((s, a) => {
            const rate = cfg.capitalAllowance.annualRatesByClass[a.assetClass] ?? 0.20;
            const maxClaimable = a.historicalCost * (1 - cfg.capitalAllowance.residualRetentionPct);
            return s + Math.min(maxClaimable, a.historicalCost * rate);
          }, 0) || totalFixedAssetCost * 0.20)
    );
    opportunities.push({
      id: 'opp_capital_allowance',
      category: 'capital_allowance',
      title: 'Capital Allowances (Straight-Line, 1% Residual Retention)',
      status: fixedAssets.length > 0 || modelAssetCount > 0 ? 'probably_eligible' : 'needs_confirmation',
      triggerInData: fixedAssets.length > 0 || modelAssetCount > 0
        ? `${fixedAssets.length || modelAssetCount} asset(s) in Fixed Asset Register totaling ₦${totalFixedAssetCost.toLocaleString()}.`
        : `Detected ${ppePurchases.length} potential equipment purchase(s) totaling ₦${totalFixedAssetCost.toLocaleString()}.`,
      triggeredAmount: estStraightLineCa,
      estimatedSaving: round2(estStraightLineCa * effectiveCorporateTaxRate),
      assumptions: [
        'NTA 2025 removes initial allowance and applies straight-line annual rates (10% / 20% / 25%) retaining 1% cost until disposal.',
      ],
      questionToAsk: 'Have all equipment purchases been assigned to the right statutory asset class?',
      evidenceRequired: 'Purchase invoices & Fixed Asset Register',
      contestedNote: 'Contested item: Verify exact annual capital allowance rate (10%/20%/25%) per asset class against NRS guidance.',
    });
  }

  if (pbt < 0) {
    const absLoss = round2(Math.abs(pbt));
    opportunities.push({
      id: 'opp_loss_carryforward',
      category: 'loss_relief',
      title: 'Operating Loss Carry-Forward (Indefinite)',
      status: 'probably_eligible',
      triggerInData: `Current period P&L shows an operating loss of ₦${absLoss.toLocaleString()}.`,
      triggeredAmount: absLoss,
      estimatedSaving: round2(absLoss * cfg.standardRates.combinedCorporateRate),
      assumptions: ['Operating losses under NTA 2025 carry forward indefinitely against future profits (no carry-back).'],
      questionToAsk: 'Are there any prior-year unrelieved tax losses from previous NRS assessments?',
      evidenceRequired: 'Prior-year tax computations & NRS assessment notices',
    });
  }

  // ── 5. Input VAT Recovery & WHT Credits ────────────────────────────────────
  const vatInputTxs = matchRecords(/\b(vat|value added tax|input vat)\b/i, 'expense');
  const vatInputAmt = round2(vatInputTxs.reduce((s, r) => s + r.amount * (cfg.standardRates.vatRate / (1 + cfg.standardRates.vatRate)), 0));
  if (vatInputAmt > 0 && !isSmallCompanyEligible) {
    opportunities.push({
      id: 'opp_input_vat',
      category: 'vat_recovery',
      title: 'Input VAT Recovery on Services & Fixed Assets (5-Year Window)',
      status: 'needs_confirmation',
      triggerInData: `Found ${vatInputTxs.length} VAT-bearing purchase(s) (estimated input VAT: ₦${vatInputAmt.toLocaleString()}).`,
      triggeredAmount: vatInputAmt,
      estimatedSaving: vatInputAmt,
      assumptions: ['Input VAT is claimable on services & fixed assets used to make taxable supplies within 5 years.'],
      questionToAsk: 'Do you have valid supplier tax invoices showing VAT charged?',
      evidenceRequired: 'Valid supplier VAT invoices',
    });
  }

  const whtNotesFromModel = params.whtCreditNotes?.length
    ? params.whtCreditNotes
    : (fsModel?.whtSchedule.rows ?? []);
  const whtDeductedTotal = round2(whtNotesFromModel.reduce((s, w) => s + (Number(w.wht_deducted) || 0), 0));
  const netWhtTxs = matchRecords(/\b(wht|withholding)\b/i, 'income');
  if (whtDeductedTotal > 0 || netWhtTxs.length > 0) {
    const amt = whtDeductedTotal || round2(netWhtTxs.reduce((s, r) => s + r.amount * 0.05, 0));
    opportunities.push({
      id: 'opp_wht_credit',
      category: 'wht_credit',
      title: 'Withholding Tax (WHT) Credit Note Offset',
      status: whtNotesFromModel.length > 0 ? 'eligible' : 'needs_confirmation',
      triggerInData: whtNotesFromModel.length > 0
        ? `${whtNotesFromModel.length} WHT credit note(s) on file totaling ₦${whtDeductedTotal.toLocaleString()}.`
        : `Detected ${netWhtTxs.length} receipt(s) referencing WHT deductions.`,
      triggeredAmount: amt,
      estimatedSaving: amt,
      assumptions: ['Verified NRS WHT credit notes offset CIT payable Naira-for-Naira.'],
      questionToAsk: 'Have all WHT credit notes been verified on the NRS portal?',
      evidenceRequired: 'NRS WHT Credit Notes',
    });
  }

  // ── 6. "Do Not Claim These" Guardrail Alerts ───────────────────────────────
  const penaltyTxs = matchRecords(/\b(fine|penalty|penalties|late fee|surcharge)\b/i, 'expense');
  if (penaltyTxs.length > 0) {
    disallowedAlerts.push({
      id: 'disallow_penalties',
      title: 'Penalties & Statutory Fines (Non-Deductible)',
      reason: 'Fines and penalties are strictly disallowed under NTA 2025 and must be added back to taxable profit.',
      amount: round2(penaltyTxs.reduce((s, r) => s + r.amount, 0)),
      sampleDescriptions: penaltyTxs.slice(0, 3).map((r) => r.desc),
    });
  }

  const privateTxs = matchRecords(/\b(personal|private|family|school fees|owner drawing|withdrawal)\b/i, 'expense');
  if (privateTxs.length > 0) {
    disallowedAlerts.push({
      id: 'disallow_private',
      title: 'Private Expenses & Owner Withdrawals (Non-Deductible)',
      reason: 'Private expenses and capital/owner drawings cannot be deducted against company income.',
      amount: round2(privateTxs.reduce((s, r) => s + r.amount, 0)),
      sampleDescriptions: privateTxs.slice(0, 3).map((r) => r.desc),
    });
  }

  const totalEstimatedTaxSavings = round2(opportunities.reduce((s, o) => s + o.estimatedSaving, 0));
  const totalPotentialDeductions = round2(
    opportunities
      .filter((o) => o.category === 'deduction' || o.category === 'incentive' || o.category === 'capital_allowance')
      .reduce((s, o) => s + o.triggeredAmount, 0)
  );

  return {
    opportunities,
    disallowedAlerts,
    totalEstimatedTaxSavings,
    totalPotentialDeductions,
    isSmallCompanyEligible,
    disclaimer: cfg.disclaimer,
  };
}
