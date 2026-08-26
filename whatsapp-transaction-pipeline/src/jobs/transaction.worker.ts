import { Worker, Job } from 'bullmq';
import { redis } from '../config/redis';
import { TransactionJobData, MediaPayload, TextPayload, UnifiedInputPayload } from '../types';
import { AuthService } from '../auth/auth.service';
import { MediaDownloader } from '../media/media.downloader';
import { OCRService } from '../services/ocr/ocr.service';
import { SpeechToTextService } from '../services/speech/speech.service';
import { ROVAAIService } from '../services/ai/rova_ai.service';
import { WhatsAppService } from '../services/whatsapp/whatsapp.service';
import { IdempotencyService } from '../utils/idempotency';
import { Logger } from '../utils/logger';

/**
 * Core BullMQ Worker orchestrating the multi-modal input processing pipeline.
 *
 * UNIFIED ROVA AI PIPELINE:
 * Text, Image/Document (OCR), and Voice (Speech-to-Text) inputs are processed into
 * clean text and structured data, then routed into the single central ROVA AI reasoning system.
 */
export class TransactionWorker {
  private authService = new AuthService();
  private mediaDownloader = new MediaDownloader();
  private ocrService = new OCRService();
  private speechToTextService = new SpeechToTextService();
  private rovaAIService = new ROVAAIService();
  private whatsappService = new WhatsAppService();
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

    Logger.info('Transaction Worker active — unified OCR, Speech, and Central AI pipeline online');
  }

  private async processJob(data: TransactionJobData): Promise<void> {
    const startTime = Date.now();
    const { from, messageId, type, payload } = data;

    // ── Idempotency Check ─────────────────────────────────────────────────
    if (await this.idempotencyService.isProcessed(messageId)) {
      Logger.info(`Skipping already processed message: ${messageId}`);
      return;
    }

    // ── Step 1: Authenticate sender against ROVA user database ─────────────
    const user = await this.authService.getUserByPhone(from);
    if (!user) {
      await this.whatsappService.sendTextMessage(
        from,
        '⚠️ Your WhatsApp number is not linked to a ROVA account.\n\nPlease log in to https://www.rovabusiness.com → Settings → Business Profile and add your phone number to enable WhatsApp accounting.'
      );
      return;
    }

    let extractedText = '';
    let downloadedFilePath: string | null = null;
    let convertedFilePath: string | null = null;

    try {
      // ── Step 2: Multi-Modal Input Processing ────────────────────────────
      if (type === 'text') {
        extractedText = (payload as TextPayload).text || '';

      } else if (type === 'voice') {
        const mediaPayload = payload as MediaPayload;
        try {
          downloadedFilePath = await this.mediaDownloader.download(mediaPayload.mediaId, mediaPayload.mimeType);
          const speechResult = await this.speechToTextService.processAudio(downloadedFilePath, mediaPayload.mimeType);
          
          extractedText = speechResult.transcript;
          convertedFilePath = speechResult.convertedPath;

          if (!extractedText.trim()) {
            await this.whatsappService.sendTextMessage(
              from,
              "🎙️ I couldn't clearly hear your voice note. Please record again in a quiet area, or type a text message."
            );
            return;
          }
        } catch (err: any) {
          Logger.error(`Voice processing error for ${from}: ${err.message}`);
          await this.whatsappService.sendTextMessage(
            from,
            "🎙️ I couldn't understand that voice note due to background noise or accent clarity. Could you repeat it clearly or type the text?"
          );
          return;
        }

      } else if (type === 'image' || type === 'document') {
        const mediaPayload = payload as MediaPayload;
        try {
          downloadedFilePath = await this.mediaDownloader.download(mediaPayload.mediaId, mediaPayload.mimeType);
          const ocrResult = await this.ocrService.processImage(downloadedFilePath, mediaPayload.mimeType);
          
          extractedText = ocrResult.text;
          if (mediaPayload.caption) {
            extractedText = `${mediaPayload.caption}\n\n${extractedText}`;
          }

          if (!extractedText.trim()) {
            await this.whatsappService.sendTextMessage(
              from,
              "📷 The image is blurry or contains no readable text. Please send a clearer photo or document."
            );
            return;
          }
        } catch (err: any) {
          Logger.error(`OCR processing error for ${from}: ${err.message}`);
          await this.whatsappService.sendTextMessage(
            from,
            "📷 The document/receipt image isn't clear enough to read. Please retake the photo in good lighting or type out the transaction details."
          );
          return;
        }

      } else {
        await this.whatsappService.sendTextMessage(
          from,
          "I can process text messages 💬, voice notes 🎙️, and receipt images/documents 📷. Please send one of these."
        );
        return;
      }

      if (!extractedText.trim()) {
        await this.whatsappService.sendTextMessage(
          from,
          '⚠️ I could not extract any readable text from your message. Please try again with a clearer message, photo, or voice note.'
        );
        return;
      }

      // ── Step 3: Route to Unified ROVA AI Reasoning Layer ───────────────
      Logger.info(`[Pipeline → Unified AI] User: ${user.id} | Source: ${type} | Text: "${extractedText.slice(0, 80)}..."`);

      const inputPayload: UnifiedInputPayload = {
        userId: user.id,
        source: 'whatsapp',
        messageType: type,
        rawInputText: extractedText,
        caption: (payload as MediaPayload).caption,
      };

      const aiResponse = await this.rovaAIService.process(user.id, inputPayload);

      // Mark message as processed for idempotency
      await this.idempotencyService.markProcessed(messageId);

      // ── Step 4: Send Response to User via WhatsApp ─────────────────────
      const processingMs = Date.now() - startTime;
      let replyMessage = aiResponse.reply;

      // Add dashboard quick-link footer
      replyMessage += `\n\n🌐 _Dashboard_: https://www.rovabusiness.com\n_(Processed in ${(processingMs / 1000).toFixed(1)}s)_`;

      await this.whatsappService.sendTextMessage(from, replyMessage);
      Logger.info(`[WhatsApp Pipeline] Successfully processed ${type} message for user ${user.id} in ${processingMs}ms`);

    } finally {
      // ── Cleanup: Security & Privacy Compliance ─────────────────────────
      // Automatically delete temporary downloaded and converted media files
      if (downloadedFilePath) {
        this.mediaDownloader.deleteFile(downloadedFilePath);
      }
      if (convertedFilePath && convertedFilePath !== downloadedFilePath) {
        this.mediaDownloader.deleteFile(convertedFilePath);
      }
    }
  }
}
