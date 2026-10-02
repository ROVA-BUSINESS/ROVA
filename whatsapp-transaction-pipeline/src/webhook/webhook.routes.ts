import { Router } from 'express';
import { WebhookController } from './webhook.controller';
import { verifyWebhookSignature } from './webhook.middleware';

import { FlowController } from './flow.controller';

const router = Router();
const controller = new WebhookController();
const flowController = new FlowController();

// GET: Used by Meta to verify the webhook endpoint when you first set it up
router.get('/', controller.verify.bind(controller));

// POST: Receives all incoming WhatsApp messages and events
// verifyWebhookSignature middleware runs first to authenticate the payload
router.post('/', verifyWebhookSignature, controller.handle.bind(controller));

// POST: WhatsApp Flows Data API Endpoint (Encrypted RSA+AES)
router.post('/flow', flowController.handleFlow.bind(flowController));

export default router;
