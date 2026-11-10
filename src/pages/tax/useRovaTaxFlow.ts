const sumRecord = (rec: Record<string, number>) => Object.values(rec).reduce((sum, val) => sum + (val || 0), 0);

import { useState, useMemo, useCallback } from 'react';
import type { RovaTaxState, AssetCategory } from '../../types/rovaTaxFlow';

const ASSET_RATES: Record<AssetCategory, { salvagePct: number; usefulLife: number | null; initialPct: number; annualPct: number }> = {
  'Building Industrial': { salvagePct: 10, usefulLife: 25, initialPct: 0.15, annualPct: 0.10 },
  'Building Non-Industrial': { salvagePct: 10, usefulLife: 25, initialPct: 0.15, annualPct: 0.10 },
  'Plants (excluding Furniture & Fittings)': { salvagePct: 10, usefulLife: 10, initialPct: 0.50, annualPct: 0.25 },
  'Agricultural Plants Expenditure': { salvagePct: 10, usefulLife: 10, initialPct: 0.50, annualPct: 0.25 },
  'Furniture & Fittings Expenditure': { salvagePct: 5, usefulLife: 5, initialPct: 0.25, annualPct: 0.20 },
  'Public Transport Motor Vehicles': { salvagePct: 20, usefulLife: 5, initialPct: 0.50, annualPct: 0.25 },
  'Motor Vehicles Expenditure': { salvagePct: 20, usefulLife: 5, initialPct: 0.50, annualPct: 0.25 },
  'Plantation Equipment': { salvagePct: 10, usefulLife: 10, initialPct: 0.50, annualPct: 0.25 },
  'Construction Plants Expenditure': { salvagePct: 10, usefulLife: 10, initialPct: 0.50, annualPct: 0.25 },
  'Research & Development Expenditure': { salvagePct: 0, usefulLife: 3, initialPct: 0.50, annualPct: 0.25 },
  'Housing Estate Expenditure': { salvagePct: 10, usefulLife: 25, initialPct: 0.15, annualPct: 0.10 },
  'Land': { salvagePct: 0, usefulLife: null, initialPct: 0, annualPct: 0 },
  'Ranching & Plantation': { salvagePct: 10, usefulLife: 10, initialPct: 0.50, annualPct: 0.25 },
  'Software': { salvagePct: 0, usefulLife: 3, initialPct: 0.50, annualPct: 0.25 },
  'Others': { salvagePct: 5, usefulLife: 5, initialPct: 0.50, annualPct: 0.25 },
};

export const INITIAL_ROVA_TAX_STATE: RovaTaxState = {
  hasNewFixedAssets: null,
  assets: [],
  hasFixedAssets: null,
  mneCfc: { isMNE: false, isCFC: false },
  yearOfAssessment: String(new Date().getFullYear()),
  sector: '',
  sectors: [],
  sectorRevenues: {},
  revenue: null,
  costOfSales: {
    openingInventory: {},
    purchases: {},
    otherDirectCost: {},
    factoryOverheads: {},
    closingInventory: {},
  },
  sfp: {
    propertiesPlantsEquipment: null,
    investments: {},
    intangibleAssets: {},
    otherNonCurrentAssets: {},
    inventories: null,
    tradeReceivables: null,
    otherCurrentAssets: {},
    cashAndEquivalents: {},
    otherCurrentLiabilities: {},
    nonCurrentLiabilities: {},
    otherReserves: {},
    tradePayablesAndCurrentTax: {},
    equity: {},
  },
  profitAdjustment: {
    hasAddbacks: null,
    addbacks: {},
    hasDeductions: null,
    deductions: {},
  },
  otherIncome: {},
  adminExpense: {},
  nta2025: {
    professionalServicesFlag: false,
    grossFixedAssets: 0,
    whtCreditsUtilized: 0,
    advanceCitPaid: 0,
    openingUnutilizedCa: 0,
    openingUnrelievedLosses: 0,
    financeIncome: 0,
    financeCosts: 0,
    syncedFromFinancialStatements: false,
  },
};

export function useRovaTaxFlow(initialState?: Partial<RovaTaxState>) {
  const [state, setState] = useState<RovaTaxState>({
    ...INITIAL_ROVA_TAX_STATE,
    ...initialState,
  });

  const computed = useMemo(() => {
    // 1. Capital Allowance (Initial + Annual per NTA 2025 / CITA Second Schedule)
    let totalCapitalAllowance = 0;
    const assetCalcs = state.assets.map((asset) => {
      if (!asset.category || !asset.cost) {
        return { ...asset, salvageValue: 0, annualDepreciation: 0, initialAllowance: 0, annualAllowance: 0 };
      }
      const rates = ASSET_RATES[asset.category];
      if (!rates || rates.usefulLife === null) {
        return { ...asset, salvageValue: 0, annualDepreciation: 0, initialAllowance: 0, annualAllowance: 0 };
      }
      const salvageValue = asset.cost * (rates.salvagePct / 100);
      const initRate = asset.initialAllowanceRate ?? rates.initialPct;
      const annRate = asset.annualAllowanceRate ?? rates.annualPct;
      const initialAllowance = asset.cost * initRate;
      const annualAllowance = Math.max(0, asset.cost - initialAllowance) * annRate;
      const totalAssetCa = initialAllowance + annualAllowance;
      const annualDepreciation = (asset.cost - salvageValue) / rates.usefulLife;
      totalCapitalAllowance += totalAssetCa;
      return {
        ...asset,
        salvageValue,
        annualDepreciation,
        initialAllowance,
        annualAllowance,
        totalAssetCa,
      };
    });

    // 2. Cost of Sales & P&L
    const openingInventory = sumRecord(state.costOfSales.openingInventory);

    const findPurchKey = (needle: string) => {
      const entry = Object.entries(state.costOfSales.purchases).find(
        ([k]) => k.trim().toLowerCase() === needle.trim().toLowerCase()
      );
      return entry ? entry[1] || 0 : 0;
    };
    const localPurchases = findPurchKey('Local Purchases');
    const importPurchases = findPurchKey('Import Purchases');
    const returnOutwards =
      findPurchKey('Return Outwards') || findPurchKey('Returns Outwards') || findPurchKey('Purchase returns (if any)');
    const otherPurchases = Object.entries(state.costOfSales.purchases)
      .filter(([k]) => {
        const cleanK = k.trim().toLowerCase();
        return !cleanK.includes('local') && !cleanK.includes('import') && !cleanK.includes('return');
      })
      .reduce((s, [, v]) => s + (v || 0), 0);
    const purchases = localPurchases + importPurchases - returnOutwards + otherPurchases;

    const otherDirectCost = sumRecord(state.costOfSales.otherDirectCost);
    const factoryOverheads = sumRecord(state.costOfSales.factoryOverheads);
    const closingInventory = sumRecord(state.costOfSales.closingInventory);

    const directCost = openingInventory + purchases + otherDirectCost + factoryOverheads - closingInventory;

    const totalSectorRev = state.sectorRevenues
      ? Object.values(state.sectorRevenues).reduce((s, v) => s + (v || 0), 0)
      : 0;
    const revenue = totalSectorRev > 0 ? totalSectorRev : state.revenue || 0;

    const grossProfit = revenue - directCost;

    const otherIncomeTotal = sumRecord(state.otherIncome);
    const adminExpensesTotal = sumRecord(state.adminExpense);
    const operatingIncome = grossProfit + otherIncomeTotal - adminExpensesTotal;
    const financeIncome = state.nta2025?.financeIncome || 0;
    const financeCost = state.nta2025?.financeCosts || 0;
    const opbt = operatingIncome + financeIncome - financeCost;

    const addbacksTotal = sumRecord(state.profitAdjustment.addbacks);
    const deductionsTotal = sumRecord(state.profitAdjustment.deductions);
    const assessableProfit = opbt + addbacksTotal - deductionsTotal;

    // 3. NTA 2025 & NTAA 2025 Taxation Logic
    const grossFixedAssets = Math.max(
      state.nta2025?.grossFixedAssets || 0,
      state.sfp.propertiesPlantsEquipment || 0,
      state.assets.reduce((s, a) => s + (a.cost || 0), 0)
    );
    const isConsultancy =
      Boolean(state.nta2025?.professionalServicesFlag) ||
      (state.sectors || [state.sector]).includes('PROFESSIONAL SCIENTIFIC AND TECHNICAL ACTIVITIES');

    const qualifiesSmallCompanyExemption =
      !isConsultancy && revenue <= 100_000_000 && grossFixedAssets <= 250_000_000;

    const positiveAssessable = Math.max(0, assessableProfit);
    const lossesUsed = Math.min(positiveAssessable, state.nta2025?.openingUnrelievedLosses || 0);
    const profitAfterLosses = Math.max(0, positiveAssessable - lossesUsed);

    const totalAvailableCa = totalCapitalAllowance + (state.nta2025?.openingUnutilizedCa || 0);
    const caRestrictionCap = profitAfterLosses * 0.6667;
    const capitalAllowanceClaimed = Math.min(totalAvailableCa, caRestrictionCap);

    const taxableProfit = Math.max(0, profitAfterLosses - capitalAllowanceClaimed);

    const citRate = qualifiesSmallCompanyExemption ? 0 : 0.275;
    const devLevyRate = qualifiesSmallCompanyExemption ? 0 : 0.04;

    const citCharged = taxableProfit * citRate;
    const developmentLevy = positiveAssessable * devLevyRate;
    const totalTaxLiability = citCharged + developmentLevy;

    const whtCreditsUtilized = Math.min(totalTaxLiability, state.nta2025?.whtCreditsUtilized || 0);
    const advanceCitPaid = state.nta2025?.advanceCitPaid || 0;
    const netTaxPayable = Math.max(0, totalTaxLiability - whtCreditsUtilized - advanceCitPaid);
    const taxation = totalTaxLiability;

    const profitAfterTax = opbt - taxation;
    const oci = 0;
    const profitForYear = profitAfterTax + oci;

    return {
      assetCalcs,
      totalCapitalAllowance,
      capitalAllowanceClaimed,
      caRestrictionCap,
      openingInventory,
      purchases,
      otherDirectCost,
      factoryOverheads,
      closingInventory,
      directCost,
      revenue,
      grossProfit,
      otherIncomeTotal,
      adminExpensesTotal,
      operatingIncome,
      financeCost,
      opbt,
      addbacksTotal,
      deductionsTotal,
      assessableProfit,
      taxableProfit,
      qualifiesSmallCompanyExemption,
      citRate,
      citCharged,
      devLevyRate,
      developmentLevy,
      totalTaxLiability,
      whtCreditsUtilized,
      advanceCitPaid,
      netTaxPayable,
      taxation,
      profitAfterTax,
      oci,
      profitForYear,
    };
  }, [state]);

  const updateState = useCallback((updater: (prev: RovaTaxState) => RovaTaxState) => {
    setState(updater);
  }, []);

  const hydrateState = useCallback((next: RovaTaxState) => {
    setState(next);
  }, []);

  const exportForFiling = () => {
    const filterRecord = (rec: Record<string, number>) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(rec)) {
        if (v) out[k] = String(v);
      }
      return out;
    };

    const activeSectors =
      state.sectors && state.sectors.length > 0 ? state.sectors : state.sector ? [state.sector] : [];

    return {
      year: state.yearOfAssessment,
      sector: activeSectors.join(', '),
      sectors: activeSectors,
      sector_revenues: filterRecord(state.sectorRevenues || {}),
      revenue: String(computed.revenue || state.revenue || 0),
      mne: state.mneCfc.isMNE ? 'Yes' : 'No',
      cfc: state.mneCfc.isCFC ? 'Yes' : 'No',
      has_new_fixed_assets: state.hasNewFixedAssets ? 'Yes' : 'No',
      assets: state.assets
        .filter((a) => a.category && a.cost)
        .map((a, i) => ({
          category: a.category,
          description: a.description,
          cost: String(a.cost),
          date_first_used: a.dateFirstUsed,
          salvage_value: String(computed.assetCalcs[i]?.salvageValue || 0),
          annual_depreciation: String(computed.assetCalcs[i]?.annualDepreciation || 0),
        })),
      cos: {
        opening_inventory: filterRecord(state.costOfSales.openingInventory),
        purchases: filterRecord(state.costOfSales.purchases),
        other_direct_cost: filterRecord(state.costOfSales.otherDirectCost),
        factory_overheads: filterRecord(state.costOfSales.factoryOverheads),
        closing_inventory: filterRecord(state.costOfSales.closingInventory),
      },
      sfp: {
        properties_plant_equipment: state.sfp.propertiesPlantsEquipment
          ? String(state.sfp.propertiesPlantsEquipment)
          : '0',
        investments: filterRecord(state.sfp.investments),
        intangible_assets: filterRecord(state.sfp.intangibleAssets),
        other_non_current_assets: filterRecord(state.sfp.otherNonCurrentAssets),
        inventories:
          state.sfp.inventories !== null
            ? String(state.sfp.inventories)
            : sumRecord(state.costOfSales.closingInventory)
              ? String(sumRecord(state.costOfSales.closingInventory))
              : '0',
        trade_receivables: state.sfp.tradeReceivables !== null ? String(state.sfp.tradeReceivables) : '0',
        other_current_assets: filterRecord(state.sfp.otherCurrentAssets),
        cash_and_cash_equivalents: filterRecord(state.sfp.cashAndEquivalents),
        other_current_liabilities: filterRecord(state.sfp.otherCurrentLiabilities),
        non_current_liabilities: filterRecord(state.sfp.nonCurrentLiabilities),
        other_reserves: filterRecord(state.sfp.otherReserves),
        current_liabilities: filterRecord(state.sfp.tradePayablesAndCurrentTax),
        equity: filterRecord(state.sfp.equity),
      },
      other_income: filterRecord(state.otherIncome),
      admin: filterRecord(state.adminExpense),
      addbacks: filterRecord(state.profitAdjustment.addbacks),
      deductions: filterRecord(state.profitAdjustment.deductions),
      computed: {
        total_capital_allowance: String(computed.totalCapitalAllowance),
        capital_allowance_claimed: String(computed.capitalAllowanceClaimed),
        direct_cost: String(computed.directCost),
        gross_profit: String(computed.grossProfit),
        admin_expenses: String(computed.adminExpensesTotal),
        operating_income: String(computed.operatingIncome),
        opbt: String(computed.opbt),
        assessable_profit: String(computed.assessableProfit),
        taxable_profit: String(computed.taxableProfit),
        cit_rate: String(computed.citRate),
        cit_charged: String(computed.citCharged),
        development_levy: String(computed.developmentLevy),
        wht_credits_utilized: String(computed.whtCreditsUtilized),
        net_tax_payable: String(computed.netTaxPayable),
        taxation: String(computed.taxation),
        profit_after_tax: String(computed.profitAfterTax),
        profit_for_year: String(computed.profitForYear),
      },
    };
  };

  return {
    state,
    computed,
    updateState,
    hydrateState,
    exportForFiling,
  };
}
