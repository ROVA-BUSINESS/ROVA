// toolExecutors.ts - Preserves full ROVA Accounting Logic and Document Generation

import { ToolExecutionResult } from "./types.ts";
import { generateReceiptPDF, generateInvoicePDF } from "./documentGenerator.ts";
import { IntentUnderstanding } from "./intentUnderstanding.ts";

function formatCurrency(amount: number): string {
  return `₦${Number(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export class ToolExecutors {
  /**
   * Idempotency Check: Prevents duplicate transactions within a short time window (e.g., 2 minutes)
   */
  static async checkDuplicateTransaction(
    supabaseClient: any,
    userId: string,
    type: string,
    amount: number,
    description: string
  ): Promise<any | null> {
    try {
      const twoMinutesAgo = new Date(Date.now() - 120000).toISOString();
      const { data: duplicates } = await supabaseClient
        .from("transactions")
        .select("id, amount, description, date, reference")
        .eq("user_id", userId)
        .eq("type", type)
        .eq("amount", Math.abs(amount))
        .ilike("description", description.trim())
        .gte("created_at", twoMinutesAgo)
        .limit(1);

      if (duplicates && duplicates.length > 0) {
        return duplicates[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  // 1. Unified Transaction Recording
  static async executeRecordTransaction(
    supabaseClient: any,
    userId: string,
    params: any,
    rawMsg: string,
    meta?: Record<string, any>
  ): Promise<ToolExecutionResult> {
    const amount = Number(params.amount) || IntentUnderstanding.extractAmount(rawMsg) || 0;
    if (!amount || amount <= 0) {
      const itemDesc = params.description || IntentUnderstanding.cleanItemFromText(rawMsg);
      return {
        success: false,
        toolName: "recordTransaction",
        formattedSummary: `How much did you spend on ${itemDesc || "that"}?`,
        requiresClarification: true,
        clarificationQuestion: `How much did you spend on ${itemDesc || "that"}?`,
      };
    }

    let description = params.description || IntentUnderstanding.cleanItemFromText(rawMsg);
    if (!description) description = "Transaction";
    description = description.charAt(0).toUpperCase() + description.slice(1);

    let type = params.type || "expense";
    if (!["income", "expense", "transfer"].includes(type)) {
      if (type === "owner_contribution" || type === "loan_received") type = "income";
      else if (type === "owner_withdrawal" || type === "loan_repayment" || type === "asset_purchase") type = "expense";
      else type = "expense";
    }

    // Check idempotency duplicate
    const existing = await this.checkDuplicateTransaction(supabaseClient, userId, type, amount, description);
    if (existing) {
      return {
        success: true,
        toolName: "recordTransaction",
        formattedSummary: `ℹ️ Transaction already recorded: ${formatCurrency(amount)} for ${description} (Ref: ${existing.reference}).`,
        recordId: existing.id,
        data: existing,
      };
    }

    const categoryName = params.category || (type === "income" ? "Sales Revenue" : "Operating Expense");

    let categoryId = null;
    try {
      const { data: existingCat } = await supabaseClient
        .from("categories")
        .select("id, name")
        .ilike("name", categoryName.trim())
        .or(`user_id.eq.${userId},is_system.eq.true`)
        .limit(1)
        .maybeSingle();

      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const { data: newCat } = await supabaseClient
          .from("categories")
          .insert({
            user_id: userId,
            name: categoryName.trim(),
            type: type === "transfer" ? "both" : type,
            icon: type === "income" ? "trending-up" : "credit-card",
            color: type === "income" ? "#10b981" : "#ef4444",
            is_system: false,
          })
          .select("id")
          .single();
        if (newCat) categoryId = newCat.id;
      }
    } catch (cErr) {
      console.warn("[ROVA Core] Category lookup/insert error:", cErr);
    }

    const txDate = params.date || new Date().toISOString().split("T")[0];
    const refCode = `${type === "income" ? "REV" : type === "transfer" ? "TRF" : "EXP"}-${Date.now().toString().slice(-6)}`;

    const { data: transaction, error } = await supabaseClient
      .from("transactions")
      .insert({
        user_id: userId,
        amount: Math.abs(amount),
        type,
        description,
        date: txDate,
        category_id: categoryId,
        ai_category: categoryName,
        reference: refCode,
        notes: params.notes || null,
        is_verified: true,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-link inventory if category is Inventory / Purchases
    if (/inventory|purchases/i.test(categoryName)) {
      try {
        const { data: matchedItem } = await supabaseClient
          .from("inventory_items")
          .select("id, name, current_stock")
          .eq("user_id", userId)
          .ilike("name", `%${description}%`)
          .maybeSingle();

        if (matchedItem) {
          await supabaseClient
            .from("inventory_items")
            .update({ current_stock: (matchedItem.current_stock || 0) + 1 })
            .eq("id", matchedItem.id);

          await supabaseClient.from("inventory_transactions").insert({
            user_id: userId,
            item_id: matchedItem.id,
            transaction_id: transaction.id,
            type: "purchase",
            quantity: 1,
            unit_cost: Math.abs(amount),
            total_cost: Math.abs(amount),
            date: txDate,
            notes: "Auto-linked by ROVA AI",
          });
        }
      } catch (invErr) {
        console.warn("[ROVA Core] Inventory auto-link error:", invErr);
      }
    }

    const source = meta?.source || "web";
    const prefix = source === "whatsapp" ? "✅ " : "";
    const formattedSummary = `${prefix}I've recorded ${formatCurrency(amount)} for ${description} under ${categoryName}.`;

    return {
      success: true,
      toolName: "recordTransaction",
      formattedSummary,
      actions: [{ type: "view_report", label: "View Transactions", payload: { transactionId: transaction.id } }],
      recordId: transaction.id,
      data: transaction,
    };
  }

  // 2. Record Sale
  static async executeRecordSale(
    supabaseClient: any,
    userId: string,
    params: any,
    rawMsg: string
  ): Promise<ToolExecutionResult> {
    const amount = params.amount || IntentUnderstanding.extractAmount(rawMsg) || 0;
    const description = params.description || rawMsg || "Sale";
    const saleDate = new Date().toISOString().split("T")[0];

    const existing = await this.checkDuplicateTransaction(supabaseClient, userId, "income", amount, description);
    if (existing) {
      return {
        success: true,
        toolName: "recordSale",
        formattedSummary: `ℹ️ Sale already recorded: ${formatCurrency(amount)} for ${description} (Ref: ${existing.reference}).`,
        recordId: existing.id,
        data: existing,
      };
    }

    const { data: transaction, error } = await supabaseClient
      .from("transactions")
      .insert({
        user_id: userId,
        amount: Math.abs(amount),
        type: "income",
        description,
        date: saleDate,
        reference: `SALE-${Date.now().toString().slice(-6)}`,
        ai_category: "Business Revenue",
        is_verified: true,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      toolName: "recordSale",
      formattedSummary: `I've recorded ${formatCurrency(amount)} for ${description} under Sales Revenue.`,
      actions: [{ type: "view_report", label: "View Sales Report", payload: {} }],
      recordId: transaction.id,
      data: transaction,
    };
  }

  // 3. Record Expense
  static async executeRecordExpense(
    supabaseClient: any,
    userId: string,
    params: any,
    rawMsg: string
  ): Promise<ToolExecutionResult> {
    const amount = params.amount || IntentUnderstanding.extractAmount(rawMsg) || 0;
    const description = params.description || rawMsg || "Expense";
    const categoryName = params.categoryName || "Operating Expense";
    const expenseDate = new Date().toISOString().split("T")[0];

    const existing = await this.checkDuplicateTransaction(supabaseClient, userId, "expense", amount, description);
    if (existing) {
      return {
        success: true,
        toolName: "recordExpense",
        formattedSummary: `ℹ️ Expense already recorded: ${formatCurrency(amount)} for ${description} (Ref: ${existing.reference}).`,
        recordId: existing.id,
        data: existing,
      };
    }

    const { data: transaction, error } = await supabaseClient
      .from("transactions")
      .insert({
        user_id: userId,
        amount: Math.abs(amount),
        type: "expense",
        description,
        date: expenseDate,
        reference: `EXP-${Date.now().toString().slice(-6)}`,
        ai_category: categoryName,
        is_verified: true,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      toolName: "recordExpense",
      formattedSummary: `I've recorded ${formatCurrency(amount)} for ${description} under ${categoryName}.`,
      actions: [{ type: "view_report", label: "View Expense Report", payload: {} }],
      recordId: transaction.id,
      data: transaction,
    };
  }

  // 4. Create Invoice
  static async executeCreateInvoice(
    supabaseClient: any,
    userId: string,
    params: any,
    rawMsg: string
  ): Promise<ToolExecutionResult> {
    const clientName = params.clientName;
    if (!clientName || clientName.trim() === "") {
      return {
        success: false,
        toolName: "createInvoice",
        formattedSummary: "Who should I address this invoice to? Please provide the client's name.",
        requiresClarification: true,
        clarificationQuestion: "Who should I address this invoice to? Please provide the client's name.",
      };
    }

    const amount = params.amount || IntentUnderstanding.extractAmount(rawMsg) || 0;
    const description = params.description || params.itemDescription || "Professional Services";
    const dueDate = params.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
    const taxRate = params.taxRate ?? 7.5;
    const subtotal = amount;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const { data: invoice, error } = await supabaseClient
      .from("invoices")
      .insert({
        user_id: userId,
        invoice_number: invoiceNumber,
        client_name: clientName,
        client_email: params.clientEmail || "",
        client_address: params.clientAddress || "",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: dueDate,
        status: "sent",
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        amount_paid: 0,
        currency: "NGN",
        notes: params.notes || "Generated by ROVA AI",
      })
      .select()
      .single();

    if (error) throw error;

    const items = params.items && Array.isArray(params.items)
      ? params.items
      : [{ description, quantity: 1, unit_price: subtotal }];

    for (const item of items) {
      await supabaseClient.from("invoice_items").insert({
        invoice_id: invoice.id,
        description: item.description || description,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || subtotal,
        amount: (item.quantity || 1) * (item.unit_price || subtotal),
      });
    }

    const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", userId).maybeSingle();
    const invoiceWithItems = {
      ...invoice,
      items: items.map((item: any) => ({
        description: item.description || description,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || subtotal,
        amount: (item.quantity || 1) * (item.unit_price || subtotal),
      })),
    };

    let pdfUrl = "";
    let pdfFileName = `Invoice_${invoiceNumber}.pdf`;
    try {
      const gen = await generateInvoicePDF(supabaseClient, userId, invoiceWithItems, profile);
      pdfUrl = gen.pdfUrl;
      pdfFileName = gen.fileName;
    } catch (pdfErr) {
      console.error("Failed to generate PDF for invoice:", pdfErr);
    }

    return {
      success: true,
      toolName: "createInvoice",
      formattedSummary: `📄 Invoice #${invoiceNumber} Created for ${clientName}!\n• Subtotal: ${formatCurrency(subtotal)}\n• Tax (${taxRate}%): ${formatCurrency(taxAmount)}\n• Total: ${formatCurrency(total)}\n• Due: ${dueDate}\n\nThe official invoice document has been generated and attached below.`,
      actions: [{ type: "view_invoice", label: "View Invoice", payload: { invoice_id: invoice.id } }],
      recordId: invoice.id,
      documentToSend: pdfUrl
        ? {
            url: pdfUrl,
            fileName: pdfFileName,
            caption: `Invoice #${invoiceNumber} for ${clientName}`,
            mimeType: "application/pdf",
          }
        : undefined,
      data: invoice,
    };
  }

  // 5. Create Receipt
  static async executeCreateReceipt(
    supabaseClient: any,
    userId: string,
    params: any,
    rawMsg: string
  ): Promise<ToolExecutionResult> {
    const customerName = params.customerName || params.clientName;
    if (!customerName || customerName.trim() === "") {
      return {
        success: false,
        toolName: "createReceipt",
        formattedSummary: "Who should I address this receipt to? Please provide the customer's name.",
        requiresClarification: true,
        clarificationQuestion: "Who should I address this receipt to? Please provide the customer's name.",
      };
    }

    const amount = params.amount || IntentUnderstanding.extractAmount(rawMsg) || 0;
    const description = params.description || "Payment received";
    const paymentMethod = params.paymentMethod || "Bank Transfer";
    const receiptDate = new Date().toISOString().split("T")[0];

    const { data: countData, error: countErr } = await supabaseClient.rpc("generate_next_receipt_number", {
      p_user_id: userId,
    });
    let receiptNumber = "RCPT-001";
    if (!countErr && countData) {
      receiptNumber = countData;
    } else {
      receiptNumber = `RCPT-${Date.now().toString().slice(-6)}`;
    }

    const { data: receipt, error } = await supabaseClient
      .from("receipts")
      .insert({
        user_id: userId,
        receipt_number: receiptNumber,
        customer_name: customerName,
        payment_method: paymentMethod,
        description,
        receipt_date: receiptDate,
        total: amount,
        status: "generated",
        created_by: "ROVA AI",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "42P01") {
        throw new Error("Receipts feature is not yet enabled in the database (Pending Migration). Please generate the receipt from the web app.");
      }
      throw error;
    }

    await supabaseClient.from("receipt_items").insert({
      receipt_id: receipt.id,
      description,
      quantity: 1,
      unit_price: amount,
      amount: amount,
    });

    const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", userId).maybeSingle();
    const receiptWithItems = {
      ...receipt,
      items: [{ description, quantity: 1, unit_price: amount, total: amount }],
    };

    let pdfUrl = "";
    let pdfFileName = `Receipt_${receipt.receipt_number}.pdf`;
    try {
      const gen = await generateReceiptPDF(supabaseClient, userId, receiptWithItems, profile);
      pdfUrl = gen.pdfUrl;
      pdfFileName = gen.fileName;
    } catch (pdfErr) {
      console.error("Failed to generate PDF for receipt:", pdfErr);
    }

    return {
      success: true,
      toolName: "createReceipt",
      formattedSummary: `🧾 Receipt #${receipt.receipt_number} Generated for ${customerName}!\n• Amount: ${formatCurrency(amount)}\n• Method: ${paymentMethod}\n\nThe official receipt document has been generated and attached below.`,
      actions: [{ type: "view_receipt", label: "View Receipt", payload: { receipt_id: receipt.id } }],
      recordId: receipt.id,
      documentToSend: pdfUrl
        ? {
            url: pdfUrl,
            fileName: pdfFileName,
            caption: `Receipt #${receipt.receipt_number} for ${customerName}`,
            mimeType: "application/pdf",
          }
        : undefined,
      data: receipt,
    };
  }

  // 6. Process Business Document
  static async executeProcessBusinessDocument(
    supabaseClient: any,
    userId: string,
    params: any,
    rawMsg: string,
    context?: any
  ): Promise<ToolExecutionResult> {
    const documentType = (params.documentType || "supplier_invoice").toLowerCase();
    const vendorOrCustomer = (
      params.vendorOrCustomer ||
      params.supplierName ||
      params.clientName ||
      params.merchant ||
      params.vendor ||
      "Vendor"
    ).trim();
    const documentNumber = (params.documentNumber || params.invoiceNumber || params.receiptNumber || "").trim();
    const totalAmount = Number(params.totalAmount || params.amount || IntentUnderstanding.extractAmount(rawMsg) || 0);
    const paymentStatus = (
      params.paymentStatus || (rawMsg.toLowerCase().includes("paid") ? "paid" : "unpaid")
    ).toLowerCase();
    const docDate = params.date || new Date().toISOString().split("T")[0];
    const dueDate = params.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

    const attachmentUrl = context?.documentUrl || params.documentUrl || "";

    if (documentNumber) {
      const { data: existingBill } = await supabaseClient
        .from("bills")
        .select("id, bill_number, total_amount, vendor_name")
        .eq("user_id", userId)
        .eq("bill_number", documentNumber)
        .maybeSingle();

      if (existingBill) {
        return {
          success: true,
          toolName: "processBusinessDocument",
          formattedSummary: `⚠️ Duplicate Alert: Bill #${documentNumber} from ${existingBill.vendor_name} (${formatCurrency(existingBill.total_amount)}) is already in your ROVA records. No duplicate entry was created.`,
          recordId: existingBill.id,
        };
      }
    }

    const { data: bill, error: billErr } = await supabaseClient
      .from("bills")
      .insert({
        user_id: userId,
        bill_number: documentNumber || `BILL-${Date.now().toString().slice(-6)}`,
        vendor_name: vendorOrCustomer,
        issue_date: docDate,
        due_date: dueDate,
        total_amount: totalAmount,
        status: paymentStatus === "paid" ? "paid" : "unpaid",
        notes: `Processed by ROVA AI from ${documentType.replace(/_/g, " ")}`,
        attachment_url: attachmentUrl || null,
      })
      .select()
      .single();

    if (billErr) throw billErr;

    // Record linked expense transaction
    const { data: tx } = await supabaseClient
      .from("transactions")
      .insert({
        user_id: userId,
        amount: Math.abs(totalAmount),
        type: "expense",
        description: `Bill: ${vendorOrCustomer} (#${bill.bill_number})`,
        date: docDate,
        reference: `BILL-${bill.id.slice(0, 8).toUpperCase()}`,
        ai_category: "Inventory / Purchases",
        is_verified: true,
        notes: `Auto-linked from Bill #${bill.bill_number}`,
      })
      .select()
      .single();

    return {
      success: true,
      toolName: "processBusinessDocument",
      formattedSummary: `✅ Processed ${documentType.replace(/_/g, " ")} from ${vendorOrCustomer} (#${bill.bill_number}) for ${formatCurrency(totalAmount)}. Linked to expense ledger.`,
      actions: [{ type: "view_report", label: "View Bill", payload: { bill_id: bill.id } }],
      recordId: bill.id,
      data: { bill, transaction: tx },
    };
  }

  // 7. Send Document
  static async executeSendDocument(
    supabaseClient: any,
    userId: string,
    params: any
  ): Promise<ToolExecutionResult> {
    const docType = (params.documentType || "invoice").toLowerCase();
    const customerName = (params.customerName || "").trim();
    const documentNumber = (params.documentNumber || "").trim();

    const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", userId).maybeSingle();

    if (docType === "invoice") {
      let query = supabaseClient.from("invoices").select("*, items:invoice_items(*)").eq("user_id", userId);
      if (documentNumber) {
        query = query.eq("invoice_number", documentNumber);
      } else if (customerName) {
        query = query.ilike("client_name", `%${customerName}%`).order("created_at", { ascending: false }).limit(1);
      } else {
        query = query.order("created_at", { ascending: false }).limit(1);
      }

      const { data: invoices } = await query;
      const inv = invoices && invoices[0];
      if (!inv) {
        return {
          success: false,
          toolName: "sendDocument",
          formattedSummary: `I could not find an invoice ${customerName ? `for "${customerName}"` : documentNumber ? `#${documentNumber}` : "in your records"}. Would you like me to create one?`,
        };
      }

      let pdfUrl = inv.pdf_url;
      let fileName = `Invoice_${inv.invoice_number}.pdf`;
      if (!pdfUrl) {
        try {
          const genResult = await generateInvoicePDF(supabaseClient, userId, inv, profile);
          pdfUrl = genResult.pdfUrl;
          fileName = genResult.fileName;
        } catch (err) {
          console.error("Failed to generate PDF for invoice:", err);
        }
      }

      return {
        success: true,
        toolName: "sendDocument",
        formattedSummary: `📄 Here is Invoice #${inv.invoice_number} for ${inv.client_name}:\n• Total: ${formatCurrency(inv.total)}\n• Status: ${(inv.status || "unpaid").toUpperCase()}\n• Due Date: ${inv.due_date || "N/A"}\n\nThe official invoice document is attached below.`,
        documentToSend: pdfUrl
          ? {
              url: pdfUrl,
              fileName,
              caption: `Invoice #${inv.invoice_number} for ${inv.client_name}`,
              mimeType: "application/pdf",
            }
          : undefined,
        recordId: inv.id,
        actions: [{ type: "view_invoice", label: "View Invoice", payload: { invoice_id: inv.id } }],
        data: inv,
      };
    } else {
      let query = supabaseClient.from("receipts").select("*, items:receipt_items(*)").eq("user_id", userId);
      if (documentNumber) {
        query = query.eq("receipt_number", documentNumber);
      } else if (customerName) {
        query = query.ilike("customer_name", `%${customerName}%`).order("created_at", { ascending: false }).limit(1);
      } else {
        query = query.order("created_at", { ascending: false }).limit(1);
      }

      const { data: receipts } = await query;
      const rcpt = receipts && receipts[0];
      if (!rcpt) {
        return {
          success: false,
          toolName: "sendDocument",
          formattedSummary: `I could not find a receipt ${customerName ? `for "${customerName}"` : documentNumber ? `#${documentNumber}` : "in your records"}. Would you like me to generate one?`,
        };
      }

      let pdfUrl = rcpt.pdf_url;
      let fileName = `Receipt_${rcpt.receipt_number}.pdf`;
      if (!pdfUrl) {
        try {
          const genResult = await generateReceiptPDF(supabaseClient, userId, rcpt, profile);
          pdfUrl = genResult.pdfUrl;
          fileName = genResult.fileName;
        } catch (err) {
          console.error("Failed to generate PDF for receipt:", err);
        }
      }

      return {
        success: true,
        toolName: "sendDocument",
        formattedSummary: `🧾 Here is Receipt #${rcpt.receipt_number} for ${rcpt.customer_name}:\n• Amount: ${formatCurrency(rcpt.total || rcpt.amount)}\n• Payment Method: ${rcpt.payment_method || "Bank Transfer"}\n• Date: ${rcpt.receipt_date}\n\nThe official receipt document is attached below.`,
        documentToSend: pdfUrl
          ? {
              url: pdfUrl,
              fileName,
              caption: `Receipt #${rcpt.receipt_number} for ${rcpt.customer_name}`,
              mimeType: "application/pdf",
            }
          : undefined,
        recordId: rcpt.id,
        actions: [{ type: "view_receipt", label: "View Receipt", payload: { receipt_id: rcpt.id } }],
        data: rcpt,
      };
    }
  }

  // 8. Get Sales
  static async executeGetSales(
    supabaseClient: any,
    userId: string,
    params: any
  ): Promise<ToolExecutionResult> {
    const period = params.period || "this_month";
    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    if (period === "today") startDate = now.toISOString().split("T")[0];
    else if (period === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff)).toISOString().split("T")[0];
    } else if (period === "last_month") {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    } else if (period === "this_year") {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
    }

    const { data: txs, error } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "income")
      .gte("date", startDate)
      .order("date", { ascending: false });

    if (error) throw error;

    const salesList = txs || [];
    const totalAmount = salesList.reduce((s: number, t: any) => s + t.amount, 0);
    const topSales = salesList.slice(0, 5).map((t: any) => `• ${t.date}: ${formatCurrency(t.amount)} — ${t.description}`).join("\n");

    return {
      success: true,
      toolName: "getSales",
      formattedSummary: `📈 Sales Summary (${period.replace(/_/g, " ").toUpperCase()})\n• Total Revenue: ${formatCurrency(totalAmount)}\n• Transactions: ${salesList.length}\n\n${topSales || "No sales recorded for this period."}`,
      data: { totalAmount, count: salesList.length, sales: salesList },
    };
  }

  // 9. Get Expenses
  static async executeGetExpenses(
    supabaseClient: any,
    userId: string,
    params: any
  ): Promise<ToolExecutionResult> {
    const period = params.period || "this_month";
    const now = new Date();
    let startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    if (period === "today") startDate = now.toISOString().split("T")[0];
    else if (period === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff)).toISOString().split("T")[0];
    }

    const { data: txs, error } = await supabaseClient
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("type", "expense")
      .gte("date", startDate)
      .order("amount", { ascending: false });

    if (error) throw error;

    const expenseList = txs || [];
    const totalAmount = expenseList.reduce((s: number, t: any) => s + t.amount, 0);
    const top = expenseList.slice(0, 5).map((t: any) => `• ${t.date}: ${formatCurrency(t.amount)} — ${t.description}`).join("\n");

    return {
      success: true,
      toolName: "getExpenses",
      formattedSummary: `📉 Expense Summary (${period.replace(/_/g, " ").toUpperCase()})\n• Total Spent: ${formatCurrency(totalAmount)}\n• Transactions: ${expenseList.length}\n\n${top || "No expenses recorded for this period."}`,
      data: { totalAmount, count: expenseList.length, expenses: expenseList },
    };
  }

  // 10. Get Inventory
  static async executeGetInventory(
    supabaseClient: any,
    userId: string,
    params: any
  ): Promise<ToolExecutionResult> {
    let query = supabaseClient.from("inventory_items").select("*").eq("user_id", userId).eq("status", "active");

    if (params.search && params.search.trim()) {
      query = query.ilike("name", `%${params.search.trim()}%`);
    }

    const { data: items, error } = await query;
    if (error) throw error;

    const inventoryList = items || [];

    // Disambiguation: multiple matches
    if (params.search && inventoryList.length > 1) {
      const options = inventoryList
        .map((i: any, idx: number) => `${idx + 1}. ${i.name} — ${i.current_stock} ${i.unit || "units"} in stock (Cost: ${formatCurrency(i.cost_price)})`)
        .join("\n");
      return {
        success: true,
        toolName: "getInventory",
        formattedSummary: `🔍 I found ${inventoryList.length} items matching "${params.search}". Which one did you mean?\n\n${options}`,
        actions: inventoryList.map((i: any) => ({
          type: "select_inventory_item",
          label: `${i.name} (${i.current_stock} ${i.unit || "units"})`,
          payload: { item_id: i.id, item_name: i.name, current_stock: i.current_stock },
        })),
        data: inventoryList,
      };
    }

    // Single match
    if (params.search && inventoryList.length === 1) {
      const i = inventoryList[0];
      const isLow = (i.current_stock || 0) <= (i.reorder_level || 5);
      return {
        success: true,
        toolName: "getInventory",
        formattedSummary: `📦 ${i.name}\n• In Stock: ${i.current_stock} ${i.unit || "units"} ${isLow ? "⚠️ LOW STOCK" : "✅"}\n• Cost Price: ${formatCurrency(i.cost_price)}\n• Selling Price: ${formatCurrency(i.selling_price)}\n• Reorder Level: ${i.reorder_level || 5} units`,
        data: i,
      };
    }

    // Full overview
    const totalValuation = inventoryList.reduce((s: number, i: any) => s + (i.current_stock || 0) * (i.cost_price || 0), 0);
    const lowStock = inventoryList.filter((i: any) => (i.current_stock || 0) <= (i.reorder_level || 5));
    const sampleList = inventoryList
      .slice(0, 8)
      .map((i: any) => `• ${i.name}: ${i.current_stock} ${i.unit || "units"} ${(i.current_stock || 0) <= (i.reorder_level || 5) ? "⚠️" : ""}`)
      .join("\n");

    return {
      success: true,
      toolName: "getInventory",
      formattedSummary: `📦 Inventory Overview\n• Total Items: ${inventoryList.length}\n• Stock Valuation: ${formatCurrency(totalValuation)}\n• Low Stock Alerts: ${lowStock.length}\n\n${sampleList || "No items in stock."}`,
      actions: [{ type: "add_inventory", label: "Add Item", payload: {} }],
      data: { totalItems: inventoryList.length, totalValuation, lowStockCount: lowStock.length },
    };
  }

  // 11. Get Outstanding Invoices
  static async executeGetOutstandingInvoices(
    supabaseClient: any,
    userId: string
  ): Promise<ToolExecutionResult> {
    const { data: invoices, error } = await supabaseClient
      .from("invoices")
      .select("*")
      .eq("user_id", userId)
      .neq("status", "paid")
      .order("due_date", { ascending: true });

    if (error) throw error;

    const unpaidList = invoices || [];
    const totalOwed = unpaidList.reduce((s: number, i: any) => s + ((i.total || 0) - (i.amount_paid || 0)), 0);
    const clientList = unpaidList
      .slice(0, 8)
      .map((i: any) => `• ${i.client_name}: ${formatCurrency((i.total || 0) - (i.amount_paid || 0))} (Due: ${i.due_date || "N/A"})`)
      .join("\n");

    return {
      success: true,
      toolName: "getOutstandingInvoices",
      formattedSummary: `📋 Outstanding Receivables\n• Total Owed to You: ${formatCurrency(totalOwed)}\n• Pending Invoices: ${unpaidList.length}\n\n${clientList || "🎉 No outstanding client debts!"}`,
      data: { totalOwed, count: unpaidList.length, invoices: unpaidList },
    };
  }

  // 12. Get Staff
  static async executeGetStaff(
    supabaseClient: any,
    userId: string
  ): Promise<ToolExecutionResult> {
    const { data: employees, error } = await supabaseClient
      .from("employees")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("full_name");

    if (error) throw error;

    const list = employees || [];
    const totalGross = list.reduce((s: number, e: any) => s + (e.gross_salary || 0), 0);
    const staffLines = list
      .slice(0, 10)
      .map((e: any) => `• ${e.full_name} — ${e.role || "No role"} | ${formatCurrency(e.gross_salary)}/month`)
      .join("\n");

    return {
      success: true,
      toolName: "getStaff",
      formattedSummary: `👥 Active Staff (${list.length})\n• Total Monthly Payroll Liability: ${formatCurrency(totalGross)}\n\n${staffLines || "No active employees on record."}`,
      actions: list.length === 0 ? [{ type: "view_report", label: "Add Employee", payload: { page: "payroll" } }] : [],
      data: { count: list.length, totalGross, staff: list },
    };
  }

  // 13. Get Payroll
  static async executeGetPayroll(
    supabaseClient: any,
    userId: string,
    params: any
  ): Promise<ToolExecutionResult> {
    const { data: runs, error } = await supabaseClient
      .from("payroll_runs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) throw error;

    const runList = runs || [];
    const runLines = runList
      .map((r: any) => `• ${r.period_label}: Gross ${formatCurrency(r.total_gross)} → Net ${formatCurrency(r.total_net)} (${r.employee_count} staff)`)
      .join("\n");

    return {
      success: true,
      toolName: "getPayroll",
      formattedSummary: `💰 Payroll History\n\n${runLines || "No payroll runs recorded yet."}`,
      actions: [{ type: "view_report", label: "View Payroll", payload: { page: "payroll" } }],
      data: runList,
    };
  }

  // 14. Get Customers
  static async executeGetCustomers(
    supabaseClient: any,
    userId: string
  ): Promise<ToolExecutionResult> {
    const { data: invoices, error } = await supabaseClient
      .from("invoices")
      .select("client_name, client_email, total, amount_paid, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const clientMap: Record<string, { name: string; email: string; totalInvoiced: number; totalPaid: number; invoiceCount: number }> = {};
    for (const inv of invoices || []) {
      if (!clientMap[inv.client_name]) {
        clientMap[inv.client_name] = { name: inv.client_name, email: inv.client_email || "", totalInvoiced: 0, totalPaid: 0, invoiceCount: 0 };
      }
      clientMap[inv.client_name].totalInvoiced += inv.total || 0;
      clientMap[inv.client_name].totalPaid += inv.amount_paid || 0;
      clientMap[inv.client_name].invoiceCount += 1;
    }

    const clients = Object.values(clientMap);
    const clientLines = clients
      .slice(0, 10)
      .map((c) => `• ${c.name} — ${c.invoiceCount} invoice(s) | Total billed: ${formatCurrency(c.totalInvoiced)} | Paid: ${formatCurrency(c.totalPaid)}`)
      .join("\n");

    return {
      success: true,
      toolName: "getCustomers",
      formattedSummary: `🧑‍💼 Your Clients/Customers (${clients.length})\n\n${clientLines || "No clients on record yet. Create your first invoice to add a client."}`,
      actions: [{ type: "create_invoice", label: "Create Invoice", payload: {} }],
      data: clients,
    };
  }

  // 15. Get Transactions
  static async executeGetTransactions(
    supabaseClient: any,
    userId: string,
    params: any
  ): Promise<ToolExecutionResult> {
    let query = supabaseClient.from("transactions").select("*").eq("user_id", userId);

    if (params.date) {
      const dateStr = params.date.includes("/")
        ? params.date.split("/").reverse().join("-")
        : params.date;
      query = query.eq("date", dateStr);
    } else {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      query = query.gte("date", startDate);
    }

    if (params.type && ["income", "expense", "transfer"].includes(params.type)) {
      query = query.eq("type", params.type);
    }

    const { data: txs, error } = await query.order("date", { ascending: false }).limit(20);
    if (error) throw error;

    const list = txs || [];
    const totalIn = list.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);
    const totalOut = list.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
    const lines = list
      .slice(0, 10)
      .map((t: any) => `• ${t.date} | ${t.type === "income" ? "📈" : "📉"} ${formatCurrency(t.amount)} — ${t.description}`)
      .join("\n");

    const label = params.date ? `on ${params.date}` : "this month";
    return {
      success: true,
      toolName: "getTransactions",
      formattedSummary: `🗒️ Transactions ${label} (${list.length} records)\n• In: ${formatCurrency(totalIn)} | Out: ${formatCurrency(totalOut)}\n\n${lines || "No transactions found for this period."}`,
      data: { count: list.length, totalIn, totalOut, transactions: list },
    };
  }

  // 16. Delete Transaction (High-Risk)
  static async executeDeleteTransaction(
    supabaseClient: any,
    userId: string,
    params: any
  ): Promise<ToolExecutionResult> {
    let txId = params.transactionId || params.transaction_id;
    let tx: any = null;

    if (txId) {
      const { data } = await supabaseClient
        .from("transactions")
        .select("id, description, amount")
        .eq("id", txId)
        .eq("user_id", userId)
        .maybeSingle();
      tx = data;
    } else {
      let query = supabaseClient.from("transactions").select("id, description, amount").eq("user_id", userId);
      if (params.description && params.description.trim()) {
        query = query.ilike("description", `%${params.description.trim()}%`);
      } else if (params.amount && params.amount > 0) {
        query = query.eq("amount", params.amount);
      }
      const { data: matches } = await query.order("created_at", { ascending: false }).limit(1);
      if (matches && matches.length > 0) {
        tx = matches[0];
        txId = tx.id;
      }
    }

    if (!tx || !txId) {
      return {
        success: false,
        toolName: "deleteTransaction",
        formattedSummary: `⚠️ Could not find a matching transaction to remove. Please provide the description or amount of the transaction you want to delete.`,
      };
    }

    const { error: delErr } = await supabaseClient
      .from("transactions")
      .delete()
      .eq("id", txId)
      .eq("user_id", userId);

    if (delErr) throw delErr;

    return {
      success: true,
      toolName: "deleteTransaction",
      formattedSummary: `🗑️ Transaction Deleted: "${tx.description || "Transaction"}" (${formatCurrency(tx.amount)}) has been permanently removed.`,
      recordId: txId,
      data: { deletedId: txId },
    };
  }

  // 17. Calculate Tax
  static async executeCalculateTax(
    supabaseClient: any,
    userId: string,
    params: any
  ): Promise<ToolExecutionResult> {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];

    const { data: txs, error } = await supabaseClient
      .from("transactions")
      .select("amount, type")
      .eq("user_id", userId)
      .gte("date", startOfYear);

    if (error) throw error;

    const allTxs = txs || [];
    const grossIncome = allTxs.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);
    const allowableExpenses = allTxs.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
    const netProfit = Math.max(0, grossIncome - allowableExpenses);

    const vatLiability = grossIncome * 0.075;
    const citRate = grossIncome > 100_000_000 ? 0.3 : grossIncome >= 25_000_000 ? 0.2 : 0.0;
    const estimatedCIT = netProfit * citRate;
    const devLevy = netProfit * 0.04;
    const totalTax = vatLiability + estimatedCIT;

    return {
      success: true,
      toolName: "calculateTax",
      formattedSummary: `🏛️ Tax Liability Estimate — This Year\n• Gross Revenue: ${formatCurrency(grossIncome)}\n• Allowable Expenses: ${formatCurrency(allowableExpenses)}\n• Net Taxable Profit: ${formatCurrency(netProfit)}\n\n📊 Breakdown:\n• VAT (7.5% on revenue): ${formatCurrency(vatLiability)}\n• CIT (${(citRate * 100).toFixed(0)}%): ${formatCurrency(estimatedCIT)}\n• Dev Levy (4%): ${formatCurrency(devLevy)}\n• Total Estimated Tax: ${formatCurrency(totalTax)}\n\n⚠️ This is an estimate. Please consult a tax professional for official filing.`,
      data: { grossIncome, allowableExpenses, netProfit, vatLiability, citRate, estimatedCIT, devLevy, totalTax },
    };
  }
}
