/**
 * Redis is no longer used for the transaction queue.
 * BullMQ polling caused Upstash's 500k free-tier request limit to be exceeded.
 * All transaction processing now runs through the In-Memory Queue.
 *
 * Redis may be re-enabled in future by switching QUEUE_DRIVER=redis and
 * pointing REDIS_URL to an unlimited Redis instance (e.g. Redis Cloud free tier).
 */
export const redis: null = null;
export function isRedisAvailable(): boolean { return false; }
export function markRedisUnusable(_reason: string): void {}
