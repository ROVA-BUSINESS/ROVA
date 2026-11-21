// @ts-nocheck
// recordTransactions.ts — validates and saves transactions extracted by DeepSeek tool calls.

export const LARGE_AMOUNT_THRESHOLD = 500_000;

const VALID_TYPES = ["income", "expense", "transfer"];

/** Today's date in Nigeria (Africa/Lagos), formatted YYYY-MM-DD. */
export function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function lagosWeekday(): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", weekday: "long" }).format(new Date());
}

/** DeepSeek tool definition (OpenAI-compatible function calling). */
export const RECORD_TRANSACTIONS_TOOL = {
  type: "function",
  function: {
    name: "record_transactions",
    description:
      "Save one or more business transactions (money in or money out) that the user has told you about. " +
      "Call this whenever the user states that a sale, purchase, payment, expense, income, transfer, loan, " +
      "withdrawal or contribution HAS HAPPENED. Do NOT call it for questions, plans or hypotheticals.",
    parameters: {
      type: "object",
      properties: {
        transactions: {
          type: "array",
          description: "One entry per separate transaction in the message.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: VALID_TYPES,
                description: "income = money in, expense = money out, transfer = between own accounts.",
              },
              amount: {
                type: "number",
                description: "Total amount in Naira as a plain number. '45k' = 45000, '1.2m' = 1200000.",
              },
              description: { type: "string", description: "Short, clean description e.g. 'Sold 3 bags of rice'." },
              category: { type: "string", description: "Best matching category from the allowed list." },
              date: {
                type: "string",
                description: "Date the transaction happened, YYYY-MM-DD. Resolve 'today', 'yesterday', weekdays relative to today's date.",
              },
              quantity: { type: "number", description: "Optional quantity." },
              unit_price: { type: "number", description: "Optional price per unit." },
              counterparty: { type: "string", description: "Optional customer or vendor name." },
              payment_method: {
                type: "string",
                enum: ["cash", "transfer", "pos", "card", "credit", "unknown"],
              },
            },
            required: ["type", "amount", "description", "category", "date"],
          },
        },
      },
      required: ["transactions"],
    },
  },
};

export const RECORDING_PROMPT_ADDON = (today: string, weekday: string) => `

### 15. TRANSACTION RECORDING (MANDATORY — OVERRIDES EARLIER OUTPUT RULES)

Today's date in Nigeria is ${today} (${weekday}).

You have a tool called \`record_transactions\`. It is the ONLY way a transaction gets saved.

- Whenever the user says money came in or went out (sold, bought, paid, spent, collected, received, transferred, borrowed, withdrew, "I don buy", "I sell", "customer pay me", etc.), CALL \`record_transactions\`.
- Put EVERY separate transaction in the message into the array ("sold shoes 20k and bought fuel 5k" = 2 items).
- Amounts: "45k" = 45000, "1.2m" = 1200000, "₦12,500" = 12500. If quantity and unit price are given, amount = quantity × unit price.
- Date: resolve "today", "yesterday", "last Friday" etc. using today's date above. If no date is mentioned, use ${today}. Never use a future date.
- Understand English, Nigerian Pidgin and mixed language.
- Categories — choose the closest from Rova's official chart of accounts:
  * MONEY IN: Sales / Service Revenue, Customer Payment, Customer Deposit / Advance, Interest Income, Other Income, Supplier Refund, Owner Capital Injection, Loan Received, Director / Shareholder Loan, Asset Sale Proceeds.
  * MONEY OUT: Direct Costs / Cost of Sales, Inventory Purchase, Salaries & Wages, Rent, Utilities, Electricity, Water, Internet & Telecoms, Software & Subscriptions, Marketing & Advertising, Travel & Transport, Fuel & Generator, Repairs & Maintenance, Insurance, Office Supplies, Professional Fees, Bank Charges, Licences & Registration Fees, Training, Staff Welfare / Meals, Delivery & Logistics, Commissions Paid, Fines & Penalties, Miscellaneous Expense, Fixed Asset Purchase, Supplier Payment, Prepayment, Loan Repayment: Principal, Loan Interest, Owner's Drawings, Customer Refund.
- Owner's drawings, loan repayments, dividends and fixed asset purchases are direction "expense" (money out); loans received and owner capital are direction "income" (money in) — the category carries the exact balance sheet / P&L accounting meaning.
- If the AMOUNT is missing or unclear, do NOT call the tool and do NOT guess. Ask ONE short question, e.g. "How much was the fuel?"
- Questions ("how much did I sell?"), plans ("I want to buy…") and general advice requests must NOT call the tool.
- Never say a transaction was recorded unless the tool was called.
`;

function normaliseDate(raw: any, today: string): string {
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    const d = raw.trim();
    // Never allow future dates; fall back to today.
    return d > today ? today : d;
  }
  return today;
}

export type CleanTx = {
  type: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  quantity?: number | null;
  unit_price?: number | null;
  counterparty?: string | null;
  payment_method?: string | null;
};

/** Validate and normalise raw tool arguments. Returns clean list + rejected items. */
export function cleanTransactions(rawList: any[], today: string): { valid: CleanTx[]; invalid: string[] } {
  const valid: CleanTx[] = [];
  const invalid: string[] = [];
  for (const raw of Array.isArray(rawList) ? rawList : []) {
    const amount = Math.abs(Number(raw?.amount));
    const description = String(raw?.description || "").trim();
    if (!amount || !isFinite(amount) || amount <= 0) {
      invalid.push(description || "an item with no amount");
      continue;
    }
    const type = VALID_TYPES.includes(raw?.type) ? raw.type : "expense";
    valid.push({
      type,
      amount: Math.round(amount * 100) / 100,
      description: description ? description.charAt(0).toUpperCase() + description.slice(1) : "Transaction",
      category: String(raw?.category || (type === "income" ? "Sales Revenue" : "Other Operating Expenses")).trim(),
      date: normaliseDate(raw?.date, today),
      quantity: raw?.quantity != null ? Number(raw.quantity) || null : null,
      unit_price: raw?.unit_price != null ? Number(raw.unit_price) || null : null,
      counterparty: raw?.counterparty ? String(raw.counterparty).trim() : null,
      payment_method: raw?.payment_method || null,
    });
  }
  return { valid, invalid };
}

async function findOrCreateCategory(db: any, ownerId: string, name: string, type: string): Promise<string | null> {
  try {
    const { data: existing } = await db
      .from("categories")
      .select("id")
      .ilike("name", name)
      .or(`user_id.eq.${ownerId},is_system.eq.true`)
      .limit(1)
      .maybeSingle();
    if (existing?.id) return existing.id;

    const { data: created } = await db
      .from("categories")
      .insert({
        user_id: ownerId,
        name,
        type: type === "transfer" ? "both" : type,
        icon: type === "income" ? "trending-up" : "credit-card",
        color: type === "income" ? "#10b981" : "#ef4444",
        is_system: false,
      })
      .select("id")
      .single();
    return created?.id ?? null;
  } catch (e) {
    console.warn("[ROVA AI] category lookup failed:", e);
    return null;
  }
}

export type SaveResult = {
  success: boolean;
  duplicate?: boolean;
  error?: string;
  transaction?: any;
  input: CleanTx;
};

/** Persist each transaction. Uses the caller's JWT client so RLS applies exactly like the web app. */
export async function saveTransactions(
  db: any,
  ownerId: string,
  actorId: string,
  list: CleanTx[]
): Promise<SaveResult[]> {
  const results: SaveResult[] = [];
  for (const tx of list) {
    try {
      // Duplicate guard: same type + amount + description in the last 2 minutes.
      const since = new Date(Date.now() - 120_000).toISOString();
      const { data: dupes } = await db
        .from("transactions")
        .select("id, amount, type, description, date, ai_category, reference")
        .eq("user_id", ownerId)
        .eq("type", tx.type)
        .eq("amount", tx.amount)
        .ilike("description", tx.description)
        .gte("created_at", since)
        .limit(1);
      if (dupes && dupes.length > 0) {
        results.push({ success: true, duplicate: true, transaction: dupes[0], input: tx });
        continue;
      }

      const categoryId = await findOrCreateCategory(db, ownerId, tx.category, tx.type);
      const noteParts = ["Recorded via ROVA AI"];
      if (tx.quantity) noteParts.push(`Qty: ${tx.quantity}`);
      if (tx.unit_price) noteParts.push(`Unit price: ₦${tx.unit_price.toLocaleString("en-NG")}`);
      if (tx.counterparty) noteParts.push(`Party: ${tx.counterparty}`);
      if (tx.payment_method && tx.payment_method !== "unknown") noteParts.push(`Method: ${tx.payment_method}`);

      const prefix = tx.type === "income" ? "REV" : tx.type === "transfer" ? "TRF" : "EXP";
      const { data: inserted, error } = await db
        .from("transactions")
        .insert({
          user_id: ownerId,
          amount: tx.amount,
          type: tx.type,
          description: tx.description,
          date: tx.date,
          category_id: categoryId,
          ai_category: tx.category,
          reference: `${prefix}-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`,
          notes: noteParts.join(" · "),
          is_verified: true,
        })
        .select("id, amount, type, description, date, ai_category, reference")
        .single();
      if (error) throw error;

      try {
        await db.from("activity_logs").insert({
          owner_id: ownerId,
          user_id: actorId,
          action: "created",
          entity_type: "transaction",
          entity_id: inserted.id,
          entity_label: `${tx.description} — ₦${tx.amount.toLocaleString("en-NG")}`,
          metadata: { amount: tx.amount, type: tx.type, date: tx.date, source: "ai_assistant" },
        });
      } catch (_e) {
        /* non-fatal */
      }

      results.push({ success: true, transaction: inserted, input: tx });
    } catch (err: any) {
      console.error("[ROVA AI] save failed:", err);
      results.push({ success: false, error: err?.message || "Could not save", input: tx });
    }
  }
  return results;
}
