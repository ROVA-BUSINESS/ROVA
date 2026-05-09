/**
 * ROVA SMS Parser Engine
 * Automatically extracts transaction data from Nigerian bank & fintech SMS alerts.
 * Each rule matches a specific institution's SMS format.
 */

export type ParsedTransaction = {
  amount: number;
  type: 'income' | 'expense';
  balance: number | null;
  narration: string;
  institution: string;
  rawSms: string;
  date: Date;
};

type SmsRule = {
  institution: string;
  /** Patterns that must appear in sender address or SMS body to match this bank */
  senderPatterns: RegExp[];
  /** Extracts the transaction amount */
  amountRegex: RegExp;
  /** Determines debit vs credit */
  typeRegex: { debit: RegExp; credit: RegExp };
  /** Extracts available balance after transaction */
  balanceRegex: RegExp | null;
  /** Extracts transaction narration/description */
  narrationRegex: RegExp | null;
};

// ─── Institution Rules ────────────────────────────────────────────────────────

const SMS_RULES: SmsRule[] = [
  // GTBank
  {
    institution: 'GTBank',
    senderPatterns: [/gtbank/i, /guaranty/i, /gtb/i],
    amountRegex: /NGN\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit/i, credit: /credit/i },
    balanceRegex: /balance[:\s]+NGN\s?([\d,]+\.?\d*)/i,
    narrationRegex: /(?:for|narration)[:\s]+([^\n.]+)/i,
  },
  // Access Bank
  {
    institution: 'Access Bank',
    senderPatterns: [/access/i, /accessbank/i],
    amountRegex: /NGN\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit/i, credit: /credit/i },
    balanceRegex: /bal[:\s]+NGN\s?([\d,]+\.?\d*)/i,
    narrationRegex: /(?:desc|narr)[:\s]+([^\n.]+)/i,
  },
  // Zenith Bank
  {
    institution: 'Zenith Bank',
    senderPatterns: [/zenith/i, /zenithbank/i],
    amountRegex: /NGN\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit|dr/i, credit: /credit|cr/i },
    balanceRegex: /avail[^\d]*([\d,]+\.?\d*)/i,
    narrationRegex: /(?:remarks?|desc)[:\s]+([^\n.]+)/i,
  },
  // First Bank
  {
    institution: 'First Bank',
    senderPatterns: [/firstbank/i, /fbn/i],
    amountRegex: /NGN\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit|withdrawn/i, credit: /credit|deposit/i },
    balanceRegex: /balance[:\s]+([\d,]+\.?\d*)/i,
    narrationRegex: /(?:tran(?:s)?(?:action)?[:\s]+)([^\n.]+)/i,
  },
  // UBA
  {
    institution: 'UBA',
    senderPatterns: [/\buba\b/i, /united bank/i],
    amountRegex: /NGN\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit|dr/i, credit: /credit|cr/i },
    balanceRegex: /balance[:\s]+([\d,]+\.?\d*)/i,
    narrationRegex: /(?:for|narr)[:\s]+([^\n.]+)/i,
  },
  // Stanbic IBTC
  {
    institution: 'Stanbic IBTC',
    senderPatterns: [/stanbic/i, /stanbicibtc/i],
    amountRegex: /NGN\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit/i, credit: /credit/i },
    balanceRegex: /balance[:\s]+([\d,]+\.?\d*)/i,
    narrationRegex: /(?:ref|narr)[:\s]+([^\n.]+)/i,
  },
  // Fidelity Bank
  {
    institution: 'Fidelity Bank',
    senderPatterns: [/fidelity/i],
    amountRegex: /NGN\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit|dr/i, credit: /credit|cr/i },
    balanceRegex: /balance[:\s]+([\d,]+\.?\d*)/i,
    narrationRegex: /(?:for|desc)[:\s]+([^\n.]+)/i,
  },
  // Polaris Bank
  {
    institution: 'Polaris Bank',
    senderPatterns: [/polaris/i],
    amountRegex: /NGN\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit/i, credit: /credit/i },
    balanceRegex: /avail[^\d]*([\d,]+\.?\d*)/i,
    narrationRegex: /(?:narr|desc)[:\s]+([^\n.]+)/i,
  },
  // Sterling Bank
  {
    institution: 'Sterling Bank',
    senderPatterns: [/sterling/i],
    amountRegex: /NGN\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit|dr/i, credit: /credit|cr/i },
    balanceRegex: /balance[:\s]+([\d,]+\.?\d*)/i,
    narrationRegex: /(?:for|narr)[:\s]+([^\n.]+)/i,
  },
  // Wema / ALAT
  {
    institution: 'Wema Bank',
    senderPatterns: [/wema/i, /alat/i],
    amountRegex: /NGN\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit/i, credit: /credit/i },
    balanceRegex: /balance[:\s]+([\d,]+\.?\d*)/i,
    narrationRegex: /(?:desc|narr)[:\s]+([^\n.]+)/i,
  },
  // FCMB
  {
    institution: 'FCMB',
    senderPatterns: [/fcmb/i, /city micro/i],
    amountRegex: /NGN\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit/i, credit: /credit/i },
    balanceRegex: /balance[:\s]+([\d,]+\.?\d*)/i,
    narrationRegex: /(?:for|narr)[:\s]+([^\n.]+)/i,
  },
  // Kuda Bank
  {
    institution: 'Kuda Bank',
    senderPatterns: [/kuda/i],
    amountRegex: /(?:NGN|₦)\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /sent|debit|paid/i, credit: /received|credit/i },
    balanceRegex: /balance[:\s]+(?:NGN|₦)?\s?([\d,]+\.?\d*)/i,
    narrationRegex: /(?:to|from|for)[:\s]+([^\n.,]+)/i,
  },
  // Moniepoint
  {
    institution: 'Moniepoint',
    senderPatterns: [/moniepoint/i, /teamapt/i],
    amountRegex: /(?:NGN|₦)\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit|sent|paid/i, credit: /credit|received/i },
    balanceRegex: /balance[:\s]+(?:NGN|₦)?\s?([\d,]+\.?\d*)/i,
    narrationRegex: /(?:to|from|narr)[:\s]+([^\n.,]+)/i,
  },
  // OPay
  {
    institution: 'OPay',
    senderPatterns: [/opay/i, /opera/i],
    amountRegex: /(?:NGN|₦)\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /sent|paid|debit/i, credit: /received|credit/i },
    balanceRegex: /balance[:\s]+(?:NGN|₦)?\s?([\d,]+\.?\d*)/i,
    narrationRegex: /(?:to|from)[:\s]+([^\n.,]+)/i,
  },
  // PalmPay
  {
    institution: 'PalmPay',
    senderPatterns: [/palmpay/i],
    amountRegex: /(?:NGN|₦)\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /sent|paid|debit/i, credit: /received|credit/i },
    balanceRegex: /balance[:\s]+(?:NGN|₦)?\s?([\d,]+\.?\d*)/i,
    narrationRegex: /(?:to|from)[:\s]+([^\n.,]+)/i,
  },
  // VFD MFB
  {
    institution: 'VFD MFB',
    senderPatterns: [/vfd/i, /v-bank/i],
    amountRegex: /(?:NGN|₦)\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit|dr/i, credit: /credit|cr/i },
    balanceRegex: /balance[:\s]+([\d,]+\.?\d*)/i,
    narrationRegex: /(?:narr|desc)[:\s]+([^\n.]+)/i,
  },
  // Carbon (One Finance)
  {
    institution: 'Carbon',
    senderPatterns: [/carbon/i, /one finance/i],
    amountRegex: /(?:NGN|₦)\s?([\d,]+\.?\d*)/i,
    typeRegex: { debit: /debit|sent/i, credit: /credit|received/i },
    balanceRegex: /balance[:\s]+([\d,]+\.?\d*)/i,
    narrationRegex: /(?:to|from|for)[:\s]+([^\n.,]+)/i,
  },
];

// ─── Core Parser ─────────────────────────────────────────────────────────────

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

export function parseSms(smsBody: string, sender: string): ParsedTransaction | null {
  const fullText = `${sender} ${smsBody}`;

  // Find matching rule
  const rule = SMS_RULES.find(r =>
    r.senderPatterns.some(p => p.test(fullText))
  );

  if (!rule) return null;

  // Extract amount
  const amountMatch = rule.amountRegex.exec(smsBody);
  if (!amountMatch) return null;
  const amount = parseAmount(amountMatch[1]);
  if (isNaN(amount) || amount <= 0) return null;

  // Determine type
  const isDebit = rule.typeRegex.debit.test(smsBody);
  const isCredit = rule.typeRegex.credit.test(smsBody);
  if (!isDebit && !isCredit) return null;
  const type: 'income' | 'expense' = isDebit ? 'expense' : 'income';

  // Extract balance
  let balance: number | null = null;
  if (rule.balanceRegex) {
    const balMatch = rule.balanceRegex.exec(smsBody);
    if (balMatch) balance = parseAmount(balMatch[1]);
  }

  // Extract narration
  let narration = '';
  if (rule.narrationRegex) {
    const narrMatch = rule.narrationRegex.exec(smsBody);
    if (narrMatch) narration = narrMatch[1].trim();
  }
  if (!narration) narration = type === 'expense' ? 'Debit transaction' : 'Credit transaction';

  return {
    amount,
    type,
    balance,
    narration,
    institution: rule.institution,
    rawSms: smsBody,
    date: new Date(),
  };
}

export { SMS_RULES };
