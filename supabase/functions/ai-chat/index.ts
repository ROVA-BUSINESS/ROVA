// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Orchestrator } from "./orchestrator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const orchestrator = new Orchestrator();

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured in environment");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { messages, message, context } = body;
    const userId = body.userId || context?.userId;

    if (!userId) {
      throw new Error("Missing required field: userId in request body or context");
    }

    const source = body.source || context?.source || "web";

    // Standardize input message array
    let conversationMessages = messages ?? [];
    if (!conversationMessages.length && message) {
      conversationMessages = [{ role: "user", content: message }];
    }

    const orchestratorResponse = await orchestrator.processRequest(supabaseClient, {
      userId,
      messages: conversationMessages,
      context,
      source,
      confirmed: body.confirmed === true,
      cancelled: body.cancelled === true,
      pendingToolCall: body.pendingToolCall || null,
      idempotencyKey: body.idempotencyKey || req.headers.get("x-idempotency-key") || undefined,
    });

    return new Response(JSON.stringify(orchestratorResponse), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("[ROVA Orchestrator Error]:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "An unexpected error occurred in ROVA AI Orchestrator",
        reply: "⚠️ An issue occurred processing your request. Please try again shortly.",
        toolExecuted: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
