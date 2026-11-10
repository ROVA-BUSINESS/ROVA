/**
 * Nigeria Tax Act 2025 (effective 1 January 2026) — Tax Savings Finder Config
 *
 * Thresholds, caps, and statutory rates are kept strictly in config (never hardcoded in AI prompts).
 * Contested items across secondary legal/accounting summaries are flagged for accountant confirmation.
 */

export const NTA2025_TAX_SAVINGS_CONFIG = {
  effectiveDate: '2026-01-01',
  legislation: 'Nigeria Tax Act 2025 (NTA 2025)',

  smallCompany: {
    turnoverLimit: 100_000_000,
    /** One law-firm overview cites ₦50M for turnover; flagged as contested when turnover is between ₦50M and ₦100M */
    contestedSecondaryTurnoverLimit: 50_000_000,
    fixedAssetLimit: 250_000_000,
    citRate: 0,
    devLevyRate: 0,
    cgtRate: 0,
    vatFilingExemptTurnoverLimit: 100_000_000,
    whtReliefMonthlySupplierLimit: 2_000_000,
  },

  standardRates: {
    citRate: 0.275,
    devLevyRate: 0.04,
    combinedCorporateRate: 0.315,
    nonSmallAssetDisposalTaxRate: 0.30,
    vatRate: 0.075,
  },

  deductionCaps: {
    rndTurnoverCapPct: 0.05,
    donationsPbtCapPct: 0.10,
    relatedPartyInterestEbitdaCapPct: 0.30,
    relatedPartyInterestCarryForwardYears: 5,
    preStartupLookbackYears: 6,
    payAndHiringIncentiveExtraPct: 0.50,
    lowEarnerMonthlyGrossThreshold: 100_000,
    netNewHireMinTenureYears: 3,
  },

  capitalAllowance: {
    straightLineBasis: true,
    initialAllowanceRemoved: true,
    residualRetentionPct: 0.01,
    annualRatesByClass: {
      'Leasehold Land & Buildings': 0.10,
      'Plant & Heavy Machinery': 0.20,
      'Commercial Motor Vehicles': 0.25,
      'Office Furniture & Equipment': 0.20,
      'Computer & IT Infrastructure': 0.25,
    } as Record<string, number>,
  },

  vatRecovery: {
    claimWindowYears: 5,
  },

  disclaimer:
    'Eligibility prompts only — not a guaranteed tax saving. Rova only flags items supported by your recorded transactions. Several reliefs depend on statutory conditions; review every item with a qualified accountant before filing with NRS.',
} as const;
