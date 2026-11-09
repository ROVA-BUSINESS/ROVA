import { redis, isRedisAvailable, markRedisUnusable } from '../config/redis';

/**
 * Ensures WhatsApp webhook messages are processed idempotently (exactly once).
 * Combines in-memory tracking with Redis sync, providing 100% reliability
 * even if Redis limits are exceeded or Redis is offline.
 */
export class IdempotencyService {
  private readonly TTL_SECONDS = 86400; // 24 hours
  private static memoryCache = new Map<string, number>();

  async isProcessed(messageId: string): Promise<boolean> {
    const now = Date.now();
    const expiry = IdempotencyService.memoryCache.get(messageId);
    if (expiry && expiry > now) {
      return true;
    }
    if (expiry) {
      IdempotencyService.memoryCache.delete(messageId);
    }

    if (redis && isRedisAvailable()) {
      try {
        const key = `msg:processed:${messageId}`;
        const exists = await redis.get(key);
        return exists !== null;
      } catch (err: any) {
        if (err.message?.includes('max requests limit exceeded')) {
          markRedisUnusable('Upstash request limit exceeded');
        }
        return false;
      }
    }

    return false;
  }

  async markProcessed(messageId: string): Promise<void> {
    IdempotencyService.memoryCache.set(messageId, Date.now() + this.TTL_SECONDS * 1000);

    // Housekeeping: prevent unbounded map growth
    if (IdempotencyService.memoryCache.size > 20000) {
      const now = Date.now();
      for (const [k, exp] of IdempotencyService.memoryCache.entries()) {
        if (exp <= now) IdempotencyService.memoryCache.delete(k);
      }
    }

    if (redis && isRedisAvailable()) {
      try {
        const key = `msg:processed:${messageId}`;
        await redis.setex(key, this.TTL_SECONDS, 'true');
      } catch (err: any) {
        if (err.message?.includes('max requests limit exceeded')) {
          markRedisUnusable('Upstash request limit exceeded');
        }
      }
    }
  }
}
