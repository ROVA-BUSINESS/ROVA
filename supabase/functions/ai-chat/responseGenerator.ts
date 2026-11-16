// responseGenerator.ts - Two-Stage Response Generation and Formatting

import { AISource, ToolExecutionResult, ChatMessage } from "./types.ts";
import { ModelManager } from "./modelManager.ts";

export class ResponseGenerator {
  /**
   * Helper to strip asterisks from response text as required by Rule 8
   */
  static cleanAsterisks(str: string): string {
    if (!str) return "";
    return str.replace(/\*/g, "");
  }

  /**
   * Two-stage response generation:
   * When a tool executes, provide the verified result to the LLM to generate a natural, conversational response.
   * If the LLM is unavailable or for simple confirmations, fall back gracefully to the formatted summary.
   */
  static async synthesizeResponse(
    modelManager: ModelManager,
    userQuery: string,
    toolResult: ToolExecutionResult | null,
    source: AISource = "web",
    conversationHistory: ChatMessage[] = [],
    memoryContext: string = ""
  ): Promise<string> {
    // If no tool was executed or if clarification was requested, return summary directly
    if (!toolResult) {
      return "Hi! I'm ROVA AI, your business financial assistant. How can I help with your transactions, stock, or invoices today?";
    }

    if (toolResult.requiresClarification) {
      return this.cleanAsterisks(toolResult.formattedSummary);
    }

    // For document downloads or receipt/invoice PDF generation, preserving the clear structured summary with attachment link is ideal
    if (toolResult.documentToSend || toolResult.toolName === "sendDocument") {
      return this.cleanAsterisks(toolResult.formattedSummary);
    }

    // Attempt natural LLM synthesis if API key is configured
    if (modelManager.hasConfiguredProvider) {
      try {
        const systemPrompt = `You are ROVA AI, the conversational ERP for Nigerian SMEs (${source === "whatsapp" ? "WhatsApp" : "Web app"}).
A backend operation was executed for the user's request. Here is the VERIFIED database outcome:

Tool Executed: ${toolResult.toolName}
Execution Success: ${toolResult.success}
Database Result Details:
${JSON.stringify(toolResult.data || toolResult.formattedSummary, null, 2)}

${memoryContext ? memoryContext : ""}

CRITICAL RULES:
1. Speak naturally, professionally, and conversationally to the user about what happened.
2. Only confirm what actually succeeded in the database result. NEVER invent unverified numbers.
3. Keep amounts formatted in Naira (e.g. ₦15,000.00).
4. ${source === "whatsapp" ? "Use helpful domain emojis (💰, 💸, 📦, 📊, ✅) for readability." : "Keep styling clean."}
5. FORMATTING RULE: Do NOT use asterisks (*) or double asterisks (**) anywhere in your response. Write clean plain text.`;

        const messages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          ...conversationHistory.slice(-2),
          { role: "user", content: userQuery },
          { role: "assistant", content: `Tool execution output: ${toolResult.formattedSummary}` },
        ];

        const res = await modelManager.callChat(messages, {
          temperature: 0.3,
          maxTokens: 350,
          timeoutMs: 8000,
        });

        if (res.content && res.content.trim().length > 10) {
          return this.cleanAsterisks(res.content.trim());
        }
      } catch (err) {
        console.warn("[ResponseGenerator] LLM synthesis failed, falling back to verified summary:", err);
      }
    }

    // Verified fallback
    return this.cleanAsterisks(toolResult.formattedSummary);
  }
}
