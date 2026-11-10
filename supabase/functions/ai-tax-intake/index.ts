// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  return items.map((item, idx) => {
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

    if (dir === "income") {
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
      clarificationQuestion: isSuspense ? `What is "${item.description}" (₦${amt.toLocaleString()}) for?` : null,
      resolutionStatus: isSuspense ? "Unresolved" : "Resolved",
      source: item.source || "bank_statement",
    };
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const body = await req.json();
    const { mode } = body;

    if (mode === "extract_bank_statement_rows") {
      const { rawText } = body;
      if (!rawText) throw new Error("rawText is required");

      if (!DEEPSEEK_API_KEY) {
        return new Response(JSON.stringify({ rows: [], warning: "DEEPSEEK_API_KEY not configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = `You extract bank statement transactions from OCR or PDF text for Nigerian businesses.
Return strictly JSON:
{
  "rows": [
    { "date": "YYYY-MM-DD", "description": "string", "amount": number, "direction": "income" | "expense" | "transfer", "reference": "string" }
  ]
}
Rules:
- Credit/Inflow/Deposit -> direction: "income", Debit/Outflow/Withdrawal -> direction: "expense".
- Parse amounts as positive numbers (strip commas and ₦/NGN).
- Skip opening/closing balance summary lines and headers.`;

      const parsed = await callDeepSeek(DEEPSEEK_API_KEY, systemPrompt, `Extract all transaction rows from:\n${String(rawText).slice(0, 24000)}`);
      return new Response(JSON.stringify({ rows: parsed.rows || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "parse_financial_statement") {
      const { rawText, fiscalYear } = body;
      if (!rawText) throw new Error("rawText is required");

      if (!DEEPSEEK_API_KEY) {
        return new Response(JSON.stringify({ extracted: {}, warning: "DEEPSEEK_API_KEY not configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = `You are a Nigerian Chartered Accountant AI. Extract figures from an existing Financial Statement (P&L, Balance Sheet, Notes, Fixed Assets) into strict JSON for the NRS CIT Filing Wizard (FY ${fiscalYear || 2026}).
Valid admin expense keys: ${JSON.stringify(NRS_ADMIN_LABELS)}.
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
  "confidence": number
}`;

      const parsed = await callDeepSeek(DEEPSEEK_API_KEY, systemPrompt, `Extract financial statement data:\n${String(rawText).slice(0, 28000)}`);
      return new Response(JSON.stringify({ extracted: parsed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "convert_evidence_to_entries") {
      const { items = [], businessContext = "", defaultBankCode = "1020" } = body;
      if (!Array.isArray(items) || items.length === 0) {
        return new Response(JSON.stringify({ entries: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!DEEPSEEK_API_KEY) {
        const entries = deterministicFallbackConvert(items, defaultBankCode);
        return new Response(JSON.stringify({ entries, fallback: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const systemPrompt = `You are ROVA AI, a Nigerian IFRS & NTA 2025 Chartered Accountant engine.
Convert each raw transaction / receipt / bank statement line into a double-entry accounting entry using ONLY the allowed Chart of Accounts codes below.

ALLOWED COA CODES:
${VALID_COA_LIST}

VALID NRS ADMIN EXPENSE LABELS (for 6010–6140, 7010):
${JSON.stringify(NRS_ADMIN_LABELS)}

VALID STATUTORY ASSET CLASSES (if capital asset):
["Leasehold Land & Buildings", "Plant & Heavy Machinery", "Commercial Motor Vehicles", "Office Furniture & Equipment", "Computer & IT Infrastructure"]

CRITICAL RULES:
1. Never invent amounts. Keep exact input amount.
2. For income: debitCode = "${defaultBankCode}" (or 1010/1030/1040), creditCode = revenue/equity/liability/9999 code.
3. For expense: debitCode = expense/asset/9999 code, creditCode = "${defaultBankCode}" (or 1010/1030).
4. Fixed asset purchases (laptops, vehicles, machinery, furniture, buildings) MUST go to 1510–1550 with isFixedAssetCandidate=true and assetClass set, NOT operating expenses.
5. Fines and penalties go to 6070 with nrsLabel="Fines" and taxTreatment="non_deductible_addback".
6. UNCLASSIFIED / SUSPENSE RULE (Account 9999): If narration is vague, incomplete, or confidence < 0.80 (e.g., "NIP TRF TO JOHN", "POS WITHDRAWAL", unclear transfer), set the category side code to "9999", taxTreatment="suspense", resolutionStatus="Unresolved", and write one concise clarificationQuestion.

Business context: ${businessContext || "Nigerian SME"}

Return strictly JSON:
{
  "entries": [
    {
      "id": "string (same as input id)",
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": number,
      "direction": "income" | "expense" | "transfer",
      "debitCode": "4-digit COA code",
      "creditCode": "4-digit COA code",
      "nrsSection": "revenue" | "cos" | "other_income" | "admin" | "sfp" | "tax" | "none",
      "nrsLabel": "string or null",
      "taxTreatment": "allowable" | "non_deductible_addback" | "exempt_income" | "capital" | "suspense",
      "isFixedAssetCandidate": boolean,
      "assetClass": "string or null",
      "confidence": number,
      "clarificationQuestion": "string or null",
      "resolutionStatus": "Resolved" | "Unresolved",
      "source": "string"
    }
  ]
}`;

      const compactItems = items.slice(0, 60).map((it: any, idx: number) => ({
        id: it.id || `item_${idx}`,
        date: it.date,
        description: it.description,
        amount: it.amount,
        direction: it.direction,
        source: it.source || "bank_statement",
      }));

      try {
        const parsed = await callDeepSeek(DEEPSEEK_API_KEY, systemPrompt, JSON.stringify({ items: compactItems }));
        return new Response(JSON.stringify({ entries: parsed.entries || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("DeepSeek conversion failed, using deterministic fallback:", err);
        const entries = deterministicFallbackConvert(compactItems, defaultBankCode);
        return new Response(JSON.stringify({ entries, fallback: true }), {
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
