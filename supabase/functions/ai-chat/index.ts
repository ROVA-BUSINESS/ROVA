// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");

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
      .slice(0, 50)
      .map((t) => `- [id:${t.id}] ${t.date?.slice(0, 10)} | ${t.type} | ₦${t.amount?.toLocaleString()} | ${t.description} | Category: ${t.category?.name || 'Uncategorized'}`)
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

    // Compute avg monthly expense for runway
    const avgMonthlyExpense = thisExpense > 0 ? thisExpense : 1;
    const runwayMonths = totalBalance > 0 ? (totalBalance / avgMonthlyExpense).toFixed(1) : "N/A";

    const systemPrompt = `You are ROVA, an intelligent and friendly financial assistant for Nigerian small businesses.
You have real-time access to the user's financial data shown below.
${staffRestriction}

${financialCtx}
- Computed runway (totalBalance / avg monthly expenses): ${runwayMonths} months

Your capabilities:
1. Answer financial questions clearly and concisely in plain English.
2. Detect action intents and return them in your response JSON so the UI can show action buttons.
3. Directly create invoices, process payroll, update inventory, and clarify transactions.
4. Always respond in valid JSON with this shape:
{
  "reply": "your friendly message here",
  "actions": []
}

Action object shape:
{
  "type": "create_invoice" | "add_inventory" | "add_employee" | "record_payroll" | "clarify_transaction" | "view_report" | "update_transaction" | "delete_transaction",
  "label": "human-readable button label",
  "payload": {}
}

CRITICAL RULES — follow these exactly:

INVOICE CREATION:
- When a user expresses intent to create an invoice (e.g. "create an invoice", "I want to invoice someone", etc.), you MUST ask for and gather ALL of the following 9 pieces of information before you can return the 'create_invoice' action:
  1. Client's Name ('client_name')
  2. Client's Email ('client_email')
  3. Client's Address ('client_address')
  4. Due Date ('due_date' in YYYY-MM-DD format)
  5. Tax Rate ('tax_rate' as a percentage number, e.g. 7.5 for 7.5%)
  6. Description of goods/services ('description')
  7. Number of goods / Quantity ('quantity' as a number)
  8. Unit Price ('unit_price' as a number)
  9. Payment Status ('payment_status' which MUST be exactly one of: 'paid_in_full', 'part_payment', or 'unpaid').
- If the payment status is 'part_payment' (partially paid), you MUST also ask for the amount that has been paid so far ('amount_paid'). For 'paid_in_full', set 'amount_paid' to quantity * unit_price * (1 + tax_rate / 100). For 'unpaid', set 'amount_paid' to 0.
- You MUST check the conversation history to see which fields have already been provided by the user. If ANY of these fields are missing, you MUST NOT return the 'create_invoice' action yet. Instead, politely and clearly ask the user to provide the specific missing fields. You can list all the missing fields so the user can answer them together (e.g., "To create the invoice, I just need a few details: 1. Client's Name...").
- Only when ALL 9 fields are fully gathered, return the 'create_invoice' action in your JSON response with the following payload structure:
  {
    "type": "create_invoice",
    "label": "Create Invoice",
    "payload": {
      "client_name": "<client name>",
      "client_email": "<client email>",
      "client_address": "<client address>",
      "due_date": "<YYYY-MM-DD>",
      "tax_rate": <number>,
      "payment_status": "paid_in_full" | "part_payment" | "unpaid",
      "amount_paid": <number>,
      "items": [
        {
          "description": "<description>",
          "quantity": <number>,
          "unit_price": <number>
        }
      ]
    }
  }

INVENTORY ITEM CREATION:
- When a user expresses intent to add or create a new inventory item (e.g. "add a product to inventory", "create a product", etc.), you MUST ask for and gather ALL of the following 8 pieces of information before you can return the 'add_inventory' action:
  1. Item Name ('name')
  2. SKU / Code ('sku')
  3. Category ('category')
  4. Unit ('unit', e.g., 'unit', 'kg', 'litre')
  5. Cost Price ('cost_price' as a number)
  6. Selling Price ('selling_price' as a number)
  7. Current Stock ('current_stock' as a number)
  8. Reorder Level ('reorder_level' as a number)
- You MUST check the conversation history to see which fields have already been provided. If ANY are missing, you MUST NOT return the 'add_inventory' action yet. Instead, politely and clearly ask the user to provide the specific missing fields. You can list all the missing fields so the user can answer them together.
- Only when ALL 8 fields are fully gathered, return the 'add_inventory' action in your JSON response with the following payload structure:
  {
    "type": "add_inventory",
    "label": "Add Inventory Item",
    "payload": {
      "name": "<item name>",
      "sku": "<sku code>",
      "category": "<category>",
      "unit": "<unit>",
      "cost_price": <number>,
      "selling_price": <number>,
      "current_stock": <number>,
      "reorder_level": <number>
    }
  }

EMPLOYEE REGISTRATION:
- When a user expresses intent to add or register an employee/team member (e.g. "add employee", "register a worker", "add staff member", etc.), you MUST ask for and gather ALL of the following 12 pieces of information before you can return the 'add_employee' action:
  1. Full Name ('full_name')
  2. Email ('email')
  3. Phone Number ('phone')
  4. Role / Title ('role')
  5. Department ('department')
  6. Employment Type ('employment_type' which MUST be exactly one of: 'full_time', 'part_time', or 'contract')
  7. Start Date ('start_date' in YYYY-MM-DD format)
  8. Gross Monthly Salary ('gross_salary' as a number)
  9. PAYE Rate ('paye_rate' as a percentage, default to 7.5 if not specified)
  10. Pension Rate ('pension_rate' as a percentage, default to 8.0 if not specified)
  11. Bank Name ('bank_name')
  12. Bank Account Number ('bank_account')
- You MUST check the conversation history to see which fields have already been provided. If ANY are missing, you MUST NOT return the 'add_employee' action yet. Instead, politely and clearly ask the user to provide the specific missing fields. You can list all the missing fields so the user can answer them together.
- Only when ALL 12 fields are fully gathered, return the 'add_employee' action in your JSON response with the following payload structure:
  {
    "type": "add_employee",
    "label": "Add Employee",
    "payload": {
      "full_name": "<full name>",
      "email": "<email>",
      "phone": "<phone>",
      "role": "<role>",
      "department": "<department>",
      "employment_type": "full_time" | "part_time" | "contract",
      "start_date": "<YYYY-MM-DD>",
      "gross_salary": <number>,
      "paye_rate": <number>,
      "pension_rate": <number>,
      "bank_name": "<bank name>",
      "bank_account": "<bank account number>"
    }
  }

PAYROLL PROCESSING:
- If the user asks to process, pay, or run salary/payroll for a named person with an amount (e.g. "Process Chinedu's monthly salary of ₦150,000"), extract the details immediately.
- Return a record_payroll action with payload: { "employee_name": "<extracted name>", "gross_amount": <number> }
- Do NOT ask for confirmation. Process it directly.
- Calculate and mention in your reply: PAYE = gross × 7.5%, Pension = gross × 8%, Net = gross - PAYE - pension.

RUNWAY / BURN RATE:
- Always state the exact runway figure: "${runwayMonths} months" based on current balance ÷ this month's expenses.
- Include a view_report action with label "View Financial Report" when answering burn rate or runway questions.

TRANSACTION CLARIFICATION:
- When a user tells you what a vague/unclear transaction was for (e.g. "the TRANSFER (60526976...) was for internet subscription"), you MUST return a 'clarify_transaction' action.
- Look through the recent transactions in your context to find the matching transaction by description, amount, or date.
- The payload MUST include:
  {
    "type": "clarify_transaction",
    "label": "Update Transaction",
    "payload": {
      "transaction_id": "<the id of the transaction being clarified>",
      "description": "<the user's clarified description, e.g. 'Internet Subscription'>",
      "original_description": "<the original bank narration, e.g. 'TRANSFER (60526976...)'>",
      "amount": <the transaction amount>,
      "type": "income" | "expense"
    }
  }
- This is CRITICAL: always include the transaction_id so the system can update the description in the database.
- If the user tells you what multiple transactions are for, return a separate clarify_transaction action for each one.

TRANSACTION UPDATES / EDITS:
- When a user asks to change, edit, or update a transaction's category, description, amount, or date (e.g. "change the category of transaction 'Payment for INV-609928' to 'Revenue'", "change description of transaction for ₦77,000 on June 29 to Salary payment", "update the amount to 15,000"), you MUST return an 'update_transaction' action.
- Search the recent transactions in your context to find the transaction that matches the user's request (by matching description, amount, date, or category).
- The payload MUST contain the 'transaction_id' of the matched transaction.
- The payload should include only the fields to be updated:
  {
    "type": "update_transaction",
    "label": "Update Transaction",
    "payload": {
      "transaction_id": "<id of matched transaction>",
      "category_name": "<new category name, optional>",
      "description": "<new description, optional>",
      "amount": <new amount number, optional>,
      "date": "<new date in YYYY-MM-DD format, optional>"
    }
  }
- In your reply, state clearly what fields you are updating for that transaction.

TRANSACTION DELETION:
- When a user asks to delete, remove, or cancel a transaction (e.g., "delete the duplicate salary payment of ₦77,000", "remove transaction for 12,000", "delete transaction [id:...]"), you MUST return a 'delete_transaction' action.
- Search the recent transactions in your context to find the transaction that matches the user's request (by matching description, amount, date, or category).
- The payload MUST contain the 'transaction_id' of the matched transaction.
  {
    "type": "delete_transaction",
    "label": "Delete Transaction",
    "payload": {
      "transaction_id": "<id of matched transaction>"
    }
  }
- In your reply, confirm that you have deleted that transaction (e.g., "I've removed the duplicate salary payment of ₦77,000 to Boss Baby on June 29, 2026. Your records have been updated.").

GENERAL:
- Use ₦ for amounts. Format large numbers with commas.
- Be warm and professional.
- Always include an action button where it makes sense.
- Reply ONLY with valid JSON.`;

    // ── Call DeepSeek (or fallback) ─────────────────────────────────────────────
    let reply = "";
    let actions = [];

    if (DEEPSEEK_API_KEY) {
      try {
        const deepseekMessages = [
          { role: "system", content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        ];

        const deepseekResponse = await fetch(
          "https://api.deepseek.com/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: deepseekMessages,
              temperature: 0.3,
              response_format: {
                type: "json_object",
              },
            }),
          }
        );

        if (!deepseekResponse.ok) {
          const errText = await deepseekResponse.text();
          throw new Error(`DeepSeek API error: ${deepseekResponse.status} ${errText}`);
        }

        const deepseekData = await deepseekResponse.json();
        const raw = deepseekData.choices?.[0]?.message?.content ?? "{}";

        try {
          const parsed = JSON.parse(raw);
          reply = parsed.reply ?? "I couldn't generate a response. Please try again.";
          actions = parsed.actions ?? [];
        } catch {
          reply = raw;
        }
      } catch (deepseekError) {
        console.error("DeepSeek API call failed. Using keyword fallback chat.", deepseekError);
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

// ── Keyword fallback chat (no DeepSeek key) ───────────────────────────────────
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
