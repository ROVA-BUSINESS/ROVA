/**
 * citExcelExport.ts
 * Populates the official NRS CIT Excel template with data from the Rova CIT wizard.
 * Uses the xlsx library (browser-compatible, no Node.js required).
 *
 * Sheet structure (confirmed from 2026_2622496730309_CIT.xlsx):
 *   USER_INPUT              — C5 = year of assessment, D7 = accounting year
 *   INCOME_STATEMENT        — labels in col C, values in col D (revenue rows 7-27, COS rows 66-96)
 *   OTHER_INCOME            — labels in col C, values in col E (rows 4-17)
 *   ADMINISTRATIVE_EXPENSES — labels in col B, values in col D (rows 4-70)
 *   STATEMENT_OF_FINANCIAL_POSITION — labels in col C, values in col E (rows 8-121)
 *   PROFIT_ADJUSTMENT       — labels in col C, values in col E (rows 14-40)
 */

import { read, utils, write } from 'xlsx';

// ── helpers ──────────────────────────────────────────────────────────────────

type WorkbookType = ReturnType<typeof read>;
type WorksheetType = NonNullable<WorkbookType['Sheets'][string]>;

function getSheet(wb: WorkbookType, name: string): WorksheetType | null {
  return wb.Sheets[name] ?? null;
}

/** Write a numeric value into a cell, preserving existing cell style. */
function setCell(ws: WorksheetType, addr: string, value: number): void {
  if (!ws[addr]) ws[addr] = { t: 'n', v: value };
  else { ws[addr].t = 'n'; ws[addr].v = value; }
  // Remove formula so the written value is used
  delete ws[addr].f;
}

/** Fuzzy-match: find the first row in `rows` whose label (col `labelCol`) matches `target`. */
function findRowByLabel(
  ws: WorksheetType,
  target: string,
  labelCol: number,   // 0-indexed
  startRow: number,   // 0-indexed
  endRow: number,
): number | null {
  const needle = target.trim().toLowerCase();
  // 1. Exact match
  for (let r = startRow; r <= endRow; r++) {
    const addr = utils.encode_cell({ r, c: labelCol });
    const cell = ws[addr];
    if (cell && String(cell.v).trim().toLowerCase() === needle) return r;
  }
  // 2. Substring match
  for (let r = startRow; r <= endRow; r++) {
    const addr = utils.encode_cell({ r, c: labelCol });
    const cell = ws[addr];
    if (cell) {
      const cv = String(cell.v).trim().toLowerCase();
      if (cv.includes(needle) || needle.includes(cv)) return r;
    }
  }
  return null;
}

/** Write an entire Record<label, value> into a sheet using fuzzy label matching. */
function writeRecord(
  ws: WorksheetType,
  record: Record<string, number>,
  labelCol: number,
  valueCol: number,
  startRow: number,
  endRow: number,
): void {
  for (const [label, val] of Object.entries(record)) {
    if (!val && val !== 0) continue;
    const row = findRowByLabel(ws, label, labelCol, startRow, endRow);
    if (row !== null) {
      setCell(ws, utils.encode_cell({ r: row, c: valueCol }), val);
    }
  }
}

// ── sector row map (INCOME_STATEMENT col C rows 7-27 → D, 0-indexed rows 6-26) ──
const SECTOR_ROW: Record<string, number> = {
  'MANUFACTURING': 6,
  'AGRICULTURE FORESTRY & FISHING': 7,
  'AGRICULTURE, FORESTRY & FISHING': 7,
  'MINING & QUARRY': 8,
  'MINNING & QUARRY': 8,
  'ELECTRICITY': 9,
  'WATER SUPPLY SEWERAGE & WASTE MANAGEMENT': 10,
  'WATER SUPPLY, SEWERAGE & WASTE MANAGEMENT': 10,
  'CONSTRUCTION': 11,
  'WHOLESALE AND RETAIL TRADE': 12,
  'WHOLESALE & RETAIL TRADE': 12,
  'TRANSPORTATION AND HAULAGE': 13,
  'TRANSPORTATION & HAULAGE': 13,
  'ACCOMODATION AND FOOD SERVICE ACTIVITIES': 14,
  'ACCOMODATION & FOOD SERVICE ACTIVITIES': 14,
  'COMMUNICATION & INFORMATION': 15,
  'COMMUNICATION &. INFORMATION': 15,
  'BANKS & OTHER FINANCIAL AND ACTIVITIES': 16,
  'BANKS & OTHER FINANCIAL ACTIVITIES': 16,
  'INSURANCE ACTIVITIES': 17,
  'REAL ESTATE ACTIVITIES': 18,
  'PROFESSIONAL, SCIENTIFIC AND TECHNICAL ACTIVITIES': 19,
  'PROFESSIONAL, SCIENTIFIC & TECHNICAL ACTIVITIES': 19,
  'ADMINISTRATIVE AND SUPPORT ACTIVITIES': 20,
  'ADMINISTRATIVE & SUPPORT ACTIVITIES': 20,
  'EDUCATION': 21,
  'OIL AND GAS': 22,
  'OIL & GAS': 22,
  'NGOS, NFPOS, RELIGIOUS INSTITUTIONS': 23,
  'ART, ENTERTAINMENT AND RECREATION': 24,
  'ART, ENTERTAINMENT & RECREATION': 24,
  'DIGITAL AND VIRTUAL ASSETS': 25,
  'OTHERS': 26,
};

// ── main export function ──────────────────────────────────────────────────────

/** Convert string-valued record from exportForFiling() to number-valued. */
function toNum(rec: Record<string, string>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(rec)) {
    const n = parseFloat(v);
    if (!isNaN(n)) out[k] = n;
  }
  return out;
}

/**
 * Load the CIT template from a URL/base64 blob, populate it with wizard data,
 * and return a Uint8Array ready for download.
 *
 * @param templateBytes  ArrayBuffer of the original .xlsx template
 * @param data           Output of exportForFiling() from useRovaTaxFlow
 */
export function populateCitExcel(
  templateBytes: ArrayBuffer,
  data: Record<string, unknown>,
): Uint8Array {
  const wb = read(templateBytes, { type: 'array', cellStyles: true, cellFormula: true });

  const year = String((data.year as string) || '');
  const sector = String((data.sector as string) || '').toUpperCase().trim();
  const revenue = parseFloat((data.revenue as string) || '0') || 0;
  const cos = (data.cos as Record<string, Record<string, string>>) || {};
  const sfp = (data.sfp as Record<string, unknown>) || {};
  const computed = (data.computed as Record<string, string>) || {};

  // ── 1. USER_INPUT ──────────────────────────────────────────────────────────
  const userInput = getSheet(wb, 'USER_INPUT');
  if (userInput && year) {
    // C5 (0-indexed r=4, c=2) = year of assessment
    setCell(userInput, utils.encode_cell({ r: 4, c: 2 }), parseInt(year));
    // D7 (r=6, c=3) = accounting year (prior year)
    setCell(userInput, utils.encode_cell({ r: 6, c: 3 }), parseInt(year) - 1);
  }

  // ── 2. INCOME_STATEMENT ───────────────────────────────────────────────────
  const incStmt = getSheet(wb, 'INCOME_STATEMENT');
  if (incStmt) {
    // Revenue: col D (index 3), rows 7-27 (0-indexed 6-26)
    const sectorRow = SECTOR_ROW[sector] ?? SECTOR_ROW['OTHERS'];
    setCell(incStmt, utils.encode_cell({ r: sectorRow, c: 3 }), revenue);

    // Opening Inventory: col D (3), rows 66-68 (0-indexed 65-67)
    if (cos.opening_inventory) writeRecord(incStmt, toNum(cos.opening_inventory), 2, 3, 65, 68);
    // Purchases: col D (3), rows 71-73 (0-indexed 70-72)
    if (cos.purchases) writeRecord(incStmt, toNum(cos.purchases), 2, 3, 70, 73);
    // Other Direct Cost: col D (3), rows 76-84 (0-indexed 75-83)
    if (cos.other_direct_cost) writeRecord(incStmt, toNum(cos.other_direct_cost), 2, 3, 75, 84);
    // Factory Overheads: col D (3), rows 87-91 (0-indexed 86-90)
    if (cos.factory_overheads) writeRecord(incStmt, toNum(cos.factory_overheads), 2, 3, 86, 91);
    // Closing Inventory: col D (3), rows 94-96 (0-indexed 93-95)
    if (cos.closing_inventory) writeRecord(incStmt, toNum(cos.closing_inventory), 2, 3, 93, 96);
  }

  // ── 3. OTHER_INCOME ───────────────────────────────────────────────────────
  const otherIncome = getSheet(wb, 'OTHER_INCOME');
  if (otherIncome && data.other_income) {
    // labels col C (2), values col E (4), rows 4-17 (0-indexed 3-16)
    writeRecord(otherIncome, toNum(data.other_income as Record<string, string>), 2, 4, 3, 16);
  }

  // ── 4. ADMINISTRATIVE_EXPENSES ────────────────────────────────────────────
  const adminSheet = getSheet(wb, 'ADMINISTRATIVE_EXPENSES');
  if (adminSheet && data.admin) {
    // labels col B (1), values col D (3), rows 4-70 (0-indexed 3-69)
    writeRecord(adminSheet, toNum(data.admin as Record<string, string>), 1, 3, 3, 69);
  }

  // ── 5. STATEMENT_OF_FINANCIAL_POSITION ────────────────────────────────────
  const sfpSheet = getSheet(wb, 'STATEMENT_OF_FINANCIAL_POSITION');
  if (sfpSheet) {
    // PPE: E8 (r=7, c=4)
    const ppe = parseFloat((sfp.properties_plant_equipment as string) || '0');
    if (ppe) setCell(sfpSheet, utils.encode_cell({ r: 7, c: 4 }), ppe);

    // Investments: labels col C (2), values col E (4), rows 10-19 (0-idx 9-18)
    if (sfp.investments) writeRecord(sfpSheet, toNum(sfp.investments as Record<string, string>), 2, 4, 9, 18);
    // Intangible assets: rows 21-29 (0-idx 20-28)
    if (sfp.intangible_assets) writeRecord(sfpSheet, toNum(sfp.intangible_assets as Record<string, string>), 2, 4, 20, 28);
    // Other non-current assets: rows 31-42 (0-idx 30-41)
    if (sfp.other_non_current_assets) writeRecord(sfpSheet, toNum(sfp.other_non_current_assets as Record<string, string>), 2, 4, 30, 41);

    // Inventories: E46 (r=45, c=4)
    const inventories = parseFloat((sfp.inventories as string) || '0');
    if (inventories) setCell(sfpSheet, utils.encode_cell({ r: 45, c: 4 }), inventories);
    // Trade Receivables: E48 (r=47, c=4)
    const tradeRec = parseFloat((sfp.trade_receivables as string) || '0');
    if (tradeRec) setCell(sfpSheet, utils.encode_cell({ r: 47, c: 4 }), tradeRec);

    // Other current assets: rows 50-62 (0-idx 49-61)
    if (sfp.other_current_assets) writeRecord(sfpSheet, toNum(sfp.other_current_assets as Record<string, string>), 2, 4, 49, 61);
    // Cash & equivalents: rows 64-67 (0-idx 63-66)
    if (sfp.cash_and_cash_equivalents) writeRecord(sfpSheet, toNum(sfp.cash_and_cash_equivalents as Record<string, string>), 2, 4, 63, 66);

    // Current liabilities (trade payables + current tax): rows 73-74 (0-idx 72-73)
    if (sfp.current_liabilities) writeRecord(sfpSheet, toNum(sfp.current_liabilities as Record<string, string>), 2, 4, 72, 73);
    // Other current liabilities: rows 76-92 (0-idx 75-91)
    if (sfp.other_current_liabilities) writeRecord(sfpSheet, toNum(sfp.other_current_liabilities as Record<string, string>), 2, 4, 75, 91);

    // Non-current liabilities: rows 95-110 (0-idx 94-109)
    if (sfp.non_current_liabilities) writeRecord(sfpSheet, toNum(sfp.non_current_liabilities as Record<string, string>), 2, 4, 94, 109);

    // Equity: rows 112-117 (0-idx 111-116)
    if (sfp.equity) writeRecord(sfpSheet, toNum(sfp.equity as Record<string, string>), 2, 4, 111, 116);

    // Retained earnings from computed profit: E114 (r=113, c=4)
    const profitForYear = parseFloat(computed.profit_for_year || '0');
    if (profitForYear) setCell(sfpSheet, utils.encode_cell({ r: 113, c: 4 }), profitForYear);

    // Other reserves: rows 119-121 (0-idx 118-120)
    if (sfp.other_reserves) writeRecord(sfpSheet, toNum(sfp.other_reserves as Record<string, string>), 2, 4, 118, 120);
  }

  // ── 6. PROFIT_ADJUSTMENT ──────────────────────────────────────────────────
  const profitAdj = getSheet(wb, 'PROFIT_ADJUSTMENT');
  if (profitAdj) {
    // Profit before tax: E11 (r=10, c=4)
    const opbt = parseFloat(computed.opbt || '0');
    if (opbt) setCell(profitAdj, utils.encode_cell({ r: 10, c: 4 }), opbt);

    // Depreciation addback auto-fill from capital allowance: E13 (r=12, c=4)
    const capAllowance = parseFloat(computed.total_capital_allowance || '0');
    if (capAllowance) setCell(profitAdj, utils.encode_cell({ r: 12, c: 4 }), capAllowance);

    // Addbacks: labels col C (2), values col E (4), rows 14-32 (0-idx 13-31)
    if (data.addbacks) writeRecord(profitAdj, toNum(data.addbacks as Record<string, string>), 2, 4, 13, 31);
    // Deductions: rows 36-40 (0-idx 35-39)
    if (data.deductions) writeRecord(profitAdj, toNum(data.deductions as Record<string, string>), 2, 4, 35, 39);
  }

  // ── Serialize ─────────────────────────────────────────────────────────────
  const out = write(wb, { type: 'array', bookType: 'xlsx' });
  return new Uint8Array(out as ArrayBuffer);
}
