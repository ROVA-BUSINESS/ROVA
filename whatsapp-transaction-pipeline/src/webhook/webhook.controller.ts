import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { WhatsAppParser } from '../whatsapp/whatsapp.parser';
import { TransactionQueue } from '../jobs/transaction.queue';
import { AuthService } from '../auth/auth.service';

export class WebhookController {
  private parser = new WhatsAppParser();
  private queue = new TransactionQueue();
  private authService = new AuthService();

  // ── Send welcome text fallback ──────────────────────────────────────────────
  private async sendWelcomeText(to: string): Promise<void> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: {
              body:
                '🚀 Welcome to *Rova*! Your AI-powered business finance assistant.\n\n' +
                "Here's what I can do for you:\n" +
                '💰 Log income & expenses\n' +
                '🧾 Create & track invoices\n' +
                '📊 Generate financial reports\n' +
                '🏦 Sync your bank account\n\n' +
                'To get started, visit: https://www.rovabusiness.com/signup\n\n' +
                'Or just tell me what you need help with!',
            },
          }),
        }
      );
      const result = await response.json() as any;
      if (response.ok) {
        console.log(`📤 Welcome text sent successfully to ${to}`);
      } else {
        console.error(`❌ Welcome text FAILED to ${to}:`, JSON.stringify(result));
      }
    } catch (err) {
      console.error('Failed to send welcome text:', err);
    }
  }

  // ── Trigger onboarding Flow ─────────────────────────────────────────────────
  // Sends interactive WhatsApp Flow card if WHATSAPP_FLOW_ID is set,
  // otherwise falls back to a plain-text welcome message.
  private async triggerOnboardingFlow(recipientPhone: string): Promise<void> {
    const flowId = env.WHATSAPP_FLOW_ID;

    if (flowId) {
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
          return; // Success — done
        }
        console.error(`❌ Flow API error:`, JSON.stringify(result));
      } catch (err) {
        console.error('Error triggering onboarding flow:', err);
      }
    } else {
      console.warn('⚠️  WHATSAPP_FLOW_ID not set — sending text welcome instead');
    }

    // Fallback: send plain text welcome
    await this.sendWelcomeText(recipientPhone);
  }
  // ── Trigger ROVA Business Hub Mini-App Flow ──────────────────────────────────
  async sendBusinessHubFlow(recipientPhone: string, ctaTitle = 'Open Dashboard'): Promise<void> {
    const flowId = env.WHATSAPP_BUSINESS_HUB_FLOW_ID || '2497408190738308';
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
              header: { type: 'text', text: 'ROVA Business Hub 📊' },
              body: {
                text: 'Manage sales, log expenses, update inventory, and view business reports.',
              },
              footer: { text: 'ROVA Mini App' },
              action: {
                name: 'flow',
                parameters: {
                  flow_message_version: '3',
                  flow_token: `rova_${recipientPhone}_${Date.now()}`,
                  flow_id: flowId,
                  flow_cta: ctaTitle,
                  flow_action: 'navigate',
                  flow_action_payload: {
                    screen: 'DASHBOARD',
                  },
                },
              },
            },
          }),
        }
      );
      const result = await res.json() as any;
      if (res.ok) {
        console.log(`✅ ROVA Business Hub Flow sent to ${recipientPhone}`);
      } else {
        console.error(`❌ Failed to send Business Hub Flow:`, JSON.stringify(result));
      }
    } catch (err) {
      console.error('Error triggering Business Hub flow:', err);
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
   * STEP 1: Show typing 3 dots immediately
   * STEP 2: Respond 200 OK to WhatsApp
   * STEP 2.5: Flow completion handling (nfm_reply)
   * STEP 3: Detect greetings → trigger onboarding flow
   * STEP 4: Heavy task detection (Jumia/payout/report)
   * STEP 5: Queue the transaction for async processing
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

      const phoneId = env.WHATSAPP_PHONE_NUMBER_ID;
      const token = env.WHATSAPP_ACCESS_TOKEN;

      // STEP 1: SHOW 3 DOTS IMMEDIATELY
      if (phoneId && token && wamid) {
        try {
          await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              status: 'read',
              message_id: wamid,
              typing_indicator: { type: 'text' }
            })
          });
        } catch (err) {
          console.error('Failed to send initial typing indicator:', err);
        }
      }

      // STEP 2: TELL WHATSAPP WE RECEIVED IT (prevents duplicate delivery)
      res.sendStatus(200);

      // STEP 2.5: WHATSAPP FLOW COMPLETION (nfm_reply)
      if (msg.type === 'interactive' && msg.interactive?.type === 'nfm_reply') {
        try {
          const responseJson = JSON.parse(msg.interactive.nfm_reply.response_json || '{}');
          const fullName = responseJson.full_name || 'Business Owner';
          const businessName = responseJson.business_name || fullName;

          await this.authService.registerUserByWhatsApp(from, businessName);

          await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: from,
              type: 'text',
              text: {
                body: `🎉 Congratulations *${fullName}*!\n\nYour Rova account for *${businessName}* has been successfully created and linked to this WhatsApp number.\n\nYou can start right away:\n💰 Send income/expenses: *"Spent 5,000 on fuel"*\n🎙️ Send voice notes with your transactions\n📸 Send photos of receipts or invoices\n\n📲 View your full dashboard: https://www.rovabusiness.com`
              }
            })
          });
          console.log(`✅ Onboarded user from WhatsApp Flow: ${fullName} (${businessName})`);
        } catch (err) {
          console.error('Failed to process WhatsApp Flow completion:', err);
        }
        return;
      }

      // STEP 3: SMART ROUTING — Mini App Hub vs Registration
      const hubKeywords = ['menu', 'dashboard', 'hub', 'app', 'manage', 'sales', 'stock', 'inventory', 'balance'];
      const greetings = ['hi', 'hello', 'start', 'hey', 'register', 'join'];
      const cleanText = text.trim().toLowerCase();

      const isHubCommand = hubKeywords.some(k => cleanText.includes(k));
      const isGreeting = greetings.includes(cleanText);

      if (isHubCommand || isGreeting) {
        const user = await this.authService.getUserByPhone(from);
        if (user || isHubCommand) {
          await this.sendBusinessHubFlow(from);
          return;
        } else {
          await this.triggerOnboardingFlow(from);
          return;
        }
      }

      // STEP 4: HEAVY TASK DETECTION
      const lowerText = text.toLowerCase();
      if (lowerText.includes('jumia') || lowerText.includes('payout') || lowerText.includes('report')) {
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
              text: { body: '🤔 Rova is thinking... analyzing your Jumia orders, one sec...' }
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
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: wamid,
                typing_indicator: { type: 'text' }
              })
            });
          }
        } catch (err) {
          console.error('Failed sending thinking message or typing indicator:', err);
        }
      }

      // STEP 5: PARSE & QUEUE FOR ASYNC PROCESSING
      const parsed = this.parser.parse(msg);

      if (!parsed) {
        console.log(`ℹ️ Unsupported message type from ${from}: ${msg.type}`);
        return;
      }

      await this.queue.add({
        from,
        messageId: wamid,
        type: parsed.type,
        payload: parsed.payload,
      });

      console.log(`📨 Queued ${parsed.type} message from ${from} [${wamid}]`);
    } catch (err) {
      // Never fail — 200 already sent to Meta
      console.error('Error processing webhook payload:', err);
    }
  }
}
