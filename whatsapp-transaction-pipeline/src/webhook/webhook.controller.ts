import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { WhatsAppParser } from '../whatsapp/whatsapp.parser';
import { TransactionQueue } from '../jobs/transaction.queue';

export class WebhookController {
  private parser = new WhatsAppParser();
  private queue = new TransactionQueue();

  // ── Trigger onboarding Flow ─────────────────────────────────────────────────
  private async triggerOnboardingFlow(recipientPhone: string): Promise<void> {
    const flowId = env.WHATSAPP_FLOW_ID;
    if (!flowId) {
      console.warn('⚠️  WHATSAPP_FLOW_ID not set — skipping onboarding flow trigger');
      return;
    }
    try {
      const res = await fetch(
        `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: recipientPhone,
            type: 'interactive',
            interactive: {
              type: 'flow',
              header: { type: 'text', text: 'Welcome to Rova 🚀' },
              body: {
                text: 'Complete your registration to start accepting payments and managing your business.',
              },
              footer: { text: 'Takes about 2 minutes' },
              action: {
                name: 'flow',
                parameters: {
                  flow_message_version: '3',
                  flow_token: crypto.randomUUID(),
                  flow_id: flowId,
                  flow_cta: 'Start Registration',
                  flow_action: 'navigate',
                  flow_action_payload: {
                    screen: 'USER_INFO',
                    data: {
                      full_name: '',
                      email: '',
                      phone_number: recipientPhone,
                      id_type: '',
                      id_number: '',
                    },
                  },
                },
              },
            },
          }),
        }
      );
      const result = await res.json() as any;
      if (res.ok) {
        console.log(`✅ Onboarding flow sent to ${recipientPhone}`);
      } else {
        console.error(`❌ Failed to send onboarding flow:`, result);
      }
    } catch (err) {
      console.error('Error triggering onboarding flow:', err);
    }
  }
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Handles the Meta webhook verification challenge.
   * Meta sends a GET request with a challenge that we must echo back.
   */
  verify(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      console.log('✅ Webhook verified by Meta');
      res.status(200).send(challenge);
    } else {
      console.warn('❌ Webhook verification failed');
      res.status(403).json({ error: 'Forbidden' });
    }
  }

  /**
   * Handles all incoming WhatsApp messages.
   * We MUST respond 200 OK immediately to Meta, then do the heavy
   * processing asynchronously via BullMQ so we don't time out.
   */
  /**
   * Handles all incoming WhatsApp messages.
   * Order:
   * STEP 1: Show typing 3 dots immediately
   * STEP 2: Respond 200 OK to WhatsApp
   * STEP 3: Check for heavy tasks (jumia/payout/report) & send thinking message + 3 dots again
   * STEP 4: Execute ROVA logic / Queue dispatch
   * STEP 5: Send final answer
   */
  async handle(req: Request, res: Response): Promise<void> {
    try {
      const entry = req.body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Ignore status updates (delivered, read receipts, etc.)
      if (!value?.messages?.length) {
        res.sendStatus(200);
        return;
      }

      const msg = value.messages[0];
      const wamid = msg.id;
      const from = msg.from;
      const text = msg.text?.body || '';

      const phoneId = process.env.PHONE_NUMBER_ID || env.WHATSAPP_PHONE_NUMBER_ID;
      const token = process.env.WHATSAPP_TOKEN || env.WHATSAPP_ACCESS_TOKEN;

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
          console.error('Failed to send initial typing indicator:', err);
        }
      }

      // STEP 2: TELL WHATSAPP WE RECEIVED IT (to avoid duplicate)
      res.sendStatus(200);

      // STEP 3: DO WORK IN BACKGROUND
      // If the task is heavy (Jumia audit, AI), send thinking text
      const lowerText = text.toLowerCase();
      if (lowerText.includes("jumia") || lowerText.includes("payout") || lowerText.includes("report")) {
        if (phoneId && token) {
          try {
            await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: from,
                type: 'text',
                text: { body: "🤔 Rova is thinking... analyzing your Jumia orders, one sec..." }
              })
            });

            // Show dots again after thinking text
            if (wamid) {
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
            }
          } catch (err) {
            console.error('Failed sending thinking message or typing indicator:', err);
          }
        }
      }

      // ── NEW USER DETECTION: trigger onboarding flow ──────────────────────
      const greetings = ['hi', 'hello', 'start', 'hey', 'register', 'join'];
      if (greetings.includes(text.trim().toLowerCase())) {
        await this.triggerOnboardingFlow(from);
        return; // Don't process as a regular transaction
      }
      // ─────────────────────────────────────────────────────────────────────

      // STEP 4: YOUR EXISTING ROVA LOGIC
      const parsed = this.parser.parse(msg);

      if (!parsed) {
        console.log(`ℹ️ Unsupported message type from ${from}: ${msg.type}`);
        return;
      }

      // Dispatch to BullMQ for async processing
      await this.queue.add({
        from,
        messageId: wamid,
        type: parsed.type,
        payload: parsed.payload,
      });

      console.log(`📨 Queued ${parsed.type} message from ${from} [${wamid}]`);
    } catch (err) {
      // Log internally but never fail — we already sent 200 to Meta
      console.error('Error processing webhook payload:', err);
    }
  }
}
