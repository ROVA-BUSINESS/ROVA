/**
 * citExcelExport.ts
 * 
 * Fills the official NRS CIT Excel template (CIT_template_2026.xlsx) with data
 * from the Rova CIT Tax Wizard.
 * 
 * Uses direct OpenXML manipulation via JSZip to guarantee 100% template preservation:
 *  - ZERO alteration to table definitions (/xl/tables/table*.xml)
 *  - ZERO alteration to relationships, calc chains, drawing parts, or printer settings
 *  - All automated calculation formulas (=SUM, =D7, etc.) remain intact
 *  - NO repair prompts or warnings when opened in Microsoft Excel or uploaded to NRS
 */

import JSZip from 'jszip';

// Helper to normalize strings for matching
function norm(s: unknown): string {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Update or insert a numeric cell value into a worksheet's XML string */
function setCellValue(xmlStr: string, cellRef: string, val: number | string): string {
  if (val === undefined || val === null || val === '') return xmlStr;
  const numVal = typeof val === 'number' ? val : (parseFloat(val) || 0);

  // Pattern 1: self-closing tag <c r="D7" s="197"/>
  const selfClosingRegex = new RegExp(`(<c[^>]*r="${cellRef}"[^>]*?)\\/>`);
  if (selfClosingRegex.test(xmlStr)) {
    return xmlStr.replace(selfClosingRegex, (_m, openTag) => {
      const cleanOpen = openTag.replace(/\s+t="[^"]*"/g, '');
      return `${cleanOpen}><v>${numVal}</v></c>`;
    });
  }

  // Pattern 2: existing tag <c r="D7" ...>...</c>
  const normalRegex = new RegExp(`(<c[^>]*r="${cellRef}"[^>]*>)([\\s\\S]*?)(<\\/c>)`);
  if (normalRegex.test(xmlStr)) {
    return xmlStr.replace(normalRegex, (_m, openTag, inner, closeTag) => {
      const cleanOpen = openTag.replace(/\s+t="[^"]*"/g, '');
      const cleanInner = inner.replace(/<v>.*?<\/v>/g, '').replace(/<f>.*?<\/f>/g, '');
      return `${cleanOpen}${cleanInner}<v>${numVal}</v>${closeTag}`;
    });
  }

  // Pattern 3: row exists but cell is not listed
  const rowNum = cellRef.match(/\d+/)?.[0];
  if (rowNum) {
    const rowRegex = new RegExp(`(<row[^>]*r="${rowNum}"[^>]*>)([\\s\\S]*?)(<\\/row>)`);
    if (rowRegex.test(xmlStr)) {
      return xmlStr.replace(rowRegex, (_m, rowOpen, rowInner, rowClose) => {
        return `${rowOpen}${rowInner}<c r="${cellRef}"><v>${numVal}</v></c>${rowClose}`;
      });
    }
  }

  return xmlStr;
}

// Write a dictionary of labels->values using a row map
function writeByMap(
  xmlStr: string,
  record: Record<string, number | string> | undefined,
  colLetter: string,
  rowMap: Record<string, number>,
): string {
  if (!record || typeof record !== 'object') return xmlStr;
  let updated = xmlStr;
  for (const [rawKey, val] of Object.entries(record)) {
    const num = parseFloat(String(val));
    if (isNaN(num) || num === 0) continue;
    const targetKey = norm(rawKey);

    // Look for exact normalized match
    let foundRow: number | undefined = rowMap[targetKey];
    if (!foundRow) {
      // Substring match
      for (const [mapKey, row] of Object.entries(rowMap)) {
        if (mapKey.includes(targetKey) || targetKey.includes(mapKey)) {
          foundRow = row;
          break;
        }
      }
    }

    if (foundRow) {
      updated = setCellValue(updated, `${colLetter}${foundRow}`, num);
    }
  }
  return updated;
}

// Row maps for each section

const SECTOR_ROW_MAP: Record<string, number> = {
  [norm('MANUFACTURING')]: 7,
  [norm('AGRICULTURE FORESTRY & FISHING')]: 8,
  [norm('MINING & QUARRY')]: 9,
  [norm('MINNING & QUARRY')]: 9,
  [norm('ELECTRICITY')]: 10,
  [norm('WATER SUPPLY SEWERAGE & WASTE MANAGEMENT')]: 11,
  [norm('CONSTRUCTION')]: 12,
  [norm('WHOLESALE AND RETAIL TRADE')]: 13,
  [norm('WHOLESALE & RETAIL TRADE')]: 13,
  [norm('TRANSPORTATION AND HAULAGE')]: 14,
  [norm('ACCOMODATION AND FOOD SERVICE ACTIVITIES')]: 15,
  [norm('ACCOMMODATION AND FOOD SERVICE ACTIVITIES')]: 15,
  [norm('COMMUNICATION &. INFORMATION')]: 16,
  [norm('COMMUNICATION & INFORMATION')]: 16,
  [norm('BANKS & OTHER FINANCIAL AND ACTIVITIES')]: 17,
  [norm('BANKS & OTHER FINANCIAL ACTIVITIES')]: 17,
  [norm('INSURANCE ACTIVITIES')]: 18,
  [norm('REAL ESTATE ACTIVITIES')]: 19,
  [norm('PROFESSIONAL, SCIENTIFIC AND TECHNICAL ACTIVITIES')]: 20,
  [norm('PROFESSIONAL SCIENTIFIC AND TECHNICAL ACTIVITIES')]: 20,
  [norm('ADMINISTRATIVE AND SUPPORT ACTIVITIES')]: 21,
  [norm('EDUCATION')]: 22,
  [norm('OIL AND GAS')]: 23,
  [norm('OIL & GAS')]: 23,
  [norm('NGOs, NFPOs, RELIGIOUS INSTITUTIONS')]: 24,
  [norm('NGOs NFPOs RELIGIOUS INSTITUTIONS')]: 24,
  [norm('ART, ENTERTAINMENT AND RECREATION')]: 25,
  [norm('ART ENTERTAINMENT AND RECREATION')]: 25,
  [norm('DIGITAL AND VIRTUAL ASSETS')]: 26,
  [norm('Others')]: 27,
};

const COS_OPENING_INV_MAP: Record<string, number> = {
  [norm('Raw materials')]: 66,
  [norm('Work in progress')]: 67,
  [norm('Finished goods')]: 68,
};

const COS_PURCHASES_MAP: Record<string, number> = {
  [norm('Local Purchases')]: 71,
  [norm('Import Purchases')]: 72,
  [norm('Return Outwards')]: 73,
  [norm('Returns Outwards')]: 73,
  [norm('Purchase returns (if any)')]: 73,
};

const COS_DIRECT_COST_MAP: Record<string, number> = {
  [norm('Direct wages')]: 76,
  [norm('Direct expenses')]: 77,
  [norm('Carriage Inwards')]: 78,
  [norm('Depreciation')]: 79,
  [norm('Mining Cost')]: 80,
  [norm('Direct construction cost')]: 81,
  [norm('Cost of Storage')]: 82,
  [norm('Amortisation of intangible assets')]: 83,
  [norm('Other Direct costs')]: 84,
};

const COS_OVERHEADS_MAP: Record<string, number> = {
  [norm('Factory Rent')]: 87,
  [norm('Factory Rates')]: 88,
  [norm('Fuel and Power')]: 89,
  [norm('Indirect Wages')]: 90,
  [norm('Other Factory Overheads')]: 91,
};

const COS_CLOSING_INV_MAP: Record<string, number> = {
  [norm('Raw materials')]: 94,
  [norm('Work In Progress')]: 95,
  [norm('Work in progress')]: 95,
  [norm('Finished goods')]: 96,
};

const OTHER_INCOME_MAP: Record<string, number> = {
  [norm('Commision Income')]: 4,
  [norm('Commission Income')]: 4,
  [norm('Interest Income')]: 5,
  [norm('Lease Income-Finance')]: 6,
  [norm('Rental Income')]: 7,
  [norm('Dividend Income')]: 8,
  [norm('Profit from disposal of investment in subsidiary income')]: 9,
  [norm('Decrease in provision')]: 10,
  [norm('Gain on sale of asset')]: 11,
  [norm('Non-taxable revenue')]: 12,
  [norm('Realized foreign exchange gain')]: 13,
  [norm('Unrealized foreign exchange gain')]: 14,
  [norm('Bad debt recovered')]: 15,
  [norm('Other investment income')]: 16,
  [norm('Others')]: 17,
};

const ADMIN_EXPENSES_MAP: Record<string, number> = {
  [norm('Salary and Wages')]: 4,
  [norm('Employee Benefit Expenses')]: 5,
  [norm('Directors Emoluments')]: 6,
  [norm('Directors expenses')]: 7,
  [norm('Staff Allowances')]: 8,
  [norm('Staff Loan written off')]: 9,
  [norm('Staff Gratuity')]: 10,
  [norm('Pension and Gratuity')]: 11,
  [norm('Other staff & related Cost')]: 12,
  [norm('depreciation')]: 13,
  [norm('Amortisation of intangible assets')]: 14,
  [norm('Government and regulatory costs')]: 15,
  [norm('Advertisement & Promotion')]: 16,
  [norm('Bad Debt written off')]: 17,
  [norm('Bank charges')]: 18,
  [norm('Interest Expense')]: 19,
  [norm('Rooms/ Accomodation cost')]: 20,
  [norm('Audit fees')]: 21,
  [norm('Donations')]: 22,
  [norm('Entertainment expenses')]: 23,
  [norm('Postages')]: 24,
  [norm('Fuel expenses')]: 25,
  [norm('Generator expenses')]: 26,
  [norm('Head office cost')]: 27,
  [norm('Internet Cost')]: 28,
  [norm('Loss on sale of property, plants and equipments')]: 29,
  [norm('Medical Expenses')]: 30,
  [norm('Newspaper & Periodicals')]: 31,
  [norm('Outsourcing Services expenses')]: 32,
  [norm('Rates')]: 33,
  [norm('Rent & Rates')]: 34,
  [norm('Repairs and Maintenance')]: 35,
  [norm('Research cost')]: 36,
  [norm('Security expenses')]: 37,
  [norm('Selling & Distribution Expenses')]: 38,
  [norm('Service Charge')]: 39,
  [norm('Public Relation')]: 40,
  [norm('Publication Cost')]: 41,
  [norm('Permits')]: 42,
  [norm('Telephone')]: 43,
  [norm('Trade fairs & exhibitions')]: 44,
  [norm('Training and Development')]: 45,
  [norm('Transport of supplies')]: 46,
  [norm('Utilities')]: 47,
  [norm('Website Design & Maintenance')]: 48,
  [norm('Software maintenance')]: 49,
  [norm('Cleaning & Janitory Services')]: 50,
  [norm('Corporate promotion')]: 51,
  [norm('Freight & Transport Expenses')]: 52,
  [norm('Subscription & Dues')]: 53,
  [norm('Sponsorship')]: 54,
  [norm('Stationeries expenses')]: 55,
  [norm('other professional fees')]: 56,
  [norm('Fines')]: 57,
  [norm('penalties')]: 58,
  [norm('AMCON charges')]: 59,
  [norm('Realized foreign exchange loss')]: 60,
  [norm('Corporate Social Responsibilities')]: 61,
  [norm('Royalties')]: 62,
  [norm('Electricity & Power')]: 63,
  [norm('PMS')]: 64,
  [norm('Health, safety and environmental expenses')]: 65,
  [norm('Licences & leases charges')]: 66,
  [norm('Other statutory charges & levies')]: 67,
  [norm('AGO-Diesel')]: 68,
  [norm('Travel Expenses')]: 69,
  [norm('Others')]: 70,
};

const SFP_INVESTMENTS_MAP: Record<string, number> = {
  [norm('Investment in securities')]: 10,
  [norm('Investment in stock and bonds')]: 11,
  [norm('Investment in Properties')]: 12,
  [norm('Investment in Associate & Joint Ventures')]: 13,
  [norm('Investment in Subsidiaries')]: 14,
  [norm('Investment in finance lease')]: 15,
  [norm('Investment in staff loan')]: 16,
  [norm('Investment in digital assets')]: 17,
  [norm('Investment in Commodities')]: 18,
  [norm('Others')]: 19,
};

const SFP_INTANGIBLE_MAP: Record<string, number> = {
  [norm('Goodwill')]: 21,
  [norm('Patent')]: 22,
  [norm('Trademarks')]: 23,
  [norm('Terminal and service concession rights')]: 24,
  [norm('Brands')]: 25,
  [norm('Customer relationships')]: 26,
  [norm('Right of use')]: 27,
  [norm('Copyrights')]: 28,
  [norm('Others')]: 29,
};

const SFP_OTHER_NON_CURRENT_MAP: Record<string, number> = {
  [norm('Lease-hold Land')]: 31,
  [norm('Lease-hold Building')]: 32,
  [norm('Building and Real estate lease')]: 33,
  [norm('Other leases')]: 34,
  [norm('Non-Current Assets Held for Sale')]: 35,
  [norm('Contract assets')]: 36,
  [norm('Deferred tax asset')]: 37,
  [norm('Other financial assets')]: 38,
  [norm('Derivative financial instruments')]: 39,
  [norm('Long-term borrowings and debts')]: 40,
  [norm('Defined Benefits Assets')]: 41,
  [norm('Others')]: 42,
};

const SFP_OTHER_CURRENT_ASSETS_MAP: Record<string, number> = {
  [norm('Other Interbank Advances')]: 50,
  [norm('Withholding tax receivables')]: 51,
  [norm('Other receivables')]: 52,
  [norm('Current portion of Long Term Loan')]: 53,
  [norm('Short Term Investments')]: 54,
  [norm('Accrued Income')]: 55,
  [norm('Asset classified as held for sale')]: 56,
  [norm('Advance payment to vendor')]: 57,
  [norm('Prepaid Expenses')]: 58,
  [norm('Small Tools')]: 59,
  [norm('Goods in transit')]: 60,
  [norm('chemicals, materials supplies')]: 61,
  [norm('chemical, materials supplies and others')]: 61,
  [norm('Others')]: 62,
};

const SFP_CASH_MAP: Record<string, number> = {
  [norm('Cash in hand')]: 64,
  [norm('Cash at Bank')]: 65,
  [norm('marketable securities')]: 66,
  [norm('Others')]: 67,
};

const SFP_CURRENT_LIAB_MAP: Record<string, number> = {
  [norm('Trade Payables')]: 73,
  [norm('Current tax liabilities')]: 74,
};

const SFP_OTHER_CURRENT_LIAB_MAP: Record<string, number> = {
  [norm('Other payables')]: 76,
  [norm('Financial liabilities')]: 77,
  [norm('Accruals')]: 78,
  [norm('Unearned income (advance from customers)')]: 79,
  [norm('Interest payable')]: 80,
  [norm('Short-term debt')]: 81,
  [norm('Provision for warranty expense')]: 82,
  [norm('provisions for warranty expenses')]: 82,
  [norm('Provision for bonuses and employee benefits')]: 83,
  [norm('Current portion of lease liability')]: 84,
  [norm('Current portion of long-term debt')]: 85,
  [norm('Dividend payable')]: 86,
  [norm('Provisions')]: 87,
  [norm('Income taxes payable')]: 89,
  [norm('Decommissioning and other provisions')]: 90,
  [norm('Others')]: 92,
};

const SFP_NON_CURRENT_LIAB_MAP: Record<string, number> = {
  [norm('Long Term Debt')]: 95,
  [norm('Long term Borrowings')]: 96,
  [norm('Pension and Employee Benefit obligations')]: 97,
  [norm('Deferred Revenue (Long Term Portion)')]: 98,
  [norm('Contingent Liability (Long Term Provision)')]: 99,
  [norm('Employees Benefits obligations')]: 100,
  [norm('Non-current Portion of Lease Obligation')]: 101,
  [norm('Deferred Tax Liabilities')]: 102,
  [norm('Stock warrant obligations')]: 103,
  [norm('Debt Securities')]: 104,
  [norm('Lease liabilities')]: 105,
  [norm('Derivaties liabilities held for risk Management')]: 106,
  [norm('Deposit from Customers')]: 107,
  [norm('Retirement benefits')]: 108,
  [norm('Derivative financial instruments liabilities')]: 109,
  [norm('Others')]: 110,
};

const SFP_EQUITY_MAP: Record<string, number> = {
  [norm('Issued Share Capital')]: 112,
  [norm('Share premium')]: 113,
  [norm('Retained earnings')]: 114,
  [norm('Revaluation reserve')]: 115,
  [norm('Statutory reserve')]: 116,
  [norm('Non-controlling interest')]: 117,
};

const SFP_OTHER_RESERVES_MAP: Record<string, number> = {
  [norm('Contigency reserve')]: 119,
  [norm('Contingency reserve')]: 119,
  [norm('Cumulative Translation Adjustment')]: 120,
  [norm('Share based payment reserve')]: 121,
  [norm('Reserve for bonus issue')]: 122,
  [norm('Capital reserve')]: 123,
  [norm('Other reserves')]: 124,
  [norm('Equity contribution to shareholders/ Equity holders')]: 125,
};

const ADDBACKS_MAP: Record<string, number> = {
  [norm('Depreciation')]: 13,
  [norm('Expenses Related To Exempt Income')]: 14,
  [norm('Donations (To The Extent Not Allowed)')]: 15,
  [norm('Unrealised Foreign Exchange Loss')]: 16,
  [norm('Loss On Disposal Of Fixed Assets')]: 17,
  [norm('Entertainment Expenses (To The Extent Not Allowed)')]: 18,
  [norm('Capital Repaid/Withdrawn')]: 19,
  [norm('Expenses of Capital Nature')]: 20,
  [norm('Expenditure on assets not used for the purpose of trade')]: 21,
  [norm('Sum recoverable under an insurance or contract of indemnity')]: 22,
  [norm('Taxes on Profit or Incomes')]: 23,
  [norm('Payment to any unapproved retirement fund or scheme under the Pension Reform Act.')]: 24,
  [norm('Any sum reserved out of profits subject to the provisions of section 20(1)(h) of this Act')]: 25,
  [norm('Any payment to a related party that contravenes the Transfer Pricing Regulations.')]: 26,
  [norm('Any expense incurred in deriving an income that is exempt from income tax')]: 27,
  [norm('Any expense allowable as a deduction in determining chargeable gains')]: 28,
  [norm('Penalty or fine imposed under any law')]: 29,
  [norm('Expenses liable to VAT or import duties but not charged or paid')]: 30,
  [norm('Compensating payments in regulated securities lending that qualify as dividends or interest under this Act')]: 31,
  [norm('Others')]: 32,
};

const DEDUCTIONS_MAP: Record<string, number> = {
  [norm('Deduct Non Taxable Items')]: 36,
  [norm('Profit From Sales Of Fixed Assets')]: 37,
  [norm('Frank Investment Income')]: 38,
  [norm('Unrealised Gains')]: 39,
  [norm('Others')]: 40,
};

/**
 * Loads the original template binary, updates only sheet cell values via JSZip,
 * and outputs the completed .xlsx buffer without altering any table or structural files.
 */
export async function populateCitExcel(
  templateBytes: ArrayBuffer,
  data: Record<string, unknown>,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(templateBytes);

  const year = String((data.year as string) || '');
  const cos = (data.cos as Record<string, Record<string, string>>) || {};
  const sfp = (data.sfp as Record<string, unknown>) || {};
  const computed = (data.computed as Record<string, string>) || {};
  const sectorRevenues = (data.sector_revenues as Record<string, string>) || {};

  // ── 1. USER_INPUT (sheet2.xml) ─────────────────────────────────────────────
  const userInputPath = 'xl/worksheets/sheet2.xml';
  let userInputXml = await zip.file(userInputPath)?.async('text');
  if (userInputXml && year) {
    const y = parseInt(year);
    if (!isNaN(y)) {
      userInputXml = setCellValue(userInputXml, 'C5', y);
      userInputXml = setCellValue(userInputXml, 'D7', y - 1);
      zip.file(userInputPath, userInputXml);
    }
  }

  // ── 2. INCOME_STATEMENT (sheet3.xml) ───────────────────────────────────────
  const incStmtPath = 'xl/worksheets/sheet3.xml';
  let incStmtXml = await zip.file(incStmtPath)?.async('text');
  if (incStmtXml) {
    // Sector revenue: if multi-sector revenues provided, write each to its corresponding row in Col D
    const secEntries = Object.entries(sectorRevenues);
    if (secEntries.length > 0) {
      for (const [secName, secVal] of secEntries) {
        const val = parseFloat(secVal);
        if (val > 0) {
          const row = SECTOR_ROW_MAP[norm(secName)] ?? 27;
          incStmtXml = setCellValue(incStmtXml, `D${row}`, val);
        }
      }
    } else {
      // Fallback to single revenue
      const rev = parseFloat((data.revenue as string) || '0') || 0;
      if (rev > 0) {
        const singleSec = norm((data.sector as string) || '');
        const row = SECTOR_ROW_MAP[singleSec] ?? 27;
        incStmtXml = setCellValue(incStmtXml, `D${row}`, rev);
      }
    }

    // Cost of Sales
    if (cos.opening_inventory) incStmtXml = writeByMap(incStmtXml, cos.opening_inventory, 'D', COS_OPENING_INV_MAP);
    if (cos.purchases) incStmtXml = writeByMap(incStmtXml, cos.purchases, 'D', COS_PURCHASES_MAP);
    if (cos.other_direct_cost) incStmtXml = writeByMap(incStmtXml, cos.other_direct_cost, 'D', COS_DIRECT_COST_MAP);
    if (cos.factory_overheads) incStmtXml = writeByMap(incStmtXml, cos.factory_overheads, 'D', COS_OVERHEADS_MAP);
    if (cos.closing_inventory) incStmtXml = writeByMap(incStmtXml, cos.closing_inventory, 'D', COS_CLOSING_INV_MAP);

    zip.file(incStmtPath, incStmtXml);
  }

  // ── 3. OTHER_INCOME (sheet6.xml) ───────────────────────────────────────────
  const otherIncomePath = 'xl/worksheets/sheet6.xml';
  let otherIncomeXml = await zip.file(otherIncomePath)?.async('text');
  if (otherIncomeXml && data.other_income) {
    otherIncomeXml = writeByMap(otherIncomeXml, data.other_income as Record<string, string>, 'D', OTHER_INCOME_MAP);
    zip.file(otherIncomePath, otherIncomeXml);
  }

  // ── 4. ADMINISTRATIVE_EXPENSES (sheet7.xml) ───────────────────────────────
  const adminPath = 'xl/worksheets/sheet7.xml';
  let adminXml = await zip.file(adminPath)?.async('text');
  if (adminXml && data.admin) {
    adminXml = writeByMap(adminXml, data.admin as Record<string, string>, 'C', ADMIN_EXPENSES_MAP);
    zip.file(adminPath, adminXml);
  }

  // ── 5. STATEMENT_OF_FINANCIAL_POSITION (sheet4.xml) ────────────────────────
  const sfpPath = 'xl/worksheets/sheet4.xml';
  let sfpXml = await zip.file(sfpPath)?.async('text');
  if (sfpXml) {
    // PPE (D8)
    const ppe = parseFloat((sfp.properties_plant_equipment as string) || '0');
    if (ppe > 0) sfpXml = setCellValue(sfpXml, 'D8', ppe);

    // Investments (D10:D19)
    if (sfp.investments) sfpXml = writeByMap(sfpXml, sfp.investments as Record<string, string>, 'D', SFP_INVESTMENTS_MAP);

    // Intangibles (D21:D29)
    if (sfp.intangible_assets) sfpXml = writeByMap(sfpXml, sfp.intangible_assets as Record<string, string>, 'D', SFP_INTANGIBLE_MAP);

    // Other non-current (D31:D42)
    if (sfp.other_non_current_assets) sfpXml = writeByMap(sfpXml, sfp.other_non_current_assets as Record<string, string>, 'D', SFP_OTHER_NON_CURRENT_MAP);

    // Inventories (D46)
    const inv = parseFloat((sfp.inventories as string) || '0');
    if (inv > 0) sfpXml = setCellValue(sfpXml, 'D46', inv);

    // Trade receivables (D48)
    const rec = parseFloat((sfp.trade_receivables as string) || '0');
    if (rec > 0) sfpXml = setCellValue(sfpXml, 'D48', rec);

    // Other current assets (D50:D62)
    if (sfp.other_current_assets) sfpXml = writeByMap(sfpXml, sfp.other_current_assets as Record<string, string>, 'D', SFP_OTHER_CURRENT_ASSETS_MAP);

    // Cash and equivalents (D64:D67)
    if (sfp.cash_and_cash_equivalents) sfpXml = writeByMap(sfpXml, sfp.cash_and_cash_equivalents as Record<string, string>, 'D', SFP_CASH_MAP);

    // Current liabilities (D73, D74)
    if (sfp.current_liabilities) sfpXml = writeByMap(sfpXml, sfp.current_liabilities as Record<string, string>, 'D', SFP_CURRENT_LIAB_MAP);

    // Other current liabilities (D76:D92)
    if (sfp.other_current_liabilities) sfpXml = writeByMap(sfpXml, sfp.other_current_liabilities as Record<string, string>, 'D', SFP_OTHER_CURRENT_LIAB_MAP);

    // Non-current liabilities (D95:D110)
    if (sfp.non_current_liabilities) sfpXml = writeByMap(sfpXml, sfp.non_current_liabilities as Record<string, string>, 'D', SFP_NON_CURRENT_LIAB_MAP);

    // Equity (D112:D117)
    if (sfp.equity) sfpXml = writeByMap(sfpXml, sfp.equity as Record<string, string>, 'D', SFP_EQUITY_MAP);

    // Retained earnings (D114) — auto-fill from computed profit if not entered
    const userRetained = (sfp.equity as Record<string, string>)?.[`Retained earnings`];
    if (!userRetained) {
      const pfy = parseFloat(computed.profit_for_year || '0');
      if (pfy > 0) sfpXml = setCellValue(sfpXml, 'D114', pfy);
    }

    // Other reserves (D119:D125)
    if (sfp.other_reserves) sfpXml = writeByMap(sfpXml, sfp.other_reserves as Record<string, string>, 'D', SFP_OTHER_RESERVES_MAP);

    zip.file(sfpPath, sfpXml);
  }

  // ── 6. PROFIT_ADJUSTMENT (sheet5.xml) ──────────────────────────────────────
  const profitAdjPath = 'xl/worksheets/sheet5.xml';
  let profitAdjXml = await zip.file(profitAdjPath)?.async('text');
  if (profitAdjXml) {
    if (data.addbacks) profitAdjXml = writeByMap(profitAdjXml, data.addbacks as Record<string, string>, 'D', ADDBACKS_MAP);
    if (data.deductions) profitAdjXml = writeByMap(profitAdjXml, data.deductions as Record<string, string>, 'D', DEDUCTIONS_MAP);
    zip.file(profitAdjPath, profitAdjXml);
  }

  // Generate output xlsx buffer with zero zip structure alterations
  return await zip.generateAsync({ type: 'uint8array' });
}
