// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatCurrency(amount: number): string {
  return `₦${Number(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { messages, message, context } = body;
    const { transactions, accounts, userId, isStaff } = context ?? {};

    const activeUserId = userId || body.userId;

    if (!activeUserId) {
      throw new Error("Missing userId in request body or context");
    }

    // Standardize input message array
    let conversationMessages = messages ?? [];
    if (!conversationMessages.length && message) {
      conversationMessages = [{ role: "user", content: message }];
    }

    const lastUserMsg = conversationMessages.filter((m) => m.role === "user").pop()?.content || "";

    // ── 1. REAL-TIME FINANCIAL CONTEXT FETCHING ─────────────────────────────────
    const [txRes, accRes, invRes, invcRes] = await Promise.all([
      supabaseClient
        .from("transactions")
        .select("*")
        .eq("user_id", activeUserId)
        .order("date", { ascending: false })
        .limit(50),
      supabaseClient.from("accounts").select("*").eq("user_id", activeUserId),
      supabaseClient.from("inventory_items").select("*").eq("user_id", activeUserId).eq("status", "active"),
      supabaseClient.from("invoices").select("*").eq("user_id", activeUserId).neq("status", "paid"),
    ]);

    const txs = txRes.data ?? transactions ?? [];
    const accs = accRes.data ?? accounts ?? [];
    const inventoryItems = invRes.data ?? [];
    const outstandingInvoices = invcRes.data ?? [];

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const thisMonthTx = txs.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const totalBalance = accs.reduce((s, a) => s + (a.balance ?? 0), 0);
    const thisIncome = thisMonthTx.filter((t) => t.type === "income").reduce((s, t) => s + (t.amount || 0), 0);
    const thisExpense = thisMonthTx.filter((t) => t.type === "expense").reduce((s, t) => s + (t.amount || 0), 0);
    const net = thisIncome - thisExpense;

    const totalOutstandingAmount = outstandingInvoices.reduce((s, i) => s + ((i.total || 0) - (i.amount_paid || 0)), 0);

    const financialCtx = `
Current ROVA Financial Snapshot (Single Source of Truth Database):
- Total Account Balance: ₦${totalBalance.toLocaleString()}
- This Month Income: ₦${thisIncome.toLocaleString()}
- This Month Expenses: ₦${thisExpense.toLocaleString()}
- Net Profit/Loss This Month: ₦${net.toLocaleString()}
- Total Active Inventory Items: ${inventoryItems.length}
- Outstanding Client Receivables: ₦${totalOutstandingAmount.toLocaleString()} (${outstandingInvoices.length} unpaid invoices)
`.trim();

    const staffRestriction = isStaff
      ? "STAFF MODE STRICT RULE: You MUST NOT reveal total profit margins, total net income, or tax liabilities. Only answer transaction and operational inventory queries."
      : "";

    // ── 2. SYSTEM PROMPT & CORE BUSINESS FUNCTION TOOLS DEFINITION ──────────────
    const systemPrompt = `You are ROVA AI, the single unified AI Agent and financial brain for Nigerian businesses.
Whether the user interacts via the ROVA Website or WhatsApp, you execute operations on the exact same underlying database.

${staffRestriction}

${financialCtx}

-------------------------
ROVA CORE TOOL EXECUTIONS
-------------------------
You have access to 8 core business tools:
1. recordSale(amount, description, clientName, itemId, quantity) -> Record a sales revenue transaction and update inventory if applicable.
2. createInvoice(clientName, clientEmail, clientAddress, dueDate, taxRate, items, paymentStatus, amountPaid) -> Create an official invoice.
3. recordExpense(amount, description, categoryName, merchant) -> Record a business expense.
4. getSales(period) -> Query sales revenue summary ('today', 'this_week', 'this_month', 'last_month', 'this_year').
5. getExpenses(period, categoryName) -> Query expenses and spending breakdown.
6. getInventory(search) -> Query stock levels, valuations, and low-stock alerts.
7. getOutstandingInvoices() -> Query unpaid client invoices and receivables.
8. calculateTax(period) -> Calculate VAT (7.5%), Companies Income Tax (CIT), and net taxable profit.

Respond strictly in JSON format with this shape:
{
  "reply": "your detailed response string",
  "tool_call": {
    "name": "recordSale" | "createInvoice" | "recordExpense" | "getSales" | "getExpenses" | "getInventory" | "getOutstandingInvoices" | "calculateTax",
    "parameters": {}
  } | null,
  "actions": [
    { "type": "string", "label": "string", "payload": {} }
  ]
}`;

    // ── 3. INTENT DETECTION AND TOOL EXECUTION ENGINE ───────────────────────────
    let reply = "";
    let actions = [];
    let toolCall = null;
    let toolExecuted = false;

    // Check if AI API is available (DeepSeek or OpenAI)
    const apiKey = DEEPSEEK_API_KEY || OPENAI_API_KEY;
    const apiEndpoint = DEEPSEEK_API_KEY
      ? "https://api.deepseek.com/chat/completions"
      : "https://api.openai.com/v1/chat/completions";
    const apiModel = DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-4o-mini";

    if (apiKey) {
      try {
        const response = await fetch(apiEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: apiModel,
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationMessages.map((m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content,
              })),
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          const rawContent = resData.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(rawContent);
          reply = parsed.reply || "";
          actions = parsed.actions || [];
          toolCall = parsed.tool_call || null;
        }
      } catch (err) {
        console.error("AI API call failed, invoking direct rule-based tool engine:", err);
      }
    }

    // Rule-based Fallback Tool Detection if LLM call failed or didn't specify tool call
    if (!toolCall) {
      toolCall = detectRuleBasedToolCall(lastUserMsg);
    }

    // ── 4. EXECUTE SHARED CORE BUSINESS FUNCTION ────────────────────────────────
    if (toolCall && toolCall.name) {
      const toolName = toolCall.name;
      const params = toolCall.parameters || {};

      console.log(`[ROVA Core Agent] Executing shared business function: ${toolName}`, params);

      try {
        let execResult;
        if (toolName === "recordSale") {
          execResult = await executeRecordSale(supabaseClient, activeUserId, params, lastUserMsg);
        } else if (toolName === "createInvoice") {
          execResult = await executeCreateInvoice(supabaseClient, activeUserId, params, lastUserMsg);
        } else if (toolName === "recordExpense") {
          execResult = await executeRecordExpense(supabaseClient, activeUserId, params, lastUserMsg);
        } else if (toolName === "getSales") {
          execResult = await executeGetSales(supabaseClient, activeUserId, params, lastUserMsg);
        } else if (toolName === "getExpenses") {
          execResult = await executeGetExpenses(supabaseClient, activeUserId, params, lastUserMsg);
        } else if (toolName === "getInventory") {
          execResult = await executeGetInventory(supabaseClient, activeUserId, params, lastUserMsg);
        } else if (toolName === "getOutstandingInvoices") {
          execResult = await executeGetOutstandingInvoices(supabaseClient, activeUserId);
        } else if (toolName === "calculateTax") {
          execResult = await executeCalculateTax(supabaseClient, activeUserId, params);
        }

        if (execResult && execResult.formattedSummary) {
          reply = execResult.formattedSummary;
          if (execResult.actions) {
            actions = [...actions, ...execResult.actions];
          }
          toolExecuted = true;
        }
      } catch (execErr) {
        console.error(`Error executing tool ${toolName}:`, execErr);
        reply = `⚠️ Error executing ${toolName}: ${execErr.message}`;
      }
    }

    // Default response fallback if no reply generated
    if (!reply.trim()) {
      reply = `Hello! I'm your ROVA AI Assistant. I can help you record sales, create invoices, log expenses, track inventory, check outstanding customer payments, and calculate taxes. What would you like to do?`;
    }

    return new Response(JSON.stringify({ reply, actions, toolExecuted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("ai-chat error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

// ── RULE-BASED TOOL INTENT DETECTOR ───────────────────────────────────────────
function detectRuleBasedToolCall(text: string) {
  const q = text.toLowerCase();

  // 1. Record Sale ("I sold 50000 today", "sold shoes for 20000", "recorded sale of 10000")
  if (/\b(sold|sale|recorded sale)\b/.test(q)) {
    const amtMatch = q.match(/(?:₦|naira|ngn|\$)?\s*([\d,]+(?:\.\d+)?)/i);
    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, "")) : 0;
    return {
      name: "recordSale",
      parameters: { amount, description: text },
    };
  }

  // 2. Create Invoice ("create invoice for John", "invoice 200000")
  if (/\b(create invoice|new invoice|invoice for|invoice client)\b/.test(q)) {
    const clientMatch = q.match(/(?:for|to)\s+([a-zA-Z\s]+?)(?:\s+for|\s+\d+|$)/i);
    const amtMatch = q.match(/(?:₦|naira|ngn|\$)?\s*([\d,]+(?:\.\d+)?)/i);
    const clientName = clientMatch ? clientMatch[1].trim() : "Client";
    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, "")) : 50000;
    return {
      name: "createInvoice",
      parameters: { clientName, amount, description: text },
    };
  }

  // 3. Record Expense ("I spent 25000 on fuel", "bought fuel for 15000", "expense of 5000")
  if (/\b(spent|expense|bought|fuel|paid for|cost)\b/.test(q) && !/\b(inventory|stock)\b/.test(q)) {
    const amtMatch = q.match(/(?:₦|naira|ngn|\$)?\s*([\d,]+(?:\.\d+)?)/i);
    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, "")) : 0;
    return {
      name: "recordExpense",
      parameters: { amount, description: text },
    };
  }

  // 4. Get Sales ("how much did I sell", "check sales", "total sales")
  if (/\b(sales|how much did i sell|revenue|check sales)\b/.test(q)) {
    let period = "this_month";
    if (q.includes("today")) period = "today";
    else if (q.includes("week")) period = "this_week";
    else if (q.includes("year")) period = "this_year";
    return { name: "getSales", parameters: { period } };
  }

  // 5. Get Expenses ("how much did i spend", "check expenses", "total expenses")
  if (/\b(expenses|how much did i spend|check expenses|spending)\b/.test(q)) {
    let period = "this_month";
    if (q.includes("today")) period = "today";
    else if (q.includes("week")) period = "this_week";
    return { name: "getExpenses", parameters: { period } };
  }

  // 6. Get Inventory ("how much inventory", "check stock", "stock levels")
  if (/\b(inventory|stock|products|items in stock)\b/.test(q)) {
    return { name: "getInventory", parameters: {} };
  }

  // 7. Get Outstanding Invoices ("who owes me", "how much do customers owe", "outstanding invoices")
  if (/\b(owe|debtors|receivables|outstanding|unpaid invoices)\b/.test(q)) {
    return { name: "getOutstandingInvoices", parameters: {} };
  }

  // 8. Calculate Tax ("how much tax", "tax information", "vat", "cit")
  if (/\b(tax|vat|cit|tax liability|tax owe)\b/.test(q)) {
    return { name: "calculateTax", parameters: { period: "this_year" } };
  }

  return null;
}

// ── SHARED BUSINESS FUNCTION EXECUTORS ───────────────────────────────────────

async function executeRecordSale(supabaseClient: any, userId: string, params: any, rawMsg: string) {
  const amount = params.amount || extractAmount(rawMsg) || 0;
  const description = params.description || rawMsg || "Sale";
  const saleDate = new Date().toISOString().split("T")[0];

  const { data: transaction, error } = await supabaseClient
    .from("transactions")
    .insert({
      user_id: userId,
      amount: Math.abs(amount),
      type: "income",
      description: description,
      date: saleDate,
      reference: `SALE-${Date.now().toString().slice(-6)}`,
      ai_category: "Business Revenue",
      is_verified: true,
    })
    .select()
    .single();

  if (error) throw error;

  const todayStr = new Date().toISOString().split("T")[0];
  const { data: todayTxs } = await supabaseClient
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "income")
    .gte("date", todayStr);

  const todayTotal = (todayTxs || []).reduce((s: number, t: any) => s + t.amount, 0);

  return {
    formattedSummary: `✅ **Sale Recorded**: ${formatCurrency(amount)} for "${description}".\n📊 Today's Total Sales: **${formatCurrency(todayTotal)}**.`,
    actions: [{ type: "view_report", label: "View Sales Report", payload: {} }],
  };
}

async function executeCreateInvoice(supabaseClient: any, userId: string, params: any, rawMsg: string) {
  const clientName = params.clientName || "Client";
  const amount = params.amount || extractAmount(rawMsg) || 100000;
  const description = params.description || "Services / Products rendered";
  const dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  const taxRate = params.taxRate || 7.5;
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
      issue_date: new Date().toISOString().split("T")[0],
      due_date: dueDate,
      status: "sent",
      subtotal: subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total: total,
      amount_paid: 0,
      currency: "NGN",
      notes: "Generated by ROVA Unified AI Engine",
    })
    .select()
    .single();

  if (error) throw error;

  await supabaseClient.from("invoice_items").insert({
    invoice_id: invoice.id,
    description: description,
    quantity: 1,
    unit_price: subtotal,
    amount: subtotal,
  });

  return {
    formattedSummary: `📄 **Invoice #${invoiceNumber} Created** for **${clientName}**!\n• Subtotal: ${formatCurrency(subtotal)}\n• Tax (${taxRate}%): ${formatCurrency(taxAmount)}\n• **Total Amount**: **${formatCurrency(total)}**\n• Due Date: ${dueDate}`,
    actions: [{ type: "view_invoice", label: "View Invoice", payload: { invoice_id: invoice.id } }],
  };
}

async function executeRecordExpense(supabaseClient: any, userId: string, params: any, rawMsg: string) {
  const amount = params.amount || extractAmount(rawMsg) || 0;
  const description = params.description || rawMsg || "Expense";
  const expenseDate = new Date().toISOString().split("T")[0];

  const { data: transaction, error } = await supabaseClient
    .from("transactions")
    .insert({
      user_id: userId,
      amount: Math.abs(amount),
      type: "expense",
      description: description,
      date: expenseDate,
      reference: `EXP-${Date.now().toString().slice(-6)}`,
      ai_category: params.categoryName || "Operating Expense",
      is_verified: true,
    })
    .select()
    .single();

  if (error) throw error;

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const { data: monthTxs } = await supabaseClient
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("date", startOfMonth);

  const monthTotal = (monthTxs || []).reduce((s: number, t: any) => s + t.amount, 0);

  return {
    formattedSummary: `💸 **Expense Recorded**: ${formatCurrency(amount)} for "${description}".\n📊 Total Expenses This Month: **${formatCurrency(monthTotal)}**.`,
    actions: [{ type: "view_report", label: "View Expense Report", payload: {} }],
  };
}

async function executeGetSales(supabaseClient: any, userId: string, params: any, rawMsg: string) {
  const period = params.period || "this_month";
  const now = new Date();
  let startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  if (period === "today") startDate = now.toISOString().split("T")[0];

  const { data: txs, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "income")
    .gte("date", startDate);

  if (error) throw error;

  const salesList = txs || [];
  const totalAmount = salesList.reduce((s: number, t: any) => s + t.amount, 0);

  return {
    formattedSummary: `📈 **Sales Summary (${period.toUpperCase().replace("_", " ")})**\n• Total Sales Revenue: **${formatCurrency(totalAmount)}**\n• Total Sales Recorded: **${salesList.length}**`,
  };
}

async function executeGetExpenses(supabaseClient: any, userId: string, params: any, rawMsg: string) {
  const period = params.period || "this_month";
  const now = new Date();
  let startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  if (period === "today") startDate = now.toISOString().split("T")[0];

  const { data: txs, error } = await supabaseClient
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("date", startDate);

  if (error) throw error;

  const expenseList = txs || [];
  const totalAmount = expenseList.reduce((s: number, t: any) => s + t.amount, 0);

  return {
    formattedSummary: `📉 **Expense Summary (${period.toUpperCase().replace("_", " ")})**\n• Total Expenses: **${formatCurrency(totalAmount)}**\n• Total Transactions: **${expenseList.length}**`,
  };
}

async function executeGetInventory(supabaseClient: any, userId: string, params: any, rawMsg: string) {
  const { data: items, error } = await supabaseClient
    .from("inventory_items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw error;

  const inventoryList = items || [];
  const totalValuation = inventoryList.reduce((s: number, i: any) => s + (i.current_stock || 0) * (i.cost_price || 0), 0);
  const lowStock = inventoryList.filter((i: any) => (i.current_stock || 0) <= (i.reorder_level || 5));

  const sampleList = inventoryList
    .slice(0, 5)
    .map((i: any) => `• **${i.name}**: ${i.current_stock} ${i.unit || 'units'}`)
    .join("\n");

  return {
    formattedSummary: `📦 **Inventory Status**\n• Total Stock Items: **${inventoryList.length}**\n• Total Stock Valuation: **${formatCurrency(totalValuation)}**\n• Low Stock Items: **${lowStock.length}**\n\n${sampleList || "No items in stock."}`,
    actions: [{ type: "add_inventory", label: "Add Inventory Item", payload: {} }],
  };
}

async function executeGetOutstandingInvoices(supabaseClient: any, userId: string) {
  const { data: invoices, error } = await supabaseClient
    .from("invoices")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "paid");

  if (error) throw error;

  const unpaidList = invoices || [];
  const totalOwed = unpaidList.reduce((s: number, i: any) => s + ((i.total || 0) - (i.amount_paid || 0)), 0);

  const clientList = unpaidList
    .map((i: any) => `• **${i.client_name}**: Owed ${formatCurrency((i.total || 0) - (i.amount_paid || 0))} (Due: ${i.due_date || 'N/A'})`)
    .join("\n");

  return {
    formattedSummary: `📋 **Outstanding Customer Receivables**\n• Total Customer Debt Owed to You: **${formatCurrency(totalOwed)}**\n• Pending Invoices: **${unpaidList.length}**\n\n${clientList || "🎉 No outstanding client debts!"}`,
  };
}

async function executeCalculateTax(supabaseClient: any, userId: string, params: any) {
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
  const citRate = grossIncome > 100000000 ? 0.30 : grossIncome >= 25000000 ? 0.20 : 0.0;
  const estimatedCIT = netProfit * citRate;
  const totalTax = vatLiability + estimatedCIT;

  return {
    formattedSummary: `🏛️ **ROVA Tax Liability Estimation (THIS YEAR)**\n• Gross Revenue: **${formatCurrency(grossIncome)}**\n• Allowable Expenses: **${formatCurrency(allowableExpenses)}**\n• Net Taxable Profit: **${formatCurrency(netProfit)}**\n\n📊 **Tax Breakdown:**\n• VAT (7.5%): **${formatCurrency(vatLiability)}**\n• Companies Income Tax (CIT): **${formatCurrency(estimatedCIT)}**\n• **Total Estimated Tax Owed**: **${formatCurrency(totalTax)}**`,
  };
}

function extractAmount(text: string): number {
  const m = text.match(/(?:₦|naira|ngn|\$)?\s*([\d,]+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
}
