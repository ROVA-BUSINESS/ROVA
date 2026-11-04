import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

/**
 * ROVA CIT Excel Generator
 * 
 * Reads a tax data JSON file (exported from the ROVA CIT Wizard)
 * and populates the 2026_CIT_ROVA.xlsx template into a filled copy.
 * 
 * Usage: node scripts/generate-cit-excel.js [json_path] [template_path] [output_path]
 */

const args = process.argv.slice(2);
const jsonPath = args[0] || 'scratch/test_tax_data.json';
const templatePath = args[1] || '2026_CIT_ROVA.xlsx';
const outputPath = args[2] || '2026_CIT_ROVA_filled.xlsx';

function sumValues(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  return Object.values(obj).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
}

/**
 * Find a row by label text in a given column range.
 * Uses exact match first, then substring/fuzzy match.
 */
function findRowByLabel(ws, label, labelCol, startRow, endRow) {
  const cleaned = String(label).trim().toLowerCase();
  // Exact match
  for (let r = startRow; r <= endRow; r++) {
    const cell = ws.getCell(r, labelCol);
    const val = cell.value;
    if (val && String(val).trim().toLowerCase() === cleaned) return r;
  }
  // Substring match
  for (let r = startRow; r <= endRow; r++) {
    const cell = ws.getCell(r, labelCol);
    const val = cell.value;
    if (val) {
      const cv = String(val).trim().toLowerCase();
      if (cleaned.includes(cv) || cv.includes(cleaned)) return r;
    }
  }
  return null;
}

function writeRecordToSheet(ws, record, labelCol, valueCol, startRow, endRow) {
  if (!record || typeof record !== 'object') return;
  for (const [label, val] of Object.entries(record)) {
    const row = findRowByLabel(ws, label, labelCol, startRow, endRow);
    if (row && val) {
      ws.getCell(row, valueCol).value = parseFloat(val) || 0;
    }
  }
}

async function main() {
  // Load JSON
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: JSON file not found: ${jsonPath}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`Loaded tax data from: ${jsonPath}`);
  console.log(`  Year: ${data.year}, Sector: ${data.sector}, Revenue: ₦${Number(data.revenue || 0).toLocaleString()}`);

  // Load template
  const absTemplatePath = path.resolve(templatePath);
  if (!fs.existsSync(absTemplatePath)) {
    console.error(`Error: Excel template not found: ${absTemplatePath}`);
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(absTemplatePath);
  console.log(`Loaded template: ${absTemplatePath}`);
  console.log(`  Sheets: ${wb.worksheets.map(s => s.name).join(', ')}`);

  // ──────────────────────────────────────────────
  // 1. USER_INPUT sheet
  // ──────────────────────────────────────────────
  const userInput = wb.getWorksheet('USER_INPUT');
  if (userInput && data.year) {
    try {
      userInput.getCell('C5').value = parseInt(data.year);
      userInput.getCell('D7').value = parseInt(data.year) - 1;
      console.log('  ✅ USER_INPUT: Year of assessment filled');
    } catch (e) {
      console.warn('  ⚠️ USER_INPUT: Could not write year:', e.message);
    }
  }

  // ──────────────────────────────────────────────
  // 2. INCOME_STATEMENT sheet
  // ──────────────────────────────────────────────
  const incomeStatement = wb.getWorksheet('INCOME_STATEMENT');
  if (incomeStatement) {
    // Revenue by sector
    if (data.sector && data.revenue) {
      const sectorRow = findRowByLabel(incomeStatement, data.sector, 3, 7, 27);
      if (sectorRow) {
        incomeStatement.getCell(sectorRow, 4).value = parseFloat(data.revenue);
        console.log(`  ✅ INCOME_STATEMENT: Revenue ₦${Number(data.revenue).toLocaleString()} in sector row ${sectorRow}`);
      } else {
        // Fallback to "Others" row 27
        incomeStatement.getCell(27, 4).value = parseFloat(data.revenue);
        console.log('  ⚠️ INCOME_STATEMENT: Sector not found, wrote revenue to Others (row 27)');
      }
    }

    // Cost of Sales
    if (data.cos) {
      writeRecordToSheet(incomeStatement, data.cos.opening_inventory, 3, 4, 65, 68);
      writeRecordToSheet(incomeStatement, data.cos.purchases, 3, 4, 70, 73);
      writeRecordToSheet(incomeStatement, data.cos.other_direct_cost, 3, 4, 75, 84);
      writeRecordToSheet(incomeStatement, data.cos.factory_overheads, 3, 4, 86, 91);
      writeRecordToSheet(incomeStatement, data.cos.closing_inventory, 3, 4, 93, 96);
      console.log('  ✅ INCOME_STATEMENT: Cost of Sales sections filled');
    }
  }

  // ──────────────────────────────────────────────
  // 3. STATEMENT_OF_FINANCIAL_POSITION sheet
  // ──────────────────────────────────────────────
  const sfpSheet = wb.getWorksheet('STATEMENT_OF_FINANCIAL_POSITION');
  if (sfpSheet && data.sfp) {
    // Properties, Plants & Equipment
    if (data.sfp.properties_plant_equipment) {
      sfpSheet.getCell('D8').value = parseFloat(data.sfp.properties_plant_equipment);
      console.log('  ✅ SFP: Properties, Plants & Equipment filled');
    }

    // Map each SFP category to its row ranges
    const sfpCategories = [
      ['investments', 10, 19],
      ['intangible_assets', 21, 29],
      ['other_non_current_assets', 31, 42],
      ['other_current_assets', 50, 62],
      ['cash_and_cash_equivalents', 64, 67],
      ['current_liabilities', 73, 74],
      ['other_current_liabilities', 76, 92],
      ['non_current_liabilities', 95, 110],
      ['equity', 112, 117],
      ['other_reserves', 119, 125],
    ];

    for (const [key, startRow, endRow] of sfpCategories) {
      if (data.sfp[key] && typeof data.sfp[key] === 'object') {
        writeRecordToSheet(sfpSheet, data.sfp[key], 3, 4, startRow, endRow);
      }
    }

    // Inventories → D46
    if (data.sfp.inventories !== undefined && data.sfp.inventories !== null && data.sfp.inventories !== '') {
      sfpSheet.getCell('D46').value = parseFloat(data.sfp.inventories);
    } else if (data.cos?.closing_inventory) {
      const closingSum = sumValues(data.cos.closing_inventory);
      if (closingSum > 0) {
        sfpSheet.getCell('D46').value = closingSum;
      }
    }

    // Trade receivables → D48
    if (data.sfp.trade_receivables !== undefined && data.sfp.trade_receivables !== null && data.sfp.trade_receivables !== '') {
      sfpSheet.getCell('D48').value = parseFloat(data.sfp.trade_receivables);
    }

    // Retained earnings from computed profit
    if (data.computed?.profit_for_year) {
      sfpSheet.getCell('D114').value = parseFloat(data.computed.profit_for_year);
    } else {
      // Compute manually if not provided
      const rev = parseFloat(data.revenue || 0);
      const cosData = data.cos || {};
      const directCost = sumValues(cosData.opening_inventory) + sumValues(cosData.purchases) +
        sumValues(cosData.other_direct_cost) + sumValues(cosData.factory_overheads) -
        sumValues(cosData.closing_inventory);
      const grossProfit = rev - directCost;
      const adminCost = sumValues(data.admin);
      const opIncome = grossProfit - adminCost;
      const addbacks = sumValues(data.addbacks);
      const deductions = sumValues(data.deductions);
      const taxableProfit = opIncome + addbacks - deductions;
      const taxation = Math.max(taxableProfit, 0) * 0.30;
      const pat = opIncome - taxation;
      sfpSheet.getCell('D114').value = pat;
    }
    console.log('  ✅ SFP: All sections filled');
  }

  // ──────────────────────────────────────────────
  // 4. PROFIT_ADJUSTMENT sheet
  // ──────────────────────────────────────────────
  const profitAdj = wb.getWorksheet('PROFIT_ADJUSTMENT');
  if (profitAdj) {
    if (data.addbacks) {
      writeRecordToSheet(profitAdj, data.addbacks, 3, 4, 14, 32);
      console.log('  ✅ PROFIT_ADJUSTMENT: Addbacks filled');
    }
    if (data.deductions) {
      writeRecordToSheet(profitAdj, data.deductions, 3, 4, 36, 40);
      console.log('  ✅ PROFIT_ADJUSTMENT: Deductions filled');
    }
  }

  // ──────────────────────────────────────────────
  // 5. OTHER_INCOME sheet
  // ──────────────────────────────────────────────
  const otherIncome = wb.getWorksheet('OTHER_INCOME');
  if (otherIncome && data.other_income) {
    writeRecordToSheet(otherIncome, data.other_income, 3, 4, 4, 17);
    console.log('  ✅ OTHER_INCOME: filled');
  }

  // ──────────────────────────────────────────────
  // 6. ADMINISTRATIVE_EXPENSES sheet
  // ──────────────────────────────────────────────
  const adminSheet = wb.getWorksheet('ADMINISTRATIVE_EXPENSES');
  if (adminSheet && data.admin) {
    writeRecordToSheet(adminSheet, data.admin, 2, 3, 4, 70);
    console.log('  ✅ ADMINISTRATIVE_EXPENSES: filled');
  }

  // ──────────────────────────────────────────────
  // Save output
  // ──────────────────────────────────────────────
  const absOutputPath = path.resolve(outputPath);
  await wb.xlsx.writeFile(absOutputPath);
  console.log(`\n✅ Successfully generated filled Excel: ${absOutputPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
