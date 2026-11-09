import { TransactionJobData } from '../types';
import { Logger } from '../utils/logger';

/**
 * Resilient In-Memory Queue for WhatsApp transactions.
 * Used when QUEUE_DRIVER=memory, or as an automatic failover when Redis
 * is unreachable or reaches provider request/quota limits (e.g. Upstash 500k limit).
 */
export class InMemoryTransactionQueue {
  private queue: TransactionJobData[] = [];
  private processing = 0;
  private readonly concurrency = 5;
  private processor: ((data: TransactionJobData) => Promise<void>) | null = null;

  setProcessor(processor: (data: TransactionJobData) => Promise<void>): void {
    this.processor = processor;
  }

  async add(data: TransactionJobData): Promise<void> {
    this.queue.push(data);
    Logger.info(`[InMemoryQueue] Enqueued transaction job ${data.messageId} (pending: ${this.queue.length})`);
    this.processNext();
  }

  private processNext(): void {
    if (this.processing >= this.concurrency || this.queue.length === 0 || !this.processor) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.processing++;

    // Execute asynchronously without blocking the queue loop
    (async () => {
      try {
        await this.processor!(item);
      } catch (err: any) {
        Logger.error(`[InMemoryQueue] Processing failed for message ${item.messageId}: ${err.message}`);
      } finally {
        this.processing--;
        this.processNext();
      }
    })();
  }
}

export const inMemoryQueue = new InMemoryTransactionQueue();

