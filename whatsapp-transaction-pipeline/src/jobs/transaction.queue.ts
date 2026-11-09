import { TransactionJobData } from '../types';
import { inMemoryQueue } from './in_memory.queue';
import { Logger } from '../utils/logger';

/**
 * Unified Transaction Queue — 100% In-Memory.
 * BullMQ + Redis removed to avoid Upstash free-tier polling limits.
 * Jobs are processed immediately within the same Node.js process.
 */
export class TransactionQueue {
  async add(data: TransactionJobData): Promise<void> {
    Logger.info(`[Queue] Enqueuing transaction from ${data.from} [${data.messageId}]`);
    await inMemoryQueue.add(data);
  }
}
