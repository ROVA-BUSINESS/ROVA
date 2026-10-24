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

    const wamid = message.id;
    const fromNumber = message.from || ""; // User's WhatsApp Phone Number
    const messageType = message.type; // 'text' | 'image' | 'audio' | 'voice'

    console.log(`[WhatsApp Webhook Received] From: ${fromNumber} | Type: ${messageType}`);

    const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || Deno.env.get("PHONE_NUMBER_ID");
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || Deno.env.get("WHATSAPP_TOKEN");

    // STEP 1: SHOW 3 DOTS IMMEDIATELY (must be first thing)
    if (PHONE_NUMBER_ID && WHATSAPP_ACCESS_TOKEN && wamid) {
      try {
        await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            status: "read",
            message_id: wamid,
            typing_indicator: { type: "text" }
          }),
        });
      } catch (err) {
        console.error("Failed sending initial typing indicator:", err);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "";

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const PADDLE_OCR_URL = Deno.env.get("PADDLE_OCR_URL");
    const OCR_SPACE_API_KEY = Deno.env.get("OCR_SPACE_API_KEY") || "helloworld";
    const WHISPER_SERVICE_URL = Deno.env.get("WHISPER_SERVICE_URL");

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
        "⚠️ Welcome to ROVA! Your WhatsApp phone number is not linked to a ROVA account yet.\n\n📲 Please log in to https://www.rovabusiness.com, go to ⚙️ Settings → Business Profile, and update your Business Phone number to enable instant WhatsApp accounting.",
        WHATSAPP_ACCESS_TOKEN
      );
      return new Response(JSON.stringify({ status: "user_not_found" }), { headers: corsHeaders, status: 200 });
    }

    let extractedText = "";
    let mediaTypeSource = "Text message";
    let uploadedDocUrl = "";
    let uploadedDocFileName = "";

    // Safe ArrayBuffer to Base64 (prevents RangeError stack overflow on large images/audio)
    function safeArrayBufferToBase64(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
      }
      return btoa(binary);
    }

    // ── STEP A: MULTI-MODAL INPUT PROCESSING (Text / Free OCR / Whisper STT) ──

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

          // Upload image to Supabase Storage receipts bucket
          try {
            const filePath = `${userId}/inbound_${Date.now()}.jpg`;
            await supabaseClient.storage.from("receipts").upload(filePath, imgBlob, {
              contentType: "image/jpeg",
              upsert: true,
            });
            const { data: signedData } = await supabaseClient.storage.from("receipts").createSignedUrl(filePath, 315360000);
            uploadedDocUrl = signedData?.signedUrl || "";
            uploadedDocFileName = "receipt_image.jpg";
          } catch (storageErr) {
            console.error("Failed to save image to receipts bucket:", storageErr);
          }

          if (message.image?.caption) {
            extractedText = message.image.caption;
          }

          // 1. Try PaddleOCR URL if configured
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

          // 2. Try OCR.space Free API
          if (!extractedText) {
            try {
              const base64Img = safeArrayBufferToBase64(imgBlob);
              const formData = new URLSearchParams();
              formData.append("apikey", OCR_SPACE_API_KEY);
              formData.append("base64Image", `data:image/jpeg;base64,${base64Img}`);
              formData.append("language", "eng");
              formData.append("isTable", "true");
              formData.append("scale", "true");
              formData.append("OCREngine", "2");

              const ocrSpaceRes = await fetch("https://api.ocr.space/parse/image", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: formData.toString(),
              });
              const ocrSpaceData = await ocrSpaceRes.json();
              if (ocrSpaceData.ParsedResults?.length) {
                extractedText = ocrSpaceData.ParsedResults.map((r: any) => r.ParsedText || "").join("\n").trim();
              }
            } catch (err) {
              console.error("OCR.space API call failed:", err);
            }
          }

          // 3. Fallback to OpenAI Vision if present and free providers fail
          if (!extractedText && OPENAI_API_KEY) {
            const base64Img = safeArrayBufferToBase64(imgBlob);
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
            extractedText = visionData.choices?.[0]?.message?.content || extractedText;
          }
        }
      }
    } else if (messageType === "document") {
      mediaTypeSource = "Business Document / PDF";
      const docId = message.document?.id;
      const docFileName = message.document?.filename || "document.pdf";
      const docMimeType = message.document?.mime_type || "application/pdf";
      const docCaption = message.document?.caption || "";

      if (docId && WHATSAPP_ACCESS_TOKEN) {
        const mediaRes = await fetch(`https://graph.facebook.com/v20.0/${docId}`, {
          headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        });
        const mediaData = await mediaRes.json();
        const mediaUrl = mediaData.url;

        if (mediaUrl) {
          const docBuffer = await fetch(mediaUrl, {
            headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
          }).then((res) => res.arrayBuffer());

          const ext = docFileName.includes(".") ? docFileName.split(".").pop() : "pdf";
          const filePath = `${userId}/inbound_${Date.now()}_${docFileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

          try {
            await supabaseClient.storage.from("receipts").upload(filePath, docBuffer, {
              contentType: docMimeType,
              upsert: true,
            });
            const { data: signedData } = await supabaseClient.storage.from("receipts").createSignedUrl(filePath, 315360000);
            uploadedDocUrl = signedData?.signedUrl || "";
            uploadedDocFileName = docFileName;
          } catch (storageErr) {
            console.error("Failed to upload document to storage:", storageErr);
          }

          // OCR Extraction for Document / PDF via OCR.space
          try {
            const base64Doc = safeArrayBufferToBase64(docBuffer);
            const formData = new URLSearchParams();
            formData.append("apikey", OCR_SPACE_API_KEY);
            formData.append("base64Image", `data:${docMimeType};base64,${base64Doc}`);
            formData.append("language", "eng");
            formData.append("isTable", "true");
            formData.append("scale", "true");
            formData.append("OCREngine", "2");
            formData.append("filetype", (ext || "PDF").toUpperCase());

            const ocrSpaceRes = await fetch("https://api.ocr.space/parse/image", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: formData.toString(),
            });
            const ocrSpaceData = await ocrSpaceRes.json();
            if (ocrSpaceData.ParsedResults?.length) {
              extractedText = ocrSpaceData.ParsedResults.map((r: any) => r.ParsedText || "").join("\n").trim();
            }
          } catch (err) {
            console.error("OCR extraction failed for document:", err);
          }

          if (docCaption) {
            extractedText = extractedText ? `${extractedText}\n\nNote: ${docCaption}` : docCaption;
          }
        }
      }
    } else if (messageType === "audio" || messageType === "voice") {
      mediaTypeSource = "Voice Note (Whisper Speech-to-Text)";
      const audioId = message.audio?.id || message.voice?.id;

      if (audioId && WHATSAPP_ACCESS_TOKEN) {
        const mediaRes = await fetch(`https://graph.facebook.com/v20.0/${audioId}`, {
          headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
        });
        const mediaData = await mediaRes.json();
        const mediaUrl = mediaData.url;

        if (mediaUrl) {
          const audioBuffer = await fetch(mediaUrl, {
            headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}` },
          }).then((res) => res.arrayBuffer());

          // 1. Try Custom / Self-hosted Whisper HTTP Endpoint
          if (WHISPER_SERVICE_URL) {
            try {
              const formData = new FormData();
              formData.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "voice.ogg");
              const whisperSvcRes = await fetch(WHISPER_SERVICE_URL, {
                method: "POST",
                body: formData,
              });
              const whisperSvcData = await whisperSvcRes.json();
              extractedText = whisperSvcData.text || whisperSvcData.transcript || "";
            } catch (err) {
              console.error("WHISPER_SERVICE_URL call failed:", err);
            }
          }

          // 2. Try Groq Free Whisper API (100% Free - 14,400 requests/day)
          if (!extractedText && GROQ_API_KEY) {
            try {
              const formData = new FormData();
              formData.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "voice.ogg");
              formData.append("model", "whisper-large-v3-turbo");
              formData.append("language", "en");

              const groqRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
                method: "POST",
                headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
                body: formData,
              });
              const groqData = await groqRes.json();
              extractedText = groqData.text || "";
            } catch (err) {
              console.error("Groq Whisper API call failed:", err);
            }
          }

          // 3. Try Hugging Face Free Inference API for Whisper
          if (!extractedText) {
            try {
              const hfToken = Deno.env.get("HF_API_TOKEN");
              const headers: Record<string, string> = { "Content-Type": "audio/ogg" };
              if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

              const hfRes = await fetch("https://router.huggingface.co/hf-inference/v1/audio/transcriptions", {
                method: "POST",
                headers,
                body: audioBuffer,
              });
              if (hfRes.ok) {
                const hfData = await hfRes.json();
                extractedText = hfData.text || "";
              }
            } catch (err) {
              console.error("HuggingFace Whisper API call failed:", err);
            }
          }

          // 4. Fallback to OpenAI Whisper API if key is present
          if (!extractedText && OPENAI_API_KEY) {
            try {
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
            } catch (err) {
              console.error("OpenAI Whisper API call failed:", err);
            }
          }
        }
      }
    }

    if (!extractedText.trim()) {
      const isVoice = messageType === "audio" || messageType === "voice";
      const helpMsg = isVoice
        ? "🎙️ ROVA received your voice note! To process this transaction instantly, please send a text message (e.g. 💰 'Recorded sale of ₦25,000') or send a photo of your receipt 📄."
        : "📷 ROVA could not read text from this image clearly. Please ensure good lighting or type out the transaction details in a text message 💬.";

      await sendWhatsAppMessage(fromNumber, helpMsg, WHATSAPP_ACCESS_TOKEN);
      return new Response(JSON.stringify({ status: "extraction_empty" }), { headers: corsHeaders, status: 200 });
    }

    // ── STEP A.5: INTERCEPT SPECIFIC QUERIES (E.G. TAX) ────────────────────────
    if (/\b(tax|vat|cit|file tax|taxes|tax return|tax action)\b/i.test(extractedText)) {
      await sendWhatsAppMessage(
        fromNumber,
        '🏛️ Tax filing and management is available on our website. Please visit 🔗 https://www.rovabusiness.com/app/tax to perform your tax actions securely.\n\n📲 View full dashboard: https://www.rovabusiness.com',
        WHATSAPP_ACCESS_TOKEN
      );
      return new Response(JSON.stringify({ status: "tax_handled" }), { headers: corsHeaders, status: 200 });
    }

    // ── STEP 3: HEAVY TASK THINKING INDICATOR (JUMIA / PAYOUT / REPORT) ───────
    const lowerText = (extractedText || "").toLowerCase();
    if (lowerText.includes("jumia") || lowerText.includes("payout") || lowerText.includes("report")) {
      await sendWhatsAppMessage(
        fromNumber,
        "🤔 Rova is thinking... analyzing your Jumia orders, one sec...",
        WHATSAPP_ACCESS_TOKEN
      );

      // Show dots again after thinking text
      if (PHONE_NUMBER_ID && WHATSAPP_ACCESS_TOKEN && wamid) {
        try {
          await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              status: "read",
              message_id: wamid,
              typing_indicator: { type: "text" },
            }),
          });
        } catch (err) {
          console.error("Failed sending typing indicator after thinking message:", err);
        }
      }
    }

    // ── STEP B: ROUTE TO UNIFIED CENTRAL ROVA AI AGENT BRAIN VIA SUPABASE SDK ─
    console.log(`[WhatsApp Webhook -> Central ROVA AI Agent] Processing query for User ${userId}: "${extractedText}"`);

    const userPrompt = uploadedDocUrl
      ? `[BUSINESS DOCUMENT UPLOADED]\nFilename: ${uploadedDocFileName}\nDocument URL: ${uploadedDocUrl}\n\nDocument Content:\n${extractedText || "(See attached document file)"}`
      : extractedText;

    const { data: agentData, error: agentError } = await supabaseClient.functions.invoke("ai-chat", {
      body: {
        messages: [{ role: "user", content: userPrompt }],
        context: {
          userId: userId,
          source: "whatsapp",
          documentUrl: uploadedDocUrl,
          documentFileName: uploadedDocFileName,
        },
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
    // If a document was generated or retrieved, send the file directly to WhatsApp!
    if (agentData?.documentToSend?.url) {
      await sendWhatsAppDocument(
        fromNumber,
        agentData.documentToSend.url,
        agentData.documentToSend.fileName || "ROVA_Document.pdf",
        agentData.documentToSend.caption || "",
        WHATSAPP_ACCESS_TOKEN
      );
    }

    const formattedWhatsAppReply = `${replyText}\n\n📲 View full dashboard: https://www.rovabusiness.com`;
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
  const cleanBodyText = (text || "").replace(/\*/g, "");

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
        text: { body: cleanBodyText },
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

// Helper: Send Document (PDF, Image, etc.) via Meta Cloud API
async function sendWhatsAppDocument(
  to: string,
  url: string,
  filename: string,
  caption?: string,
  accessToken?: string
) {
  if (!accessToken) {
    console.warn("[WhatsApp Document Skipped] No WHATSAPP_ACCESS_TOKEN set.");
    return;
  }
  const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!PHONE_NUMBER_ID) {
    console.warn("[WhatsApp Document Skipped] No WHATSAPP_PHONE_NUMBER_ID set.");
    return;
  }

  const recipient = to.replace(/\D/g, "");
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "document",
    document: {
      link: url,
      filename: filename || "ROVA_Document.pdf",
      caption: (caption || "").replace(/\*/g, ""),
    },
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const resData = await response.json();
    if (!response.ok) {
      console.error(`[WhatsApp Document Error ${response.status}]`, JSON.stringify(resData));
    } else {
      console.log(`[WhatsApp Document Sent Successfully] To: ${recipient} | File: ${filename}`);
    }
  } catch (err) {
    console.error("sendWhatsAppDocument failed:", err);
  }
}
// ── HANDLE WHATSAPP FLOW COMPLETION ─────────────────────────────────────────
if (messageType === "interactive") {
  const interactive = message.interactive;

  if (interactive?.type === "nfm_reply") {
    // This is a WhatsApp Flow completion payload
    const flowResponse = interactive.nfm_reply;
    const responseJson = JSON.parse(flowResponse.response_json);

    console.log("[Rova Flow Completed]", responseJson);

    // Extract all fields from the 3-screen flow
    const {
      full_name,
      email,
      phone_number,
      id_type,
      id_number,
      business_name,
      business_email,
      business_phone,
      registration_type,
      registration_number,
      business_logo_link,
      password,
      terms_accepted,
    } = responseJson;

    // 1. Create user account in Supabase Auth
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      phone: phone_number,
      email_confirm: true,
    });

    if (authError) {
      console.error("[Rova Flow] Auth error:", authError.message);
      await sendWhatsAppMessage(
        fromNumber,
        `❌ Registration failed: ${authError.message}. Please try again or visit rovabusiness.com`,
        WHATSAPP_ACCESS_TOKEN
      );
      return new Response("ok", { status: 200 });
    }

    // 2. Save business profile
    await supabase.from("business_profiles").insert({
      user_id: newUser.user.id,
      full_name,
      phone_number,
      id_type,
      id_number,
      business_name,
      business_email,
      business_phone,
      registration_type,
      registration_number,
      business_logo_link,
      terms_accepted: true,
      source: "whatsapp_flow",
    });

    // 3. Send welcome message back to the user
    await sendWhatsAppMessage(
      fromNumber,
      `🎉 Welcome to Rova, ${full_name}!\n\n` +
      `Your account has been created successfully.\n` +
      `Business: ${business_name}\n\n` +
      `📲 Log in at https://www.rovabusiness.com to access your dashboard.\n\n` +
      `You can also use this WhatsApp chat to record expenses, send invoices, and more!`,
      WHATSAPP_ACCESS_TOKEN
    );

    return new Response("ok", { status: 200 });
  }
}

