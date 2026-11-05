import type { PaymentTransaction, PaymentTransactionType, PaymentProviderStatus, StatementParsedRow } from '../types/payment';

export interface ColumnMapping {
  date: string;
  description: string;
  reference: string;
  amount: string;
  type?: string;
  credit?: string;
  debit?: string;
  counterparty?: string;
  status?: string;
}

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  detectedMapping: ColumnMapping;
  parsedRecords: StatementParsedRow[];
  totalRows: number;
}

/**
 * Split CSV text into rows and columns handling quotes
 */
export function parseCSVText(csvText: string): { headers: string[]; data: Record<string, string>[] } {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], data: [] };

  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(h => h.replace(/^["']|["']$/g, '').trim());

  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] !== undefined ? cols[idx].replace(/^["']|["']$/g, '').trim() : '';
    });
    data.push(row);
  }

  return { headers, data };
}

/**
 * Automatically inspects column names to detect field mapping
 */
export function autoDetectMapping(headers: string[]): ColumnMapping {
  const lower = headers.map(h => h.toLowerCase());

  const findHeader = (candidates: string[]): string => {
    for (const cand of candidates) {
      const idx = lower.findIndex(h => h === cand || h.includes(cand));
      if (idx !== -1) return headers[idx];
    }
    return '';
  };

  const dateCol = findHeader(['transaction date', 'trans date', 'value date', 'date', 'txn date', 'created_at', 'timestamp', 'time']);
  const descCol = findHeader(['narration', 'description', 'remarks', 'details', 'memo', 'particulars', 'summary']);
  const refCol = findHeader(['reference', 'trans ref', 'ref no', 'transaction id', 'txn ref', 'payment ref', 'ref', 'id']);
  const amtCol = findHeader(['transaction amount', 'amount', 'trans amount', 'val', 'net amount', 'total']);
  const typeCol = findHeader(['type', 'txn type', 'trans type', 'dr/cr', 'cr/dr', 'direction']);
  const creditCol = findHeader(['credit', 'inflow', 'deposit', 'cr']);
  const debitCol = findHeader(['debit', 'outflow', 'withdrawal', 'dr']);
  const counterpartyCol = findHeader(['counterparty', 'beneficiary', 'sender', 'customer', 'customer name', 'payer', 'party', 'source']);
  const statusCol = findHeader(['status', 'txn status', 'state']);

  return {
    date: dateCol || headers[0] || '',
    description: descCol || (headers[1] || ''),
    reference: refCol || (headers.find(h => h.toLowerCase().includes('ref')) || ''),
    amount: amtCol || '',
    type: typeCol,
    credit: creditCol,
    debit: debitCol,
    counterparty: counterpartyCol,
    status: statusCol,
  };
}

/**
 * Normalizes any date string (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, ISO) into YYYY-MM-DD
 */
export function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  const cleaned = raw.replace(/[T\s].*$/, '').trim();

  // YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(cleaned)) {
    const [y, m, d] = cleaned.split(/[-/]/);
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY (Nigerian / UK standard)
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/.test(cleaned)) {
    const [d, m, y] = cleaned.split(/[-/]/);
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Clean and parse numeric amount
 */
export function cleanAmount(raw: string): number {
  if (!raw) return 0;
  // Remove currency signs (₦, $, £, EUR, NGN, etc) and commas
  const cleaned = raw.replace(/[₦$£€A-Za-z,\s]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Process parsed raw rows with mapping and detect duplicates
 */
export function mapAndValidateRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  existingTransactions: PaymentTransaction[]
): StatementParsedRow[] {
  const existingRefs = new Set<string>();
  const existingKeys = new Set<string>();

  existingTransactions.forEach(t => {
    if (t.provider_reference) existingRefs.add(t.provider_reference.trim().toLowerCase());
    const key = `${t.amount}_${t.transaction_date.slice(0, 10)}_${(t.description || '').slice(0, 15).toLowerCase()}`;
    existingKeys.add(key);
  });

  return rows.map((row, index) => {
    const rawDate = mapping.date ? row[mapping.date] : '';
    const rawDesc = mapping.description ? row[mapping.description] : '';
    const rawRef = mapping.reference ? row[mapping.reference] : '';
    const rawAmt = mapping.amount ? row[mapping.amount] : '';
    const rawType = mapping.type ? row[mapping.type] : '';
    const rawCredit = mapping.credit ? row[mapping.credit] : '';
    const rawDebit = mapping.debit ? row[mapping.debit] : '';
    const rawCounterparty = mapping.counterparty ? row[mapping.counterparty] : '';
    const rawStatus = mapping.status ? row[mapping.status] : '';

    let amount = cleanAmount(rawAmt);
    let type: PaymentTransactionType = 'credit';

    if (rawCredit && cleanAmount(rawCredit) > 0) {
      amount = cleanAmount(rawCredit);
      type = 'credit';
    } else if (rawDebit && cleanAmount(rawDebit) > 0) {
      amount = cleanAmount(rawDebit);
      type = 'debit';
    } else if (rawType) {
      const lowerType = rawType.toLowerCase();
      if (lowerType.includes('debit') || lowerType.includes('dr') || lowerType.includes('outflow')) {
        type = 'debit';
      } else if (lowerType.includes('refund')) {
        type = 'refund';
      } else if (lowerType.includes('fee') || lowerType.includes('charge')) {
        type = 'fee';
      } else {
        type = 'credit';
      }
    } else if (rawAmt.trim().startsWith('-') || rawAmt.trim().startsWith('(')) {
      type = 'debit';
    }

    const normDate = normalizeDate(rawDate);
    const reference = rawRef ? rawRef.trim() : `IMP_${Date.now()}_${index + 1}`;
    const description = rawDesc ? rawDesc.trim() : 'Statement transaction';

    // Provider status
    let status: PaymentProviderStatus = 'success';
    if (rawStatus) {
      const s = rawStatus.toLowerCase();
      if (s.includes('fail')) status = 'failed';
      else if (s.includes('pend')) status = 'pending';
      else if (s.includes('refund')) status = 'refunded';
      else if (s.includes('revers')) status = 'reversed';
    }

    // Duplicate detection
    const isRefDuplicate = rawRef ? existingRefs.has(rawRef.trim().toLowerCase()) : false;
    const softKey = `${amount}_${normDate}_${description.slice(0, 15).toLowerCase()}`;
    const isSoftDuplicate = existingKeys.has(softKey);

    const isDuplicate = isRefDuplicate || isSoftDuplicate;
    const duplicateMatch = isDuplicate
      ? existingTransactions.find(t => (rawRef && t.provider_reference.toLowerCase() === rawRef.toLowerCase()) ||
          (Math.abs(t.amount - amount) < 0.01 && t.transaction_date.slice(0, 10) === normDate))
      : undefined;

    let validationError: string | undefined;
    if (amount <= 0) {
      validationError = 'Amount must be greater than 0';
    }

    return {
      rowNumber: index + 1,
      date: normDate,
      description,
      reference,
      amount,
      type,
      currency: 'NGN',
      counterpartyName: rawCounterparty ? rawCounterparty.trim() : undefined,
      status,
      isDuplicate,
      duplicateMatchId: duplicateMatch?.id,
      validationError,
    };
  });
}

