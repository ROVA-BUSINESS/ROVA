// contextManager.ts - Targeted Database Context & Conversation Continuity Manager

import { ChatMessage, OrchestratorContext } from "./types.ts";

export interface RetrievedContext {
  formattedText: string;
  targetedData: Record<string, any>;
  activeMemories: any[];
  memoryFormattedCtx: string;
}

export class ContextManager {
  /**
   * Fetches active memories for a user, ordered by importance (desc) then recency.
   * Returns max 15 memories to stay strictly within token budgets.
   */
  static async fetchUserMemories(supabaseClient: any, userId: string): Promise<{
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
        .limit(15);

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
          return `${label}:\n${items.map((i) => `  - ${i}`).join("\n")}`;
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
      console.error("[ROVA Context] Failed to fetch memories:", err);
      return { memories: [], formattedCtx: "" };
    }
  }

  /**
   * Targeted Retrieval: Only query specific tables that the user query or intent requires,
   * avoiding full 8-table database dumps on every simple chat or specific operational query.
   */
  static async buildTargetedContext(
    supabaseClient: any,
    userId: string,
    tablesNeeded: string[],
    includeOverview: boolean = false
  ): Promise<RetrievedContext> {
    const data: Record<string, any> = {};
    const promises: Promise<void>[] = [];

    // Pre-fetch memories
    const { memories, formattedCtx: memoryFormattedCtx } = await this.fetchUserMemories(supabaseClient, userId);

    // If targeted tables specify accounts or if overview is needed
    if (includeOverview || tablesNeeded.includes("accounts") || tablesNeeded.includes("transactions")) {
      promises.push(
        (async () => {
          const { data: accs } = await supabaseClient.from("accounts").select("id, name, type, balance").eq("user_id", userId);
          data.accounts = accs || [];
        })()
      );
    }

    if (includeOverview || tablesNeeded.includes("transactions") || tablesNeeded.includes("sales") || tablesNeeded.includes("expenses")) {
      promises.push(
        (async () => {
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
          const { data: txs } = await supabaseClient
            .from("transactions")
            .select("id, amount, type, description, date, ai_category")
            .eq("user_id", userId)
            .gte("date", startOfMonth)
            .order("date", { ascending: false })
            .limit(30);
          data.transactions = txs || [];
        })()
      );
    }

    if (tablesNeeded.includes("inventory") || tablesNeeded.includes("inventory_items")) {
      promises.push(
        (async () => {
          const { data: inv } = await supabaseClient
            .from("inventory_items")
            .select("id, name, current_stock, cost_price, selling_price, unit, reorder_level")
            .eq("user_id", userId)
            .eq("status", "active")
            .limit(40);
          data.inventory = inv || [];
        })()
      );
    }

    if (tablesNeeded.includes("invoices") || tablesNeeded.includes("receivables")) {
      promises.push(
        (async () => {
          const { data: invc } = await supabaseClient
            .from("invoices")
            .select("id, invoice_number, client_name, total, amount_paid, due_date, status")
            .eq("user_id", userId)
            .neq("status", "paid")
            .order("due_date", { ascending: true })
            .limit(20);
          data.invoices = invc || [];
        })()
      );
    }

    if (tablesNeeded.includes("employees") || tablesNeeded.includes("payroll")) {
      promises.push(
        (async () => {
          const { data: emps } = await supabaseClient
            .from("employees")
            .select("id, full_name, role, gross_salary, status")
            .eq("user_id", userId)
            .eq("status", "active");
          data.employees = emps || [];

          const { data: payroll } = await supabaseClient
            .from("payroll_runs")
            .select("id, period_label, total_gross, total_net, employee_count")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(2);
          data.payrollRuns = payroll || [];
        })()
      );
    }

    await Promise.all(promises);

    // Format targeted context string concisely
    const contextLines: string[] = [];
    if (data.accounts) {
      const totalBal = data.accounts.reduce((s: number, a: any) => s + (a.balance || 0), 0);
      contextLines.push(`• Total Accounts Balance: ₦${totalBal.toLocaleString()}`);
    }

    if (data.transactions) {
      const inc = data.transactions.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + (t.amount || 0), 0);
      const exp = data.transactions.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + (t.amount || 0), 0);
      contextLines.push(`• This Month Income: ₦${inc.toLocaleString()} | Expenses: ₦${exp.toLocaleString()} | Net: ₦${(inc - exp).toLocaleString()}`);
    }

    if (data.inventory) {
      const lowStock = data.inventory.filter((i: any) => (i.current_stock || 0) <= (i.reorder_level || 5));
      contextLines.push(`• Active Inventory: ${data.inventory.length} items (${lowStock.length} low stock)`);
    }

    if (data.invoices) {
      const outstanding = data.invoices.reduce((s: number, i: any) => s + ((i.total || 0) - (i.amount_paid || 0)), 0);
      contextLines.push(`• Unpaid Receivables: ₦${outstanding.toLocaleString()} across ${data.invoices.length} pending invoices`);
    }

    if (data.employees) {
      const totalSalary = data.employees.reduce((s: number, e: any) => s + (e.gross_salary || 0), 0);
      contextLines.push(`• Active Staff: ${data.employees.length} employees (Monthly liability: ₦${totalSalary.toLocaleString()})`);
    }

    const formattedText = contextLines.length > 0
      ? `Live Targeted Financial Snapshot:\n${contextLines.join("\n")}`
      : "";

    return {
      formattedText,
      targetedData: data,
      activeMemories: memories,
      memoryFormattedCtx,
    };
  }

  /**
   * Compacts conversation history to fit strictly within a token budget (~3200 tokens).
   * Automatically summarizes older turns if history grows large, preserving conversational continuity.
   */
  static compactConversationHistory(
    messages: ChatMessage[],
    maxTokens: number = 2800
  ): ChatMessage[] {
    const valid = messages.filter((m) => m && m.content && m.content.trim().length > 0);
    if (valid.length <= 6) return valid;

    let tokenCount = 0;
    const recent: ChatMessage[] = [];
    const older: ChatMessage[] = [];

    // Traverse from newest to oldest
    for (let i = valid.length - 1; i >= 0; i--) {
      const msg = valid[i];
      const estTokens = Math.ceil(msg.content.length / 4);

      if (tokenCount + estTokens < maxTokens || recent.length < 4) {
        tokenCount += estTokens;
        recent.unshift(msg);
      } else {
        older.unshift(msg);
      }
    }

    if (older.length > 0) {
      const snippet = older
        .slice(-5)
        .map((m) => `${m.role === "user" ? "User" : "ROVA"}: ${m.content.slice(0, 70).replace(/\n/g, " ")}`)
        .join(" | ");

      const summaryMsg: ChatMessage = {
        role: "system",
        content: `[Previous conversation summary (${older.length} earlier turns): ${snippet}]`,
      };

      return [summaryMsg, ...recent];
    }

    return recent;
  }

  /**
   * Tracks whether the user is answering a previous question or clarification prompt.
   * (e.g. Previous assistant message: "How much did you spend on nylon?", current user message: "15,000" or "15k")
   */
  static detectClarificationAnswer(
    messages: ChatMessage[],
    currentUserText: string
  ): { isAnswer: boolean; itemContext?: string; categoryContext?: string; previousQuestion?: string } | null {
    if (messages.length < 2) return null;

    // Find the last assistant message
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistantMsg) return null;

    const lastText = lastAssistantMsg.content.toLowerCase();
    const isQuestion = lastText.includes("?") || lastText.includes("how much") || lastText.includes("which one");

    if (!isQuestion) return null;

    // Match item if the assistant asked "How much did you spend on [Item]?" or "How much did you pay for [Item]?"
    const matchItem =
      lastAssistantMsg.content.match(/(?:how much did you (?:spend on|pay for|spend for|buy)|how much was)\s+(?:the\s+|an?\s+)?(.*?)(?:\?|\.|\s+once|$)/i);

    const matchCat = lastAssistantMsg.content.match(/record it as an? (?:expense|income) under (.*?)(?:\.|$)/i);

    const itemContext = matchItem ? matchItem[1].trim() : undefined;
    const categoryContext = matchCat ? matchCat[1].trim() : undefined;

    return {
      isAnswer: true,
      itemContext,
      categoryContext,
      previousQuestion: lastAssistantMsg.content,
    };
  }
}
