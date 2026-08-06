import { Router } from 'express';
import { WebhookController } from './webhook.controller';
import { verifyWebhookSignature } from './webhook.middleware';

const router = Router();
const controller = new WebhookController();

// GET: Used by Meta to verify the webhook endpoint when you first set it up
router.get('/', controller.verify.bind(controller));

// POST: Receives all incoming WhatsApp messages and events
// verifyWebhookSignature middleware runs first to authenticate the payload
router.post('/', verifyWebhookSignature, controller.handle.bind(controller));

export default router;
