import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { TransactionJobData, MediaPayload, TextPayload } from '../types';
import { AuthService } from '../auth/auth.service';
import { MediaDownloader } from '../media/media.downloader';
import { AudioConverter } from '../media/audio.converter';
import { SpeechTranscriber } from '../speech/speech.transcriber';
import { OCRProcessor } from '../ocr/ocr.processor';
import { DeepSeekService } from '../deepseek/deepseek.service';
import { TransactionService } from '../transactions/transaction.service';
import { WhatsAppSender } from '../whatsapp/whatsapp.sender';
import { IdempotencyService } from '../utils/idempotency';
import { Logger } from '../utils/logger';

/**
 * The core BullMQ Worker that orchestrates the entire transaction processing pipeline.
 * Clean modular architecture enforcing SOLID principles.
 */
export class TransactionWorker {
  private authService = new AuthService();
  private mediaDownloader = new MediaDownloader();
  private audioConverter = new AudioConverter();
  private speechTranscriber = new SpeechTranscriber();
  private ocrProcessor = new OCRProcessor();
  private deepSeekService = new DeepSeekService();
  private transactionService = new TransactionService();
  private whatsappSender = new WhatsAppSender();
  private idempotencyService = new IdempotencyService();

  start(): void {
    const worker = new Worker<TransactionJobData>(
      'whatsapp-transactions',
      async (job: Job<TransactionJobData>) => {
        await this.processJob(job.data);
      },
      {
        connection: redis,
        concurrency: 5,
      }
    );

    worker.on('completed', (job) => {
      Logger.info(`Job ${job.id} completed for ${job.data.from}`);
    });

    worker.on('failed', (job, err) => {
      Logger.error(`Job ${job?.id} failed for ${job?.data?.from}: ${err.message}`);
    });

    Logger.info('Transaction Worker active and ready for jobs');
  }

  private async processJob(data: TransactionJobData): Promise<void> {
    const startTime = Date.now();
    const { from, messageId, type, payload } = data;

    // ── Idempotency Check ────────────────────────────────────────────────
    if (await this.idempotencyService.isProcessed(messageId)) {
      Logger.info(`Skipping already processed message: ${messageId}`);
      return;
    }

    // ── Step 1: Authenticate the sender ──────────────────────────────────
    const user = await this.authService.getUserByPhone(from);
    if (!user) {
      await this.whatsappSender.sendText(
        from,
        'Your number is not registered with ROVA. Please sign up at rova.app'
      );
      return;
    }

    let rawText = '';
    let downloadedFilePath: string | null = null;
    let convertedFilePath: string | null = null;

    try {
      // ── Step 2: Extract text based on message type ────────────────────
      if (type === 'text') {
        rawText = (payload as TextPayload).text;

      } else if (type === 'voice') {
        const mediaPayload = payload as MediaPayload;
        downloadedFilePath = await this.mediaDownloader.download(mediaPayload.mediaId, mediaPayload.mimeType);
        convertedFilePath = await this.audioConverter.convertToWav(downloadedFilePath);
        rawText = await this.speechTranscriber.transcribe(convertedFilePath);

        if (!rawText.trim()) {
          await this.whatsappSender.sendText(from, "I couldn't clearly understand the voice note. Please record it again.");
          return;
        }

      } else if (type === 'image' || type === 'document') {
        const mediaPayload = payload as MediaPayload;
        downloadedFilePath = await this.mediaDownloader.download(mediaPayload.mediaId, mediaPayload.mimeType);

        try {
          rawText = await this.ocrProcessor.extractText(downloadedFilePath);
          if (mediaPayload.caption) {
            rawText = `${mediaPayload.caption}\n\n${rawText}`;
          }
        } catch {
          await this.whatsappSender.sendText(from, "The image isn't clear enough. Please retake it in better lighting.");
          return;
        }

      } else {
        await this.whatsappSender.sendText(from, "Sorry, I can only process text messages, voice notes, and images.");
        return;
      }

      // ── Step 3: Send extracted text to DeepSeek for AI classification ─
      const extracted = await this.deepSeekService.extractTransaction(rawText);

      // ── Step 4: Confidence check (< 0.80) ─────────────────────────────
      if (extracted.confidence < 0.80) {
        await this.whatsappSender.sendText(
          from,
          "I couldn't confidently understand this transaction. Please confirm the details."
        );
        return;
      }

      // ── Step 5: Save to database & update inventory ───────────────────
      const processingTime = Date.now() - startTime;
      await this.transactionService.processAndSaveTransaction(
        user.id,
        extracted,
        rawText,
        type,
        processingTime
      );

      // Mark message as processed for idempotency
      await this.idempotencyService.markProcessed(messageId);

      // ── Step 6: Send success confirmation to user ─────────────────────
      const reply = this.whatsappSender.buildSuccessReply(
        extracted.transaction_type,
        extracted.amount,
        extracted.currency
      );
      await this.whatsappSender.sendText(from, reply);

    } finally {
      // ── Cleanup: Always delete temp files ─────────────────────────────
      if (downloadedFilePath) this.mediaDownloader.deleteFile(downloadedFilePath);
      if (convertedFilePath) this.mediaDownloader.deleteFile(convertedFilePath);
    }
  }
}

