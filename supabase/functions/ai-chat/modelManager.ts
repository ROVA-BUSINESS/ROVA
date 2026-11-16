// modelManager.ts - Central Model Configuration and Unified LLM Client

import { ChatMessage } from "./types.ts";

export interface LLMCallOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  reasoningEffort?: "low" | "medium" | "high";
}

export interface LLMCallResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

export class ModelManager {
  private readonly deepseekKey: string | null;
  private readonly openaiKey: string | null;

  constructor() {
    // Deno environment variables
    this.deepseekKey = Deno.env.get("DEEPSEEK_API_KEY") || null;
    this.openaiKey = Deno.env.get("OPENAI_API_KEY") || null;
  }

  get hasConfiguredProvider(): boolean {
    return Boolean(this.deepseekKey || this.openaiKey);
  }

  /**
   * Primary LLM call routing: Tries DeepSeek first, gracefully falls back to OpenAI
   */
  async callChat(
    messages: ChatMessage[],
    options: LLMCallOptions = {}
  ): Promise<LLMCallResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 30000;

    // Filter out invalid messages
    const sanitizedMessages = messages
      .filter((m) => {
        if (!m || !m.content) return false;
        return typeof m.content === "string" && m.content.trim().length > 0;
      })
      .map((m) => ({
        role: m.role,
        content: m.content.trim(),
      }));

    // If DeepSeek is available, call it as primary
    if (this.deepseekKey) {
      try {
        return await this.callDeepSeek(sanitizedMessages, options, startTime, timeoutMs);
      } catch (err: any) {
        console.warn(`[ModelManager] DeepSeek API failed (${err.message}). Attempting fallback to OpenAI...`);
        if (this.openaiKey) {
          return await this.callOpenAI(sanitizedMessages, options, startTime, timeoutMs);
        }
        throw err;
      }
    }

    // If only OpenAI is available
    if (this.openaiKey) {
      return await this.callOpenAI(sanitizedMessages, options, startTime, timeoutMs);
    }

    throw new Error("No LLM API keys configured (missing DEEPSEEK_API_KEY and OPENAI_API_KEY)");
  }

  private async callDeepSeek(
    messages: { role: string; content: string }[],
    options: LLMCallOptions,
    startTime: number,
    timeoutMs: number
  ): Promise<LLMCallResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const modelName = options.model || "deepseek-chat";
    const body: Record<string, any> = {
      model: modelName,
      messages,
      temperature: options.temperature ?? 0.1,
    };

    if (options.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    if (options.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.deepseekKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`DeepSeek API error HTTP ${response.status}: ${errText.slice(0, 300)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        content,
        model: modelName,
        usage: {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        },
        durationMs: Date.now() - startTime,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async callOpenAI(
    messages: { role: string; content: string }[],
    options: LLMCallOptions,
    startTime: number,
    timeoutMs: number
  ): Promise<LLMCallResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const modelName = options.model || "gpt-4o-mini";
    const body: Record<string, any> = {
      model: modelName,
      messages,
      temperature: options.temperature ?? 0.1,
    };

    if (options.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    if (options.jsonMode) {
      body.response_format = { type: "json_object" };
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.openaiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`OpenAI API error HTTP ${response.status}: ${errText.slice(0, 300)}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        content,
        model: modelName,
        usage: {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        },
        durationMs: Date.now() - startTime,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
