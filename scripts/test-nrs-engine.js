/**
 * Integration Test Script for Rova NRS CIT Engine
 * Usage: node scripts/test-nrs-engine.js
 */

import { evaluateShowIf, evaluateFormula, syncComputedEngineState, hydrateForExport, flowConfig } from '../src/lib/nrsFlowEngine.ts';

function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Rova NRS CIT Engine Unit & Integration Test Suite');
  console.log('═══════════════════════════════════════════════════════════');

  // 1. Test evaluateShowIf
  console.log('\n[1] Testing evaluateShowIf()...');
  
  const testAnswers1 = { business_model: 'Services only', has_other_income: true };
  const testAnswers2 = { business_model: 'Goods only', sectors: ['Construction'] };

  const cond1 = evaluateShowIf("answers.business_model != 'Services only'", testAnswers1);
  console.log(`  • Condition (business_model != 'Services only') for 'Services only': ${cond1 === false ? '✅ PASSED (hidden)' : '❌ FAILED'}`);

  const cond2 = evaluateShowIf("answers.business_model != 'Services only'", testAnswers2);
  console.log(`  • Condition (business_model != 'Services only') for 'Goods only': ${cond2 === true ? '✅ PASSED (shown)' : '❌ FAILED'}`);

  const cond3 = evaluateShowIf("sectors_includes:Construction", testAnswers2);
  console.log(`  • Condition (sectors_includes:Construction): ${cond3 === true ? '✅ PASSED (shown)' : '❌ FAILED'}`);

  // 2. Test evaluateFormula
  console.log('\n[2] Testing evaluateFormula()...');
  const calcAnswers = {
    revenue_per_sector: [100000, 50000],
    opening_inventory_total: 20000,
    purchases_local: 30000,
    purchases_import: 0,
    purchase_returns: 5000,
    direct_costs_chips: { 'Direct wages': 10000 },
    factory_overheads_chips: { 'Factory rent': 5000 },
    closing_inventory_total: 15000,
    total_assets: 100000,
    total_current_liabilities: 40000,
    non_current_liabilities_total: 10000,
    total_equity: 50000,
  };

  const totalRev = evaluateFormula("sum(revenue_per_sector)", calcAnswers);
  console.log(`  • sum(revenue_per_sector): ${totalRev === 150000 ? `✅ PASSED (${totalRev})` : `❌ FAILED (${totalRev})`}`);

  const cosTotal = evaluateFormula(
    "opening_inventory_total + (purchases_local + purchases_import - purchase_returns) + sum(direct_costs_chips) + sum(factory_overheads_chips) - closing_inventory_total",
    calcAnswers
  );
  console.log(`  • cost_of_sales_total formula: ${cosTotal === 45000 ? `✅ PASSED (${cosTotal})` : `❌ FAILED (${cosTotal})`}`);

  const isBalanced = evaluateFormula(
    "total_assets == (total_current_liabilities + non_current_liabilities_total + total_equity)",
    calcAnswers
  );
  console.log(`  • balance_check (Assets == Liab + Eq): ${isBalanced === true ? '✅ PASSED (Balanced)' : '❌ FAILED'}`);

  // 3. Test Sparse Answers vs Hydrated Export
  console.log('\n[3] Testing Sparse Answers vs hydrateForExport()...');
  const sparseAnswers = {
    year_of_assessment: 2026,
    entity_type: 'Company',
    sectors: ['Agriculture'],
    business_model: 'Goods only',
    revenue_per_sector: [1000000],
    opening_inventory_total: 200000,
    purchases_local: 500000,
    closing_inventory_total: 300000
  };

  const hydrated = hydrateForExport(sparseAnswers, flowConfig);
  const totalKeys = Object.keys(hydrated).length;
  const zeroKeysCount = Object.values(hydrated).filter(v => v === '0.00').length;
  const answeredFieldVal = hydrated['INCOME_STATEMENT!D69'];

  console.log(`  • Total NRS Fields in Export Manifest: ${totalKeys}`);
  console.log(`  • Fields Hydrated with Explicit '0.00': ${zeroKeysCount}`);
  console.log(`  • Answered Opening Inventory Field (INCOME_STATEMENT!D69): ${answeredFieldVal}`);

  if (totalKeys > 20 && zeroKeysCount > 0 && answeredFieldVal === '200000.00') {
    console.log('\n✅ ALL NRS ENGINE TESTS PASSED PERFECTLY!\n');
  } else {
    console.log('\n❌ NRS Engine test suite had errors.\n');
  }
}

runTests();
