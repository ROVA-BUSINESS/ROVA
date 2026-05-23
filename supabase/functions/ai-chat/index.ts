import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { messages, context } = body;
    const { transactions, accounts, userId, isStaff } = context ?? {};

    if (!messages || !userId) throw new Error("Missing messages or userId");

    // ── Build financial summary for context ───────────────────────────────────
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const txs: any[] = transactions ?? [];
    const accs: any[] = accounts ?? [];

    const thisMonthTx = txs.filter((t: any) => {
      const d = new Date(t.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const totalBalance = accs.reduce((s: number, a: any) => s + (a.balance ?? 0), 0);
    const thisIncome = thisMonthTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);
    const thisExpense = thisMonthTx.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
    const net = thisIncome - thisExpense;

    const recentTx = txs.slice(0, 10).map((t: any) =>
      `- ${t.date?.slice(0, 10)} | ${t.type} | ₦${t.amount?.toLocaleString()} | ${t.description}`
    ).join("\n");

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
  "actions": [] // optional array of action objects
}

Action object shape:
{
  "type": "create_invoice" | "add_inventory" | "record_payroll" | "clarify_transaction" | "view_report",
  "label": "human-readable button label",
  "payload": { ...relevant prefill data }
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

    // ── Call DeepSeek (or fallback) ───────────────────────────────────────────
    let reply = "";
    let actions: any[] = [];

    if (DEEPSEEK_API_KEY) {
      try {
        const dsMessages = [
          { role: "system", content: systemPrompt },
          ...messages,
        ];

        const dsResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: dsMessages,
            temperature: 0.3,
            max_tokens: 800,
            response_format: { type: "json_object" },
          }),
        });

        if (!dsResponse.ok) {
          const errText = await dsResponse.text();
          throw new Error(`DeepSeek API error: ${dsResponse.status} ${errText}`);
        }

        const dsData = await dsResponse.json();
        const raw = dsData.choices?.[0]?.message?.content ?? "{}";

        try {
          const parsed = JSON.parse(raw);
          reply = parsed.reply ?? "I couldn't generate a response. Please try again.";
          actions = parsed.actions ?? [];
        } catch {
          reply = raw; // return raw text if JSON parse fails
        }
      } catch (dsError) {
        console.error("DeepSeek API call failed. Using keyword fallback chat.", dsError);
        const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
        reply = keywordFallbackChat(lastMsg, totalBalance, thisIncome, thisExpense, net, txs.length);
        actions = detectActions(lastMsg);
      }
    } else {
      // ── No API key: keyword fallback ──────────────────────────────────────
      const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
      reply = keywordFallbackChat(lastMsg, totalBalance, thisIncome, thisExpense, net, txs.length);
      actions = detectActions(lastMsg);
    }

    return new Response(JSON.stringify({ reply, actions }), {
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

// ── Keyword fallback chat (no DeepSeek key) ───────────────────────────────────
function fmt(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function keywordFallbackChat(
  q: string,
  balance: number,
  income: number,
  expense: number,
  net: number,
  txCount: number
): string {
  if (q.includes("balance") || q.includes("how much")) {
    return `Your total account balance is ${fmt(balance)}.`;
  }
  if (q.includes("income") || q.includes("earn") || q.includes("revenue")) {
    return `This month you've earned ${fmt(income)} in income, with ${fmt(expense)} in expenses. Net: ${fmt(net)}.`;
  }
  if (q.includes("expense") || q.includes("spent") || q.includes("spending")) {
    return `This month you've spent ${fmt(expense)} in total. Your net position is ${fmt(net)}.`;
  }
  if (q.includes("profit") || q.includes("margin") || q.includes("net")) {
    const margin = income > 0 ? ((net / income) * 100).toFixed(1) : "0.0";
    return `This month: Income ${fmt(income)}, Expenses ${fmt(expense)}, Net ${fmt(net)} (${margin}% margin).`;
  }
  if (q.includes("invoice")) {
    return `I can help you create an invoice! Please tell me the client's name, email, items, and the amount.`;
  }
  if (q.includes("salary") || q.includes("payroll") || q.includes("pay ")) {
    return `Sure! To record a salary payment, go to Payroll and add a payslip, or tell me the employee name and amount and I'll guide you.`;
  }
  if (q.includes("inventory") || q.includes("stock") || q.includes("item")) {
    return `I can update your inventory. Tell me the item name, quantity, and cost price.`;
  }
  if (q.includes("hi") || q.includes("hello") || q.includes("hey")) {
    return `Hi! I'm ROVA, your financial assistant. You have ${txCount} transactions on record and a total balance of ${fmt(balance)}. How can I help you today?`;
  }
  return `I'm here to help with your finances! You can ask me about income, expenses, profits, invoices, payroll, or inventory. Your current balance is ${fmt(balance)}.`;
}

function detectActions(q: string): any[] {
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
