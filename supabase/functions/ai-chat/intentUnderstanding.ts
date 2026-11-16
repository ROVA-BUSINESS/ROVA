// intentUnderstanding.ts - Broad Intent Understanding & Entity Extraction

import { IntentAnalysis, ChatMessage } from "./types.ts";
import { ContextManager } from "./contextManager.ts";

export class IntentUnderstanding {
  /**
   * Robust amount extractor handling Nigerian Naira (₦, NGN, naira), k/thousand, m/million,
   * avoiding accidental matching of bag/unit quantities.
   */
  static extractAmount(text: string): number {
    if (!text) return 0;
    const clean = text.trim();

    // 1. Explicit currency symbol or code: ₦15,000, N15,000, NGN 15000, 15,000 naira
    const currencyRegex =
      /(?:₦|ngn|\bnaira\b|\$)\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|m|million)?|\b([\d,]+(?:\.\d+)?)\s*(?:₦|ngn|\bnaira\b|\$)/i;
    const currMatch = clean.match(currencyRegex);
    if (currMatch) {
      const rawNum = currMatch[1] || currMatch[3];
      let val = parseFloat(rawNum.replace(/,/g, ""));
      const mult = (currMatch[2] || "").toLowerCase();
      if (mult === "k" || mult === "thousand") val *= 1000;
      if (mult === "m" || mult === "million") val *= 1000000;
      return val;
    }

    // 2. Preceded by transaction verbs/prepositions: 'for 15,000', 'paid 50,000', 'spent 3000', 'of 10,000'
    const prepRegex =
      /\b(?:for|paid|spent|cost|worth|received|total(?:ing)?)\s+(?:(?:₦|ngn|\$)\s*)?([\d,]+(?:\.\d+)?)\s*(k|thousand|m|million)?\b/i;
    const prepMatch = clean.match(prepRegex);
    if (prepMatch) {
      let val = parseFloat(prepMatch[1].replace(/,/g, ""));
      const mult = (prepMatch[2] || "").toLowerCase();
      if (mult === "k" || mult === "thousand") val *= 1000;
      if (mult === "m" || mult === "million") val *= 1000000;
      return val;
    }

    // 3. Standalone numbers with 'k' or 'm': '3k', '50k', '2m'
    const kmRegex = /\b([\d,]+(?:\.\d+)?)\s*(k|thousand|m|million)\b/i;
    const kmMatch = clean.match(kmRegex);
    if (kmMatch) {
      let val = parseFloat(kmMatch[1].replace(/,/g, ""));
      const mult = (kmMatch[2] || "").toLowerCase();
      if (mult === "k" || mult === "thousand") val *= 1000;
      if (mult === "m" || mult === "million") val *= 1000000;
      return val;
    }

    // 4. Find numeric candidates, skipping units like '3 bags', '2 units', '5 pcs'
    const candidates: number[] = [];
    const allNumMatches = [...clean.matchAll(/\b([\d,]+(?:\.\d+)?)\b/g)];
    for (const m of allNumMatches) {
      const numStr = m[1];
      const idx = m.index ?? 0;
      const after = clean.slice(idx + numStr.length, idx + numStr.length + 15).toLowerCase();
      if (/^\s*(bags?|units?|pcs?|pieces?|cartons?|litres?|kg|rolls?|crates?|packs?)\b/.test(after)) {
        continue;
      }
      const val = parseFloat(numStr.replace(/,/g, ""));
      if (!isNaN(val)) candidates.push(val);
    }

    if (candidates.length > 0) {
      return candidates[candidates.length - 1];
    }

    return 0;
  }

  /**
   * Cleans item names from transaction sentence (e.g. "I bought nylon for 15,000" -> "Nylon")
   */
  static cleanItemFromText(text: string): string {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^(i\s+)?(just\s+)?(bought|purchased|paid\s+for|spent\s+money\s+on|spent\s+on|sold|received\s+for)\s+/i, "");
    cleaned = cleaned.replace(/\s+(for|at|costing|amounting\s+to|worth)?\s*(₦|ngn|\$)?\s*[\d,]+(\.\d+)?\s*(k|thousand|m|million|\b naira)?.*$/i, "");
    cleaned = cleaned.replace(/[.,!?]+$/, "").trim();
    if (!cleaned) cleaned = text;
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  /**
   * Analyzes the user request to determine required tables and initial intent.
   * Flexible, non-rigid: Never rejects general conversations or business questions.
   */
  static analyzeIntent(
    userText: string,
    conversationHistory: ChatMessage[] = []
  ): IntentAnalysis {
    const q = userText.toLowerCase().trim();

    // Check if this message is answering a pending assistant question
    const pendingClarification = ContextManager.detectClarificationAnswer(conversationHistory, userText);
    if (pendingClarification && pendingClarification.isAnswer) {
      const amt = this.extractAmount(userText);
      if (amt > 0 && pendingClarification.itemContext) {
        return {
          primaryCategory: "clarification_response",
          needsFinancialSnapshot: false,
          neededTables: ["transactions", "inventory_items"],
          suggestedToolCall: {
            name: "recordTransaction",
            parameters: {
              description: pendingClarification.itemContext,
              amount: amt,
              type: "expense",
            },
          },
          isMultiIntent: false,
          confidence: 0.95,
        };
      }
    }

    // 1. Document / OCR Uploads
    if (
      q.includes("[business document uploaded") ||
      q.includes("[document uploaded") ||
      q.includes("[document/receipt ocr extracted]") ||
      /\b(supplier invoice|vendor invoice|purchase receipt)\b/i.test(q)
    ) {
      return {
        primaryCategory: "document_operation",
        needsFinancialSnapshot: true,
        neededTables: ["invoices", "inventory_items", "transactions"],
        suggestedToolCall: {
          name: "processBusinessDocument",
          parameters: {
            documentType: q.includes("receipt") ? "purchase_receipt" : "supplier_invoice",
            rawText: userText,
          },
        },
        isMultiIntent: false,
        confidence: 0.95,
      };
    }

    // 2. Document retrieval (Send invoice/receipt)
    if (
      /\b(send me|give me|get me|show me|find|download)\b.*\b(last|recent|latest)?\s*(invoice|receipt)\b/i.test(q) ||
      /\b(send|get|show)\s+(?:me\s+)?([a-zA-Z\s]+?)'?s?\s+(?:last\s+|latest\s+)?(invoice|receipt)\b/i.test(q)
    ) {
      const isInvoice = q.includes("invoice");
      const nameMatch =
        q.match(/(?:for|to|of)\s+([a-zA-Z\s]+?)(?:\s+for|\s+\d+|\?|$)/i) ||
        q.match(/(?:send|get|show)\s+(?:me\s+)?([a-zA-Z]+)(?:'s|\s+last|\s+invoice|\s+receipt)/i);
      const customerName = nameMatch ? nameMatch[1].replace(/last|latest|recent|invoice|receipt/gi, "").trim() : "";
      const numMatch = q.match(/(?:#|no\.?|number\s+)?([a-zA-Z0-9_-]{3,20})/i);

      return {
        primaryCategory: "document_operation",
        needsFinancialSnapshot: false,
        neededTables: isInvoice ? ["invoices"] : ["receipts"],
        suggestedToolCall: {
          name: "sendDocument",
          parameters: {
            documentType: isInvoice ? "invoice" : "receipt",
            customerName,
            documentNumber: q.includes("#") ? numMatch?.[1] : undefined,
          },
        },
        isMultiIntent: false,
        confidence: 0.9,
      };
    }

    // 3. Document Creation (Invoice / Receipt)
    if (/\b(create|generate|make|issue|send)\s+(?:an?\s+)?(invoice|receipt)\b/i.test(q)) {
      const isReceipt = q.includes("receipt");
      const amt = this.extractAmount(userText);
      return {
        primaryCategory: "document_operation",
        needsFinancialSnapshot: false,
        neededTables: isReceipt ? ["receipts"] : ["invoices"],
        suggestedToolCall: {
          name: isReceipt ? "createReceipt" : "createInvoice",
          parameters: {
            amount: amt > 0 ? amt : undefined,
          },
        },
        isMultiIntent: false,
        confidence: 0.9,
      };
    }

    // 4. Financial Transaction Recording
    if (/(?:bought|purchased|spent|paid for|bought nylon|paid shop rent|paid workers|transportation|generator|sale|sold|received.*customer)/i.test(q)) {
      const amt = this.extractAmount(userText);
      const item = this.cleanItemFromText(userText);

      // Missing amount triggers clarification
      if (!amt || amt <= 0) {
        return {
          primaryCategory: "record_transaction",
          needsFinancialSnapshot: false,
          neededTables: [],
          suggestedToolCall: null,
          isMultiIntent: false,
          clarificationNeeded: `How much did you spend on ${item || "that"}?`,
          confidence: 0.85,
        };
      }

      let category = "Operating Expense";
      let type = "expense";

      if (/\b(nylon|polythene|poly\s*bag|packaging|wrapper|box(?:es)?\s+for\s+pack)\b/i.test(q)) {
        category = "Packaging Materials";
        type = "expense";
      } else if (/\b(flour|rice|beans|sugar|oil|cement|bags?\s+of|cartons?\s+of|crates?\s+of|goods\s+for\s+resale|stock|inventory)\b/i.test(q) && !/\b(sold|sale|received)\b/i.test(q)) {
        category = "Inventory / Purchases";
        type = "expense";
      } else if (/\b(rent|shop\s*rent|store\s*rent|office\s*rent)\b/i.test(q)) {
        category = "Rent Expense";
        type = "expense";
      } else if (/\b(workers?|staff|salary|salaries|wages?)\b/i.test(q)) {
        category = "Salaries and Wages";
        type = "expense";
      } else if (/\b(transport|transportation|fare|fuel|diesel|petrol|uber|bolt)\b/i.test(q)) {
        category = "Transportation Expense";
        type = "expense";
      } else if (/\b(generator|laptop|freezer|machinery|equipment|vehicle|car|furniture)\b/i.test(q)) {
        category = "Property, Plant and Equipment";
        type = "expense";
      } else if (/\b(sold|sale|sales|customer.*goods|goods\s+sold)\b/i.test(q)) {
        category = "Sales Revenue";
        type = "income";
      }

      return {
        primaryCategory: "record_transaction",
        needsFinancialSnapshot: false,
        neededTables: ["transactions", "categories", "inventory_items"],
        suggestedToolCall: {
          name: "recordTransaction",
          parameters: {
            description: item,
            amount: amt,
            category,
            type,
          },
        },
        isMultiIntent: false,
        confidence: 0.95,
      };
    }

    // 5. Query Sales & Revenue
    if (/\b(how much.*sell|total sales|sales|revenue|how much did we make)\b/i.test(q)) {
      let period = "this_month";
      if (q.includes("today")) period = "today";
      else if (q.includes("week")) period = "this_week";
      else if (q.includes("year")) period = "this_year";
      else if (q.includes("last month")) period = "last_month";

      return {
        primaryCategory: "query_data",
        needsFinancialSnapshot: false,
        neededTables: ["transactions"],
        suggestedToolCall: { name: "getSales", parameters: { period } },
        isMultiIntent: false,
        confidence: 0.95,
      };
    }

    // 6. Query Expenses & Costs
    if (/\b(how much.*spend|expenses|spending|total costs)\b/i.test(q)) {
      let period = "this_month";
      if (q.includes("today")) period = "today";
      else if (q.includes("week")) period = "this_week";

      return {
        primaryCategory: "query_data",
        needsFinancialSnapshot: false,
        neededTables: ["transactions"],
        suggestedToolCall: { name: "getExpenses", parameters: { period } },
        isMultiIntent: false,
        confidence: 0.95,
      };
    }

    // 7. Inventory Operations
    if (/\b(inventory|stock|how many|how much.*bags?|units?|items?)\b/i.test(q)) {
      const searchMatch = q.match(/(?:how many|how much)\s+(?:bags?\s+of\s+|units?\s+of\s+|packs?\s+of\s+)?(.+?)(?:\s+do i|\s+is|\?|$)/i)?.[1] || "";
      return {
        primaryCategory: "query_data",
        needsFinancialSnapshot: false,
        neededTables: ["inventory_items"],
        suggestedToolCall: { name: "getInventory", parameters: { search: searchMatch.trim() } },
        isMultiIntent: false,
        confidence: 0.9,
      };
    }

    // 8. Receivables & Debtors
    if (/\b(owe|debtors|receivables|outstanding|unpaid invoices?|who owes)\b/i.test(q)) {
      return {
        primaryCategory: "query_data",
        needsFinancialSnapshot: false,
        neededTables: ["invoices"],
        suggestedToolCall: { name: "getOutstandingInvoices", parameters: {} },
        isMultiIntent: false,
        confidence: 0.95,
      };
    }

    // 9. Taxes
    if (/\b(tax|vat|cit|tax liability|withholding tax|firs)\b/i.test(q)) {
      return {
        primaryCategory: "accounting_question",
        needsFinancialSnapshot: true,
        neededTables: ["transactions"],
        suggestedToolCall: { name: "calculateTax", parameters: { period: "this_year" } },
        isMultiIntent: false,
        confidence: 0.9,
      };
    }

    // 10. Staff & Payroll
    if (/\b(payroll|salary|salaries|pay.*run)\b/i.test(q)) {
      return {
        primaryCategory: "query_data",
        needsFinancialSnapshot: false,
        neededTables: ["payroll_runs"],
        suggestedToolCall: { name: "getPayroll", parameters: {} },
        isMultiIntent: false,
        confidence: 0.9,
      };
    }
    if (/\b(staff|employees?|workers?|team)\b/i.test(q)) {
      return {
        primaryCategory: "query_data",
        needsFinancialSnapshot: false,
        neededTables: ["employees"],
        suggestedToolCall: { name: "getStaff", parameters: {} },
        isMultiIntent: false,
        confidence: 0.9,
      };
    }

    // 11. Clients / Customers
    if (/\b(customers?|clients?|who.*customers?|all.*clients?)\b/i.test(q)) {
      return {
        primaryCategory: "query_data",
        needsFinancialSnapshot: false,
        neededTables: ["invoices"],
        suggestedToolCall: { name: "getCustomers", parameters: {} },
        isMultiIntent: false,
        confidence: 0.9,
      };
    }

    // 12. Transaction history / search
    if (/\b(transactions?|history|records?)\b/i.test(q)) {
      const dateMatch = q.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
      return {
        primaryCategory: "query_data",
        needsFinancialSnapshot: false,
        neededTables: ["transactions"],
        suggestedToolCall: { name: "getTransactions", parameters: { date: dateMatch?.[1] || "", period: "this_month" } },
        isMultiIntent: false,
        confidence: 0.85,
      };
    }

    // 13. Financial Health / Business Advisory
    if (/\b(how is my business|financial health|profit|profitability|advice|performance|overview)\b/i.test(q)) {
      return {
        primaryCategory: "financial_analysis",
        needsFinancialSnapshot: true,
        neededTables: ["accounts", "transactions", "invoices", "inventory_items"],
        suggestedToolCall: null,
        isMultiIntent: false,
        confidence: 0.9,
      };
    }

    // Default: General Conversation or Broad Business Query (Never whitelisted or blocked!)
    return {
      primaryCategory: "general_chat",
      needsFinancialSnapshot: false,
      neededTables: [],
      suggestedToolCall: null,
      isMultiIntent: false,
      confidence: 0.7,
    };
  }
}
