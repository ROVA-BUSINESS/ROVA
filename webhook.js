import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

// Helper function to send WhatsApp message
async function sendMessage(to, text) {
  const phoneId = process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !token) {
    console.warn("⚠️ PHONE_NUMBER_ID or WHATSAPP_TOKEN missing in env.");
    return;
  }

  try {
    await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: { body: text }
      })
    });
  } catch (err) {
    console.error("Error in sendMessage:", err);
  }
}

// ─── Trigger Rova Onboarding Flow ────────────────────────────────────────────
// Sends an interactive WhatsApp Flow message to kick off user registration.
// Call this the first time a brand-new phone number contacts Rova.
async function triggerRovaOnboardingFlow(recipientPhone) {
  const phoneId = process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token   = process.env.WHATSAPP_TOKEN   || process.env.WHATSAPP_ACCESS_TOKEN;
  const flowId  = process.env.WHATSAPP_FLOW_ID;

  if (!phoneId || !token) {
    console.warn("⚠️ PHONE_NUMBER_ID or WHATSAPP_TOKEN missing — cannot trigger flow.");
    return null;
  }
  if (!flowId) {
    console.warn("⚠️ WHATSAPP_FLOW_ID missing in .env — cannot trigger onboarding flow.");
    return null;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipientPhone,          // e.g. "2348012345678" (no +)
          type: "interactive",
          interactive: {
            type: "flow",
            header: {
              type: "text",
              text: "Welcome to Rova 🚀",
            },
            body: {
              text: "Complete your registration to start accepting payments and managing your business.",
            },
            footer: {
              text: "Takes about 2 minutes",
            },
            action: {
              name: "flow",
              parameters: {
                flow_message_version: "3",
                flow_token: crypto.randomUUID(),   // unique per session
                flow_id: flowId,
                flow_cta: "Start Registration",
                flow_action: "navigate",
                flow_action_payload: {
                  screen: "USER_INFO",
                  data: {
                    full_name: "",
                    email: "",
                    phone_number: recipientPhone,
                    id_type: "",
                    id_number: "",
                  },
                },
              },
            },
          },
        }),
      }
    );

    const result = await response.json();
    if (response.ok) {
      console.log("✅ Onboarding flow sent to", recipientPhone, result);
    } else {
      console.error("❌ Failed to send onboarding flow:", result);
    }
    return result;
  } catch (err) {
    console.error("Error triggering onboarding flow:", err);
    return null;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Helper to run ROVA logic
async function runRovaLogic(text, from) {
  const lower = text.toLowerCase();
  if (lower.includes("jumia") || lower.includes("payout") || lower.includes("report")) {
    return "📊 *ROVA Jumia Payout Audit Report*\n\n• Total Jumia Orders: 42\n• Escrow Pending: ₦345,000\n• Verified Net Payout: ₦1,250,000\n• Status: Matched with bank deposit ✅";
  }
  return `✅ ROVA processed your query: "${text}"`;
}

// GET Webhook verification for Meta
app.get("/webhook", (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'rova-whatsapp-webhook-2026')) {
    console.log('✅ Webhook verified by Meta');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST Webhook handler with Typing Dots + Thinking Indicator
app.post("/webhook", async (req, res) => {
  const entry = req.body?.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const msg = value?.messages?.[0];

  if (!msg) {
    return res.sendStatus(200);
  }

  const wamid = msg.id;
  const from = msg.from;
  const text = msg.text?.body || "";

  const phoneId = process.env.PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

  // STEP 1: SHOW 3 DOTS IMMEDIATELY (must be first thing)
  if (phoneId && token && wamid) {
    try {
      await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: wamid,
          typing_indicator: { type: "text" }
        })
      });
    } catch (err) {
      console.error("Failed to send initial typing indicator:", err);
    }
  }

  // STEP 2: TELL WHATSAPP WE RECEIVED IT (to avoid duplicate)
  res.sendStatus(200);

  // ── NEW USER DETECTION: send onboarding flow instead of text reply ──────
  // A simple heuristic: if the message is exactly "hi", "hello", "start", or
  // the very first message (you can replace this with a Supabase lookup later).
  const greetings = ["hi", "hello", "start", "hey", "register", "join"];
  if (greetings.includes(text.trim().toLowerCase())) {
    await triggerRovaOnboardingFlow(from);
    return; // Don't send the normal ROVA reply for this message
  }
  // ────────────────────────────────────────────────────────────────────────

  // STEP 3: DO WORK IN BACKGROUND
  // If the task is heavy (Jumia audit, AI), send thinking text
  const lowerText = text.toLowerCase();
  if (lowerText.includes("jumia") || lowerText.includes("payout") || lowerText.includes("report")) {
    await sendMessage(from, "🤔 Rova is thinking... analyzing your Jumia orders, one sec...");

    // Show dots again after thinking text
    if (phoneId && token && wamid) {
      try {
        await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            status: "read",
            message_id: wamid,
            typing_indicator: { type: "text" }
          })
        });
      } catch (err) {
        console.error("Failed to send typing indicator after thinking message:", err);
      }
    }
  }

  // STEP 4: YOUR EXISTING ROVA LOGIC
  const finalAnswer = await runRovaLogic(text, from);

  // STEP 5: SEND FINAL ANSWER (dots disappear automatically)
  await sendMessage(from, finalAnswer);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 ROVA Webhook server running on port ${PORT}`);
});

export default app;
