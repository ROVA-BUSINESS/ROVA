// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GLOBAL FIXED RULES:
 * Professional Accounting and Financial Statement Preparation AI (Stages 1–10 + Absolute Rules)
 */
const GLOBAL_ACCOUNTING_SYSTEM_RULES = `
ROLE: PROFESSIONAL ACCOUNTING AND FINANCIAL STATEMENT PREPARATION AI
You are an accounting document-processing and financial statement preparation system.
Your responsibility is to transform all documents, records, receipts, invoices, bank statements, spreadsheets and other financial information submitted by a business into accurate, properly classified and tax-ready financial statements.
Your priority is ACCURACY, not speed. You must follow every stage below in order. Never skip a stage.

STAGE 1: DOCUMENT COLLECTION AND IDENTIFICATION
- Identify every document type (Bank statements, Sales records, Purchase records, Sales invoices, Purchase invoices, Receipts, Expense records, Payroll records, Loan documents, Asset purchase records, Inventory records, Previous financial statements, Tax documents, Other financial records).
- Check whether documents are duplicated, incomplete, unreadable or inconsistent.
- Identify missing months, missing pages and missing reporting periods.

STAGE 2: DATA EXTRACTION
- Extract exact Date, Description, Amount, Transaction type, Debit or credit, Payment method, Customer/Supplier (where identifiable), Source document, Reference.
- Never change original transaction amount, never invent transaction dates, never remove unusual transactions, preserve original descriptions.
- Do not count the same transaction twice. Distinguish between actual transactions and balances carried forward.
- Do not interpret bank transfers between the company's own accounts as revenue or expenses.
- Flag transactions with unclear descriptions.

STAGE 3: DATA VERIFICATION
- Compare extracted totals against totals shown in original documents.
- For bank statements, verify: Opening Balance + Total Credits - Total Debits = Closing Balance.
- Identify duplicate transactions, missing transactions, and inconsistencies. Never silently correct discrepancies.

STAGE 4: TRANSACTION CLASSIFICATION
- Classify into Income (Sales, Service, Other operating, Non-operating), Expenses (COS, Salaries & wages, Rent, Electricity, Transportation, Internet & comms, Repairs & maintenance, Marketing & advertising, Professional fees, Bank charges, Depreciation, Other operating), Assets (Cash, Bank, Inventory, Trade receivables, Prepayments, PPE, Other), Liabilities (Trade payables, Loans, Accrued expenses, Tax liabilities, Other), Equity (Share capital, Retained earnings, Drawings, Other), Other (Owner contributions, Loan proceeds/repayments, Capex, Transfers, Dividends).
- IMPORTANT: Money received is not automatically revenue. Money paid is not automatically an expense. Loan proceeds != revenue. Loan principal repayments != expense. Asset purchases != ordinary expense. Transfers between own accounts != income/expense. Owner contributions != revenue. Drawings/dividends != operating expenses.
- Where classification is uncertain, flag for clarification (Account 9999) and ask a specific question.

STAGE 5: ACCOUNTING ADJUSTMENTS
- Identify accrued income/expenses, prepaid expenses, depreciation, inventory adjustments, bad debts/ECL, opening/closing balances. Do not invent adjustment figures.

STAGE 6–9: RECONCILIATION, TAX-READINESS & QUALITY CONTROL
- Do not treat accounting profit automatically as taxable profit; apply Nigerian tax legislation (NTA 2025 & NTAA 2025). Do not invent tax deductions, exemptions, or reliefs.
- Perform independent extraction, accounting, and mathematical reviews. Flag all discrepancies and missing documents.

ABSOLUTE RULES
1. NEVER fabricate financial information or assume missing figures.
2. NEVER silently discard transactions or double-count transactions.
3. NEVER classify transactions solely based on descriptions when the accounting treatment is uncertain — ask the customer specific questions.
4. NEVER manipulate figures to make the balance sheet balance.
5. NEVER mark an unverified figure as verified or submit incomplete statements as final.
`;

const VALID_COA_LIST = `
1010 Cash on Hand | 1020 Zenith Bank Current Account | 1030 GTBank Operating Account | 1040 Short-Term Call Placements
1110 Trade Accounts Receivable | 1120 Allowance for ECL | 1130 Other Receivables | 1140 WHT Credit Notes
1210 Inventory - Goods for Resale | 1310 Prepaid Expenses | 1410 VAT Input Recoverable | 1420 Security Deposits
1510 PPE Land & Buildings | 1520 PPE Plant & Machinery | 1530 PPE Motor Vehicles | 1540 PPE Office Furniture & Equipment | 1550 PPE Computer & IT Equipment | 1610 Intangible Assets Software
2010 Trade Accounts Payable | 2020 Accrued Audit & Professional Fees | 2030 Accrued Salaries | 2040 VAT Output Payable | 2050 WHT Payable | 2060 PAYE Tax Payable | 2070 Current Tax Liabilities (CIT & Levy) | 2080 Customer Advances
2510 Long-Term Bank Loan | 2520 Director / Shareholder Current Account | 2530 Commercial Paper / Short-Term Facility
3010 Ordinary Share Capital | 3020 Retained Earnings | 3030 Owner Capital Contributions | 3040 Owner Drawings
4010 Revenue - Sale of Goods & Supply Contracts | 4020 Revenue - Technical & Logistics Services | 4090 Other Operating Income
5010 Cost of Goods Sold - Materials / Purchases | 5020 Direct Subcontracting & Technical Labour | 5030 Direct Freight & Inward Haulage
6010 Salaries & Wages | 6020 Staff Welfare, Pensions & HMO | 6030 Office Rent & Premises Rates | 6040 Electricity, Diesel & Utilities | 6050 Repairs & Facility Maintenance
6060 Advertising & Marketing | 6070 Audit, Tax Advisory & Legal Fees | 6080 IT, Software Subscriptions & Telecoms | 6090 Travel, Transport & Logistics | 6100 Insurance Expenses
6110 Printing, Stationery & Office Supplies | 6120 Bank Charges & Transaction Fees | 6130 Depreciation Expense (P&L) | 6140 Impairment Loss on Receivables (ECL)
7010 Finance Costs (Loan Interest) | 7020 Finance Income (Deposit Interest) | 8010 Income Tax Expense
9999 Suspense & Unclassified Transactions Clearing
`;

const NRS_ADMIN_LABELS = [
  "Salary and Wages", "Employee Benefit Expenses", "Directors Emoluments", "Directors expenses",
  "Staff Allowances", "Staff Gratuity", "Pension and Gratuity", "Other staff & related Cost",
  "depreciation", "Amortisation of intangible assets", "Government and regulatory costs",
  "Advertisement & Promotion", "Bad Debt written off", "Bank charges", "Interest Expense",
  "Rooms/ Accomodation cost", "Audit fees", "Donations", "Entertainment expenses", "Postages",
  "Fuel expenses", "Generator expenses", "Head office cost", "Internet Cost", "Medical Expenses",
  "Outsourcing Services expenses", "Rates", "Rent & Rates", "Repairs and Maintenance",
  "Research cost", "Security expenses", "Selling & Distribution Expenses", "Service Charge",
  "Telephone", "Training and Development", "Transport of supplies", "Utilities",
  "Website Design & Maintenance", "Software maintenance", "Cleaning & Janitory Services",
  "Freight & Transport Expenses", "Subscription & Dues", "Stationeries expenses",
  "other professional fees", "Fines", "penalties", "Realized foreign exchange loss",
  "Electricity & Power", "PMS", "Licences & leases charges", "Other statutory charges & levies",
  "AGO-Diesel", "Travel Expenses", "Others"
];

async function callDeepSeek(apiKey: string, systemPrompt: string, userPrompt: string) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${errText}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content);
}

function deterministicFallbackConvert(items: any[], defaultBankCode = "1020") {
  const entries = items.map((item, idx) => {
    const desc = String(item.description || "").toLowerCase();
    const amt = Math.abs(Number(item.amount) || 0);
    const dir = item.direction === "income" ? "income" : item.direction === "transfer" ? "transfer" : "expense";

    let coa = "9999";
    let nrsSection = "none";
    let nrsLabel: string | undefined;
    let taxTreatment = "suspense";
    let isFixedAssetCandidate = false;
    let assetClass: string | undefined;
    let confidence = 0.45;

    if (dir === "transfer") {
      coa = "1030";
      nrsSection = "none";
      taxTreatment = "capital";
      confidence = 0.90;
    } else if (dir === "income") {
      if (desc.includes("interest")) {
        coa = "7020"; nrsSection = "other_income"; nrsLabel = "Interest Income"; taxTreatment = "allowable"; confidence = 0.88;
      } else if (desc.includes("loan")) {
        coa = "2510"; nrsSection = "sfp"; taxTreatment = "capital"; confidence = 0.85;
      } else if (desc.includes("capital") || desc.includes("equity")) {
        coa = "3030"; nrsSection = "sfp"; taxTreatment = "capital"; confidence = 0.85;
      } else if (desc.includes("sale") || desc.includes("invoice") || desc.includes("payment") || desc.includes("service") || desc.includes("pos") || desc.includes("revenue")) {
        coa = "4010"; nrsSection = "revenue"; taxTreatment = "allowable"; confidence = 0.86;
      }
    } else if (dir === "expense") {
      if (desc.includes("salary") || desc.includes("wage") || desc.includes("payroll")) {
        coa = "6010"; nrsSection = "admin"; nrsLabel = "Salary and Wages"; taxTreatment = "allowable"; confidence = 0.92;
      } else if (desc.includes("rent") || desc.includes("lease")) {
        coa = "6030"; nrsSection = "admin"; nrsLabel = "Rent & Rates"; taxTreatment = "allowable"; confidence = 0.90;
      } else if (desc.includes("diesel") || desc.includes("fuel") || desc.includes("petrol") || desc.includes("nepa") || desc.includes("power") || desc.includes("electric")) {
        coa = "6040"; nrsSection = "admin"; nrsLabel = desc.includes("diesel") ? "AGO-Diesel" : desc.includes("petrol") ? "PMS" : "Electricity & Power"; taxTreatment = "allowable"; confidence = 0.89;
      } else if (desc.includes("bank charge") || desc.includes("stamp duty") || desc.includes("sms alert") || desc.includes("nip fee") || desc.includes("vat on fee")) {
        coa = "6120"; nrsSection = "admin"; nrsLabel = "Bank charges"; taxTreatment = "allowable"; confidence = 0.92;
      } else if (desc.includes("laptop") || desc.includes("macbook") || desc.includes("server") || desc.includes("computer")) {
        coa = "1550"; nrsSection = "sfp"; taxTreatment = "capital"; isFixedAssetCandidate = true; assetClass = "Computer & IT Infrastructure"; confidence = 0.88;
      } else if (desc.includes("vehicle") || desc.includes("truck") || desc.includes("van") || desc.includes("car")) {
        coa = "1530"; nrsSection = "sfp"; taxTreatment = "capital"; isFixedAssetCandidate = true; assetClass = "Commercial Motor Vehicles"; confidence = 0.86;
      } else if (desc.includes("generator") || desc.includes("machinery")) {
        coa = "1520"; nrsSection = "sfp"; taxTreatment = "capital"; isFixedAssetCandidate = true; assetClass = "Plant & Heavy Machinery"; confidence = 0.84;
      } else if (desc.includes("fine") || desc.includes("penalty")) {
        coa = "6070"; nrsSection = "admin"; nrsLabel = "Fines"; taxTreatment = "non_deductible_addback"; confidence = 0.90;
      } else if (desc.includes("audit") || desc.includes("legal") || desc.includes("consult")) {
        coa = "6070"; nrsSection = "admin"; nrsLabel = desc.includes("audit") ? "Audit fees" : "other professional fees"; taxTreatment = "allowable"; confidence = 0.88;
      } else if (desc.includes("internet") || desc.includes("data") || desc.includes("mtn") || desc.includes("airtel") || desc.includes("software")) {
        coa = "6080"; nrsSection = "admin"; nrsLabel = desc.includes("software") ? "Software maintenance" : "Internet Cost"; taxTreatment = "allowable"; confidence = 0.88;
      } else if (desc.includes("advert") || desc.includes("marketing") || desc.includes("meta") || desc.includes("google ads")) {
        coa = "6060"; nrsSection = "admin"; nrsLabel = "Advertisement & Promotion"; taxTreatment = "allowable"; confidence = 0.88;
      } else if (desc.includes("stock") || desc.includes("inventory") || desc.includes("goods") || desc.includes("supplies") || desc.includes("purchase")) {
        coa = "5010"; nrsSection = "cos"; nrsLabel = "Local Purchases"; taxTreatment = "allowable"; confidence = 0.82;
      }
    }

    const isSuspense = coa === "9999";
    return {
      id: item.id || `intake_${idx}_${Date.now()}`,
      date: item.date || new Date().toISOString().split("T")[0],
      description: item.description || "Unclassified Item",
      amount: amt,
      direction: dir,
      debitCode: dir === "income" ? defaultBankCode : dir === "expense" ? coa : "1030",
      creditCode: dir === "income" ? coa : dir === "expense" ? defaultBankCode : defaultBankCode,
      nrsSection,
      nrsLabel,
      taxTreatment,
      isFixedAssetCandidate,
      assetClass,
      confidence,
      clarificationQuestion: isSuspense ? `Uncertain accounting treatment for "${item.description}" (₦${amt.toLocaleString()}). Is this business revenue, operating expense, loan/equity, or personal transfer?` : null,
      resolutionStatus: isSuspense ? "Unresolved" : "Resolved",
      source: item.source || "bank_statement",
      sourceRef: item.sourceFileName || "",
    };
  });

  const questionsForUser = entries
    .filter((e) => e.resolutionStatus === "Unresolved")
    .map((e) => ({
      entryId: e.id,
      question: e.clarificationQuestion,
      amount: e.amount,
      date: e.date,
    }));

  return {
    entries,
    questionsForUser,
    duplicatesDetected: [],
    missingDocuments: [],
    adjustmentsIdentified: [],
    qualityControlSummary: {
      extractionReview: "Exact amounts and dates preserved from submitted records.",
      accountingReview: `${entries.length - questionsForUser.length} of ${entries.length} entries classified; ${questionsForUser.length} routed to Account 9999 for clarification.`,
      discrepancies: [],
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const body = await req.json();
    const { mode } = body;

    if (mode === "extract_bank_statement_rows") {
      const { rawText, fileName } = body;
      if (!rawText) throw new Error("rawText is required");

      if (!DEEPSEEK_API_KEY) {
        return new Response(JSON.stringify({ rows: [], warning: "DEEPSEEK_API_KEY not configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = `${GLOBAL_ACCOUNTING_SYSTEM_RULES}

TASK — STAGES 1, 2 & 3 (BANK STATEMENT EXTRACTION & VERIFICATION):
Extract every actual transaction row from the bank statement text for "${fileName || "Bank Statement"}".
Verify: Opening Balance + Total Credits - Total Debits = Closing Balance.
Return strictly JSON:
{
  "documentIdentification": {
    "documentType": "Bank statement",
    "reportingPeriod": "string or null",
    "openingBalance": number | null,
    "closingBalance": number | null,
    "totalCredits": number,
    "totalDebits": number,
    "reconciles": boolean,
    "discrepancyAmount": number,
    "missingPeriodsOrWarnings": ["string"]
  },
  "rows": [
    {
      "date": "YYYY-MM-DD",
      "description": "exact original description",
      "amount": number,
      "direction": "income" | "expense" | "transfer",
      "reference": "string",
      "counterparty": "string or null"
    }
  ]
}
Rules:
- Never include Opening Balance / Closing Balance / Brought Forward lines as transactions.
- Credit/Inflow/Deposit -> direction: "income", Debit/Outflow/Withdrawal -> direction: "expense".
- Strip commas and ₦/NGN so amount is a positive number.`;

      const parsed = await callDeepSeek(DEEPSEEK_API_KEY, systemPrompt, `Extract and verify bank statement:\n${String(rawText).slice(0, 26000)}`);
      return new Response(
        JSON.stringify({
          rows: parsed.rows || [],
          documentIdentification: parsed.documentIdentification || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mode === "parse_financial_statement") {
      const { rawText, fiscalYear, customInstructions } = body;
      if (!rawText) throw new Error("rawText is required");

      if (!DEEPSEEK_API_KEY) {
        return new Response(JSON.stringify({ extracted: {}, warning: "DEEPSEEK_API_KEY not configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = `${GLOBAL_ACCOUNTING_SYSTEM_RULES}

TASK — EXTRACT PREPARED FINANCIAL STATEMENTS INTO STRUCTURED JSON (FY ${fiscalYear || 2026}):
Valid admin expense keys: ${JSON.stringify(NRS_ADMIN_LABELS)}.
Never invent missing figures; set missing figures to 0 and list them in missingInformation.
Return strictly JSON:
{
  "companyProfile": { "company_legal_name": "", "rc_number": "", "tin": "", "sector": "" },
  "revenue": number,
  "costOfSales": { "openingInventory": number, "purchases": number, "otherDirectCost": number, "factoryOverheads": number, "closingInventory": number },
  "otherIncome": { "Interest Income": number, "Rental Income": number, "Dividend Income": number, "Others": number },
  "adminExpenses": { "<exact valid admin key>": number },
  "balanceSheet": {
    "ppe": number, "intangibles": number, "inventories": number, "tradeReceivables": number,
    "otherCurrentAssets": number, "cashAndEquivalents": number, "tradePayables": number,
    "currentTaxLiabilities": number, "otherCurrentLiabilities": number, "nonCurrentLiabilities": number,
    "shareCapital": number, "retainedEarnings": number
  },
  "taxAdjustments": { "depreciationAddBack": number, "finesAndPenalties": number, "exemptIncome": number, "capitalAllowances": number, "whtCredits": number },
  "questionsForUser": ["specific questions if figures are missing or Assets != Equity + Liabilities"],
  "missingInformation": ["string"],
  "discrepancies": ["string"],
  "confidence": number
}`;

      const userPrompt = `${customInstructions ? `<custom_filing_instructions>\n${String(customInstructions).slice(0, 2000)}\n</custom_filing_instructions>\n\n` : ""}Extract financial statement data:\n${String(rawText).slice(0, 28000)}`;
      const parsed = await callDeepSeek(DEEPSEEK_API_KEY, systemPrompt, userPrompt);
      return new Response(JSON.stringify({ extracted: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "convert_evidence_to_entries") {
      const {
        items = [],
        businessContext = "",
        defaultBankCode = "1020",
        customInstructions = "",
        clarificationAnswers = {},
        documentSummaries = [],
      } = body;

      if (!Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ entries: [], questionsForUser: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!DEEPSEEK_API_KEY) {
        const fallback = deterministicFallbackConvert(items, defaultBankCode);
        return new Response(JSON.stringify({ ...fallback, fallback: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = `${GLOBAL_ACCOUNTING_SYSTEM_RULES}

ALLOWED CHART OF ACCOUNTS (USE ONLY THESE 4-DIGIT CODES):
${VALID_COA_LIST}

VALID NRS ADMIN EXPENSE LABELS (for 6010–6140, 7010):
${JSON.stringify(NRS_ADMIN_LABELS)}

VALID STATUTORY ASSET CLASSES (if capital expenditure):
["Leasehold Land & Buildings", "Plant & Heavy Machinery", "Commercial Motor Vehicles", "Office Furniture & Equipment", "Computer & IT Infrastructure"]

CRITICAL CLASSIFICATION & CLARIFICATION RULES:
1. Keep exact input amounts and dates. Never alter numbers.
2. For income/inflows: debitCode = "${defaultBankCode}" (or 1010/1030/1040), creditCode = revenue (4010/4020), AR collection (1110), customer advance (2080), loan proceeds (2510/2520), owner capital (3030), or 9999.
3. For expense/outflows: debitCode = expense/COS/asset/liability/9999 code, creditCode = "${defaultBankCode}" (or 1010/1030).
4. Fixed asset purchases MUST go to 1510–1550 with isFixedAssetCandidate=true and assetClass set.
5. Own-account bank transfers MUST use debitCode="1030" and creditCode="1020" (never P&L).
6. Fines/penalties -> 6070, nrsLabel="Fines", taxTreatment="non_deductible_addback".
7. WHENEVER UNSURE (confidence < 0.80, vague narration like POS/NIP transfer without purpose, unknown party, or unclear capital vs expense): route the category side to "9999", set taxTreatment="suspense", resolutionStatus="Unresolved", and write a SPECIFIC clarificationQuestion for the customer.
8. If the user already provided an answer in clarificationAnswers for an item ID, apply that answer cleanly and mark resolutionStatus="Resolved".

Business context: ${businessContext || "Nigerian SME"}

Return strictly JSON:
{
  "entries": [
    {
      "id": "string (exact input id)",
      "date": "YYYY-MM-DD",
      "description": "exact original description",
      "amount": number,
      "direction": "income" | "expense" | "transfer",
      "debitCode": "4-digit COA code",
      "creditCode": "4-digit COA code",
      "nrsSection": "revenue" | "cos" | "other_income" | "admin" | "sfp" | "tax" | "none",
      "nrsLabel": "string or null",
      "taxTreatment": "allowable" | "non_deductible_addback" | "exempt_income" | "capital" | "suspense",
      "isFixedAssetCandidate": boolean,
      "assetClass": "string or null",
      "counterparty": "string or null",
      "confidence": number,
      "clarificationQuestion": "string or null",
      "resolutionStatus": "Resolved" | "Unresolved",
      "source": "string",
      "sourceRef": "string"
    }
  ],
  "questionsForUser": [
    { "entryId": "string", "question": "specific question to classify uncertain transaction or missing adjustment", "amount": number, "date": "string" }
  ],
  "duplicatesDetected": ["description of potential duplicate transactions if any"],
  "missingDocuments": ["e.g. missing months, opening balances, asset invoices, WHT credit notes"],
  "adjustmentsIdentified": ["e.g. accrued expenses, prepayments, depreciation on fixed assets"],
  "qualityControlSummary": {
    "extractionReview": "string",
    "accountingReview": "string",
    "discrepancies": ["string"]
  }
}`;

      const compactItems = items.slice(0, 60).map((it: any, idx: number) => ({
        id: it.id || `item_${idx}`,
        date: it.date,
        description: it.description,
        amount: it.amount,
        direction: it.direction,
        source: it.source || "bank_statement",
        sourceFileName: it.sourceFileName || "",
      }));

      const userPayload = {
        customInstructions: customInstructions ? String(customInstructions).slice(0, 2000) : undefined,
        clarificationAnswers,
        documentSummaries,
        items: compactItems,
      };

      try {
        const parsed = await callDeepSeek(DEEPSEEK_API_KEY, systemPrompt, JSON.stringify(userPayload));
        return new Response(
          JSON.stringify({
            entries: parsed.entries || [],
            questionsForUser: parsed.questionsForUser || [],
            duplicatesDetected: parsed.duplicatesDetected || [],
            missingDocuments: parsed.missingDocuments || [],
            adjustmentsIdentified: parsed.adjustmentsIdentified || [],
            qualityControlSummary: parsed.qualityControlSummary || null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("DeepSeek conversion failed, using deterministic fallback:", err);
        const fallback = deterministicFallbackConvert(compactItems, defaultBankCode);
        return new Response(JSON.stringify({ ...fallback, fallback: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    throw new Error(`Unsupported mode: ${mode}`);
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Unexpected error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
