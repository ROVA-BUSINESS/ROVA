import express from 'express';
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
