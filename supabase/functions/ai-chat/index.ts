// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MASTER_SYSTEM_PROMPT = `You are ROVA AI, an intelligent, helpful and friendly AI assistant. You are a general-purpose conversational assistant capable of answering questions, explaining concepts, helping with problems, brainstorming ideas, discussing different subjects and engaging in natural conversations.
Understand the user's message based on its meaning and context, not just keywords.
Communicate naturally, intelligently and clearly. Ask follow-up questions when necessary. Maintain conversation context and adapt your explanations to the user's needs.
You are not restricted to accounting, finance or business. You can discuss general knowledge, technology, education, science, entertainment, everyday life and other appropriate topics.
Never force a conversation into an accounting workflow. Never display generic fallback messages simply because a user's message does not match predefined commands.
Be honest about uncertainty. Never invent facts or claim to have performed actions you have not performed.
Your primary objective is to provide an intelligent, natural and useful conversational experience.`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY");
    if (!deepseekApiKey) {
      console.warn("[ROVA AI] DEEPSEEK_API_KEY is not configured in Supabase environment secrets");
      return new Response(
        JSON.stringify({
          error: "DEEPSEEK_API_KEY_MISSING",
          reply: "⚠️ The DeepSeek API key is not configured. Please set the DEEPSEEK_API_KEY secret in your Supabase project settings.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { messages, message, prompt, stream } = body;
    const isStream = Boolean(stream);

    // ── Build normalized message array ─────────────────────────────────────────
    let inputMessages: { role: string; content: string }[] = [];

    if (Array.isArray(messages) && messages.length > 0) {
      inputMessages = messages;
    } else if (typeof message === "string" && message.trim().length > 0) {
      inputMessages = [{ role: "user", content: message.trim() }];
    } else if (typeof prompt === "string" && prompt.trim().length > 0) {
      inputMessages = [{ role: "user", content: prompt.trim() }];
    }

    if (inputMessages.length === 0) {
      return new Response(
        JSON.stringify({
          error: "EMPTY_MESSAGE",
          reply: "Please provide a message or prompt.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Sanitize and filter messages (sensible context management: keep up to last 20 messages)
    const sanitizedMessages = inputMessages
      .filter((m) => m && typeof m.content === "string" && m.content.trim().length > 0)
      .slice(-20)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content.trim(),
      }));

    // Prepend master system prompt
    const finalMessages = [
      { role: "system", content: MASTER_SYSTEM_PROMPT },
      ...sanitizedMessages,
    ];

    // ── Call official DeepSeek API directly ────────────────────────────────────
    const deepseekResponse = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: finalMessages,
        temperature: 0.7,
        stream: isStream,
      }),
    });

    if (!deepseekResponse.ok) {
      const errText = await deepseekResponse.text().catch(() => "");
      console.error(`[ROVA AI] DeepSeek API error HTTP ${deepseekResponse.status}:`, errText);

      let friendlyReply = "I encountered an issue connecting to the AI engine. Please try again shortly.";
      if (deepseekResponse.status === 401) {
        friendlyReply = "Invalid DeepSeek API key. Please check your DEEPSEEK_API_KEY secret.";
      } else if (deepseekResponse.status === 429) {
        friendlyReply = "The AI service is currently busy. Please wait a moment and try again.";
      }

      return new Response(
        JSON.stringify({
          error: `DEEPSEEK_HTTP_${deepseekResponse.status}`,
          details: errText.slice(0, 300),
          reply: friendlyReply,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // ── Handle SSE Streaming ───────────────────────────────────────────────────
    if (isStream && deepseekResponse.body) {
      return new Response(deepseekResponse.body, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // ── Handle Standard JSON Completion ───────────────────────────────────────
    const data = await deepseekResponse.json();
    const reply = data.choices?.[0]?.message?.content ?? "";

    return new Response(
      JSON.stringify({
        reply,
        role: "assistant",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("[ROVA AI Server Error]:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "An unexpected error occurred in ROVA AI",
        reply: "Sorry, I ran into an unexpected error. Please try again in a moment.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
