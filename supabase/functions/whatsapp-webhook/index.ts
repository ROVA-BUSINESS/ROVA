// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);

  // ── 1. Webhook Verification (GET request from Meta / WhatsApp) ─────────────
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "rova-whatsapp-webhook-2026";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WhatsApp Webhook verified successfully.");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ── 2. Webhook Event Handler (POST request) ────────────────────────────────
  try {
    const body = await req.json();
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return new Response(JSON.stringify({ status: "ignored_no_message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const fromNumber = message.from || ""; // User's WhatsApp Phone Number
    const messageType = message.type; // 'text' | 'image' | 'audio' | 'voice'

    console.log(`[WhatsApp Webhook Received] From: ${fromNumber} | Type: ${messageType}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "";

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const PADDLE_OCR_URL = Deno.env.get("PADDLE_OCR_URL");

    if (!WHATSAPP_ACCESS_TOKEN) {
      console.warn("⚠️ WHATSAPP_ACCESS_TOKEN secret is not set in Supabase. Messages cannot be sent back to WhatsApp.");
    }

    // ── SINGLE IDENTITY LOOKUP (Shared User / Business Account) ────────────────
    const cleanPhone = fromNumber.replace(/\D/g, "");
    const withPlus = `+${cleanPhone}`;
    const localPhone = cleanPhone.startsWith("234") ? `0${cleanPhone.slice(3)}` : cleanPhone;

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, full_name, business_name")
      .or(`phone.eq.${cleanPhone},phone.eq.${withPlus},phone.eq.${localPhone}`)
      .maybeSingle();

    const userId = profile?.id;
    if (!userId) {
      console.log(`[WhatsApp Webhook] Unlinked phone number ${fromNumber}. Sending setup prompt.`);
      await sendWhatsAppMessage(
        fromNumber,
        "⚠️ Welcome to ROVA! Your WhatsApp phone number is not linked to a ROVA account yet.\n\nPlease log in to https://www.rovabusiness.com, go to Settings → Business Profile, and update your Business Phone number to enable instant WhatsApp accounting.",
        WHATSAPP_ACCESS_TOKEN
      );
      return new Response(JSON.stringify({ status: "user_not_found" }), { headers: corsHeaders, status: 200 });
    }

    let extractedText = "";
    let mediaTypeSource = "Text message";

    // ── STEP A: MULTI-MODAL INPUT PROCESSING (Text / OCR / Whisper STT) ──────

    if (messageType === "text") {
      extractedText = message.text?.body || "";
      mediaTypeSource = "Text message";
    } else if (messageType === "image") {
      mediaTypeSource = "Receipt / Document Image";
      const imageId = message.image?.id;

      if (imageId && WHATSAPP_ACCESS_TOKEN) {
        const mediaRes = await fetch(`https://graph.facebook.com/v20.0/${imageId}`, {
          headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        });
        const mediaData = await mediaRes.json();
        const mediaUrl = mediaData.url;

        if (mediaUrl) {
          const imgBlob = await fetch(mediaUrl, {
            headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
          }).then((res) => res.arrayBuffer());

          if (PADDLE_OCR_URL) {
            try {
              const ocrRes = await fetch(PADDLE_OCR_URL, {
                method: "POST",
                headers: { "Content-Type": "application/octet-stream" },
                body: imgBlob,
              });
              const ocrData = await ocrRes.json();
              extractedText = ocrData.text || ocrData.extracted_text || "";
            } catch (err) {
              console.error("PaddleOCR call failed:", err);
            }
          }

          if (!extractedText && OPENAI_API_KEY) {
            const base64Img = btoa(String.fromCharCode(...new Uint8Array(imgBlob)));
            const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: "Transcribe all text from this receipt/document image clearly. List items, amounts, merchant name, date, and total." },
                      { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Img}` } },
                    ],
                  },
                ],
              }),
            });
            const visionData = await visionRes.json();
            extractedText = visionData.choices?.[0]?.message?.content || "";
          }
        }
      }
    } else if (messageType === "audio" || messageType === "voice") {
      mediaTypeSource = "Voice Note (Whisper Speech-to-Text)";
      const audioId = message.audio?.id || message.voice?.id;

      if (audioId && WHATSAPP_ACCESS_TOKEN && OPENAI_API_KEY) {
        const mediaRes = await fetch(`https://graph.facebook.com/v20.0/${audioId}`, {
          headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        });
        const mediaData = await mediaRes.json();
        const mediaUrl = mediaData.url;

        if (mediaUrl) {
          const audioBuffer = await fetch(mediaUrl, {
            headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
          }).then((res) => res.arrayBuffer());

          const formData = new FormData();
          formData.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "voice.ogg");
          formData.append("model", "whisper-1");

          const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
            body: formData,
          });
          const whisperData = await whisperRes.json();
          extractedText = whisperData.text || "";
        }
      }
    }

    if (!extractedText.trim()) {
      await sendWhatsAppMessage(
        fromNumber,
        "⚠️ ROVA could not extract readable text from your input. Please send a clearer text message, receipt photo, or voice note.",
        WHATSAPP_ACCESS_TOKEN
      );
      return new Response(JSON.stringify({ status: "extraction_empty" }), { headers: corsHeaders, status: 200 });
    }

    // ── STEP B: ROUTE TO UNIFIED CENTRAL ROVA AI AGENT BRAIN VIA SUPABASE SDK ─
    console.log(`[WhatsApp Webhook -> Central ROVA AI Agent] Processing query for User ${userId}: "${extractedText}"`);

    const { data: agentData, error: agentError } = await supabaseClient.functions.invoke("ai-chat", {
      body: {
        messages: [{ role: "user", content: extractedText }],
        context: { userId: userId, source: "whatsapp" },
        source: "whatsapp",
      },
    });

    let replyText = agentData?.reply;

    if (agentError || !replyText) {
      console.error("[WhatsApp Webhook] Error from ai-chat agent:", agentError || agentData);
      replyText = agentError?.message
        ? `⚠️ ROVA AI Error: ${agentError.message}`
        : (agentData?.error || "ROVA AI could not process your request. Please check your query and try again.");
    }

    // ── STEP C: SEND RESPONSE BACK VIA WHATSAPP API ────────────────────────────
    const formattedWhatsAppReply = `${replyText}\n\n🌐 *View full dashboard*: https://www.rovabusiness.com`;
    await sendWhatsAppMessage(fromNumber, formattedWhatsAppReply, WHATSAPP_ACCESS_TOKEN);

    return new Response(
      JSON.stringify({ success: true, extractedText, reply: replyText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("WhatsApp webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Helper: Send WhatsApp Message via Meta Cloud API
async function sendWhatsAppMessage(to: string, text: string, accessToken?: string) {
  if (!accessToken) {
    console.warn(`[WhatsApp API Skipped] No WHATSAPP_ACCESS_TOKEN set. Would have sent to ${to}: ${text}`);
    return;
  }
  const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!PHONE_NUMBER_ID) {
    console.warn("[WhatsApp API Skipped] No WHATSAPP_PHONE_NUMBER_ID set.");
    return;
  }

  const recipient = to.replace(/\D/g, "");

  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: { body: text },
      }),
    });

    const resData = await response.json();
    if (!response.ok) {
      console.error(`[WhatsApp API Error ${response.status}]`, JSON.stringify(resData));
    } else {
      console.log(`[WhatsApp Message Sent Successfully] To: ${recipient} | Msg ID: ${resData.messages?.[0]?.id}`);
    }
  } catch (err) {
    console.error("Failed to send WhatsApp message fetch error:", err);
  }
}
