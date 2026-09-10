import { useState, useMemo } from 'react';
import type { RovaTaxState, AssetCategory } from '../../types/rovaTaxFlow';

const ASSET_RATES: Record<AssetCategory, { salvagePct: number; usefulLife: number | null }> = {
  'Building Industrial': { salvagePct: 10, usefulLife: 25 },
  'Building Non-Industrial': { salvagePct: 10, usefulLife: 25 },
  'Plants (excluding Furniture & Fittings)': { salvagePct: 10, usefulLife: 10 },
  'Agricultural Plants Expenditure': { salvagePct: 10, usefulLife: 10 },
  'Furniture & Fittings Expenditure': { salvagePct: 5, usefulLife: 5 },
  'Public Transport Motor Vehicles': { salvagePct: 20, usefulLife: 5 },
  'Motor Vehicles Expenditure': { salvagePct: 20, usefulLife: 5 },
  'Plantation Equipment': { salvagePct: 10, usefulLife: 10 },
  'Construction Plants Expenditure': { salvagePct: 10, usefulLife: 10 },
  'Research & Development Expenditure': { salvagePct: 0, usefulLife: 3 },
  'Housing Estate Expenditure': { salvagePct: 10, usefulLife: 25 },
  'Land': { salvagePct: 0, usefulLife: null },
  'Ranching & Plantation': { salvagePct: 10, usefulLife: 10 },
  'Software': { salvagePct: 0, usefulLife: 3 },
  'Others': { salvagePct: 5, usefulLife: 5 },
};

const INITIAL_STATE: RovaTaxState = {
  hasNewFixedAssets: null,
  assets: [],
  hasFixedAssets: null,
  mneCfc: { isMNE: null, isCFC: null },
  yearOfAssessment: '',
  sector: '',
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
  adminExpense: {},
};

export function useRovaTaxFlow() {
  const [state, setState] = useState<RovaTaxState>(INITIAL_STATE);

  // Computations
  const computed = useMemo(() => {
    // 1. Capital Allowance
    let totalCapitalAllowance = 0;
    const assetCalcs = state.assets.map(asset => {
      if (!asset.category || !asset.cost) {
        return { ...asset, salvageValue: 0, annualDepreciation: 0 };
      }
      const rates = ASSET_RATES[asset.category];
      if (!rates || rates.usefulLife === null) {
        return { ...asset, salvageValue: 0, annualDepreciation: 0 };
      }
      const salvageValue = asset.cost * (rates.salvagePct / 100);
      const annualDepreciation = (asset.cost - salvageValue) / rates.usefulLife;
      totalCapitalAllowance += annualDepreciation;
      return { ...asset, salvageValue, annualDepreciation };
    });

    // Helper to sum record values
    const sumRecord = (rec: Record<string, number>) => Object.values(rec).reduce((sum, val) => sum + (val || 0), 0);

    // 2. Cost of Sales & P&L
    const openingInventory = sumRecord(state.costOfSales.openingInventory);
    const purchases = sumRecord(state.costOfSales.purchases);
    const otherDirectCost = sumRecord(state.costOfSales.otherDirectCost);
    const factoryOverheads = sumRecord(state.costOfSales.factoryOverheads);
    const closingInventory = sumRecord(state.costOfSales.closingInventory);

    const directCost = openingInventory + purchases + otherDirectCost + factoryOverheads - closingInventory;
    const revenue = state.revenue || 0;
    const grossProfit = revenue - directCost;

    const adminExpensesTotal = sumRecord(state.adminExpense);
    const operatingIncome = grossProfit - adminExpensesTotal;
    const financeCost = 0;
    const opbt = operatingIncome - financeCost;

    const addbacksTotal = sumRecord(state.profitAdjustment.addbacks);
    const deductionsTotal = sumRecord(state.profitAdjustment.deductions);
    const taxableProfit = opbt + addbacksTotal - deductionsTotal;

    // Taxation logic
    let taxation = 0;
    const fixedAssets = state.sfp.propertiesPlantsEquipment || 0;
    
    // CIT Rate Determination
    // Small companies: turnover <= 100m AND fixed assets <= 250m => 0%
    // Large companies: 30% CIT + 4% Dev Levy
    // Consultancy (PROFESSIONAL SCIENTIFIC AND TECHNICAL ACTIVITIES): 30% CIT + 4% Dev Levy
    const isConsultancy = state.sector === 'PROFESSIONAL SCIENTIFIC AND TECHNICAL ACTIVITIES';
    const assessableProfit = Math.max(0, taxableProfit);

    if (isConsultancy) {
      taxation = assessableProfit * 0.30 + assessableProfit * 0.04;
    } else {
      if (revenue <= 100_000_000 && fixedAssets <= 250_000_000) {
        taxation = 0;
      } else {
        taxation = assessableProfit * 0.30 + assessableProfit * 0.04;
      }
    }

    const profitAfterTax = opbt - taxation;
    const oci = 0;
    const profitForYear = profitAfterTax + oci;

    return {
      assetCalcs,
      totalCapitalAllowance,
      openingInventory,
      purchases,
      otherDirectCost,
      factoryOverheads,
      closingInventory,
      directCost,
      revenue,
      grossProfit,
      adminExpensesTotal,
      operatingIncome,
      financeCost,
      opbt,
      addbacksTotal,
      deductionsTotal,
      taxableProfit,
      taxation,
      profitAfterTax,
      oci,
      profitForYear,
    };
  }, [state]);

  const updateState = (updater: (prev: RovaTaxState) => RovaTaxState) => {
    setState(updater);
  };

  /** Serialize wizard state + computed values into the JSON format the filing bot and Excel generator expect. */
  const exportForFiling = () => {
    // Filter only non-zero entries from a record
    const filterRecord = (rec: Record<string, number>) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(rec)) {
        if (v) out[k] = String(v);
      }
      return out;
    };

    return {
      year: state.yearOfAssessment,
      sector: state.sector,
      revenue: state.revenue ? String(state.revenue) : '0',
      mne: state.mneCfc.isMNE ? 'Yes' : 'No',
      cfc: state.mneCfc.isCFC ? 'Yes' : 'No',
      has_new_fixed_assets: state.hasNewFixedAssets ? 'Yes' : 'No',
      assets: state.assets
        .filter(a => a.category && a.cost)
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
        properties_plant_equipment: state.sfp.propertiesPlantsEquipment ? String(state.sfp.propertiesPlantsEquipment) : '0',
        investments: filterRecord(state.sfp.investments),
        intangible_assets: filterRecord(state.sfp.intangibleAssets),
        other_non_current_assets: filterRecord(state.sfp.otherNonCurrentAssets),
        other_current_assets: filterRecord(state.sfp.otherCurrentAssets),
        cash_and_cash_equivalents: filterRecord(state.sfp.cashAndEquivalents),
        other_current_liabilities: filterRecord(state.sfp.otherCurrentLiabilities),
        non_current_liabilities: filterRecord(state.sfp.nonCurrentLiabilities),
        other_reserves: filterRecord(state.sfp.otherReserves),
        current_liabilities: filterRecord(state.sfp.tradePayablesAndCurrentTax),
        equity: filterRecord(state.sfp.equity),
      },
      admin: filterRecord(state.adminExpense),
      addbacks: filterRecord(state.profitAdjustment.addbacks),
      deductions: filterRecord(state.profitAdjustment.deductions),
      computed: {
        total_capital_allowance: String(computed.totalCapitalAllowance),
        direct_cost: String(computed.directCost),
        gross_profit: String(computed.grossProfit),
        admin_expenses: String(computed.adminExpensesTotal),
        operating_income: String(computed.operatingIncome),
        opbt: String(computed.opbt),
        taxable_profit: String(computed.taxableProfit),
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
    exportForFiling,
  };
}
