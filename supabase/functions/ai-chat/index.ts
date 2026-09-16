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

// ── Audit Logger ──────────────────────────────────────────────────────────────
async function logAIAction(supabaseClient: any, params: {
  userId: string;
  source: "web" | "whatsapp";
  userRequest: string;
  toolCalled: string;
  parameters: Record<string, any>;
  confirmationStatus: "auto" | "confirmed" | "skipped" | "high_risk_blocked" | "pending";
  resultStatus: "success" | "error" | "pending_confirmation" | "cancelled";
  recordId?: string;
  errorMessage?: string;
}) {
  try {
    await supabaseClient.from("ai_action_log").insert({
      user_id: params.userId,
      source: params.source,
      user_request: params.userRequest,
      tool_called: params.toolCalled,
      parameters: params.parameters,
      confirmation_status: params.confirmationStatus,
      result_status: params.resultStatus,
      record_id: params.recordId || "",
      error_message: params.errorMessage || "",
    });
  } catch (err) {
    // Never let audit logging crash the main flow
    console.error("[ROVA Audit] Failed to log AI action:", err);
  }
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

    // source tells us if the request came from whatsapp or web
    const source: "web" | "whatsapp" = body.source || context?.source || "web";

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
    const [txRes, accRes, invRes, invcRes, empRes, payrollRes, teamRes] = await Promise.all([
      supabaseClient
        .from("transactions")
        .select("*")
        .eq("user_id", activeUserId)
        .order("date", { ascending: false })
        .limit(100),
      supabaseClient.from("accounts").select("*").eq("user_id", activeUserId),
      supabaseClient.from("inventory_items").select("*").eq("user_id", activeUserId).eq("status", "active"),
      supabaseClient.from("invoices").select("*").eq("user_id", activeUserId).neq("status", "paid"),
      supabaseClient.from("employees").select("*").eq("user_id", activeUserId).eq("status", "active"),
      supabaseClient
        .from("payroll_runs")
        .select("*")
        .eq("user_id", activeUserId)
        .order("created_at", { ascending: false })
        .limit(3),
      supabaseClient
        .from("team_members")
        .select("id, invite_email, role, status")
        .eq("owner_id", activeUserId),
    ]);

    const txs = txRes.data ?? transactions ?? [];
    const accs = accRes.data ?? accounts ?? [];
    const inventoryItems = invRes.data ?? [];
    const outstandingInvoices = invcRes.data ?? [];
    const employees = empRes.data ?? [];
    const payrollRuns = payrollRes.data ?? [];
    const teamMembers = teamRes.data ?? [];

    // Also get distinct client names from invoices (customers)
    const { data: clientData } = await supabaseClient
      .from("invoices")
      .select("client_name, client_email")
      .eq("user_id", activeUserId)
      .order("created_at", { ascending: false });

    const uniqueClients = Array.from(
      new Map((clientData ?? []).map((c: any) => [c.client_name, c])).values()
    );

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
    const lowStockItems = inventoryItems.filter((i: any) => (i.current_stock || 0) <= (i.reorder_level || 5));

    const latestPayroll = payrollRuns[0];

    const financialCtx = `
Current ROVA Financial Snapshot (Real-Time Database):
- Total Account Balance: ₦${totalBalance.toLocaleString()}
- This Month Income: ₦${thisIncome.toLocaleString()}
- This Month Expenses: ₦${thisExpense.toLocaleString()}
- Net Profit/Loss This Month: ₦${net.toLocaleString()}
- Active Inventory Items: ${inventoryItems.length} (${lowStockItems.length} low stock)
- Outstanding Client Receivables: ₦${totalOutstandingAmount.toLocaleString()} (${outstandingInvoices.length} unpaid invoices)
- Active Employees/Staff on Payroll: ${employees.length}
- Team Members (Access): ${teamMembers.length}
- Known Clients: ${uniqueClients.length}
- Latest Payroll Run: ${latestPayroll ? `${latestPayroll.period_label} — Net ₦${(latestPayroll.total_net || 0).toLocaleString()}` : "None on record"}
`.trim();

    const staffRestriction = isStaff
      ? "STAFF MODE STRICT RULE: You MUST NOT reveal total profit margins, total net income, or tax liabilities. Only answer transaction and operational inventory queries."
      : "";

    // ── 2. SYSTEM PROMPT ─────────────────────────────────────────────────────────
    const systemPrompt = `You are ROVA AI, the single unified AI Agent and conversational ERP operating layer for Nigerian businesses.
You operate identically whether the user is on the ROVA web app or WhatsApp — same database, same tools, same rules.

${staffRestriction}

${financialCtx}

─────────────────────────────────
ROVA CORE TOOL DEFINITIONS
─────────────────────────────────
You have access to 12 core business tools. ALWAYS use these to fetch real data — never guess or estimate.

READ-ONLY TOOLS (execute immediately, no confirmation needed):
1. getSales(period) — Query sales revenue. period: 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year'
2. getExpenses(period, categoryName?) — Query expenses and breakdown
3. getInventory(search?) — Query stock levels. If 'search' returns multiple matches, list them and ask the user which one.
4. getOutstandingInvoices() — Query all unpaid client invoices
5. getStaff() — Query all active employees/staff with their salaries and roles
6. getPayroll(period?) — Query payroll run history and totals
7. getCustomers() — Query all clients who have ever been invoiced
8. getTransactions(date?, period?, type?) — Query specific transactions by date or period

DATA CREATION TOOLS:
9. recordSale(amount, description, clientName?) — Record a sales revenue transaction (MUST NOT ask for confirmation)
10. recordExpense(amount, description, categoryName?, merchant?) — Record a business expense (MUST NOT ask for confirmation)
11. createInvoice(clientName, items, dueDate?, taxRate?, notes?) — Create an invoice. NEVER use default "Client". If clientName is missing, STOP and ask: "Who should I address this invoice to?" If items are missing, ask: "What items or services should I include?". MUST ask for confirmation before executing.
12. createReceipt(customerName, amount?, paymentMethod?, description?) — Create a payment receipt. If customerName is missing, STOP and ask: "Who should I address this receipt to?". MUST ask for confirmation before executing.

HIGH-RISK TOOLS (NEVER execute from ambiguous instructions — require explicit typed confirmation):
13. deleteTransaction(transactionId) — Permanently delete a transaction record

─────────────────────────────────
CRITICAL BEHAVIOUR RULES
─────────────────────────────────
1. NEVER fabricate data. If you don't know a value, use the appropriate tool to fetch it.
2. READ-ONLY tools: respond immediately with data from the database.
3. CREATE TOOLS: Normal transactions (recordSale, recordExpense) MUST be automatically recorded immediately without asking for confirmation. Only createInvoice requires asking if client or items are missing.
4. INVOICE CREATION: If client name OR line items are missing, ask for them before doing anything. Do not fill in defaults.
5. DISAMBIGUATION: If getInventory returns multiple matches, list them as numbered options and ask "Which one did you mean?"
6. SOURCE AWARENESS: You are operating via ${source === "whatsapp" ? "WhatsApp" : "the ROVA web app"}. Tailor your reply format accordingly — for WhatsApp, use plain readable text without markdown tables.

─────────────────────────────────
RESPONSE FORMAT (strict JSON)
─────────────────────────────────
{
  "reply": "your response text",
  "tool_call": {
    "name": "getSales" | "getExpenses" | "getInventory" | "getOutstandingInvoices" | "getStaff" | "getPayroll" | "getCustomers" | "getTransactions" | "recordSale" | "recordExpense" | "createInvoice" | "createReceipt" | "deleteTransaction",
    "parameters": {}
  } | null,
  "requires_confirmation": false,
  "confirmation_summary": "",
  "actions": [{ "type": "string", "label": "string", "payload": {} }]
}`;

    // ── 3. LLM CALL ──────────────────────────────────────────────────────────────
    let reply = "";
    let actions = [];
    let toolCall = null;
    let requiresConfirmation = false;
    let confirmationSummary = "";

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
            temperature: 0.1,
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
          requiresConfirmation = parsed.requires_confirmation === true;
          confirmationSummary = parsed.confirmation_summary || "";
        }
      } catch (err) {
        console.error("AI API call failed, using rule-based fallback:", err);
      }
    }

    // Rule-based fallback if LLM didn't detect a tool
    if (!toolCall) {
      toolCall = detectRuleBasedToolCall(lastUserMsg);
    }

    // ── 4. CONFIRMATION GATE ─────────────────────────────────────────────────────
    // For write operations, if LLM flagged requires_confirmation, return early with pending state.
    // The client will display a confirm bubble. When the user confirms, client re-sends with
    // body.confirmed = true.
    const WRITE_TOOLS = ["createInvoice", "createReceipt"];
    const HIGH_RISK_TOOLS = ["deleteTransaction"];
    const toolName = toolCall?.name || "";

    const userConfirmed = body.confirmed === true;
    const userCancelled = body.cancelled === true;

    if (userCancelled && toolName) {
      await logAIAction(supabaseClient, {
        userId: activeUserId,
        source,
        userRequest: lastUserMsg,
        toolCalled: toolName,
        parameters: toolCall?.parameters || {},
        confirmationStatus: "skipped",
        resultStatus: "cancelled",
      });
      return new Response(
        JSON.stringify({ reply: "Got it — action cancelled. Let me know if there's anything else I can help with.", actions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // High-risk tools — require explicit confirmation from web and WhatsApp
    if (HIGH_RISK_TOOLS.includes(toolName) && !userConfirmed) {
      if (source === "whatsapp") {
        await logAIAction(supabaseClient, {
          userId: activeUserId,
          source,
          userRequest: lastUserMsg,
          toolCalled: toolName,
          parameters: toolCall?.parameters || {},
          confirmationStatus: "pending",
          resultStatus: "pending_confirmation",
        });
        const waConfirmMsg = `${reply || "⚠️ I'm about to permanently delete this record. This cannot be undone. Are you absolutely sure?"}\n\nReply *YES* to confirm or *NO* to cancel.`;
        return new Response(
          JSON.stringify({
            reply: waConfirmMsg,
            requiresConfirmation: true,
            pendingToolCall: toolCall,
            actions: [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      // Web: return confirmation request
      const confirmReply = reply || `⚠️ I'm about to permanently delete this record. This cannot be undone. Are you absolutely sure?`;
      return new Response(
        JSON.stringify({
          reply: confirmReply,
          requiresConfirmation: true,
          confirmationSummary: confirmationSummary || "Delete transaction",
          pendingToolCall: toolCall,
          actions: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Write tools — require confirmation unless user already confirmed
    if (WRITE_TOOLS.includes(toolName) && requiresConfirmation && !userConfirmed) {
      await logAIAction(supabaseClient, {
        userId: activeUserId,
        source,
        userRequest: lastUserMsg,
        toolCalled: toolName,
        parameters: toolCall?.parameters || {},
        confirmationStatus: "pending",
        resultStatus: "pending_confirmation",
      });

      // For WhatsApp: ask via text
      if (source === "whatsapp") {
        const waConfirmMsg = `${reply}\n\nReply *YES* to confirm or *NO* to cancel.`;
        return new Response(
          JSON.stringify({ reply: waConfirmMsg, requiresConfirmation: true, pendingToolCall: toolCall, actions: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }

      return new Response(
        JSON.stringify({
          reply,
          requiresConfirmation: true,
          confirmationSummary,
          pendingToolCall: toolCall,
          actions: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ── 5. EXECUTE TOOL ──────────────────────────────────────────────────────────
    let toolExecuted = false;
    if (toolCall && toolCall.name) {
      const params = toolCall.parameters || {};
      const confirmStatus = userConfirmed ? "confirmed" : "auto";

      console.log(`[ROVA Core Agent] Executing: ${toolName}`, params);

      try {
        let execResult: any;
        if (toolName === "recordSale") {
          execResult = await executeRecordSale(supabaseClient, activeUserId, params, lastUserMsg);
        } else if (toolName === "createInvoice") {
          execResult = await executeCreateInvoice(supabaseClient, activeUserId, params, lastUserMsg);
        } else if (toolName === "createReceipt") {
          execResult = await executeCreateReceipt(supabaseClient, activeUserId, params, lastUserMsg);
        } else if (toolName === "recordExpense") {
          execResult = await executeRecordExpense(supabaseClient, activeUserId, params, lastUserMsg);
        } else if (toolName === "getSales") {
          execResult = await executeGetSales(supabaseClient, activeUserId, params);
        } else if (toolName === "getExpenses") {
          execResult = await executeGetExpenses(supabaseClient, activeUserId, params);
        } else if (toolName === "getInventory") {
          execResult = await executeGetInventory(supabaseClient, activeUserId, params);
        } else if (toolName === "getOutstandingInvoices") {
          execResult = await executeGetOutstandingInvoices(supabaseClient, activeUserId);
        } else if (toolName === "calculateTax") {
          execResult = await executeCalculateTax(supabaseClient, activeUserId, params);
        } else if (toolName === "getStaff") {
          execResult = await executeGetStaff(supabaseClient, activeUserId);
        } else if (toolName === "getPayroll") {
          execResult = await executeGetPayroll(supabaseClient, activeUserId, params);
        } else if (toolName === "getCustomers") {
          execResult = await executeGetCustomers(supabaseClient, activeUserId);
        } else if (toolName === "getTransactions") {
          execResult = await executeGetTransactions(supabaseClient, activeUserId, params);
        } else if (toolName === "deleteTransaction") {
          execResult = await executeDeleteTransaction(supabaseClient, activeUserId, params);
        }

        if (execResult && execResult.formattedSummary) {
          reply = execResult.formattedSummary;
          if (execResult.actions) actions = [...actions, ...execResult.actions];
          toolExecuted = true;

          await logAIAction(supabaseClient, {
            userId: activeUserId,
            source,
            userRequest: lastUserMsg,
            toolCalled: toolName,
            parameters: params,
            confirmationStatus: confirmStatus,
            resultStatus: "success",
            recordId: execResult.recordId || "",
          });
        }
      } catch (execErr: any) {
        console.error(`Error executing tool ${toolName}:`, execErr);
        reply = `⚠️ I ran into an error while trying to complete that: ${execErr.message}. Please try again or check the relevant section in the app.`;

        await logAIAction(supabaseClient, {
          userId: activeUserId,
          source,
          userRequest: lastUserMsg,
          toolCalled: toolName,
          parameters: params,
          confirmationStatus: confirmStatus,
          resultStatus: "error",
          errorMessage: execErr.message,
        });
      }
    }

    if (!reply.trim()) {
      reply = `Hi! I'm ROVA AI, your business financial assistant. I can help you record sales, create invoices, log expenses, check stock levels, review payroll, see who owes you money, and calculate taxes. What would you like to do?`;
    }

    return new Response(JSON.stringify({ reply, actions, toolExecuted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("ai-chat error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

// ── RULE-BASED TOOL INTENT DETECTOR ─────────────────────────────────────────
function detectRuleBasedToolCall(text: string) {
  const q = text.toLowerCase();

  if (/\b(sold|sale|recorded sale|i made a sale)\b/.test(q)) {
    const amt = extractAmount(q);
    return { name: "recordSale", parameters: { amount: amt, description: text } };
  }
  if (/\b(create invoice|new invoice|invoice for|invoice client|send invoice)\b/.test(q)) {
    const clientMatch = q.match(/(?:for|to)\s+([a-zA-Z\s]+?)(?:\s+for|\s+\d+|$)/i);
    const clientName = clientMatch ? clientMatch[1].trim() : "";
    const amount = extractAmount(q);
    return { name: "createInvoice", parameters: { clientName, amount, description: text } };
  }
  if (/\b(create receipt|new receipt|receipt for|send receipt|generate receipt)\b/.test(q)) {
    const customerMatch = q.match(/(?:for|to)\s+([a-zA-Z\s]+?)(?:\s+for|\s+\d+|$)/i);
    const customerName = customerMatch ? customerMatch[1].trim() : "";
    const amount = extractAmount(q);
    return { name: "createReceipt", parameters: { customerName, amount, description: text } };
  }
  if (/\b(spent|expense|bought|paid for|cost|fuel|data|generator)\b/.test(q) && !/\b(inventory|stock)\b/.test(q)) {
    return { name: "recordExpense", parameters: { amount: extractAmount(q), description: text } };
  }
  if (/\b(how much.*sell|total sales|sales|revenue)\b/.test(q)) {
    let period = "this_month";
    if (q.includes("today")) period = "today";
    else if (q.includes("week")) period = "this_week";
    else if (q.includes("year")) period = "this_year";
    else if (q.includes("last month")) period = "last_month";
    return { name: "getSales", parameters: { period } };
  }
  if (/\b(how much.*spend|expenses|spending)\b/.test(q)) {
    let period = "this_month";
    if (q.includes("today")) period = "today";
    else if (q.includes("week")) period = "this_week";
    return { name: "getExpenses", parameters: { period } };
  }
  if (/\b(inventory|stock|how many|how much.*bags?|units?|items?)\b/.test(q)) {
    const search = q.match(/(?:how many|how much)\s+(?:bags?\s+of\s+|units?\s+of\s+|packs?\s+of\s+)?(.+?)(?:\s+do i|\s+is|\?|$)/i)?.[1] || "";
    return { name: "getInventory", parameters: { search: search.trim() } };
  }
  if (/\b(owe|debtors|receivables|outstanding|unpaid invoices?|who owes)\b/.test(q)) {
    return { name: "getOutstandingInvoices", parameters: {} };
  }
  if (/\b(tax|vat|cit|tax liability)\b/.test(q)) {
    return { name: "calculateTax", parameters: { period: "this_year" } };
  }
  if (/\b(staff|employees?|workers?|how many.*staff|team)\b/.test(q) && !/\b(payroll|salary|salaries)\b/.test(q)) {
    return { name: "getStaff", parameters: {} };
  }
  if (/\b(payroll|salary|salaries|pay.*run)\b/.test(q)) {
    return { name: "getPayroll", parameters: {} };
  }
  if (/\b(customers?|clients?|who.*customers?|all.*clients?)\b/.test(q)) {
    return { name: "getCustomers", parameters: {} };
  }
  if (/\b(delete|remove|cancel)\s+(?:transaction|expense|sale|record|entry)\b/i.test(q)) {
    const amt = extractAmount(q);
    const descMatch = q.replace(/delete|remove|cancel|transaction|expense|sale|record|entry/gi, "").trim();
    return { name: "deleteTransaction", parameters: { amount: amt, description: descMatch, query: text } };
  }
  if (/\b(transactions?|what.*transactions?|transactions?.*on|on .*(january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}))\b/.test(q)) {
    const dateMatch = q.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
    return { name: "getTransactions", parameters: { date: dateMatch?.[1] || "", period: "this_month" } };
  }

  return null;
}

// ── TOOL EXECUTORS ────────────────────────────────────────────────────────────

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
      description,
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
    recordId: transaction.id,
  };
}

async function executeCreateInvoice(supabaseClient: any, userId: string, params: any, rawMsg: string) {
  const clientName = params.clientName;
  if (!clientName || clientName.trim() === "") {
    return {
      formattedSummary: "Who should I address this invoice to? Please provide the client's name.",
      requiresClarification: true,
    };
  }

  const amount = params.amount || extractAmount(rawMsg) || 0;
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

  // Insert line items
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

  return {
    formattedSummary: `📄 **Invoice #${invoiceNumber} Created** for **${clientName}**!\n• Subtotal: ${formatCurrency(subtotal)}\n• Tax (${taxRate}%): ${formatCurrency(taxAmount)}\n• **Total**: **${formatCurrency(total)}**\n• Due: ${dueDate}`,
    actions: [{ type: "view_invoice", label: "View Invoice", payload: { invoice_id: invoice.id } }],
    recordId: invoice.id,
  };
}

async function executeCreateReceipt(supabaseClient: any, userId: string, params: any, rawMsg: string) {
  const customerName = params.customerName || params.clientName;
  if (!customerName || customerName.trim() === "") {
    return {
      formattedSummary: "Who should I address this receipt to? Please provide the customer's name.",
      requiresClarification: true,
    };
  }

  const amount = params.amount || extractAmount(rawMsg) || 0;
  const description = params.description || "Payment received";
  const paymentMethod = params.paymentMethod || "Bank Transfer";
  const receiptDate = new Date().toISOString().split("T")[0];

  const { data: countData, error: countErr } = await supabaseClient
    .rpc("generate_next_receipt_number", { p_user_id: userId });
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
    if (error.code === '42P01') {
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

  return {
    formattedSummary: `🧾 **Receipt #${receipt.receipt_number} Generated** for **${customerName}**!\n• Amount: **${formatCurrency(amount)}**\n• Method: ${paymentMethod}\n\nYou can view and share this receipt from the Receipts tab.`,
    actions: [{ type: "view_receipt", label: "View Receipt", payload: { receipt_id: receipt.id } }],
    recordId: receipt.id,
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
      description,
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
    recordId: transaction.id,
  };
}

async function executeGetSales(supabaseClient: any, userId: string, params: any) {
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
  const topSales = salesList.slice(0, 5).map((t: any) => `• ${t.date}: **${formatCurrency(t.amount)}** — ${t.description}`).join("\n");

  return {
    formattedSummary: `📈 **Sales Summary (${period.replace(/_/g, " ").toUpperCase()})**\n• Total Revenue: **${formatCurrency(totalAmount)}**\n• Transactions: **${salesList.length}**\n\n${topSales || "No sales recorded for this period."}`,
  };
}

async function executeGetExpenses(supabaseClient: any, userId: string, params: any) {
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
  const top = expenseList.slice(0, 5).map((t: any) => `• ${t.date}: **${formatCurrency(t.amount)}** — ${t.description}`).join("\n");

  return {
    formattedSummary: `📉 **Expense Summary (${period.replace(/_/g, " ").toUpperCase()})**\n• Total Spent: **${formatCurrency(totalAmount)}**\n• Transactions: **${expenseList.length}**\n\n${top || "No expenses recorded for this period."}`,
  };
}

async function executeGetInventory(supabaseClient: any, userId: string, params: any) {
  let query = supabaseClient.from("inventory_items").select("*").eq("user_id", userId).eq("status", "active");

  if (params.search && params.search.trim()) {
    query = query.ilike("name", `%${params.search.trim()}%`);
  }

  const { data: items, error } = await query;
  if (error) throw error;

  const inventoryList = items || [];

  // Disambiguation: multiple matches for a search query
  if (params.search && inventoryList.length > 1) {
    const options = inventoryList
      .map((i: any, idx: number) => `${idx + 1}. **${i.name}** — ${i.current_stock} ${i.unit || "units"} in stock (Cost: ${formatCurrency(i.cost_price)})`)
      .join("\n");
    return {
      formattedSummary: `🔍 I found **${inventoryList.length} items** matching "${params.search}". Which one did you mean?\n\n${options}`,
      actions: inventoryList.map((i: any) => ({
        type: "select_inventory_item",
        label: `${i.name} (${i.current_stock} ${i.unit || "units"})`,
        payload: { item_id: i.id, item_name: i.name, current_stock: i.current_stock },
      })),
    };
  }

  // Single match or no search
  if (params.search && inventoryList.length === 1) {
    const i = inventoryList[0];
    const isLow = (i.current_stock || 0) <= (i.reorder_level || 5);
    return {
      formattedSummary: `📦 **${i.name}**\n• In Stock: **${i.current_stock} ${i.unit || "units"}** ${isLow ? "⚠️ LOW STOCK" : "✅"}\n• Cost Price: ${formatCurrency(i.cost_price)}\n• Selling Price: ${formatCurrency(i.selling_price)}\n• Reorder Level: ${i.reorder_level || 5} units`,
    };
  }

  // Full inventory overview
  const totalValuation = inventoryList.reduce((s: number, i: any) => s + (i.current_stock || 0) * (i.cost_price || 0), 0);
  const lowStock = inventoryList.filter((i: any) => (i.current_stock || 0) <= (i.reorder_level || 5));
  const sampleList = inventoryList
    .slice(0, 8)
    .map((i: any) => `• **${i.name}**: ${i.current_stock} ${i.unit || "units"} ${(i.current_stock || 0) <= (i.reorder_level || 5) ? "⚠️" : ""}`)
    .join("\n");

  return {
    formattedSummary: `📦 **Inventory Overview**\n• Total Items: **${inventoryList.length}**\n• Stock Valuation: **${formatCurrency(totalValuation)}**\n• Low Stock Alerts: **${lowStock.length}**\n\n${sampleList || "No items in stock."}`,
    actions: [{ type: "add_inventory", label: "Add Item", payload: {} }],
  };
}

async function executeGetOutstandingInvoices(supabaseClient: any, userId: string) {
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
    .map((i: any) => `• **${i.client_name}**: ${formatCurrency((i.total || 0) - (i.amount_paid || 0))} (Due: ${i.due_date || "N/A"})`)
    .join("\n");

  return {
    formattedSummary: `📋 **Outstanding Receivables**\n• Total Owed to You: **${formatCurrency(totalOwed)}**\n• Pending Invoices: **${unpaidList.length}**\n\n${clientList || "🎉 No outstanding client debts!"}`,
  };
}

async function executeGetStaff(supabaseClient: any, userId: string) {
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
    .map((e: any) => `• **${e.full_name}** — ${e.role || "No role"} | ${formatCurrency(e.gross_salary)}/month`)
    .join("\n");

  return {
    formattedSummary: `👥 **Active Staff (${list.length})**\n• Total Monthly Payroll Liability: **${formatCurrency(totalGross)}**\n\n${staffLines || "No active employees on record."}`,
    actions: list.length === 0 ? [{ type: "view_report", label: "Add Employee", payload: { page: "payroll" } }] : [],
  };
}

async function executeGetPayroll(supabaseClient: any, userId: string, params: any) {
  const { data: runs, error } = await supabaseClient
    .from("payroll_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) throw error;

  const runList = runs || [];
  const runLines = runList
    .map((r: any) => `• **${r.period_label}**: Gross ${formatCurrency(r.total_gross)} → Net ${formatCurrency(r.total_net)} (${r.employee_count} staff)`)
    .join("\n");

  return {
    formattedSummary: `💰 **Payroll History**\n\n${runLines || "No payroll runs recorded yet."}`,
    actions: [{ type: "view_report", label: "View Payroll", payload: { page: "payroll" } }],
  };
}

async function executeGetCustomers(supabaseClient: any, userId: string) {
  const { data: invoices, error } = await supabaseClient
    .from("invoices")
    .select("client_name, client_email, total, amount_paid, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Aggregate by client
  const clientMap: Record<string, { name: string; email: string; totalInvoiced: number; totalPaid: number; invoiceCount: number }> = {};
  for (const inv of (invoices || [])) {
    if (!clientMap[inv.client_name]) {
      clientMap[inv.client_name] = { name: inv.client_name, email: inv.client_email || "", totalInvoiced: 0, totalPaid: 0, invoiceCount: 0 };
    }
    clientMap[inv.client_name].totalInvoiced += (inv.total || 0);
    clientMap[inv.client_name].totalPaid += (inv.amount_paid || 0);
    clientMap[inv.client_name].invoiceCount += 1;
  }

  const clients = Object.values(clientMap);
  const clientLines = clients
    .slice(0, 10)
    .map((c) => `• **${c.name}** — ${c.invoiceCount} invoice(s) | Total billed: ${formatCurrency(c.totalInvoiced)} | Paid: ${formatCurrency(c.totalPaid)}`)
    .join("\n");

  return {
    formattedSummary: `🧑‍💼 **Your Clients/Customers (${clients.length})**\n\n${clientLines || "No clients on record yet. Create your first invoice to add a client."}`,
    actions: [{ type: "create_invoice", label: "Create Invoice", payload: {} }],
  };
}

async function executeGetTransactions(supabaseClient: any, userId: string, params: any) {
  let query = supabaseClient.from("transactions").select("*").eq("user_id", userId);

  if (params.date) {
    // Try to parse date
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
    .map((t: any) => `• ${t.date} | ${t.type === "income" ? "📈" : "📉"} **${formatCurrency(t.amount)}** — ${t.description}`)
    .join("\n");

  const label = params.date ? `on ${params.date}` : "this month";
  return {
    formattedSummary: `🗒️ **Transactions ${label}** (${list.length} records)\n• In: **${formatCurrency(totalIn)}** | Out: **${formatCurrency(totalOut)}**\n\n${lines || "No transactions found for this period."}`,
  };
}

async function executeDeleteTransaction(supabaseClient: any, userId: string, params: any) {
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
    formattedSummary: `🗑️ **Transaction Deleted**: "${tx.description || 'Transaction'}" (${formatCurrency(tx.amount)}) has been permanently removed.`,
    recordId: txId,
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
  const citRate = grossIncome > 100_000_000 ? 0.30 : grossIncome >= 25_000_000 ? 0.20 : 0.0;
  const estimatedCIT = netProfit * citRate;
  const devLevy = netProfit * 0.04;
  const totalTax = vatLiability + estimatedCIT;

  return {
    formattedSummary: `🏛️ **Tax Liability Estimate — This Year**\n• Gross Revenue: **${formatCurrency(grossIncome)}**\n• Allowable Expenses: **${formatCurrency(allowableExpenses)}**\n• Net Taxable Profit: **${formatCurrency(netProfit)}**\n\n📊 **Breakdown:**\n• VAT (7.5% on revenue): **${formatCurrency(vatLiability)}**\n• CIT (${(citRate * 100).toFixed(0)}%): **${formatCurrency(estimatedCIT)}**\n• Dev Levy (4%): **${formatCurrency(devLevy)}**\n• **Total Estimated Tax: ${formatCurrency(totalTax)}**\n\n⚠️ *This is an estimate. Please consult a tax professional for official filing.*`,
  };
}

function extractAmount(text: string): number {
  const m = text.match(/(?:₦|naira|ngn|\$)?\s*([\d,]+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
}
