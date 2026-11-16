// toolRegistry.ts - Central Tool Registry with Parameter Validation and Permission Checks

import { ToolDefinition, ToolExecutionResult } from "./types.ts";
import { ToolExecutors } from "./toolExecutors.ts";

export class ToolRegistry {
  private static tools: Map<string, ToolDefinition> = new Map();

  static initialize() {
    if (this.tools.size > 0) return;

    // 1. recordTransaction
    this.register({
      name: "recordTransaction",
      description: "Record any financial transaction (income, expense, transfer) preserving original description, amount, and category.",
      category: "write",
      requiresConfirmation: false,
      parameters: {
        description: { type: "string", description: "Name of item or service purchased/sold", required: true },
        amount: { type: "number", description: "Exact monetary amount in Naira", required: true },
        type: { type: "string", description: "Transaction type", enum: ["income", "expense", "transfer"], required: true },
        category: { type: "string", description: "Accounting category" },
        date: { type: "string", description: "Transaction date in YYYY-MM-DD" },
        notes: { type: "string", description: "Optional notes" },
      },
      execute: (supabaseClient, userId, params, rawMsg, meta) =>
        ToolExecutors.executeRecordTransaction(supabaseClient, userId, params, rawMsg, meta),
    });

    // 2. recordSale
    this.register({
      name: "recordSale",
      description: "Record a sales revenue transaction.",
      category: "write",
      requiresConfirmation: false,
      parameters: {
        amount: { type: "number", description: "Sale amount in Naira", required: true },
        description: { type: "string", description: "Description of sale or item sold", required: true },
        clientName: { type: "string", description: "Optional client/customer name" },
      },
      execute: (supabaseClient, userId, params, rawMsg) =>
        ToolExecutors.executeRecordSale(supabaseClient, userId, params, rawMsg),
    });

    // 3. recordExpense
    this.register({
      name: "recordExpense",
      description: "Record a business expense.",
      category: "write",
      requiresConfirmation: false,
      parameters: {
        amount: { type: "number", description: "Expense amount in Naira", required: true },
        description: { type: "string", description: "Description of expense", required: true },
        categoryName: { type: "string", description: "Category name" },
        merchant: { type: "string", description: "Vendor or seller name" },
      },
      execute: (supabaseClient, userId, params, rawMsg) =>
        ToolExecutors.executeRecordExpense(supabaseClient, userId, params, rawMsg),
    });

    // 4. createInvoice
    this.register({
      name: "createInvoice",
      description: "Generate and record an official sales invoice for a client.",
      category: "write",
      requiresConfirmation: false,
      parameters: {
        clientName: { type: "string", description: "Name of customer or client", required: true },
        amount: { type: "number", description: "Total or subtotal amount in Naira" },
        description: { type: "string", description: "Service or item description" },
        dueDate: { type: "string", description: "Due date in YYYY-MM-DD" },
        taxRate: { type: "number", description: "VAT/tax rate percentage (default 7.5)" },
        items: { type: "array", description: "Array of line items with description, quantity, unit_price" },
      },
      execute: (supabaseClient, userId, params, rawMsg) =>
        ToolExecutors.executeCreateInvoice(supabaseClient, userId, params, rawMsg),
    });

    // 5. createReceipt
    this.register({
      name: "createReceipt",
      description: "Generate an official payment receipt for a customer.",
      category: "write",
      requiresConfirmation: false,
      parameters: {
        customerName: { type: "string", description: "Customer name", required: true },
        amount: { type: "number", description: "Payment amount in Naira" },
        paymentMethod: { type: "string", description: "Payment method (e.g. Bank Transfer, Cash)" },
        description: { type: "string", description: "Description of goods/services paid for" },
      },
      execute: (supabaseClient, userId, params, rawMsg) =>
        ToolExecutors.executeCreateReceipt(supabaseClient, userId, params, rawMsg),
    });

    // 6. processBusinessDocument
    this.register({
      name: "processBusinessDocument",
      description: "Process uploaded supplier invoices, bills, or receipts into the accounting ledger.",
      category: "write",
      requiresConfirmation: false,
      parameters: {
        documentType: { type: "string", description: "supplier_invoice or purchase_receipt" },
        vendorOrCustomer: { type: "string", description: "Vendor or merchant name" },
        documentNumber: { type: "string", description: "Invoice or receipt number" },
        totalAmount: { type: "number", description: "Total document amount in Naira" },
        paymentStatus: { type: "string", description: "paid or unpaid" },
        items: { type: "array", description: "Line items" },
      },
      execute: (supabaseClient, userId, params, rawMsg, meta) =>
        ToolExecutors.executeProcessBusinessDocument(supabaseClient, userId, params, rawMsg, meta),
    });

    // 7. sendDocument
    this.register({
      name: "sendDocument",
      description: "Retrieve an existing invoice or receipt and deliver its PDF document.",
      category: "read",
      requiresConfirmation: false,
      parameters: {
        documentType: { type: "string", description: "invoice or receipt", required: true },
        customerName: { type: "string", description: "Customer or client name" },
        documentNumber: { type: "string", description: "Invoice or receipt number" },
      },
      execute: (supabaseClient, userId, params) =>
        ToolExecutors.executeSendDocument(supabaseClient, userId, params),
    });

    // 8. getSales
    this.register({
      name: "getSales",
      description: "Query sales revenue and transaction count for a given time period.",
      category: "read",
      requiresConfirmation: false,
      parameters: {
        period: { type: "string", description: "today | this_week | this_month | last_month | this_year" },
      },
      execute: (supabaseClient, userId, params) =>
        ToolExecutors.executeGetSales(supabaseClient, userId, params),
    });

    // 9. getExpenses
    this.register({
      name: "getExpenses",
      description: "Query business expenses and spending breakdown for a time period.",
      category: "read",
      requiresConfirmation: false,
      parameters: {
        period: { type: "string", description: "today | this_week | this_month" },
      },
      execute: (supabaseClient, userId, params) =>
        ToolExecutors.executeGetExpenses(supabaseClient, userId, params),
    });

    // 10. getInventory
    this.register({
      name: "getInventory",
      description: "Query stock levels, stock valuation, and reorder alerts for inventory items.",
      category: "read",
      requiresConfirmation: false,
      parameters: {
        search: { type: "string", description: "Item name keyword to search for" },
      },
      execute: (supabaseClient, userId, params) =>
        ToolExecutors.executeGetInventory(supabaseClient, userId, params),
    });

    // 11. getOutstandingInvoices
    this.register({
      name: "getOutstandingInvoices",
      description: "Query all unpaid client invoices and total receivables.",
      category: "read",
      requiresConfirmation: false,
      parameters: {},
      execute: (supabaseClient, userId) =>
        ToolExecutors.executeGetOutstandingInvoices(supabaseClient, userId),
    });

    // 12. getStaff
    this.register({
      name: "getStaff",
      description: "Query all active employees and monthly payroll liability.",
      category: "read",
      requiresConfirmation: false,
      parameters: {},
      execute: (supabaseClient, userId) =>
        ToolExecutors.executeGetStaff(supabaseClient, userId),
    });

    // 13. getPayroll
    this.register({
      name: "getPayroll",
      description: "Query payroll runs and disbursement history.",
      category: "read",
      requiresConfirmation: false,
      parameters: {},
      execute: (supabaseClient, userId, params) =>
        ToolExecutors.executeGetPayroll(supabaseClient, userId, params),
    });

    // 14. getCustomers
    this.register({
      name: "getCustomers",
      description: "Query list of clients, total billed, and payment history.",
      category: "read",
      requiresConfirmation: false,
      parameters: {},
      execute: (supabaseClient, userId) =>
        ToolExecutors.executeGetCustomers(supabaseClient, userId),
    });

    // 15. getTransactions
    this.register({
      name: "getTransactions",
      description: "Query specific transactions filtered by date, period, or type.",
      category: "read",
      requiresConfirmation: false,
      parameters: {
        date: { type: "string", description: "Date in YYYY-MM-DD" },
        type: { type: "string", description: "income | expense | transfer" },
      },
      execute: (supabaseClient, userId, params) =>
        ToolExecutors.executeGetTransactions(supabaseClient, userId, params),
    });

    // 16. deleteTransaction (High-Risk)
    this.register({
      name: "deleteTransaction",
      description: "Permanently delete a transaction record (REQUIRES USER CONFIRMATION).",
      category: "high_risk",
      requiresConfirmation: true,
      parameters: {
        transactionId: { type: "string", description: "Transaction ID" },
        description: { type: "string", description: "Description keyword of transaction to delete" },
        amount: { type: "number", description: "Amount of transaction to delete" },
      },
      execute: (supabaseClient, userId, params) =>
        ToolExecutors.executeDeleteTransaction(supabaseClient, userId, params),
    });

    // 17. calculateTax
    this.register({
      name: "calculateTax",
      description: "Calculate estimated VAT, CIT, and Development Levy based on year-to-date accounting records.",
      category: "read",
      requiresConfirmation: false,
      parameters: {
        period: { type: "string", description: "this_year" },
      },
      execute: (supabaseClient, userId, params) =>
        ToolExecutors.executeCalculateTax(supabaseClient, userId, params),
    });
  }

  static register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  static getTool(name: string): ToolDefinition | undefined {
    this.initialize();
    return this.tools.get(name);
  }

  static getAllTools(): ToolDefinition[] {
    this.initialize();
    return Array.from(this.tools.values());
  }

  /**
   * Generates standard OpenAPI / JSON schemas of registered tools for the LLM system prompt
   */
  static generateToolSystemPrompt(): string {
    this.initialize();
    const readTools: string[] = [];
    const writeTools: string[] = [];
    const highRiskTools: string[] = [];

    for (const tool of this.tools.values()) {
      const paramList = Object.entries(tool.parameters)
        .map(([pName, pSchema]) => `${pName}${pSchema.required ? " (required)" : ""}: ${pSchema.type}`)
        .join(", ");

      const line = `• ${tool.name}(${paramList}) — ${tool.description}`;
      if (tool.category === "read") readTools.push(line);
      else if (tool.category === "write") writeTools.push(line);
      else if (tool.category === "high_risk") highRiskTools.push(line);
    }

    return `
─────────────────────────────────
AVAILABLE ROVA TOOLS
─────────────────────────────────
READ-ONLY TOOLS (execute immediately, no confirmation needed):
${readTools.join("\n")}

ACTION & CREATION TOOLS (execute immediately when details are provided):
${writeTools.join("\n")}

HIGH-RISK TOOLS (require explicit user confirmation):
${highRiskTools.join("\n")}
`.trim();
  }

  /**
   * Validates parameters and security constraints before tool execution
   */
  static validateAndExecute(
    name: string,
    params: Record<string, any>,
    supabaseClient: any,
    userId: string,
    rawMsg: string,
    isStaff: boolean = false,
    meta?: Record<string, any>
  ): Promise<ToolExecutionResult> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not registered in the ROVA Central Tool Registry`);
    }

    // Security Check: Staff restrictions
    if (isStaff) {
      if (tool.name === "calculateTax" || tool.name === "deleteTransaction") {
        throw new Error("Access Denied: Staff accounts are restricted from executing tax or deletion operations.");
      }
    }

    // Never allow raw SQL or unauthorized execution
    if (params && (params.sql || params.query?.toLowerCase().includes("select ") || params.query?.toLowerCase().includes("drop "))) {
      throw new Error("Security Violation: Direct SQL execution is strictly forbidden.");
    }

    return tool.execute(supabaseClient, userId, params, rawMsg, meta);
  }
}
