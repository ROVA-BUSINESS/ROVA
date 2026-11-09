import { redis } from '../config/redis';

/**
 * Ensures WhatsApp webhook messages are processed idempotently (exactly once).
 * Uses an in-memory Map as primary store (24-hour TTL).
 * Redis sync is disabled since Redis is no longer used for the queue.
 */
export class IdempotencyService {
  private readonly TTL_MS = 86400 * 1000; // 24 hours
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
    return false;
  }

  async markProcessed(messageId: string): Promise<void> {
    IdempotencyService.memoryCache.set(messageId, Date.now() + this.TTL_MS);

    // Housekeeping: prevent unbounded map growth
    if (IdempotencyService.memoryCache.size > 20000) {
      const now = Date.now();
      for (const [k, exp] of IdempotencyService.memoryCache.entries()) {
        if (exp <= now) IdempotencyService.memoryCache.delete(k);
      }
    }
  }
}
