import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { redis } from '../config/redis';
import { TransactionJobData, MediaPayload, TextPayload } from '../types';
import { AuthService } from '../auth/auth.service';
import { MediaDownloader } from '../media/media.downloader';
import { AudioConverter } from '../media/audio.converter';
import { SpeechTranscriber } from '../speech/speech.transcriber';
import { OCRProcessor } from '../ocr/ocr.processor';
import { WhatsAppSender } from '../whatsapp/whatsapp.sender';
import { IdempotencyService } from '../utils/idempotency';
import { Logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * The core BullMQ Worker that orchestrates the entire transaction processing pipeline.
 *
 * UNIFIED ROVA AI ARCHITECTURE:
 * This worker handles multi-modal input processing (text, voice, image) locally for
 * efficiency, then delegates ALL business logic and AI intelligence to the central
 * ROVA AI Agent (Supabase `ai-chat` edge function). This ensures one single AI brain,
 * one database, and one set of business rules for ALL interfaces (Website + WhatsApp).
 */
export class TransactionWorker {
  private authService = new AuthService();
  private mediaDownloader = new MediaDownloader();
  private audioConverter = new AudioConverter();
  private speechTranscriber = new SpeechTranscriber();
  private ocrProcessor = new OCRProcessor();
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

    Logger.info('Transaction Worker active — routing all intelligence to ROVA Central AI Agent');
  }

  private async processJob(data: TransactionJobData): Promise<void> {
    const startTime = Date.now();
    const { from, messageId, type, payload } = data;

    // ── Idempotency Check ─────────────────────────────────────────────────
    if (await this.idempotencyService.isProcessed(messageId)) {
      Logger.info(`Skipping already processed message: ${messageId}`);
      return;
    }

    // ── Step 1: Authenticate sender against ROVA shared user database ─────
    const user = await this.authService.getUserByPhone(from);
    if (!user) {
      await this.whatsappSender.sendText(
        from,
        '⚠️ Your WhatsApp number is not linked to a ROVA account.\n\nPlease log in to https://www.rovabusiness.com → Settings → Business Profile and add your phone number to enable WhatsApp accounting.'
      );
      return;
    }

    let extractedText = '';
    let downloadedFilePath: string | null = null;
    let convertedFilePath: string | null = null;

    try {
      // ── Step 2: Multi-modal input processing ──────────────────────────
      // This pipeline handles the raw media extraction locally:
      // text messages are used as-is, voice notes are transcribed via Whisper,
      // and images/documents are processed through OCR. The resulting plain text
      // is then passed to the central ROVA AI Agent for understanding & action.

      if (type === 'text') {
        extractedText = (payload as TextPayload).text;

      } else if (type === 'voice') {
        const mediaPayload = payload as MediaPayload;
        downloadedFilePath = await this.mediaDownloader.download(mediaPayload.mediaId, mediaPayload.mimeType);
        convertedFilePath = await this.audioConverter.convertToWav(downloadedFilePath);
        extractedText = await this.speechTranscriber.transcribe(convertedFilePath);

        if (!extractedText.trim()) {
          await this.whatsappSender.sendText(
            from,
            "🎙️ I couldn't clearly understand your voice note. Please record it again in a quiet environment, or send a text message instead."
          );
          return;
        }

      } else if (type === 'image' || type === 'document') {
        const mediaPayload = payload as MediaPayload;
        downloadedFilePath = await this.mediaDownloader.download(mediaPayload.mediaId, mediaPayload.mimeType);

        try {
          extractedText = await this.ocrProcessor.extractText(downloadedFilePath);
          // Prepend caption if provided — gives AI context alongside the receipt text
          if (mediaPayload.caption) {
            extractedText = `${mediaPayload.caption}\n\n${extractedText}`;
          }
        } catch {
          await this.whatsappSender.sendText(
            from,
            "📷 The image isn't clear enough to read. Please retake it in better lighting or send the details as a text message."
          );
          return;
        }

      } else {
        await this.whatsappSender.sendText(
          from,
          "I can process text messages, voice notes 🎙️, and receipt images 📷. Please send one of these."
        );
        return;
      }

      if (!extractedText.trim()) {
        await this.whatsappSender.sendText(
          from,
          '⚠️ I could not extract any text from your message. Please try again with a clearer message, image, or voice note.'
        );
        return;
      }

      // ── Step 3: Route to Central ROVA AI Agent Brain ──────────────────
      // This is the key integration point: instead of running separate AI logic
      // here, we call the SAME `ai-chat` Supabase edge function that the website
      // uses. This guarantees ONE AI brain, ONE set of business rules, ONE database.
      Logger.info(`[WhatsApp Pipeline → Central ROVA AI Agent] User: ${user.id} | Input: "${extractedText.slice(0, 80)}..."`);

      const agentReply = await this.callCentralROVAAgent(user.id, extractedText);

      // Mark message as processed for idempotency
      await this.idempotencyService.markProcessed(messageId);

      // ── Step 4: Send ROVA AI's reply back via WhatsApp ────────────────
      const processingMs = Date.now() - startTime;
      const reply = `${agentReply}\n\n🌐 _View full dashboard_: https://www.rovabusiness.com\n_(Processed in ${(processingMs / 1000).toFixed(1)}s)_`;

      await this.whatsappSender.sendText(from, reply);
      Logger.info(`[WhatsApp Pipeline] Successfully processed ${type} message for user ${user.id} in ${processingMs}ms`);

    } finally {
      // ── Cleanup: Always delete temp media files ───────────────────────
      if (downloadedFilePath) this.mediaDownloader.deleteFile(downloadedFilePath);
      if (convertedFilePath) this.mediaDownloader.deleteFile(convertedFilePath);
    }
  }

  /**
   * Calls the central unified ROVA AI Agent (Supabase `ai-chat` edge function).
   * This is the same function the website AI assistant uses — one brain for all interfaces.
   */
  private async callCentralROVAAgent(userId: string, userMessage: string): Promise<string> {
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const response = await axios.post(
        `${supabaseUrl}/functions/v1/ai-chat`,
        {
          messages: [{ role: 'user', content: userMessage }],
          context: { userId },
        },
        {
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const reply = response.data?.reply;
      if (!reply) {
        throw new Error('Central ROVA AI Agent returned no reply');
      }

      return reply;
    } catch (err: any) {
      Logger.error(`Central ROVA AI Agent call failed: ${err.message}`);
      return `⚠️ ROVA is having trouble connecting right now. Please try again in a moment, or visit https://www.rovabusiness.com for full access.`;
    }
  }
}
