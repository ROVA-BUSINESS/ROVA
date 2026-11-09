import { Queue } from 'bullmq';
import { redis, isRedisAvailable, markRedisUnusable } from '../config/redis';
import { env } from '../config/env';
import { TransactionJobData } from '../types';
import { inMemoryQueue } from './in_memory.queue';
import { Logger } from '../utils/logger';

/**
 * Unified Queue for async WhatsApp transaction processing.
 *
 * Supports both BullMQ (when Redis is available) and an In-Memory Queue.
 * If Redis reaches quota limits (e.g. Upstash 500k free tier limit) or goes down,
 * it automatically and seamlessly falls back to the in-memory queue so transactions
 * are NEVER dropped.
 */
export class TransactionQueue {
  private queue: Queue<TransactionJobData> | null = null;

  constructor() {
    if (env.QUEUE_DRIVER !== 'memory' && redis && isRedisAvailable()) {
      try {
        this.queue = new Queue<TransactionJobData>('whatsapp-transactions', {
          connection: redis,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        });
      } catch (err: any) {
        Logger.warn(`BullMQ Queue init skipped: ${err.message}. Using In-Memory Queue.`);
        this.queue = null;
      }
    }
  }

  async add(data: TransactionJobData): Promise<void> {
    // 1. Direct In-Memory processing if configured or Redis unavailable
    if (env.QUEUE_DRIVER === 'memory' || !this.queue || !isRedisAvailable()) {
      await inMemoryQueue.add(data);
      return;
    }

    // 2. Attempt BullMQ with automatic failover
    try {
      await this.queue.add('process-transaction', data, {
        jobId: data.messageId,
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('max requests limit exceeded')) {
        markRedisUnusable('Upstash quota limit exceeded in Queue.add');
        Logger.warn(`[Queue Failover] Upstash request limit reached. Transferred message ${data.messageId} to In-Memory Queue.`);
      } else {
        Logger.error(`[Queue Failover] BullMQ failed (${msg}). Processing via In-Memory Queue.`);
      }

      await inMemoryQueue.add(data);
    }
  }
}
