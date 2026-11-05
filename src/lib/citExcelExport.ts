/**
 * citExcelExport.ts
 * 
 * Fills the official NRS CIT Excel template (CIT_template_2026.xlsx) with data
 * from the Rova CIT Tax Wizard using ExcelJS.
 * 
 * Unlike SheetJS, ExcelJS preserves 100% of:
 *  - Original FIRS colors, formatting, fonts, and borders
 *  - Excel Table definitions (e.g. administrative_expenses, other_income)
 *  - All automated calculation formulas (=SUM, =D7, etc.)
 *  - Original OpenXML metadata required by the NRS portal
 */

import ExcelJS from 'exceljs';

function cleanStr(s: unknown): string {
  return String(s || '').trim().toLowerCase();
}

/** Find a row index (1-based) in a worksheet by searching for label text in a column */
function findRowByLabel(
  ws: ExcelJS.Worksheet,
  targetLabel: string,
  labelCol: number,
  startRow: number,
  endRow: number,
): number | null {
  const needle = cleanStr(targetLabel);
  if (!needle) return null;

  // 1. Exact match
  for (let r = startRow; r <= endRow; r++) {
    const val = cleanStr(ws.getRow(r).getCell(labelCol).value);
    if (val === needle) return r;
  }

  // 2. Substring match
  for (let r = startRow; r <= endRow; r++) {
    const val = cleanStr(ws.getRow(r).getCell(labelCol).value);
    if (val && (val.includes(needle) || needle.includes(val))) return r;
  }

  return null;
}

/** Write Record<label, value> into the sheet by searching label in `labelCol` and writing value into `valueCol` */
function writeRecord(
  ws: ExcelJS.Worksheet,
  record: Record<string, string> | undefined,
  labelCol: number,
  valueCol: number,
  startRow: number,
  endRow: number,
): void {
  if (!record || typeof record !== 'object') return;
  for (const [label, strVal] of Object.entries(record)) {
    const n = parseFloat(strVal);
    if (isNaN(n) || n === 0) continue;
    const row = findRowByLabel(ws, label, labelCol, startRow, endRow);
    if (row !== null) {
      ws.getRow(row).getCell(valueCol).value = n;
    }
  }
}

// Map of business sectors to row numbers in INCOME_STATEMENT (rows 7 to 27)
const SECTOR_ROW_MAP: Record<string, number> = {
  'MANUFACTURING': 7,
  'AGRICULTURE FORESTRY & FISHING': 8,
  'AGRICULTURE, FORESTRY & FISHING': 8,
  'MINING & QUARRY': 9,
  'MINNING & QUARRY': 9,
  'ELECTRICITY': 10,
  'WATER SUPPLY SEWERAGE & WASTE MANAGEMENT': 11,
  'WATER SUPPLY, SEWERAGE & WASTE MANAGEMENT': 11,
  'CONSTRUCTION': 12,
  'WHOLESALE AND RETAIL TRADE': 13,
  'WHOLESALE & RETAIL TRADE': 13,
  'TRANSPORTATION AND HAULAGE': 14,
  'TRANSPORTATION & HAULAGE': 14,
  'ACCOMODATION AND FOOD SERVICE ACTIVITIES': 15,
  'ACCOMODATION & FOOD SERVICE ACTIVITIES': 15,
  'COMMUNICATION & INFORMATION': 16,
  'COMMUNICATION &. INFORMATION': 16,
  'BANKS & OTHER FINANCIAL AND ACTIVITIES': 17,
  'BANKS & OTHER FINANCIAL ACTIVITIES': 17,
  'BANKS & OTHER FINANCIAL AND  ACTIVITIES': 17,
  'INSURANCE ACTIVITIES': 18,
  'REAL ESTATE ACTIVITIES': 19,
  'PROFESSIONAL, SCIENTIFIC AND TECHNICAL ACTIVITIES': 20,
  'PROFESSIONAL, SCIENTIFIC & TECHNICAL ACTIVITIES': 20,
  'ADMINISTRATIVE AND SUPPORT ACTIVITIES': 21,
  'ADMINISTRATIVE & SUPPORT ACTIVITIES': 21,
  'EDUCATION': 22,
  'OIL AND GAS': 23,
  'OIL & GAS': 23,
  'NGOS, NFPOS, RELIGIOUS INSTITUTIONS': 24,
  'ART, ENTERTAINMENT AND RECREATION': 25,
  'ART, ENTERTAINMENT & RECREATION': 25,
  'DIGITAL AND VIRTUAL ASSETS': 26,
  'OTHERS': 27,
};

/**
 * Loads the original template binary, sets input values on the exact cells,
 * and outputs a 100% styled and formula-complete .xlsx buffer.
 */
export async function populateCitExcel(
  templateBytes: ArrayBuffer,
  data: Record<string, unknown>,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBytes);

  const year = String((data.year as string) || '');
  const sector = String((data.sector as string) || '').toUpperCase().trim();
  const revenue = parseFloat((data.revenue as string) || '0') || 0;
  const cos = (data.cos as Record<string, Record<string, string>>) || {};
  const sfp = (data.sfp as Record<string, unknown>) || {};
  const computed = (data.computed as Record<string, string>) || {};

  // ── 1. USER_INPUT ──────────────────────────────────────────────────────────
  const userInput = wb.getWorksheet('USER_INPUT');
  if (userInput && year) {
    const y = parseInt(year);
    if (!isNaN(y)) {
      userInput.getCell('C5').value = y;
      userInput.getCell('D7').value = y - 1;
    }
  }

  // ── 2. INCOME_STATEMENT ───────────────────────────────────────────────────
  const incStmt = wb.getWorksheet('INCOME_STATEMENT');
  if (incStmt) {
    // Sector revenue input is in Column D (cols: C=label, D=input, E=formula)
    const sectorRow = SECTOR_ROW_MAP[sector] ?? SECTOR_ROW_MAP['OTHERS'];
    if (revenue > 0) {
      incStmt.getRow(sectorRow).getCell(4).value = revenue;
    }

    // Cost of Sales input cells are in Column D (col 4), labels in Column C (col 3)
    if (cos.opening_inventory) writeRecord(incStmt, cos.opening_inventory, 3, 4, 66, 68);
    if (cos.purchases) writeRecord(incStmt, cos.purchases, 3, 4, 71, 73);
    if (cos.other_direct_cost) writeRecord(incStmt, cos.other_direct_cost, 3, 4, 76, 84);
    if (cos.factory_overheads) writeRecord(incStmt, cos.factory_overheads, 3, 4, 87, 91);
    if (cos.closing_inventory) writeRecord(incStmt, cos.closing_inventory, 3, 4, 94, 96);
  }

  // ── 3. OTHER_INCOME ───────────────────────────────────────────────────────
  const otherIncome = wb.getWorksheet('OTHER_INCOME');
  if (otherIncome && data.other_income) {
    // Labels in Column C (col 3), inputs in Column D (col 4, REVENUE)
    // E3 has the table formula: =SUM(other_income[REVENUE])
    writeRecord(otherIncome, data.other_income as Record<string, string>, 3, 4, 4, 17);
  }

  // ── 4. ADMINISTRATIVE_EXPENSES ────────────────────────────────────
  const adminSheet = wb.getWorksheet('ADMINISTRATIVE_EXPENSES');
  if (adminSheet && data.admin) {
    // Labels in Column B (col 2), inputs in Column C (col 3, REVENUE)
    // D3 has the table formula: =SUM(administrative_expenses[REVENUE])
    writeRecord(adminSheet, data.admin as Record<string, string>, 2, 3, 4, 70);
  }

  // ── 5. STATEMENT_OF_FINANCIAL_POSITION ────────────────────────────────────
  const sfpSheet = wb.getWorksheet('STATEMENT_OF_FINANCIAL_POSITION');
  if (sfpSheet) {
    // All inputs are in Column D (col 4), labels in Column C (col 3)
    // Column E has formula calculations (=D8, =SUM(...), etc.)

    // PPE (D8)
    const ppe = parseFloat((sfp.properties_plant_equipment as string) || '0');
    if (ppe > 0) sfpSheet.getCell('D8').value = ppe;

    // Investments (D10 to D19)
    if (sfp.investments) writeRecord(sfpSheet, sfp.investments as Record<string, string>, 3, 4, 10, 19);

    // Intangible assets (D21 to D29)
    if (sfp.intangible_assets) writeRecord(sfpSheet, sfp.intangible_assets as Record<string, string>, 3, 4, 21, 29);

    // Other non-current assets (D31 to D42)
    if (sfp.other_non_current_assets) writeRecord(sfpSheet, sfp.other_non_current_assets as Record<string, string>, 3, 4, 31, 42);

    // Inventories (D46)
    const inv = parseFloat((sfp.inventories as string) || '0');
    if (inv > 0) sfpSheet.getCell('D46').value = inv;

    // Trade Receivables (D48)
    const tradeRec = parseFloat((sfp.trade_receivables as string) || '0');
    if (tradeRec > 0) sfpSheet.getCell('D48').value = tradeRec;

    // Other current assets (D50 to D62)
    if (sfp.other_current_assets) writeRecord(sfpSheet, sfp.other_current_assets as Record<string, string>, 3, 4, 50, 62);

    // Cash and Cash Equivalents (D64 to D67)
    if (sfp.cash_and_cash_equivalents) writeRecord(sfpSheet, sfp.cash_and_cash_equivalents as Record<string, string>, 3, 4, 64, 67);

    // Trade Payables & Current Tax (D73, D74)
    if (sfp.current_liabilities) writeRecord(sfpSheet, sfp.current_liabilities as Record<string, string>, 3, 4, 73, 74);

    // Other Current Liabilities (D76 to D92)
    if (sfp.other_current_liabilities) writeRecord(sfpSheet, sfp.other_current_liabilities as Record<string, string>, 3, 4, 76, 92);

    // Non-current Liabilities (D95 to D110)
    if (sfp.non_current_liabilities) writeRecord(sfpSheet, sfp.non_current_liabilities as Record<string, string>, 3, 4, 95, 110);

    // Equity (D112 to D117)
    if (sfp.equity) writeRecord(sfpSheet, sfp.equity as Record<string, string>, 3, 4, 112, 117);

    // Retained Earnings (D114) — if user did not set it explicitly, use computed profit
    const userRetained = (sfp.equity as Record<string, string>)?.[`Retained earnings`] || (sfp.equity as Record<string, string>)?.[`retained_earnings`];
    if (!userRetained) {
      const pfy = parseFloat(computed.profit_for_year || '0');
      if (pfy > 0) sfpSheet.getCell('D114').value = pfy;
    }

    // Other Reserves (D119 to D125)
    if (sfp.other_reserves) writeRecord(sfpSheet, sfp.other_reserves as Record<string, string>, 3, 4, 119, 125);
  }

  // ── 6. PROFIT_ADJUSTMENT ──────────────────────────────────────────────────
  const profitAdj = wb.getWorksheet('PROFIT_ADJUSTMENT');
  if (profitAdj) {
    // Addbacks: labels in Column C (col 3), inputs in Column D (col 4, rows 14-32)
    if (data.addbacks) writeRecord(profitAdj, data.addbacks as Record<string, string>, 3, 4, 14, 32);

    // Deductions: labels in Column C (col 3), inputs in Column D (col 4, rows 36-40)
    if (data.deductions) writeRecord(profitAdj, data.deductions as Record<string, string>, 3, 4, 36, 40);
  }

  // Generate output xlsx buffer
  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
