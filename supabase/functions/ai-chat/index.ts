// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateReceiptPDF, generateInvoicePDF } from "./documentGenerator.ts";

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

// ─────────────────────────────────────────────────────────────────────────────
// MEMORY SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches active memories for a user, ordered by importance (desc) then recency.
 * Returns a formatted string ready to inject into the system prompt.
 * Max 20 memories to stay within token budgets.
 */
async function fetchUserMemories(supabaseClient: any, userId: string): Promise<{
  memories: any[];
  formattedCtx: string;
}> {
  try {
    const { data: memories, error } = await supabaseClient
      .from("rova_memories")
      .select("id, memory_type, content, importance, created_at")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !memories || memories.length === 0) {
      return { memories: [], formattedCtx: "" };
    }

    const grouped: Record<string, string[]> = {};
    for (const m of memories) {
      const type = m.memory_type || "general";
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(m.content);
    }

    const typeLabels: Record<string, string> = {
      preference: "User Preferences",
      business_detail: "Business Details",
      instruction: "Standing Instructions",
      recurring_contact: "Known Contacts / Suppliers",
      decision: "Past Decisions",
      general: "Other Context",
    };

    const sections = Object.entries(grouped)
      .map(([type, items]) => {
        const label = typeLabels[type] || type;
        return `${label}:\n${items.map(i => `  - ${i}`).join("\n")}`;
      })
      .join("\n\n");

    const formattedCtx = `
─────────────────────────────────
ROVA MEMORY — What I Know About This User/Business
─────────────────────────────────
${sections}

Use this context to personalise responses naturally. Do NOT announce that you are using memory; just use it.
`.trim();

    return { memories, formattedCtx };
  } catch (err) {
    console.error("[ROVA Memory] Failed to fetch memories:", err);
    return { memories: [], formattedCtx: "" };
  }
}

/**
 * Detects if the user message is a memory management command.
 * Returns the command type or null.
 */
function detectMemoryCommand(text: string): "forget_last" | "forget_all" | "recall" | "force_remember" | null {
  const q = text.toLowerCase().trim();

  // "forget that" / "forget the last thing" / "don't remember that"
  if (/\b(forget that|forget the last|don't remember that|delete that memory|remove that memory|erase that)\b/i.test(q)) {
    return "forget_last";
  }
  // "clear all my memories" / "forget everything"
  if (/\b(clear all memories|forget everything|reset my memory|delete all memories|wipe my memories)\b/i.test(q)) {
    return "forget_all";
  }
  // "what do you remember about me?" / "show my memories" / "what do you know about me?"
  if (/\b(what do you (remember|know) about me|show my memories?|list my memories?|what.*(remember|know|stored|saved).*about me)\b/i.test(q)) {
    return "recall";
  }
  // "remember that I prefer..." / "remember that my business..."
  if (/^remember (that |this )?/i.test(q)) {
    return "force_remember";
  }
  return null;
}

/**
 * Handles a memory management command. Returns a plain-text reply.
 */
async function handleMemoryCommand(
  supabaseClient: any,
  userId: string,
  command: "forget_last" | "forget_all" | "recall" | "force_remember",
  userMessage: string,
  existingMemories: any[]
): Promise<string> {
  try {
    if (command === "recall") {
      if (existingMemories.length === 0) {
        return "I don't have any stored memories about you yet. As we chat, I'll start remembering useful details about your business and preferences.";
      }
      const lines = existingMemories.map((m, i) => {
        const label = m.memory_type.replace(/_/g, " ");
        return `${i + 1}. [${label}] ${m.content}`;
      });
      return `Here's what I remember about you:\n\n${lines.join("\n")}\n\nYou can say "forget that" to remove specific memories, or "clear all memories" to start fresh.`;
    }

    if (command === "forget_last") {
      if (existingMemories.length === 0) {
        return "I don't have any memories stored yet — nothing to forget!";
      }
      // Soft-delete the most recently created active memory
      const latest = [...existingMemories].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      await supabaseClient
        .from("rova_memories")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", latest.id)
        .eq("user_id", userId);
      return `Done — I've forgotten: "${latest.content}". Is there anything else you'd like me to update?`;
    }

    if (command === "forget_all") {
      await supabaseClient
        .from("rova_memories")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("is_active", true);
      return "Done — I've cleared all my stored memories about you. We're starting fresh. I'll learn from our conversations going forward.";
    }

    if (command === "force_remember") {
      // Extract the thing to remember: strip the "remember that" prefix
      const content = userMessage.replace(/^remember (that |this )?/i, "").trim();
      if (!content) {
        return "What would you like me to remember? Please say: \"Remember that [the thing you want me to know]\"";
      }
      await supabaseClient.from("rova_memories").insert({
        user_id: userId,
        memory_type: "instruction",
        content,
        source_summary: "Explicitly instructed by user",
        importance: 8,
        is_active: true,
      });
      return `Got it — I'll remember: "${content}"`;
    }
  } catch (err) {
    console.error("[ROVA Memory] handleMemoryCommand error:", err);
    return "Sorry, I ran into an issue managing your memory. Please try again.";
  }
  return "";
}

/**
 * Calls the LLM to extract zero or more memories from the completed conversation turn.
 * Runs fire-and-forget style — we don't await it in the main response path to keep
 * latency low. Errors are caught and logged but never surface to the user.
 */
async function extractAndSaveMemories(
  supabaseClient: any,
  userId: string,
  userMessage: string,
  assistantReply: string,
  apiKey: string,
  apiEndpoint: string,
  apiModel: string
): Promise<void> {
  const extractionPrompt = `You are a memory extraction assistant for ROVA, an AI accounting assistant for Nigerian businesses.

Your job: read the user message and assistant reply below, then decide if there is any USEFUL information worth remembering for future conversations.

EXTRACT memories ONLY if the information is:
- A clear user or business preference (e.g. "User prefers bank transfer payments")
- A business detail not stored in the database (e.g. "Business closes at 6pm daily")
- An explicit standing instruction (e.g. "Always add 5% service charge to invoices")
- A recurring contact or relationship (e.g. "Dangote Cement is their main supplier")
- An important decision made in this conversation (e.g. "Agreed to move payroll to 25th of each month")
- General context that will meaningfully improve future responses

DO NOT extract:
- Transaction amounts or routine financial data (already in the database)
- Greetings, thank-yous, confirmations, or filler phrases
- Questions asked by the user (not facts)
- Information the user was uncertain about

User message: "${userMessage}"
Assistant reply: "${assistantReply}"

Respond ONLY with a valid JSON object in this exact format:
{
  "memories": [
    {
      "memory_type": "preference" | "business_detail" | "instruction" | "recurring_contact" | "decision" | "general",
      "content": "concise factual statement about the user/business (max 120 chars)",
      "importance": 1-10
    }
  ]
}

If nothing is worth remembering, return: {"memories": []}
Do not include any text outside the JSON.`;

  try {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: apiModel,
        messages: [{ role: "user", content: extractionPrompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
        max_tokens: 500,
      }),
    });

    if (!response.ok) return;

    const resData = await response.json();
    const rawContent = resData.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      return;
    }

    const newMemories: any[] = parsed.memories ?? [];
    if (!Array.isArray(newMemories) || newMemories.length === 0) return;

    // Deduplicate against existing active memories — avoid storing near-duplicates
    const { data: existingActive } = await supabaseClient
      .from("rova_memories")
      .select("content")
      .eq("user_id", userId)
      .eq("is_active", true);

    const existingContents = new Set(
      (existingActive ?? []).map((m: any) => m.content.toLowerCase().slice(0, 60))
    );

    const toInsert = newMemories
      .filter((m: any) => {
        if (!m.content || !m.memory_type) return false;
        const fingerprint = m.content.toLowerCase().slice(0, 60);
        return !existingContents.has(fingerprint);
      })
      .map((m: any) => ({
        user_id: userId,
        memory_type: m.memory_type,
        content: m.content.slice(0, 500), // safety cap
        source_summary: `Extracted from: "${userMessage.slice(0, 80)}"`,
        importance: typeof m.importance === "number"
          ? Math.min(10, Math.max(1, m.importance))
          : 5,
        is_active: true,
      }));

    if (toInsert.length > 0) {
      await supabaseClient.from("rova_memories").insert(toInsert);
      console.log(`[ROVA Memory] Saved ${toInsert.length} new memory/memories for user ${userId}`);
    }
  } catch (err) {
    // Fire-and-forget — never crash the main flow
    console.error("[ROVA Memory] extractAndSaveMemories error:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SERVE HANDLER
// ─────────────────────────────────────────────────────────────────────────────

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
    const documentUrl = context?.documentUrl || body.documentUrl || "";
    const documentFileName = context?.documentFileName || body.documentFileName || "";

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

    // ── MEMORY: Check for memory management commands FIRST ────────────────────
    const memoryCommand = detectMemoryCommand(lastUserMsg);

    // Always pre-fetch memories (needed for recall command + context injection)
    const { memories: existingMemories, formattedCtx: memoryCtx } =
      await fetchUserMemories(supabaseClient, activeUserId);

    if (memoryCommand) {
      const memoryReply = await handleMemoryCommand(
        supabaseClient,
        activeUserId,
        memoryCommand,
        lastUserMsg,
        existingMemories
      );
      // Memory commands are handled — return immediately, no DB writes or LLM needed
      return new Response(
        JSON.stringify({ reply: memoryReply, actions: [], toolExecuted: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

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

    // Helper to strip asterisks from response text
    function cleanAsterisks(str: string): string {
      if (!str) return "";
      return str.replace(/\*/g, "");
    }

    // ── 2. SYSTEM PROMPT ─────────────────────────────────────────────────────────
    const systemPrompt = `You are ROVA AI, the single unified AI Agent and conversational ERP operating layer for Nigerian businesses.
You operate identically whether the user is on the ROVA web app or WhatsApp — same database, same tools, same rules.

${staffRestriction}

${financialCtx}

${memoryCtx}

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

DATA CREATION & DOCUMENT GENERATION TOOLS:
9. recordSale(amount, description, clientName?) — Record a sales revenue transaction (MUST NOT ask for confirmation)
10. recordExpense(amount, description, categoryName?, merchant?) — Record a business expense (MUST NOT ask for confirmation)
11. createInvoice(clientName, items, dueDate?, taxRate?, notes?) — Create an invoice. Automatically generates the official ROVA PDF invoice. If clientName and items or amount are present, execute immediately without asking for confirmation.
12. createReceipt(customerName, amount?, paymentMethod?, description?) — Create an official payment receipt. Automatically generates the official ROVA PDF receipt and sends the document. If customerName and amount are present, execute immediately without asking for confirmation.

DOCUMENT & FILE AUTOMATION TOOLS (execute immediately, no confirmation needed):
13. processBusinessDocument(documentType, vendorOrCustomer, documentNumber, date, dueDate, totalAmount, paymentStatus, items, notes) — Automatically read and process uploaded business documents (supplier invoices, bills, purchase receipts, customer invoices). Checks for duplicate records first to avoid double entries, records the purchase/bill/expense, updates inventory stock quantities, records the supplier, links the document attachment, and updates financial ledgers.
14. sendDocument(documentType, customerName?, documentNumber?) — Find and retrieve an existing invoice or receipt from the ROVA database, generate its official ROVA PDF document if not yet generated, and send it directly through WhatsApp or link on web. (e.g. "Send me Chinedu's last invoice", "Send receipt #RCPT-000001", "Get last invoice for XYZ").

HIGH-RISK TOOLS (NEVER execute from ambiguous instructions — require explicit typed confirmation):
15. deleteTransaction(transactionId) — Permanently delete a transaction record

─────────────────────────────────
MEMORY SYSTEM AWARENESS
─────────────────────────────────
You have a persistent memory system. You already know what's in the ROVA MEMORY section above.
- Use stored memories naturally to personalise responses — do NOT say "Based on my memory..." or "According to my records..."
- If the user says "remember that...", "forget that", "what do you remember about me?", or "clear all memories", handle it gracefully — these are already intercepted before reaching you, so just respond naturally if they ask in a different way.

─────────────────────────────────
CRITICAL BEHAVIOUR RULES
─────────────────────────────────
1. NEVER fabricate data. If you don't know a value, use the appropriate tool to fetch it.
2. READ-ONLY tools: respond immediately with data from the database.
3. CREATE & DOCUMENT TOOLS: When asked to create an invoice, receipt, or record a sale/expense with details (e.g. "Create a receipt for Chinedu for ₦50,000"), execute immediately, generate the document, and return it.
4. RETRIEVE DOCUMENTS: When a user asks for an existing document (e.g. "Send me Chinedu's last invoice" or "Get receipt for John"), call sendDocument immediately to retrieve and deliver it.
5. DOCUMENT PROCESSING: When a business document is uploaded or provided (e.g. supplier invoice for 10 bags of rice), call processBusinessDocument to record the bill/expense, update inventory stock, record the supplier, and link the attachment.
6. DISAMBIGUATION: If getInventory returns multiple matches, list them as numbered options and ask "Which one did you mean?"
7. SOURCE AWARENESS: You are operating via ${source === "whatsapp" ? "WhatsApp" : "the ROVA web app"}. For WhatsApp responses (${source === "whatsapp" ? "ACTIVE" : "inactive"}), structure reply text using rich, clear domain icons and emojis (e.g. 💰 for sales/revenue, 💸 for expenses, 📄 for invoices, 🧾 for receipts, 📦 for inventory, 📊 for financial reports, 📋 for lists, 🏦 for banks, 👥 for staff/payroll, 🏛️ for tax, 📲 for app links, ✅ for success, ⚠️ for alerts) to make WhatsApp messages visual and easy to scan.
8. CRITICAL FORMATTING RULE: Do NOT use asterisks (*) or double asterisks (**) anywhere in your reply text. Write all text in clean plain text with zero asterisks.

─────────────────────────────────
RESPONSE FORMAT (strict JSON)
─────────────────────────────────
{
  "reply": "your response text",
  "tool_call": {
    "name": "getSales" | "getExpenses" | "getInventory" | "getOutstandingInvoices" | "getStaff" | "getPayroll" | "getCustomers" | "getTransactions" | "recordSale" | "recordExpense" | "createInvoice" | "createReceipt" | "deleteTransaction" | "processBusinessDocument" | "sendDocument",
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
              ...conversationMessages
                .filter((m) => {
                  // Skip system role (already handled above) and messages with empty content
                  if (m.role === "system") return false;
                  const content = typeof m.content === "string" ? m.content.trim() : String(m.content ?? "").trim();
                  return content.length > 0;
                })
                .map((m) => ({
                  role: m.role === "assistant" ? "assistant" : "user",
                  content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
                })),
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          const rawContent = resData.choices?.[0]?.message?.content ?? "{}";
          try {
            const parsed = JSON.parse(rawContent);
            reply = parsed.reply || "";
            actions = parsed.actions || [];
            toolCall = parsed.tool_call || null;
            requiresConfirmation = parsed.requires_confirmation === true;
            confirmationSummary = parsed.confirmation_summary || "";
          } catch (parseErr) {
            console.error("[ROVA] Failed to parse LLM JSON response:", rawContent, parseErr);
          }
        } else {
          const errBody = await response.text().catch(() => "");
          console.error(`[ROVA] LLM API returned ${response.status}:`, errBody);
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
        const waConfirmMsg = `${reply || "⚠️ I'm about to permanently delete this record. This cannot be undone. Are you absolutely sure?"}\n\nReply YES to confirm or NO to cancel.`;
        return new Response(
          JSON.stringify({
            reply: cleanAsterisks(waConfirmMsg),
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
          reply: cleanAsterisks(confirmReply),
          requiresConfirmation: true,
          confirmationSummary: cleanAsterisks(confirmationSummary || "Delete transaction"),
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
        const waConfirmMsg = `${reply}\n\nReply YES to confirm or NO to cancel.`;
        return new Response(
          JSON.stringify({ reply: cleanAsterisks(waConfirmMsg), requiresConfirmation: true, pendingToolCall: toolCall, actions: [] }),
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
    let documentToSend: any = null;
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
        } else if (toolName === "processBusinessDocument") {
          execResult = await executeProcessBusinessDocument(supabaseClient, activeUserId, params, lastUserMsg, { documentUrl, documentFileName });
        } else if (toolName === "sendDocument") {
          execResult = await executeSendDocument(supabaseClient, activeUserId, params);
        }

        if (execResult && execResult.formattedSummary) {
          reply = execResult.formattedSummary;
          if (execResult.actions) actions = [...actions, ...execResult.actions];
          if (execResult.documentToSend) documentToSend = execResult.documentToSend;
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

    // Clean all asterisks from final reply and summaries
    reply = cleanAsterisks(reply);
    confirmationSummary = cleanAsterisks(confirmationSummary);

    // ── 6. MEMORY EXTRACTION (fire-and-forget — does not block the response) ─────
    // Only extract if we have an API key and this wasn't a trivial/empty exchange
    if (apiKey && lastUserMsg.trim().length > 10 && reply.trim().length > 10) {
      // Deliberately NOT awaited — memory extraction runs after response is sent
      extractAndSaveMemories(
        supabaseClient,
        activeUserId,
        lastUserMsg,
        reply,
        apiKey,
        apiEndpoint,
        apiModel
      ).catch((err) => console.error("[ROVA Memory] Background extraction failed:", err));
    }

    return new Response(JSON.stringify({ reply, actions, toolExecuted, documentToSend }), {
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

  // 1. Send existing document (invoice / receipt)
  if (
    /\b(send me|give me|get me|show me|find|download)\b.*\b(last|recent|latest)?\s*(invoice|receipt)\b/i.test(q) ||
    /\b(send|get|show)\s+(?:me\s+)?([a-zA-Z\s]+?)'?s?\s+(?:last\s+|latest\s+)?(invoice|receipt)\b/i.test(q)
  ) {
    const isInvoice = q.includes("invoice");
    const docType = isInvoice ? "invoice" : "receipt";
    const nameMatch =
      q.match(/(?:for|to|of)\s+([a-zA-Z\s]+?)(?:\s+for|\s+\d+|\?|$)/i) ||
      q.match(/(?:send|get|show)\s+(?:me\s+)?([a-zA-Z]+)(?:'s|\s+last|\s+invoice|\s+receipt)/i);
    const customerName = nameMatch ? nameMatch[1].replace(/last|latest|recent|invoice|receipt/gi, "").trim() : "";
    const numMatch = q.match(/(?:#|no\.?|number\s+)?([a-zA-Z0-9_-]{3,20})/i);
    return {
      name: "sendDocument",
      parameters: {
        documentType: docType,
        customerName,
        documentNumber: q.includes("#") ? numMatch?.[1] : undefined,
      },
    };
  }

  // 2. Document upload / OCR processing
  if (
    q.includes("[business document uploaded") ||
    q.includes("[document uploaded") ||
    q.includes("document url:") ||
    (/\b(supplier invoice|vendor invoice|purchase receipt)\b/i.test(q))
  ) {
    return {
      name: "processBusinessDocument",
      parameters: {
        documentType: q.includes("receipt") ? "purchase_receipt" : "supplier_invoice",
        rawText: text,
      },
    };
  }

  if (/\b(sold|sale|recorded sale|i made a sale)\b/.test(q)) {
    const amt = extractAmount(q);
    return { name: "recordSale", parameters: { amount: amt, description: text } };
  }
  if (/\b(create invoice|new invoice|invoice for|invoice client)\b/.test(q)) {
    const clientMatch = q.match(/(?:for|to)\s+([a-zA-Z\s]+?)(?:\s+for|\s+\d+|$)/i);
    const clientName = clientMatch ? clientMatch[1].trim() : "";
    const amount = extractAmount(q);
    return { name: "createInvoice", parameters: { clientName, amount, description: text } };
  }
  if (/\b(create receipt|new receipt|receipt for|generate receipt)\b/.test(q)) {
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
    formattedSummary: `✅ Sale Recorded: ${formatCurrency(amount)} for "${description}".\n📊 Today's Total Sales: ${formatCurrency(todayTotal)}.`,
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

  // Fetch profile for document branding
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

  // Fetch profile for document branding
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
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT AUTOMATION & RETRIEVAL TOOLS
// ─────────────────────────────────────────────────────────────────────────────

async function executeProcessBusinessDocument(
  supabaseClient: any,
  userId: string,
  params: any,
  rawMsg: string,
  context?: any
) {
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
  const totalAmount = Number(params.totalAmount || params.amount || extractAmount(rawMsg) || 0);
  const paymentStatus = (
    params.paymentStatus || (rawMsg.toLowerCase().includes("paid") ? "paid" : "unpaid")
  ).toLowerCase();
  const docDate = params.date || new Date().toISOString().split("T")[0];
  const dueDate = params.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  const documentUrl = params.documentUrl || context?.documentUrl || "";
  const notes = params.notes || "";

  const items = Array.isArray(params.items) && params.items.length > 0
    ? params.items
    : [{ description: notes || "Items on document", quantity: 1, unit_price: totalAmount, total: totalAmount }];

  // 1. DUPLICATE CHECK: Prevent double-recording of invoices/bills
  if (documentNumber) {
    const { data: existingBill } = await supabaseClient
      .from("bills")
      .select("id, bill_number, vendor, amount, bill_date")
      .eq("user_id", userId)
      .eq("bill_number", documentNumber)
      .maybeSingle();

    if (existingBill) {
      return {
        formattedSummary: `⚠️ Duplicate Document: Bill #${documentNumber} from "${existingBill.vendor}" for ${formatCurrency(existingBill.amount)} has already been recorded on ${existingBill.bill_date}. No duplicate was created.`,
        recordId: existingBill.id,
        actions: [{ type: "view_bills", label: "View Existing Bill", payload: { bill_id: existingBill.id } }],
      };
    }

    const { data: existingExpense } = await supabaseClient
      .from("expenses")
      .select("id, expense_number, vendor, amount, date")
      .eq("user_id", userId)
      .eq("expense_number", documentNumber)
      .maybeSingle();

    if (existingExpense) {
      return {
        formattedSummary: `⚠️ Duplicate Document: Expense #${documentNumber} from "${existingExpense.vendor}" for ${formatCurrency(existingExpense.amount)} has already been recorded on ${existingExpense.date}. No duplicate was created.`,
        recordId: existingExpense.id,
      };
    }
  }

  // 2. SUPPLIER DIRECTORY
  let supplierId: string | null = null;
  const isSupplierDoc =
    documentType.includes("supplier") || documentType.includes("bill") || documentType.includes("purchase");

  if (isSupplierDoc && vendorOrCustomer && vendorOrCustomer.toLowerCase() !== "vendor") {
    const { data: existingSupp } = await supabaseClient
      .from("suppliers")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", vendorOrCustomer)
      .maybeSingle();

    if (existingSupp) {
      supplierId = existingSupp.id;
    } else {
      const { data: newSupp } = await supabaseClient
        .from("suppliers")
        .insert({
          user_id: userId,
          name: vendorOrCustomer,
          is_active: true,
          notes: `Added from document #${documentNumber || ""}`.trim(),
        })
        .select()
        .maybeSingle();
      if (newSupp) supplierId = newSupp.id;
    }
  }

  // 3. RECORD FINANCIAL ENTRY (Bill or Expense)
  let recordId = "";
  if (paymentStatus === "unpaid" || documentType.includes("bill")) {
    const billNumber = documentNumber || `BILL-${Date.now().toString().slice(-6)}`;
    const { data: bill, error: billErr } = await supabaseClient
      .from("bills")
      .insert({
        user_id: userId,
        bill_number: billNumber,
        vendor: vendorOrCustomer,
        amount: totalAmount,
        bill_date: docDate,
        due_date: dueDate,
        status: "unpaid",
        attachment_url: documentUrl,
        description: `Purchase from ${vendorOrCustomer}: ${items.map((i: any) => `${i.quantity || 1}x ${i.description}`).join(", ")}`,
      })
      .select()
      .single();

    if (billErr) throw billErr;
    recordId = bill.id;
  } else {
    const expenseNum = documentNumber || `EXP-${Date.now().toString().slice(-6)}`;
    const { data: exp, error: expErr } = await supabaseClient
      .from("expenses")
      .insert({
        user_id: userId,
        expense_number: expenseNum,
        vendor: vendorOrCustomer,
        amount: totalAmount,
        date: docDate,
        attachment_url: documentUrl,
        description: `Purchase from ${vendorOrCustomer}: ${items.map((i: any) => `${i.quantity || 1}x ${i.description}`).join(", ")}`,
      })
      .select()
      .single();

    if (expErr) throw expErr;
    recordId = exp.id;

    await supabaseClient.from("transactions").insert({
      user_id: userId,
      amount: totalAmount,
      type: "expense",
      description: `Purchase from ${vendorOrCustomer} (${expenseNum})`,
      date: docDate,
      reference: expenseNum,
      is_verified: true,
    });
  }

  // 4. INVENTORY UPDATES (Record purchased goods into inventory)
  const inventoryUpdates: string[] = [];

  for (const item of items) {
    const rawDesc = item.description || "";
    const cleanDesc = rawDesc
      .replace(/^\d+\s*(?:bags?|units?|packs?|cartons?|pcs?|kg|litres?)\s*(?:of\s+)?/i, "")
      .trim();
    const qty = Number(item.quantity || 1);
    const unitP = Number(item.unit_price || (qty > 0 ? totalAmount / qty : 0));

    if (qty > 0 && cleanDesc.length > 1) {
      const { data: invItems } = await supabaseClient
        .from("inventory_items")
        .select("*")
        .eq("user_id", userId)
        .ilike("name", `%${cleanDesc}%`)
        .limit(1);

      const existingItem = invItems && invItems[0];
      if (existingItem) {
        const newStock = (existingItem.current_stock || 0) + qty;
        await supabaseClient
          .from("inventory_items")
          .update({
            current_stock: newStock,
            cost_price: unitP > 0 ? unitP : existingItem.cost_price,
            supplier_id: supplierId || existingItem.supplier_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingItem.id);

        await supabaseClient.from("inventory_transactions").insert({
          user_id: userId,
          item_id: existingItem.id,
          type: "purchase",
          quantity: qty,
          unit_cost: unitP,
          notes: `Stock in via ${documentType} #${documentNumber || ""}`.trim(),
        });

        inventoryUpdates.push(`${existingItem.name}: +${qty} units (New stock: ${newStock})`);
      } else {
        const { data: newItem } = await supabaseClient
          .from("inventory_items")
          .insert({
            user_id: userId,
            name: cleanDesc,
            supplier_id: supplierId,
            current_stock: qty,
            cost_price: unitP,
            selling_price: unitP > 0 ? Math.round(unitP * 1.25) : 0,
            unit: "units",
            reorder_level: 5,
            is_active: true,
          })
          .select()
          .single();

        if (newItem?.id) {
          await supabaseClient.from("inventory_transactions").insert({
            user_id: userId,
            item_id: newItem.id,
            type: "purchase",
            quantity: qty,
            unit_cost: unitP,
            notes: `Initial stock in via ${documentType} #${documentNumber || ""}`.trim(),
          });
          inventoryUpdates.push(`${cleanDesc}: +${qty} units added to stock`);
        }
      }
    }
  }

  const itemsSummary = items
    .map((i: any) => `• ${i.quantity || 1}x ${i.description} @ ${formatCurrency(i.unit_price || 0)}`)
    .join("\n");

  const inventorySection =
    inventoryUpdates.length > 0 ? `\n\n📦 Inventory Updated:\n${inventoryUpdates.map((u) => `• ${u}`).join("\n")}` : "";

  return {
    formattedSummary: `✅ Document Processed & Recorded!\n• Document: ${documentType.replace(/_/g, " ").toUpperCase()} #${documentNumber || "N/A"}\n• Partner: ${vendorOrCustomer}\n• Total Amount: ${formatCurrency(totalAmount)}\n• Payment Status: ${paymentStatus.toUpperCase()}${dueDate ? ` (Due: ${dueDate})` : ""}\n\n📋 Items:\n${itemsSummary}${inventorySection}\n\n📎 Attached document successfully linked to record.`,
    recordId,
    actions: [{ type: "view_expenses", label: "View in Expenses & Bills", payload: {} }],
  };
}

async function executeSendDocument(supabaseClient: any, userId: string, params: any) {
  const docType = (params.documentType || "invoice").toLowerCase();
  const customerName = (params.customerName || "").trim();
  const documentNumber = (params.documentNumber || "").trim();

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

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
    };
  } else {
    // Receipt
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
    };
  }
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
    formattedSummary: `💸 Expense Recorded: ${formatCurrency(amount)} for "${description}".\n📊 Total Expenses This Month: ${formatCurrency(monthTotal)}.`,
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
  const topSales = salesList.slice(0, 5).map((t: any) => `• ${t.date}: ${formatCurrency(t.amount)} — ${t.description}`).join("\n");

  return {
    formattedSummary: `📈 Sales Summary (${period.replace(/_/g, " ").toUpperCase()})\n• Total Revenue: ${formatCurrency(totalAmount)}\n• Transactions: ${salesList.length}\n\n${topSales || "No sales recorded for this period."}`,
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
  const top = expenseList.slice(0, 5).map((t: any) => `• ${t.date}: ${formatCurrency(t.amount)} — ${t.description}`).join("\n");

  return {
    formattedSummary: `📉 Expense Summary (${period.replace(/_/g, " ").toUpperCase()})\n• Total Spent: ${formatCurrency(totalAmount)}\n• Transactions: ${expenseList.length}\n\n${top || "No expenses recorded for this period."}`,
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
      .map((i: any, idx: number) => `${idx + 1}. ${i.name} — ${i.current_stock} ${i.unit || "units"} in stock (Cost: ${formatCurrency(i.cost_price)})`)
      .join("\n");
    return {
      formattedSummary: `🔍 I found ${inventoryList.length} items matching "${params.search}". Which one did you mean?\n\n${options}`,
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
      formattedSummary: `📦 ${i.name}\n• In Stock: ${i.current_stock} ${i.unit || "units"} ${isLow ? "⚠️ LOW STOCK" : "✅"}\n• Cost Price: ${formatCurrency(i.cost_price)}\n• Selling Price: ${formatCurrency(i.selling_price)}\n• Reorder Level: ${i.reorder_level || 5} units`,
    };
  }

  // Full inventory overview
  const totalValuation = inventoryList.reduce((s: number, i: any) => s + (i.current_stock || 0) * (i.cost_price || 0), 0);
  const lowStock = inventoryList.filter((i: any) => (i.current_stock || 0) <= (i.reorder_level || 5));
  const sampleList = inventoryList
    .slice(0, 8)
    .map((i: any) => `• ${i.name}: ${i.current_stock} ${i.unit || "units"} ${(i.current_stock || 0) <= (i.reorder_level || 5) ? "⚠️" : ""}`)
    .join("\n");

  return {
    formattedSummary: `📦 Inventory Overview\n• Total Items: ${inventoryList.length}\n• Stock Valuation: ${formatCurrency(totalValuation)}\n• Low Stock Alerts: ${lowStock.length}\n\n${sampleList || "No items in stock."}`,
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
    .map((i: any) => `• ${i.client_name}: ${formatCurrency((i.total || 0) - (i.amount_paid || 0))} (Due: ${i.due_date || "N/A"})`)
    .join("\n");

  return {
    formattedSummary: `📋 Outstanding Receivables\n• Total Owed to You: ${formatCurrency(totalOwed)}\n• Pending Invoices: ${unpaidList.length}\n\n${clientList || "🎉 No outstanding client debts!"}`,
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
    .map((e: any) => `• ${e.full_name} — ${e.role || "No role"} | ${formatCurrency(e.gross_salary)}/month`)
    .join("\n");

  return {
    formattedSummary: `👥 Active Staff (${list.length})\n• Total Monthly Payroll Liability: ${formatCurrency(totalGross)}\n\n${staffLines || "No active employees on record."}`,
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
    .map((r: any) => `• ${r.period_label}: Gross ${formatCurrency(r.total_gross)} → Net ${formatCurrency(r.total_net)} (${r.employee_count} staff)`)
    .join("\n");

  return {
    formattedSummary: `💰 Payroll History\n\n${runLines || "No payroll runs recorded yet."}`,
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
    .map((c) => `• ${c.name} — ${c.invoiceCount} invoice(s) | Total billed: ${formatCurrency(c.totalInvoiced)} | Paid: ${formatCurrency(c.totalPaid)}`)
    .join("\n");

  return {
    formattedSummary: `🧑‍💼 Your Clients/Customers (${clients.length})\n\n${clientLines || "No clients on record yet. Create your first invoice to add a client."}`,
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
    .map((t: any) => `• ${t.date} | ${t.type === "income" ? "📈" : "📉"} ${formatCurrency(t.amount)} — ${t.description}`)
    .join("\n");

  const label = params.date ? `on ${params.date}` : "this month";
  return {
    formattedSummary: `🗒️ Transactions ${label} (${list.length} records)\n• In: ${formatCurrency(totalIn)} | Out: ${formatCurrency(totalOut)}\n\n${lines || "No transactions found for this period."}`,
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
    formattedSummary: `🗑️ Transaction Deleted: "${tx.description || 'Transaction'}" (${formatCurrency(tx.amount)}) has been permanently removed.`,
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
    formattedSummary: `🏛️ Tax Liability Estimate — This Year\n• Gross Revenue: ${formatCurrency(grossIncome)}\n• Allowable Expenses: ${formatCurrency(allowableExpenses)}\n• Net Taxable Profit: ${formatCurrency(netProfit)}\n\n📊 Breakdown:\n• VAT (7.5% on revenue): ${formatCurrency(vatLiability)}\n• CIT (${(citRate * 100).toFixed(0)}%): ${formatCurrency(estimatedCIT)}\n• Dev Levy (4%): ${formatCurrency(devLevy)}\n• Total Estimated Tax: ${formatCurrency(totalTax)}\n\n⚠️ This is an estimate. Please consult a tax professional for official filing.`,
  };
}

function extractAmount(text: string): number {
  const m = text.match(/(?:₦|naira|ngn|\$)?\s*([\d,]+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1].replace(/,/g, "")) : 0;
}
