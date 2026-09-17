// @ts-nocheck
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
    const { transaction, userId, mode } = body;

    if (!transaction || !userId) {
      throw new Error("Missing transaction or userId");
    }

    // ── Fetch business context ─────────────────────────────────────────────────
    const [inventoryRes, employeesRes, categoriesRes] = await Promise.all([
      supabaseClient
        .from("inventory_items")
        .select("id, name, sku, category, unit")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(50),
      supabaseClient
        .from("employees")
        .select("id, full_name, role, gross_salary")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(50),
      supabaseClient
        .from("categories")
        .select("id, name, type")
        .or(`user_id.eq.${userId},is_system.eq.true`)
        .limit(80),
    ]);

    const inventoryItems = inventoryRes.data ?? [];
    const employees = employeesRes.data ?? [];
    const categories = categoriesRes.data ?? [];

    const inventoryContext =
      inventoryItems.length > 0
        ? `Known inventory items: ${inventoryItems.map((i) => `"${i.name}" (unit: ${i.unit})`).join(", ")}`
        : "No inventory items on record yet.";

    const employeeContext =
      employees.length > 0
        ? `Known employees: ${employees.map((e) => `"${e.full_name}" (${e.role})`).join(", ")}`
        : "No employees on record yet.";

    const categoryContext = categories.map((c) => c.name).join(", ");

    // ── Build prompt ───────────────────────────────────────────────────────────
    const systemPrompt = `You are ROVA AI, an autonomous accounting assistant for Nigerian SMEs.

Your job is to understand every financial transaction and determine BOTH:
1. The transaction category.
2. The accounting treatment.

Business context:
- ${inventoryContext}
- ${employeeContext}
- Available categories: ${categoryContext}

Extract:
- Amount
- Merchant
- Product/Service
- Quantity
- Payment Method
- Date

Classify into ONE category:
1. Inventory Purchase
2. Operating Expense
3. Fixed Asset Purchase
4. Loan Repayment
5. Owner Withdrawal
6. Owner Capital Injection
7. Payroll
8. Tax
9. Customer Refund
10. Accounts Receivable Collection
11. Accounts Payable Payment
12. Unknown

-------------------------
ACCOUNTING RULES
-------------------------

1. INVENTORY PURCHASE
Examples: Beans, Rice, Soft drinks, Flour, Cement, Products for resale.
Accounting: Debit Inventory, Credit Cash or Accounts Payable. Inventory increases. DO NOT recognise as expense immediately. Move to Cost of Goods Sold (COGS) when sold. If quantity is missing, ask for quantity.

2. OPERATING EXPENSE
Examples: Fuel, Repairs, Electricity, Internet, Transport, Advertising, Office Supplies, Water, Rent, Bank Charges.
Accounting: Debit correct Expense account, Credit Cash or Accounts Payable. Do NOT add anything to inventory. Recognise full amount immediately in P&L.

3. FIXED ASSET PURCHASE
Examples: Generator, Laptop, Vehicle, Freezer, Machinery, Furniture, POS Terminal.
Accounting: Debit Fixed Assets, Credit Cash or Accounts Payable. Do NOT classify as expense immediately. Create asset record (cost, date, asset category, useful life, salvage value). Auto-calculate depreciation.

4. PAYROLL
Examples: Salary, Wages, Staff Pay.
Accounting: Debit Salary Expense, Credit Cash.

5. OWNER WITHDRAWAL
Examples: Personal draw, owner cash take.
Accounting: Reduce Owner's Equity. Do NOT classify as business expense.

6. OWNER CAPITAL INJECTION
Examples: Owner funding, capital deposit.
Accounting: Increase Owner's Equity. Not Revenue.

7. TAX
Accounting: Post to Tax Expense or Tax Liability depending on context.

8. CUSTOMER PAYMENT (AR Collection)
Accounting: Reduce Accounts Receivable, Increase Cash. Do NOT recognise Revenue again if sale already recorded.

9. SUPPLIER PAYMENT (AP Payment)
Accounting: Reduce Accounts Payable, Reduce Cash. Do NOT create another expense if purchase already recorded.

-------------------------
CONFIDENCE & CLARIFICATION RULES
-------------------------
- Assign a confidence score between 0.00 and 1.00 (0% to 100%).
- If confidence >= 0.90 (90%), process automatically (clarification_needed: false).
- If confidence < 0.90 (90%), set clarification_needed: true and ask ONE concise follow-up question. Never ask unnecessary questions.
- Increase confidence when supplier/merchant has previously been categorised or confirmed.

Always return JSON with:
{
  "category": string,
  "type": "income" | "expense" | "transfer",
  "intent": "inventory_purchase" | "operating_expense" | "fixed_asset_purchase" | "loan_repayment" | "owner_withdrawal" | "owner_capital" | "payroll" | "tax" | "customer_refund" | "ar_collection" | "ap_payment" | "unknown",
  "employee_name": string | null,
  "inventory_item": string | null,
  "quantity": number | null,
  "unit_price": number | null,
  "merchant": string | null,
  "product_service": string | null,
  "journal_entry": {
    "debit": string,
    "credit": string
  },
  "accounting_treatment": string,
  "clarification_needed": boolean,
  "ai_question": string | null,
  "confidence": number
}`;

    const userPrompt = `Classify this transaction:
Description: ${transaction.description}
Amount: ₦${transaction.amount?.toLocaleString() ?? "unknown"}
Type hint: ${transaction.type ?? "unknown"}
Date: ${transaction.date ?? "unknown"}`;

    // ── Call DeepSeek (or fallback to keyword classify) ────────────────────────
    let result;

    if (DEEPSEEK_API_KEY) {
      try {
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
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              temperature: 0.1,
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
        result = JSON.parse(raw);
      } catch (deepseekError) {
        console.error("DeepSeek API call failed. Using keywordFallback classifier.", deepseekError);
        result = keywordFallback(transaction.description ?? "", transaction.type ?? "expense");
      }
    } else {
      result = keywordFallback(transaction.description ?? "", transaction.type ?? "expense");
    }

    // ── Check if inventory item exists if intent is inventory ──────────────────
    if (result.intent === "inventory_purchase" || result.intent === "inventory_sale") {
      const itemName = result.inventory_item;
      if (itemName) {
        const { data: matches } = await supabaseClient
          .from("inventory_items")
          .select("id, name, unit")
          .eq("user_id", userId)
          .ilike("name", `%${itemName}%`);

        const matchCount = matches?.length ?? 0;

        if (matchCount === 0) {
          result.clarification_needed = true;
          result.ai_question = `I detected a ${result.intent === "inventory_purchase" ? "purchase" : "sale"} of "${itemName}". Since "${itemName}" is not in your inventory list, would you like to add it as a new inventory item first?`;
        } else if (matchCount > 1) {
          // Multiple types/matches of a product, AI is not sure
          result.clarification_needed = true;
          const unitName = matches[0]?.unit || "bag";
          result.ai_question = `I'll need to know the unit cost per ${unitName} so I can record the correct expense. Could you please provide the price per ${unitName}?`;
        }
      } else {
        result.clarification_needed = true;
        result.ai_question = `This looks like an inventory ${result.intent === "inventory_purchase" ? "purchase" : "sale"}. What item was it for?`;
      }
    }

    // ── Handle DB updates and notifications ───────────────────────────────────
    if (transaction.id && mode !== "preview") {
      if (result.clarification_needed) {
        // Insert notification
        const { data: notif } = await supabaseClient
          .from("notifications")
          .insert({
            user_id: userId,
            type: "ai_clarification",
            severity: "info",
            title: "Transaction needs your input",
            body: result.ai_question ?? `What was the transaction "${transaction.description}" for?`,
            action_url: "/assistant",
            action_label: "Clarify",
            is_read: false,
            is_dismissed: false,
          })
          .select()
          .single();

        // Insert clarification row
        await supabaseClient.from("ai_pending_clarifications").insert({
          user_id: userId,
          transaction_id: transaction.id ?? null,
          original_description: transaction.description ?? "",
          suggested_intent: result.intent,
          suggested_employee: result.employee_name,
          suggested_item: result.inventory_item,
          suggested_quantity: result.quantity,
          suggested_amount: transaction.amount ?? null,
          ai_question: result.ai_question ?? "",
          status: "pending",
          notification_id: notif?.id ?? null,
        });

        // ── Send WhatsApp Notification for Clarification ──────────────────
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("phone")
          .eq("id", userId)
          .maybeSingle();

        if (profile?.phone) {
          const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
          const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
          if (WHATSAPP_ACCESS_TOKEN && PHONE_NUMBER_ID) {
            const cleanPhone = profile.phone.replace(/\D/g, "");
            const textMsg = `🏦 *ROVA Bank Sync:*\nWe recorded a transaction of ₦${transaction.amount?.toLocaleString()} for "${transaction.description}".\n\n🤔 ${result.ai_question ?? 'Please reply with what this transaction was for so we can categorize it correctly.'}`;
            
            try {
              await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  messaging_product: "whatsapp",
                  recipient_type: "individual",
                  to: cleanPhone,
                  type: "text",
                  text: { body: textMsg },
                }),
              });
            } catch (e) {
              console.error("Failed to send WhatsApp clarification:", e);
            }
          }
        }
      } else {
        // Find category to set on transaction
        const { data: catData } = await supabaseClient
          .from("categories")
          .select("id")
          .eq("name", result.category)
          .maybeSingle();

        // Update transaction category & type
        await supabaseClient
          .from("transactions")
          .update({
            category_id: catData?.id || null,
            type: result.type,
          })
          .eq("id", transaction.id);

        // Apply intent handlers in the DB
        if (result.intent === "inventory_purchase") {
          const itemName = result.inventory_item || "Inventory Item";
          const qty = result.quantity || 1;
          const unitCost = result.unit_price || (transaction.amount || 0) / qty;

          const { data: existing } = await supabaseClient
            .from("inventory_items")
            .select("id, current_stock")
            .eq("user_id", userId)
            .ilike("name", `%${itemName}%`)
            .maybeSingle();

          let itemId;

          if (existing) {
            await supabaseClient
              .from("inventory_items")
              .update({ current_stock: existing.current_stock + qty })
              .eq("id", existing.id);
            itemId = existing.id;
          } else {
            const { data: newItem } = await supabaseClient
              .from("inventory_items")
              .insert({
                user_id: userId,
                name: itemName,
                sku: `SKU-${Date.now()}`,
                unit: "unit",
                cost_price: unitCost,
                selling_price: unitCost,
                current_stock: qty,
                reorder_level: 5,
                status: "active",
              })
              .select()
              .single();
            itemId = newItem?.id;
          }

          if (itemId) {
            await supabaseClient.from("inventory_transactions").insert({
              user_id: userId,
              item_id: itemId,
              transaction_id: transaction.id,
              type: "purchase",
              quantity: qty,
              unit_cost: unitCost,
              total_cost: qty * unitCost,
              date: transaction.date || new Date().toISOString(),
              notes: "Auto-recorded by ROVA AI",
            });
          }
        } else if (result.intent === "inventory_sale") {
          const itemName = result.inventory_item || "Inventory Item";
          const qty = result.quantity || 1;

          const { data: existing } = await supabaseClient
            .from("inventory_items")
            .select("id, current_stock, cost_price, unit")
            .eq("user_id", userId)
            .ilike("name", `%${itemName}%`)
            .maybeSingle();

          if (existing) {
            const newStock = Math.max(0, existing.current_stock - qty);
            await supabaseClient
              .from("inventory_items")
              .update({ current_stock: newStock })
              .eq("id", existing.id);

            await supabaseClient.from("inventory_transactions").insert({
              user_id: userId,
              item_id: existing.id,
              transaction_id: transaction.id,
              type: "sale",
              quantity: qty,
              unit_cost: existing.cost_price,
              total_cost: qty * existing.cost_price,
              date: transaction.date || new Date().toISOString(),
              notes: "Auto-recorded by ROVA AI",
            });

            // Create COGS transaction if cost price is defined
            if (existing.cost_price > 0) {
              await supabaseClient.from("transactions").insert({
                user_id: userId,
                amount: qty * existing.cost_price,
                type: "expense",
                description: `COGS — ${itemName} (${qty} ${existing.unit || 'unit'})`,
                date: transaction.date || new Date().toISOString().split("T")[0],
                notes: "Cost of goods sold (Auto-recorded by ROVA AI)",
              });
            }
          }
        } else if (result.intent === "salary_payment" && result.employee_name) {
          const { data: employee } = await supabaseClient
            .from("employees")
            .select("*")
            .eq("user_id", userId)
            .ilike("full_name", `%${result.employee_name}%`)
            .maybeSingle();

          if (employee) {
            const txDate = transaction.date ? new Date(transaction.date) : new Date();
            const year = txDate.getFullYear();
            const month = txDate.getMonth();
            const monthNames = [
              "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December",
            ];
            const monthLabel = `${monthNames[month]} ${year}`;

            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            const periodStart = firstDay.toISOString().split("T")[0];
            const periodEnd = lastDay.toISOString().split("T")[0];

            const amount = transaction.amount || 0;
            const paye = amount * ((employee.paye_rate || 7.5) / 100);
            const pension = amount * ((employee.pension_rate || 8.0) / 100);
            const net = amount - paye - pension;

            let runId;
            const { data: existingRun } = await supabaseClient
              .from("payroll_runs")
              .select("*")
              .eq("user_id", userId)
              .eq("period_label", monthLabel)
              .maybeSingle();

            if (existingRun) {
              runId = existingRun.id;
              await supabaseClient
                .from("payroll_runs")
                .update({
                  total_gross: (existingRun.total_gross || 0) + amount,
                  total_paye: (existingRun.total_paye || 0) + paye,
                  total_pension: (existingRun.total_pension || 0) + pension,
                  total_net: (existingRun.total_net || 0) + net,
                  employee_count: (existingRun.employee_count || 0) + 1,
                })
                .eq("id", runId);
            } else {
              const { data: newRun } = await supabaseClient
                .from("payroll_runs")
                .insert({
                  user_id: userId,
                  period_label: monthLabel,
                  period_start: periodStart,
                  period_end: periodEnd,
                  status: "processed",
                  total_gross: amount,
                  total_paye: paye,
                  total_pension: pension,
                  total_net: net,
                  employee_count: 1,
                  notes: "Automatically generated by ROVA AI linking",
                  processed_at: new Date().toISOString(),
                })
                .select()
                .single();
              runId = newRun?.id;
            }

            if (runId) {
              await supabaseClient.from("payslips").insert({
                payroll_run_id: runId,
                employee_id: employee.id,
                user_id: userId,
                gross_salary: amount,
                paye_deduction: paye,
                pension_deduction: pension,
                other_deductions: 0,
                net_pay: net,
                transaction_id: transaction.id,
                notes: "Auto-linked by ROVA AI",
              });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("ai-classify error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

// ── Keyword fallback (used when no DeepSeek key is set) ───────────────────────
function keywordFallback(description, typeHint) {
  const d = description.toLowerCase();

  if (/salary|salari|wage|payroll|monthly pay|staff pay|worker pay/.test(d)) {
    const nameMatch = description.match(/(?:to|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    return {
      category: "Payroll",
      type: "expense",
      intent: "salary_payment",
      employee_name: nameMatch ? nameMatch[1] : null,
      inventory_item: null,
      quantity: null,
      unit_price: null,
      client_name: null,
      clarification_needed: !nameMatch,
      ai_question: !nameMatch ? "This looks like a salary payment. Who is it for?" : null,
      confidence: nameMatch ? 0.82 : 0.65,
    };
  }

  if (/cement|bags?|stock|inventory|purchase|supplier|bought|buy|payment for|sold/.test(d)) {
    const qtyMatch = description.match(/(\d+)\s*(?:bags?|units?|pcs?|pieces?|cartons?|litres?)/i);
    const isIncome = typeHint === "income" || /credit|received|inflow|deposit/.test(d);
    
    let itemName = null;
    const itemMatch = description.match(/(?:bought|purchase|buy|payment for|for|sold)\s+(?:\d+\s+)?(?:bags?|units?|pcs?|pieces?|cartons?|litres?|items?)?\s*(?:of\s+)?([a-zA-Z\s]+?)(?:\s+from|\s+for|\s+at|\s+on|\bdebit\b|\bcredit\b|$)/i);
    if (itemMatch) {
      itemName = itemMatch[1].trim();
    }

    return {
      category: isIncome ? "Business Revenue" : "Inventory Purchase",
      type: isIncome ? "income" : "expense",
      intent: isIncome ? "inventory_sale" : "inventory_purchase",
      employee_name: null,
      inventory_item: itemName,
      quantity: qtyMatch ? parseFloat(qtyMatch[1]) : null,
      unit_price: null,
      client_name: null,
      clarification_needed: !qtyMatch || !itemName,
      ai_question: !qtyMatch || !itemName
        ? `This looks like an inventory ${isIncome ? 'sale' : 'purchase'}. What item was it, and how many units?`
        : null,
      confidence: qtyMatch && itemName ? 0.85 : 0.6,
    };
  }

  if (/invoice|payment from|receipt from|client pay/.test(d)) {
    return {
      category: "Business Revenue",
      type: "income",
      intent: "invoice_payment",
      employee_name: null,
      inventory_item: null,
      quantity: null,
      unit_price: null,
      client_name: null,
      clarification_needed: false,
      ai_question: null,
      confidence: 0.78,
    };
  }

  const isIncome = typeHint === "income" || /credit|received|inflow|deposit/.test(d);
  const isClear = description.trim().length > 10;

  return {
    category: isIncome ? "Other Income" : "Other Expense",
    type: isIncome ? "income" : "expense",
    intent: isIncome ? "general_income" : "general_expense",
    employee_name: null,
    inventory_item: null,
    quantity: null,
    unit_price: null,
    client_name: null,
    clarification_needed: !isClear,
    ai_question: !isClear ? `What was this transaction of "${description}" for?` : null,
    confidence: isClear ? 0.6 : 0.3,
  };
}
