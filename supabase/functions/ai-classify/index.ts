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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
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
    const systemPrompt = `You are ROVA, an intelligent business financial assistant for Nigerian SMEs.
Your task is to classify a financial transaction and detect special business intents.

Business context:
- ${inventoryContext}
- ${employeeContext}
- Available categories: ${categoryContext}

Classification rules:
1. If the description mentions paying a salary/wage to a named person → intent: salary_payment, extract employee_name
2. If the description mentions buying goods/stock/items from a supplier → intent: inventory_purchase, extract inventory_item and quantity
3. If the description mentions payment from a client or invoice number → intent: invoice_payment, extract client_name
4. If the description is vague, has no clear purpose, or confidence < 0.7 → set clarification_needed: true and write a short friendly ai_question asking the user what it was for
5. Always pick a category from the provided list, or suggest "Other Expense"/"Other Income"
6. Confidence: 0.0–1.0 based on how certain you are

IMPORTANT: Reply ONLY with valid JSON, no markdown, no explanation.
Schema:
{
  "category": string,
  "type": "income" | "expense" | "transfer",
  "intent": "salary_payment" | "inventory_purchase" | "invoice_payment" | "general_expense" | "general_income" | "transfer" | "unknown",
  "employee_name": string | null,
  "inventory_item": string | null,
  "quantity": number | null,
  "unit_price": number | null,
  "client_name": string | null,
  "clarification_needed": boolean,
  "ai_question": string | null,
  "confidence": number
}`;

    const userPrompt = `Classify this transaction:
Description: ${transaction.description}
Amount: ₦${transaction.amount?.toLocaleString() ?? "unknown"}
Type hint: ${transaction.type ?? "unknown"}
Date: ${transaction.date ?? "unknown"}`;

    // ── Call Gemini (or fallback to keyword classify) ──────────────────────────
    let result;

    if (GEMINI_API_KEY) {
      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1,
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
        result = JSON.parse(raw);
      } catch (geminiError) {
        console.error("Gemini API call failed. Using keywordFallback classifier.", geminiError);
        result = keywordFallback(transaction.description ?? "", transaction.type ?? "expense");
      }
    } else {
      result = keywordFallback(transaction.description ?? "", transaction.type ?? "expense");
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

// ── Keyword fallback (used when no Gemini key is set) ─────────────────────────
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

  if (/cement|bags?|stock|inventory|purchase|supplier|bought|buy/.test(d)) {
    const qtyMatch = description.match(/(\d+)\s*(?:bags?|units?|pcs?|pieces?|cartons?|litres?)/i);
    return {
      category: "Inventory Purchase",
      type: "expense",
      intent: "inventory_purchase",
      employee_name: null,
      inventory_item: null,
      quantity: qtyMatch ? parseFloat(qtyMatch[1]) : null,
      unit_price: null,
      client_name: null,
      clarification_needed: !qtyMatch,
      ai_question: !qtyMatch
        ? "This looks like an inventory purchase. What item did you buy, and how many units?"
        : null,
      confidence: 0.75,
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
