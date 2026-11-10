import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { uploadAndOcrDocument } from './aiMediaService';
import { autoDetectMapping, mapAndValidateRows, parseCSVText } from './statementParser';
import { getCategoryRule } from './accountingRules';
import { CATEGORY_ID_TO_COA_CODE, CATEGORY_ID_TO_NRS_ADMIN_LABEL, COA_BY_CODE } from './standardCoa';
import { resolveBankGlCode, type IntakeAccountingEntry } from './financialStatementEngine';
import type {
  CoaOpeningBalance,
  FinancialStatementProfile,
  FixedAssetDisposalRecord,
  FixedAssetRecord,
  TaxCarryforwardRecord,
  TaxIntakeSession,
  WhtCreditNoteRecord,
} from './supabase';

export type RawEvidenceRow = {
  id: string;
  date: string;
  description: string;
  amount: number;
  direction: 'income' | 'expense' | 'transfer';
  source: 'bank_statement' | 'receipt_ocr';
  sourceFileName?: string;
};

export type DocumentIdentificationSummary = {
  fileName: string;
  documentType: string;
  reportingPeriod: string | null;
  rowCount: number;
  openingBalance: number | null;
  closingBalance: number | null;
  totalCredits: number;
  totalDebits: number;
  reconciles: boolean | null;
  discrepancyAmount: number;
  warnings: string[];
};

export type AiConversionReport = {
  entries: IntakeAccountingEntry[];
  questionsForUser: { entryId: string; question: string; amount: number; date: string }[];
  duplicatesDetected: string[];
  missingDocuments: string[];
  adjustmentsIdentified: string[];
  qualityControlSummary: {
    extractionReview: string;
    accountingReview: string;
    discrepancies: string[];
  } | null;
  usedFallback: boolean;
};

/** Parse Excel (.xlsx / .xls) or CSV into raw text (for Financial Statements) or normalized bank rows */
export async function readSpreadsheetFile(file: File): Promise<{
  csvRows: Record<string, string>[];
  headers: string[];
  rawText: string;
}> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || file.type === 'text/csv') {
    const text = await file.text();
    const { headers, data } = parseCSVText(text);
    return { csvRows: data, headers, rawText: text };
  }

  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const textParts: string[] = [];
  let firstRows: Record<string, string>[] = [];
  let firstHeaders: string[] = [];

  wb.SheetNames.forEach((name, idx) => {
    const ws = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(ws);
    textParts.push(`--- SHEET: ${name} ---\n${csv}`);
    if (idx === 0) {
      const parsed = parseCSVText(csv);
      firstHeaders = parsed.headers;
      firstRows = parsed.data;
    }
  });

  return {
    csvRows: firstRows,
    headers: firstHeaders,
    rawText: textParts.join('\n\n'),
  };
}

/** Extract text from PDF / Image / Spreadsheet file using OCR or SheetJS */
export async function extractDocumentText(file: File): Promise<{
  text: string;
  parsedReceipt?: { merchant?: string | null; totalAmount?: number | null; date?: string | null; documentType: string };
}> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const { rawText } = await readSpreadsheetFile(file);
    return { text: rawText };
  }

  // Image or PDF -> try documentOCR first
  try {
    const ocr = await uploadAndOcrDocument(file);
    return {
      text: ocr.extractedText,
      parsedReceipt: ocr.parsedData,
    };
  } catch (err) {
    // Fallback for plain text-embedded PDFs if OCR API is unavailable offline
    if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
      const raw = await file.text();
      const cleaned = raw
        .replace(/[^\x20-\x7E\n\r]/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      if (cleaned.length > 40) {
        return { text: cleaned };
      }
    }
    throw err;
  }
}

/** Parse a Bank Statement file (CSV, XLSX, PDF, or Image) into RawEvidenceRow[] + Stage 1-3 Document Summary */
export async function parseBankStatementEvidence(
  file: File,
  userId?: string
): Promise<{ rows: RawEvidenceRow[]; documentInfo: DocumentIdentificationSummary }> {
  const lower = file.name.toLowerCase();

  // 1. Structured CSV / Excel path
  if (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const { headers, csvRows } = await readSpreadsheetFile(file);
    if (csvRows.length === 0) {
      return {
        rows: [],
        documentInfo: {
          fileName: file.name,
          documentType: 'Bank statement (Spreadsheet)',
          reportingPeriod: null,
          rowCount: 0,
          openingBalance: null,
          closingBalance: null,
          totalCredits: 0,
          totalDebits: 0,
          reconciles: null,
          discrepancyAmount: 0,
          warnings: ['No rows detected in spreadsheet.'],
        },
      };
    }
    const mapping = autoDetectMapping(headers);
    const validated = mapAndValidateRows(csvRows, mapping, []);
    const rows: RawEvidenceRow[] = validated
      .filter((r) => !r.validationError && r.amount > 0)
      .map((r, i) => ({
        id: `bs_${file.name}_${i}_${Date.now()}`,
        date: r.date,
        description: r.description,
        amount: r.amount,
        direction: r.type === 'credit' ? 'income' : 'expense',
        source: 'bank_statement',
        sourceFileName: file.name,
      }));
    const totalCredits = rows.filter((r) => r.direction === 'income').reduce((s, r) => s + r.amount, 0);
    const totalDebits = rows.filter((r) => r.direction === 'expense').reduce((s, r) => s + r.amount, 0);
    const dates = rows.map((r) => r.date).filter(Boolean).sort();
    return {
      rows,
      documentInfo: {
        fileName: file.name,
        documentType: 'Bank statement (CSV/Excel)',
        reportingPeriod: dates.length > 0 ? `${dates[0]} to ${dates[dates.length - 1]}` : null,
        rowCount: rows.length,
        openingBalance: null,
        closingBalance: null,
        totalCredits,
        totalDebits,
        reconciles: null,
        discrepancyAmount: 0,
        warnings: [],
      },
    };
  }

  // 2. PDF / Image bank statement -> OCR + DeepSeek row extraction
  const { text } = await extractDocumentText(file);
  const { data, error } = await supabase.functions.invoke('ai-tax-intake', {
    body: { mode: 'extract_bank_statement_rows', rawText: text, fileName: file.name, userId },
  });

  if (!error && Array.isArray(data?.rows) && data.rows.length > 0) {
    const rows: RawEvidenceRow[] = data.rows.map((r: any, i: number) => ({
      id: `bs_pdf_${i}_${Date.now()}`,
      date: r.date || new Date().toISOString().split('T')[0],
      description: r.description || 'Bank statement transaction',
      amount: Math.abs(Number(r.amount) || 0),
      direction: r.direction === 'income' ? 'income' : r.direction === 'transfer' ? 'transfer' : 'expense',
      source: 'bank_statement',
      sourceFileName: file.name,
    }));
    const docId = data.documentIdentification || {};
    return {
      rows,
      documentInfo: {
        fileName: file.name,
        documentType: docId.documentType || 'Bank statement (PDF/Image)',
        reportingPeriod: docId.reportingPeriod || null,
        rowCount: rows.length,
        openingBalance: docId.openingBalance ?? null,
        closingBalance: docId.closingBalance ?? null,
        totalCredits: docId.totalCredits ?? rows.filter((r) => r.direction === 'income').reduce((s, r) => s + r.amount, 0),
        totalDebits: docId.totalDebits ?? rows.filter((r) => r.direction === 'expense').reduce((s, r) => s + r.amount, 0),
        reconciles: docId.reconciles ?? null,
        discrepancyAmount: docId.discrepancyAmount ?? 0,
        warnings: docId.missingPeriodsOrWarnings || [],
      },
    };
  }

  // Lightweight regex fallback if edge function unreachable
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 5);
  const fallbackRows: RawEvidenceRow[] = [];
  lines.forEach((line, idx) => {
    const amtMatch = line.match(/([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/);
    if (!amtMatch) return;
    const amt = parseFloat(amtMatch[1].replace(/,/g, ''));
    if (!amt || amt <= 0) return;
    const isCr = /\b(cr|credit|deposit|inflow)\b/i.test(line);
    fallbackRows.push({
      id: `bs_rx_${idx}_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      description: line.slice(0, 120),
      amount: amt,
      direction: isCr ? 'income' : 'expense',
      source: 'bank_statement',
      sourceFileName: file.name,
    });
  });

  return {
    rows: fallbackRows,
    documentInfo: {
      fileName: file.name,
      documentType: 'Bank statement (OCR Fallback)',
      reportingPeriod: null,
      rowCount: fallbackRows.length,
      openingBalance: null,
      closingBalance: null,
      totalCredits: fallbackRows.filter((r) => r.direction === 'income').reduce((s, r) => s + r.amount, 0),
      totalDebits: fallbackRows.filter((r) => r.direction === 'expense').reduce((s, r) => s + r.amount, 0),
      reconciles: null,
      discrepancyAmount: 0,
      warnings: ['Extracted using fallback text parser; please verify balances against original PDF/image.'],
    },
  };
}

/** Parse a Receipt / Invoice Image or PDF into RawEvidenceRow */
export async function parseReceiptEvidence(file: File): Promise<RawEvidenceRow> {
  const { text, parsedReceipt } = await extractDocumentText(file);
  const amt = Number(parsedReceipt?.totalAmount || 0);
  const merchant = parsedReceipt?.merchant || file.name.replace(/\.[^.]+$/, '');
  const snippet = text.replace(/\s+/g, ' ').slice(0, 140);
  const isIncome = parsedReceipt?.documentType === 'invoice' && /issued|customer|sales/i.test(text);

  return {
    id: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    date: parsedReceipt?.date || new Date().toISOString().split('T')[0],
    description: `${merchant}${snippet ? ` — ${snippet}` : ''}`,
    amount: amt > 0 ? amt : 0,
    direction: isIncome ? 'income' : 'expense',
    source: 'receipt_ocr',
    sourceFileName: file.name,
  };
}

/** Local deterministic fallback if ai-tax-intake Edge Function is offline */
function clientFallbackConvert(items: RawEvidenceRow[], defaultBankCode = '1020'): IntakeAccountingEntry[] {
  return items.map((item) => {
    const rule = getCategoryRule('', item.direction, item.description);
    const coaCode = CATEGORY_ID_TO_COA_CODE[rule.id] || '9999';
    const isSuspense = coaCode === '9999' || item.amount <= 0;
    const finalCoa = isSuspense ? '9999' : coaCode;
    const coaDef = COA_BY_CODE[finalCoa];
    const bankCode = resolveBankGlCode(null) || defaultBankCode;
    const isPpe = rule.id === 'cat_out_ppe';

    return {
      id: item.id,
      date: item.date,
      description: item.description,
      amount: item.amount,
      direction: item.direction,
      debitCode: item.direction === 'income' ? bankCode : item.direction === 'expense' ? finalCoa : '1030',
      creditCode: item.direction === 'income' ? finalCoa : item.direction === 'expense' ? bankCode : bankCode,
      nrsSection: coaDef?.nrsSection || 'none',
      nrsLabel: CATEGORY_ID_TO_NRS_ADMIN_LABEL[rule.id] || coaDef?.nrsDefaultLabel,
      taxTreatment: isSuspense
        ? 'suspense'
        : rule.id === 'cat_out_fines'
          ? 'non_deductible_addback'
          : isPpe
            ? 'capital'
            : 'allowable',
      isFixedAssetCandidate: isPpe,
      assetClass: isPpe ? 'Computer & IT Infrastructure' : undefined,
      confidence: isSuspense ? 0.45 : 0.85,
      clarificationQuestion: isSuspense
        ? `Please clarify "${item.description}" (₦${item.amount.toLocaleString()}) so we can classify it out of Account 9999.`
        : null,
      resolutionStatus: isSuspense ? 'Unresolved' : 'Resolved',
      source: item.source,
    };
  });
}

/** Batch-convert raw evidence rows into double-entry accounting entries + Stage 1-10 Audit Report via DeepSeek Edge Function */
export async function convertEvidenceToAccountingEntries(
  items: RawEvidenceRow[],
  businessContext: string,
  defaultBankCode = '1020',
  options: {
    customInstructions?: string;
    clarificationAnswers?: Record<string, string>;
    documentSummaries?: DocumentIdentificationSummary[];
  } = {}
): Promise<AiConversionReport> {
  if (items.length === 0) {
    return {
      entries: [],
      questionsForUser: [],
      duplicatesDetected: [],
      missingDocuments: [],
      adjustmentsIdentified: [],
      qualityControlSummary: null,
      usedFallback: false,
    };
  }

  const chunkSize = 50;
  const allEntries: IntakeAccountingEntry[] = [];
  const allQuestions: { entryId: string; question: string; amount: number; date: string }[] = [];
  const duplicatesDetected: string[] = [];
  const missingDocuments: string[] = [];
  const adjustmentsIdentified: string[] = [];
  let qcSummary: AiConversionReport['qualityControlSummary'] = null;
  let usedFallback = false;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    try {
      const { data, error } = await supabase.functions.invoke('ai-tax-intake', {
        body: {
          mode: 'convert_evidence_to_entries',
          items: chunk,
          businessContext,
          defaultBankCode,
          customInstructions: options.customInstructions,
          clarificationAnswers: options.clarificationAnswers,
          documentSummaries: options.documentSummaries,
        },
      });
      if (error || !Array.isArray(data?.entries) || data.entries.length === 0) {
        usedFallback = true;
        const fb = clientFallbackConvert(chunk, defaultBankCode);
        allEntries.push(...fb);
        fb.filter((e) => e.resolutionStatus === 'Unresolved' && e.clarificationQuestion).forEach((e) => {
          allQuestions.push({ entryId: e.id, question: e.clarificationQuestion!, amount: e.amount, date: e.date });
        });
      } else {
        if (data.fallback) usedFallback = true;
        allEntries.push(...data.entries);
        if (Array.isArray(data.questionsForUser)) allQuestions.push(...data.questionsForUser);
        if (Array.isArray(data.duplicatesDetected)) duplicatesDetected.push(...data.duplicatesDetected);
        if (Array.isArray(data.missingDocuments)) missingDocuments.push(...data.missingDocuments);
        if (Array.isArray(data.adjustmentsIdentified)) adjustmentsIdentified.push(...data.adjustmentsIdentified);
        if (data.qualityControlSummary) qcSummary = data.qualityControlSummary;
      }
    } catch {
      usedFallback = true;
      const fb = clientFallbackConvert(chunk, defaultBankCode);
      allEntries.push(...fb);
      fb.filter((e) => e.resolutionStatus === 'Unresolved' && e.clarificationQuestion).forEach((e) => {
        allQuestions.push({ entryId: e.id, question: e.clarificationQuestion!, amount: e.amount, date: e.date });
      });
    }
  }

  return {
    entries: allEntries,
    questionsForUser: allQuestions,
    duplicatesDetected: Array.from(new Set(duplicatesDetected)),
    missingDocuments: Array.from(new Set(missingDocuments)),
    adjustmentsIdentified: Array.from(new Set(adjustmentsIdentified)),
    qualityControlSummary: qcSummary,
    usedFallback,
  };
}

/** Branch A: Parse uploaded Financial Statement file via DeepSeek */
export async function parseUploadedFinancialStatement(file: File, fiscalYear: number, customInstructions?: string) {
  if (file.name.toLowerCase().endsWith('.json')) {
    const rawJson = await file.text();
    return JSON.parse(rawJson);
  }
  const { text } = await extractDocumentText(file);
  const { data, error } = await supabase.functions.invoke('ai-tax-intake', {
    body: { mode: 'parse_financial_statement', rawText: text, fiscalYear, customInstructions },
  });
  if (error) throw new Error(error.message);
  return data?.extracted || {};
}

// ── Persistence Helpers (Supabase with localStorage graceful fallback) ────────

const lsKey = (table: string, userId: string, year?: number) =>
  `rova_${table}_${userId}${year ? `_${year}` : ''}`;

export async function loadTaxWorkspaceData(userId: string, fiscalYear: number) {
  const defaultProfile: FinancialStatementProfile = {
    user_id: userId,
    fiscal_year: fiscalYear,
    company_legal_name: '',
    rc_number: '',
    tin: '',
    fy_start_date: `${fiscalYear}-01-01`,
    fy_end_date: `${fiscalYear}-12-31`,
    prior_year_end_date: `${fiscalYear - 1}-12-31`,
    reporting_currency: 'Nigerian Naira (₦)',
    currency_symbol: '₦',
    nature_of_business: '',
    sector: '',
    accounting_framework: 'IFRS',
    tax_regime: 'Nigeria Tax Act 2025 & NTAA 2025',
    tax_authority: 'Nigeria Revenue Service (NRS)',
    audit_status: 'Exempt under CAMA 2020',
    auditor_firm: 'N/A',
    auditor_partner: 'N/A',
    auditor_frc: 'N/A',
    audit_opinion: 'N/A',
    director_1: '',
    director_2: '',
    cfo_name: '',
    cfo_frc: '',
    approval_date: `${fiscalYear + 1}-03-25`,
    small_turnover_threshold: 100_000_000,
    small_asset_threshold: 250_000_000,
    professional_services_flag: false,
    cit_rate_small: 0,
    cit_rate_standard: 0.275,
    dev_levy_rate: 0.04,
    vat_rate: 0.075,
    wht_rate_supplies: 0.05,
    wht_rate_services: 0.1,
    ca_restriction_cap: 0.6667,
  };

  const [profRes, obRes, faRes, dispRes, whtRes, cfRes, sessRes] = await Promise.all([
    supabase.from('financial_statement_profiles').select('*').eq('user_id', userId).eq('fiscal_year', fiscalYear).maybeSingle(),
    supabase.from('coa_opening_balances').select('*').eq('user_id', userId).eq('fiscal_year', fiscalYear),
    supabase.from('fixed_assets').select('*').eq('user_id', userId).order('date_acquired', { ascending: true }),
    supabase.from('fixed_asset_disposals').select('*').eq('user_id', userId),
    supabase.from('wht_credit_notes').select('*').eq('user_id', userId).eq('fiscal_year', fiscalYear),
    supabase.from('tax_carryforwards').select('*').eq('user_id', userId).eq('fiscal_year', fiscalYear).maybeSingle(),
    supabase.from('tax_intake_sessions').select('*').eq('user_id', userId).eq('fiscal_year', fiscalYear).maybeSingle(),
  ]);

  const readLs = <T,>(name: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(lsKey(name, userId, fiscalYear));
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  return {
    profile: (!profRes.error && profRes.data) ? profRes.data as FinancialStatementProfile : readLs('fs_profile', defaultProfile),
    openingBalances: (!obRes.error && obRes.data) ? obRes.data as CoaOpeningBalance[] : readLs<CoaOpeningBalance[]>('coa_ob', []),
    fixedAssets: (!faRes.error && faRes.data) ? faRes.data as FixedAssetRecord[] : readLs<FixedAssetRecord[]>('fixed_assets', []),
    disposals: (!dispRes.error && dispRes.data) ? dispRes.data as FixedAssetDisposalRecord[] : readLs<FixedAssetDisposalRecord[]>('asset_disposals', []),
    whtCreditNotes: (!whtRes.error && whtRes.data) ? whtRes.data as WhtCreditNoteRecord[] : readLs<WhtCreditNoteRecord[]>('wht_credits', []),
    taxCarryforwards: (!cfRes.error && cfRes.data) ? cfRes.data as TaxCarryforwardRecord : readLs<TaxCarryforwardRecord | null>('tax_cf', null),
    intakeSession: (!sessRes.error && sessRes.data) ? sessRes.data as TaxIntakeSession : readLs<TaxIntakeSession | null>('tax_intake', null),
  };
}

export async function saveFsProfile(profile: FinancialStatementProfile) {
  localStorage.setItem(lsKey('fs_profile', profile.user_id, profile.fiscal_year), JSON.stringify(profile));
  await supabase.from('financial_statement_profiles').upsert(profile, { onConflict: 'user_id,fiscal_year' });
}

export async function saveIntakeSession(session: TaxIntakeSession) {
  localStorage.setItem(lsKey('tax_intake', session.user_id, session.fiscal_year), JSON.stringify(session));
  await supabase.from('tax_intake_sessions').upsert(session, { onConflict: 'user_id,fiscal_year' });
}

export async function saveFixedAssetsList(userId: string, fiscalYear: number, assets: FixedAssetRecord[]) {
  localStorage.setItem(lsKey('fixed_assets', userId, fiscalYear), JSON.stringify(assets));
  if (assets.length > 0) {
    await supabase.from('fixed_assets').upsert(assets);
  }
}

export async function saveWhtCreditNotesList(userId: string, fiscalYear: number, notes: WhtCreditNoteRecord[]) {
  localStorage.setItem(lsKey('wht_credits', userId, fiscalYear), JSON.stringify(notes));
  if (notes.length > 0) {
    await supabase.from('wht_credit_notes').upsert(notes);
  }
}

export async function saveOpeningBalancesList(userId: string, fiscalYear: number, balances: CoaOpeningBalance[]) {
  localStorage.setItem(lsKey('coa_ob', userId, fiscalYear), JSON.stringify(balances));
  if (balances.length > 0) {
    await supabase.from('coa_opening_balances').upsert(balances, { onConflict: 'user_id,fiscal_year,account_code' });
  }
}
