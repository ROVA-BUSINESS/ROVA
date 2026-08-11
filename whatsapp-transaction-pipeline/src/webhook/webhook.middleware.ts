import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Verifies the X-Hub-Signature-256 header sent by Meta with every webhook.
 * This ensures the request is genuinely from Meta and hasn't been tampered with.
 */
export function verifyWebhookSignature(
  req: RequestWithRawBody,
  res: Response,
  next: NextFunction
): void {
  const signature = req.headers['x-hub-signature-256'] as string;

  if (!signature) {
    res.status(401).json({ error: 'No signature provided' });
    return;
  }

  if (!req.rawBody) {
    res.status(400).json({ error: 'No raw body available for verification' });
    return;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', env.META_APP_SECRET)
    .update(req.rawBody)
    .digest('hex')}`;

  // Use timingSafeEqual to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    console.warn(`⚠️ Invalid webhook signature from ${req.ip}`);
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  next();
}
