// orchestrator.ts - Central AI Orchestration Service for ROVA

import {
  OrchestratorRequest,
  OrchestratorResponse,
  ChatMessage,
  ToolExecutionResult,
  AISource,
} from "./types.ts";
import { ModelManager } from "./modelManager.ts";
import { ContextManager } from "./contextManager.ts";
import { IntentUnderstanding } from "./intentUnderstanding.ts";
import { ToolRegistry } from "./toolRegistry.ts";
import { ResponseGenerator } from "./responseGenerator.ts";

export class Orchestrator {
  private modelManager: ModelManager;

  constructor() {
    this.modelManager = new ModelManager();
    ToolRegistry.initialize();
  }

  /**
   * Main entrypoint: Every incoming AI request passes through this method
   */
  async processRequest(
    supabaseClient: any,
    req: OrchestratorRequest
  ): Promise<OrchestratorResponse> {
    const userId = req.userId;
    const source: AISource = req.source || "web";
    const rawMessages = req.messages || (req.message ? [{ role: "user", content: req.message }] : []);
    const lastUserMsg = rawMessages.filter((m) => m.role === "user").pop()?.content || "";
    const isStaff = Boolean(req.context?.isStaff);

    // ── 1. Check for Memory Management Commands ─────────────────────────────────
    const memoryCommand = this.detectMemoryCommand(lastUserMsg);
    if (memoryCommand) {
      const { memories: existingMemories } = await ContextManager.fetchUserMemories(supabaseClient, userId);
      const memoryReply = await this.handleMemoryCommand(supabaseClient, userId, memoryCommand, lastUserMsg, existingMemories);
      return {
        reply: memoryReply,
        actions: [],
        toolExecuted: false,
      };
    }

    // ── 2. Intent Analysis & Targeted Context Retrieval ─────────────────────────
    const intent = IntentUnderstanding.analyzeIntent(lastUserMsg, rawMessages);

    // If intent requires clarification (e.g. user said "I bought nylon" with no amount)
    if (intent.clarificationNeeded) {
      return {
        reply: intent.clarificationNeeded,
        requiresConfirmation: false,
        actions: [],
        toolExecuted: false,
      };
    }

    // Fetch targeted context based on identified intent
    const { formattedText: financialCtx, memoryFormattedCtx } = await ContextManager.buildTargetedContext(
      supabaseClient,
      userId,
      intent.neededTables,
      intent.needsFinancialSnapshot
    );

    // Compact conversation history to fit budget
    const compactedHistory = ContextManager.compactConversationHistory(rawMessages, 2600);

    // ── 3. Handle Confirmation / Cancellation Gate ──────────────────────────────
    const userConfirmed = req.confirmed === true;
    const userCancelled = req.cancelled === true;
    let toolCall = req.pendingToolCall || intent.suggestedToolCall;

    if (userCancelled && toolCall) {
      await this.logAIAction(supabaseClient, {
        userId,
        source,
        userRequest: lastUserMsg,
        toolCalled: toolCall.name,
        parameters: toolCall.parameters,
        confirmationStatus: "skipped",
        resultStatus: "cancelled",
      });
      return {
        reply: "Action cancelled. Let me know what else I can help with.",
        actions: [],
        toolExecuted: false,
      };
    }

    // ── 4. Model Consultation (if tool not deterministically identified) ────────
    let modelReply = "";
    let requiresConfirmation = false;
    let confirmationSummary = "";

    if (!toolCall && this.modelManager.hasConfiguredProvider) {
      try {
        const systemPrompt = `You are ROVA AI, the conversational ERP and financial operating system for Nigerian SMEs.
Source: ${source === "whatsapp" ? "WhatsApp" : "Web app"}.
${isStaff ? "STAFF RESTRICTION: Do not reveal overall company profits or calculate company taxes." : ""}

${financialCtx}

${memoryFormattedCtx}

${ToolRegistry.generateToolSystemPrompt()}

CRITICAL RULES:
1. If the user is asking to record, query, or generate a document and details are provided, return the appropriate "tool_call".
2. If the user is having a general conversation or asking business/accounting advice, answer conversationally and set "tool_call": null.
3. Plain text only: Do NOT use asterisks (*) anywhere in your reply.
4. Output ONLY valid JSON matching this schema:
{
  "reply": "Conversational reply text",
  "tool_call": { "name": "toolName", "parameters": {} } | null,
  "requires_confirmation": false,
  "confirmation_summary": ""
}`;

        const llmMessages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          ...compactedHistory.map((m) => ({ role: m.role, content: m.content })),
        ];

        const llmRes = await this.modelManager.callChat(llmMessages, {
          jsonMode: true,
          temperature: 0.1,
          maxTokens: 600,
        });

        const parsed = JSON.parse(llmRes.content);
        modelReply = parsed.reply || "";
        toolCall = parsed.tool_call || null;
        requiresConfirmation = parsed.requires_confirmation === true;
        confirmationSummary = parsed.confirmation_summary || "";
      } catch (llmErr) {
        console.warn("[Orchestrator] LLM planning failed, proceeding with intent:", llmErr);
      }
    }

    // ── 5. High-Risk Confirmation Gate ──────────────────────────────────────────
    if (toolCall) {
      const toolDef = ToolRegistry.getTool(toolCall.name);
      if (toolDef && toolDef.category === "high_risk" && !userConfirmed) {
        await this.logAIAction(supabaseClient, {
          userId,
          source,
          userRequest: lastUserMsg,
          toolCalled: toolCall.name,
          parameters: toolCall.parameters,
          confirmationStatus: "pending",
          resultStatus: "pending_confirmation",
        });

        const confirmMsg =
          source === "whatsapp"
            ? `⚠️ Are you sure you want to permanently delete this? Reply YES to confirm or NO to cancel.`
            : `⚠️ Are you sure you want to permanently delete this? This action cannot be undone.`;

        return {
          reply: confirmMsg,
          requiresConfirmation: true,
          confirmationSummary: confirmationSummary || "Delete transaction",
          pendingToolCall: toolCall,
          actions: [],
          toolExecuted: false,
        };
      }
    }

    // ── 6. Tool Execution ───────────────────────────────────────────────────────
    let execResult: ToolExecutionResult | null = null;
    let toolExecuted = false;

    if (toolCall && toolCall.name) {
      const confirmStatus = userConfirmed ? "confirmed" : "auto";
      try {
        execResult = await ToolRegistry.validateAndExecute(
          toolCall.name,
          toolCall.parameters || {},
          supabaseClient,
          userId,
          lastUserMsg,
          isStaff,
          {
            source,
            documentUrl: req.context?.documentUrl,
            documentFileName: req.context?.documentFileName,
          }
        );

        toolExecuted = execResult.success;

        await this.logAIAction(supabaseClient, {
          userId,
          source,
          userRequest: lastUserMsg,
          toolCalled: toolCall.name,
          parameters: toolCall.parameters || {},
          confirmationStatus: confirmStatus,
          resultStatus: execResult.success ? "success" : "error",
          recordId: execResult.recordId || "",
          errorMessage: execResult.errorMessage,
        });
      } catch (err: any) {
        console.error(`[Orchestrator] Error executing ${toolCall.name}:`, err);
        execResult = {
          success: false,
          toolName: toolCall.name,
          formattedSummary: `⚠️ I encountered an issue while trying to complete that: ${err.message}. Please try again.`,
          errorMessage: err.message,
        };

        await this.logAIAction(supabaseClient, {
          userId,
          source,
          userRequest: lastUserMsg,
          toolCalled: toolCall.name,
          parameters: toolCall.parameters || {},
          confirmationStatus: confirmStatus,
          resultStatus: "error",
          errorMessage: err.message,
        });
      }
    }

    // ── 7. Response Generation (Two-Stage Synthesis) ────────────────────────────
    let finalReply = "";
    if (execResult) {
      finalReply = await ResponseGenerator.synthesizeResponse(
        this.modelManager,
        lastUserMsg,
        execResult,
        source,
        compactedHistory,
        memoryFormattedCtx
      );
    } else if (modelReply) {
      finalReply = ResponseGenerator.cleanAsterisks(modelReply);
    } else {
      finalReply = "I didn't quite catch that. Could you clarify what you'd like to do? For example, you can ask to record an expense, check your stock levels, or review unpaid invoices.";
    }

    // ── 8. Fire-and-Forget Memory Extraction ────────────────────────────────────
    if (this.modelManager.hasConfiguredProvider && lastUserMsg.length > 10 && finalReply.length > 10) {
      this.extractAndSaveMemoriesBackground(supabaseClient, userId, lastUserMsg, finalReply).catch((err) =>
        console.error("[Orchestrator Memory] Extraction error:", err)
      );
    }

    return {
      reply: finalReply,
      actions: execResult?.actions || [],
      toolExecuted,
      documentToSend: execResult?.documentToSend,
      requiresConfirmation: false,
    };
  }

  // ── Memory Command Helpers ──────────────────────────────────────────────────
  private detectMemoryCommand(text: string): "forget_last" | "forget_all" | "recall" | "force_remember" | null {
    const q = text.toLowerCase().trim();
    if (/\b(forget that|forget the last|don't remember that|delete that memory|erase that)\b/i.test(q)) {
      return "forget_last";
    }
    if (/\b(forget all|clear memories|clear all memories|forget everything|reset memories)\b/i.test(q)) {
      return "forget_all";
    }
    if (/\b(what do you remember|what do you know about me|show memories|list memories|my preferences)\b/i.test(q)) {
      return "recall";
    }
    if (/^remember (that |this )?/i.test(q)) {
      return "force_remember";
    }
    return null;
  }

  private async handleMemoryCommand(
    supabaseClient: any,
    userId: string,
    command: "forget_last" | "forget_all" | "recall" | "force_remember",
    userMessage: string,
    existingMemories: any[]
  ): Promise<string> {
    if (command === "recall") {
      if (existingMemories.length === 0) {
        return "I don't have any stored memories about you yet. As we chat, I'll remember key details about your business.";
      }
      const lines = existingMemories.map((m, i) => `${i + 1}. [${m.memory_type.replace(/_/g, " ")}] ${m.content}`);
      return `Here's what I remember about you:\n\n${lines.join("\n")}\n\nYou can say "forget that" to remove specific memories, or "clear all memories" to start fresh.`;
    }

    if (command === "forget_last") {
      if (existingMemories.length === 0) return "I don't have any memories stored yet — nothing to forget!";
      const latest = [...existingMemories].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      await supabaseClient
        .from("rova_memories")
        .update({ is_active: false })
        .eq("id", latest.id)
        .eq("user_id", userId);
      return `Done — I've forgotten: "${latest.content}".`;
    }

    if (command === "forget_all") {
      await supabaseClient
        .from("rova_memories")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true);
      return "Done — I've cleared all stored memories. We're starting fresh.";
    }

    if (command === "force_remember") {
      const content = userMessage.replace(/^remember (that |this )?/i, "").trim();
      if (!content) return "What would you like me to remember? Please say: \"Remember that [detail]\"";
      await supabaseClient.from("rova_memories").insert({
        user_id: userId,
        memory_type: "instruction",
        content,
        source_summary: "Explicit user instruction",
        importance: 8,
        is_active: true,
      });
      return `Got it — I'll remember: "${content}"`;
    }

    return "";
  }

  private async extractAndSaveMemoriesBackground(
    supabaseClient: any,
    userId: string,
    userMessage: string,
    assistantReply: string
  ): Promise<void> {
    const extractionPrompt = `Read the exchange below and extract any useful facts to remember for future conversations.
User message: "${userMessage}"
Assistant reply: "${assistantReply}"

Return valid JSON ONLY in this format:
{
  "memories": [
    {
      "memory_type": "preference" | "business_detail" | "instruction" | "recurring_contact" | "decision" | "general",
      "content": "concise factual statement (max 100 chars)",
      "importance": 1-10
    }
  ]
}
If nothing is worth remembering, return: {"memories": []}`;

    try {
      const res = await this.modelManager.callChat(
        [{ role: "user", content: extractionPrompt }],
        { jsonMode: true, temperature: 0.1, maxTokens: 300, timeoutMs: 10000 }
      );
      const parsed = JSON.parse(res.content);
      const newMemories: any[] = parsed.memories || [];
      if (!Array.isArray(newMemories) || newMemories.length === 0) return;

      const toInsert = newMemories
        .filter((m) => m && m.content && m.memory_type)
        .map((m) => ({
          user_id: userId,
          memory_type: m.memory_type,
          content: m.content.slice(0, 400),
          source_summary: `Extracted from: "${userMessage.slice(0, 70)}"`,
          importance: typeof m.importance === "number" ? Math.min(10, Math.max(1, m.importance)) : 5,
          is_active: true,
        }));

      if (toInsert.length > 0) {
        await supabaseClient.from("rova_memories").insert(toInsert);
      }
    } catch {
      // Non-blocking background worker
    }
  }

  private async logAIAction(
    supabaseClient: any,
    params: {
      userId: string;
      source: "web" | "whatsapp";
      userRequest: string;
      toolCalled: string;
      parameters: Record<string, any>;
      confirmationStatus: "auto" | "confirmed" | "skipped" | "high_risk_blocked" | "pending";
      resultStatus: "success" | "error" | "pending_confirmation" | "cancelled";
      recordId?: string;
      errorMessage?: string;
    }
  ) {
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
      console.error("[ROVA Audit] Failed to log AI action:", err);
    }
  }
}
