import { Queue } from 'bullmq';
import { redis } from '../config/redis';
import { TransactionJobData } from '../types';

/**
 * BullMQ Queue for async WhatsApp transaction processing.
 * The webhook controller adds jobs here and immediately returns 200 to Meta.
 * The TransactionWorker then processes jobs in the background.
 */
export class TransactionQueue {
  private queue: Queue<TransactionJobData>;

  constructor() {
    this.queue = new Queue<TransactionJobData>('whatsapp-transactions', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,           // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000,         // Start at 5s, then 10s, 20s
        },
        removeOnComplete: 100, // Keep last 100 completed jobs for debugging
        removeOnFail: 500,     // Keep last 500 failed jobs for inspection
      },
    });
  }

  async add(data: TransactionJobData): Promise<void> {
    await this.queue.add('process-transaction', data, {
      jobId: data.messageId, // Use messageId as jobId for idempotency
    });
  }
}
