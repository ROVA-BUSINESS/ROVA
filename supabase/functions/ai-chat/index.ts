// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    const body = await req.json();
    const { messages, context } = body;
    const { transactions, accounts, userId, isStaff } = context ?? {};

    if (!messages || !userId) throw new Error("Missing messages or userId");

    // ── Build financial summary for context ───────────────────────────────────
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const txs = transactions ?? [];
    const accs = accounts ?? [];

    const thisMonthTx = txs.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const totalBalance = accs.reduce((s, a) => s + (a.balance ?? 0), 0);
    const thisIncome = thisMonthTx
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const thisExpense = thisMonthTx
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.amount, 0);
    const net = thisIncome - thisExpense;

    const recentTx = txs
      .slice(0, 10)
      .map((t) => `- ${t.date?.slice(0, 10)} | ${t.type} | ₦${t.amount?.toLocaleString()} | ${t.description}`)
      .join("\n");

    const financialCtx = `
Current financial snapshot (Nigerian Naira):
- Total balance across all accounts: ₦${totalBalance.toLocaleString()}
- This month income: ₦${thisIncome.toLocaleString()}
- This month expenses: ₦${thisExpense.toLocaleString()}
- Net this month: ₦${net.toLocaleString()}
- Total transactions on record: ${txs.length}

Recent transactions:
${recentTx || "No recent transactions."}
`.trim();

    const staffRestriction = isStaff
      ? "You are in STAFF mode. You MUST NOT share profit margins, total revenue, historical comparisons, or payroll data. Only answer questions about individual transactions they are authorised to see."
      : "";

    const systemPrompt = `You are ROVA, an intelligent and friendly financial assistant for Nigerian small businesses.
You have real-time access to the user's financial data shown below.
${staffRestriction}

${financialCtx}

Your capabilities:
1. Answer financial questions clearly and concisely in plain English.
2. Detect action intents and return them in your response JSON so the UI can show action buttons.
3. Help create invoices, record payroll, update inventory, and clarify transactions.
4. Always respond in valid JSON with this shape:
{
  "reply": "your friendly message here",
  "actions": []
}

Action object shape:
{
  "type": "create_invoice" | "add_inventory" | "record_payroll" | "clarify_transaction" | "view_report",
  "label": "human-readable button label",
  "payload": {}
}

Rules:
- Keep replies concise (max 4 sentences unless user asks for detail).
- Use ₦ for amounts. Format large numbers with commas.
- Be warm and professional. You work for a Nigerian SME.
- If the user wants to create an invoice, ALWAYS ask for: client name, email, items, and amount.
- If they mention a salary payment or employee, suggest linking to payroll.
- If they mention buying goods, suggest updating inventory.
- Always include an action button where it makes sense.
- Reply ONLY with valid JSON.`;

    // ── Call Gemini (or fallback) ──────────────────────────────────────────────
    let reply = "";
    let actions = [];

    if (GEMINI_API_KEY) {
      try {
        const geminiContents = messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: geminiContents,
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.3,
              },
            }),
          }
        );

        if (!geminiResponse.ok) {
          const errText = await geminiResponse.text();
          throw new Error(`Gemini API error: ${geminiResponse.status} ${errText}`);
        }

        const geminiData = await geminiResponse.json();
        const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

        try {
          const parsed = JSON.parse(raw);
          reply = parsed.reply ?? "I couldn't generate a response. Please try again.";
          actions = parsed.actions ?? [];
        } catch {
          reply = raw;
        }
      } catch (geminiError) {
        console.error("Gemini API call failed. Using keyword fallback chat.", geminiError);
        const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
        reply = keywordFallbackChat(lastMsg, totalBalance, thisIncome, thisExpense, net, txs.length);
        actions = detectActions(lastMsg);
      }
    } else {
      // No API key: keyword fallback
      const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
      reply = keywordFallbackChat(lastMsg, totalBalance, thisIncome, thisExpense, net, txs.length);
      actions = detectActions(lastMsg);
    }

    return new Response(JSON.stringify({ reply, actions }), {
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

// ── Keyword fallback chat (no Gemini key) ─────────────────────────────────────
function fmt(n) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function keywordFallbackChat(q, balance, income, expense, net, txCount) {
  const prefix = "*(Offline Mode)* ";
  if (/\b(balance|how much)\b/.test(q)) {
    return `${prefix}Your total account balance is ${fmt(balance)}.`;
  }
  if (/\b(income|earn|revenue)\b/.test(q)) {
    return `${prefix}This month you've earned ${fmt(income)} in income, with ${fmt(expense)} in expenses. Net: ${fmt(net)}.`;
  }
  if (/\b(expense|spent|spending)\b/.test(q)) {
    return `${prefix}This month you've spent ${fmt(expense)} in total. Your net position is ${fmt(net)}.`;
  }
  if (/\b(profit|margin|net)\b/.test(q)) {
    const margin = income > 0 ? ((net / income) * 100).toFixed(1) : "0.0";
    return `${prefix}This month: Income ${fmt(income)}, Expenses ${fmt(expense)}, Net ${fmt(net)} (${margin}% margin).`;
  }
  if (/\binvoice\b/.test(q)) {
    return `${prefix}I can help you create an invoice! Please tell me the client's name, email, items, and the amount.`;
  }
  if (/\b(salary|payroll|pay)\b/.test(q)) {
    return `${prefix}Sure! To record a salary payment, go to Payroll and add a payslip, or tell me the employee name and amount and I'll guide you.`;
  }
  if (/\b(inventory|stock|item)\b/.test(q)) {
    return `${prefix}I can update your inventory. Tell me the item name, quantity, and cost price.`;
  }
  if (/\b(hi|hello|hey)\b/.test(q)) {
    return `${prefix}Hi! I'm ROVA, your financial assistant. You have ${txCount} transactions on record and a total balance of ${fmt(balance)}. How can I help you today?`;
  }
  return `${prefix}I'm having trouble connecting to my AI brain right now, but I can still help with basic questions about your income, expenses, profits, invoices, payroll, or inventory. Your current balance is ${fmt(balance)}.`;
}

function detectActions(q) {
  const actions = [];
  if (q.includes("invoice")) {
    actions.push({ type: "create_invoice", label: "Create Invoice", payload: {} });
  }
  if (q.includes("inventory") || q.includes("stock")) {
    actions.push({ type: "add_inventory", label: "Add Inventory", payload: {} });
  }
  if (q.includes("salary") || q.includes("payroll")) {
    actions.push({ type: "record_payroll", label: "Record Payroll", payload: {} });
  }
  return actions;
}
