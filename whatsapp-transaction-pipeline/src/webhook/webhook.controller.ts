import { Request, Response } from 'express';
import { env } from '../config/env';
import { WhatsAppParser } from '../whatsapp/whatsapp.parser';
import { TransactionQueue } from '../jobs/transaction.queue';

export class WebhookController {
  private parser = new WhatsAppParser();
  private queue = new TransactionQueue();

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
  async handle(req: Request, res: Response): Promise<void> {
    // Acknowledge receipt immediately — Meta requires a fast 200 response
    res.status(200).send('OK');

    try {
      const entry = req.body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Ignore status updates (delivered, read receipts, etc.)
      if (!value?.messages?.length) return;

      const message = value.messages[0];
      const from = message.from; // Sender's WhatsApp phone number
      const messageId = message.id; // For idempotency checks

      const parsed = this.parser.parse(message);

      if (!parsed) {
        console.log(`ℹ️ Unsupported message type from ${from}: ${message.type}`);
        return;
      }

      // Dispatch to BullMQ for async processing
      await this.queue.add({
        from,
        messageId,
        type: parsed.type,
        payload: parsed.payload,
      });

      console.log(`📨 Queued ${parsed.type} message from ${from} [${messageId}]`);
    } catch (err) {
      // Log internally but never fail — we already sent 200 to Meta
      console.error('Error processing webhook payload:', err);
    }
  }
}
