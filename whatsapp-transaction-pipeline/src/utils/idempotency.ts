import { redis } from '../config/redis';

/**
 * Ensures WhatsApp webhook messages are processed idempotently (exactly once).
 */
export class IdempotencyService {
  private readonly TTL_SECONDS = 86400; // 24 hours retention for processed message IDs

  async isProcessed(messageId: string): Promise<boolean> {
    const key = `msg:processed:${messageId}`;
    const exists = await redis.get(key);
    return exists !== null;
  }

  async markProcessed(messageId: string): Promise<void> {
    const key = `msg:processed:${messageId}`;
    await redis.setex(key, this.TTL_SECONDS, 'true');
  }
}
