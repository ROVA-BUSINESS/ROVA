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

    const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "rova_whatsapp_secure_token";

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

    const fromNumber = message.from; // User's WhatsApp Phone Number
    const messageType = message.type; // 'text' | 'image' | 'audio'

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const DEEPSEEK_API_KEY = Deno.env.get("DEEPSEEK_API_KEY");
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const PADDLE_OCR_URL = Deno.env.get("PADDLE_OCR_URL"); // Optional custom PaddleOCR microservice URL

    // Find User by Phone Number
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, full_name, user_id")
      .or(`phone.eq.${fromNumber},phone.eq.+${fromNumber}`)
      .maybeSingle();

    const userId = profile?.user_id || profile?.id;
    if (!userId) {
      await sendWhatsAppMessage(fromNumber, "⚠️ Welcome to ROVA! Your WhatsApp number is not linked to a ROVA account yet. Please register at https://www.rovabusiness.com and add your phone number in Settings.", WHATSAPP_ACCESS_TOKEN);
      return new Response(JSON.stringify({ status: "user_not_found" }), { headers: corsHeaders, status: 200 });
    }

    let extractedText = "";
    let mediaTypeSource = "text";

    // ── STEP A: INPUT PROCESSING (Text / PaddleOCR / Whisper) ───────────────────

    if (messageType === "text") {
      extractedText = message.text?.body || "";
      mediaTypeSource = "Text message";
    } else if (messageType === "image") {
      mediaTypeSource = "Receipt / Image (OCR)";
      const imageId = message.image?.id;
      
      if (imageId && WHATSAPP_ACCESS_TOKEN) {
        // Fetch media URL from WhatsApp API
        const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${imageId}`, {
          headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        });
        const mediaData = await mediaRes.json();
        const mediaUrl = mediaData.url;

        if (mediaUrl) {
          // Fetch raw image bytes
          const imgBlob = await fetch(mediaUrl, {
            headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
          }).then(res => res.arrayBuffer());

          // Check if custom PaddleOCR microservice endpoint is available
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
              console.error("PaddleOCR microservice call failed:", err);
            }
          }

          // Fallback to OpenAI Vision OCR if PaddleOCR is not active
          if (!extractedText && OPENAI_API_KEY) {
            const base64Img = btoa(String.fromCharCode(...new Uint8Array(imgBlob)));
            const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: "Transcribe all text from this receipt or document image clearly. List items, amounts, merchant name, date, and total." },
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
      mediaTypeSource = "Voice note (Whisper Speech-to-Text)";
      const audioId = message.audio?.id || message.voice?.id;

      if (audioId && WHATSAPP_ACCESS_TOKEN && OPENAI_API_KEY) {
        const mediaRes = await fetch(`https://graph.facebook.com/v18.0/${audioId}`, {
          headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        });
        const mediaData = await mediaRes.json();
        const mediaUrl = mediaData.url;

        if (mediaUrl) {
          const audioBuffer = await fetch(mediaUrl, {
            headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
          }).then(res => res.arrayBuffer());

          // Call OpenAI Whisper API for Speech-to-Text
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
      await sendWhatsAppMessage(fromNumber, "⚠️ ROVA could not extract readable text from your input. Please send a clearer text message, receipt photo, or voice note.", WHATSAPP_ACCESS_TOKEN);
      return new Response(JSON.stringify({ status: "extraction_empty" }), { headers: corsHeaders, status: 200 });
    }

    // ── STEP B: INTENT DETECTION & ACCOUNTING ENGINE (ROVA AI) ──────────────────

    // Invoke ROVA AI Classification logic
    const classifyRes = await fetch(`${url.origin}/functions/v1/ai-classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": req.headers.get("Authorization") || `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({
        transaction: { description: extractedText },
        userId: userId,
        mode: "execute",
      }),
    }).then(res => res.json()).catch(err => ({ error: err.message }));

    const result = classifyRes?.result || {};
    const confidence = result.confidence ?? 0.5;

    // ── STEP C: DATABASE & WHATSAPP REPLY GENERATION ────────────────────────────

    let replyMessage = "";

    if (confidence >= 0.90 && !result.clarification_needed) {
      // Automatic Processing (High Confidence)
      replyMessage = `✅ *Transaction Recorded by ROVA AI*\n\n` +
        `📥 *Source*: ${mediaTypeSource}\n` +
        `📝 *Extracted*: "${extractedText}"\n` +
        `🏷️ *Category*: ${result.category || "General"}\n` +
        `⚖️ *Journal Entry*: Debit ${result.journal_entry?.debit || "Account"} | Credit ${result.journal_entry?.credit || "Cash"}\n` +
        `🎯 *Confidence*: ${(confidence * 100).toFixed(0)}%\n\n` +
        `View updated financial reports on https://www.rovabusiness.com`;
    } else {
      // Clarification Required (Confidence < 90%)
      replyMessage = `🤔 *ROVA AI Needs Clarification*\n\n` +
        `📥 *Source*: ${mediaTypeSource}\n` +
        `📝 *Extracted*: "${extractedText}"\n\n` +
        `❓ *Question*: ${result.ai_question || `What was this transaction of "${extractedText}" for?`}\n\n` +
        `Reply directly to this WhatsApp message with details (or type e.g., "Food, kg, 10, 250, 5" if it was inventory stock).`;
    }

    await sendWhatsAppMessage(fromNumber, replyMessage, WHATSAPP_ACCESS_TOKEN);

    return new Response(JSON.stringify({ success: true, extractedText, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
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
    console.log(`[DEV WhatsApp Simulation] To: ${to} | Message:\n${text}`);
    return;
  }
  const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!PHONE_NUMBER_ID) return;

  try {
    await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text },
      }),
    });
  } catch (err) {
    console.error("Failed to send WhatsApp message:", err);
  }
}
