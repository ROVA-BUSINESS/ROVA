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
    let user = await this.authService.getUserByPhone(from);
    
    // Direct WhatsApp Sign-Up flow check if user is not yet registered
    let rawText = type === 'text' ? ((payload as TextPayload).text || '') : '';
    const registerMatch = rawText.match(/^(?:register|signup|sign up):\s*(.+)/i);

    if (!user) {
      if (registerMatch && registerMatch[1].trim()) {
        const businessName = registerMatch[1].trim();
        user = await this.authService.registerUserByWhatsApp(from, businessName);
        if (user) {
          await this.whatsappService.sendTextMessage(
            from,
            `🎉 Welcome to ROVA! Your business account "${businessName}" has been successfully created and linked to this WhatsApp number.\n\nYou can now send transaction text messages 💬, voice notes 🎙️, or paper receipt photos 📷 to record your business records automatically.\n\nView full dashboard: https://www.rovabusiness.com`
          );
          return;
        }
      }

      await this.whatsappService.sendTextMessage(
        from,
        '👋 Welcome to ROVA AI!\nYour WhatsApp number is not linked to a ROVA account.\n\nTo sign up directly on WhatsApp, reply with:\nRegister: [Your Business Name]\n(e.g., Register: Acme Enterprise)\n\nOr register on the web: https://www.rovabusiness.com/signup'
      );
      return;
    }

    let extractedText = '';
    let downloadedFilePath: string | null = null;
    let convertedFilePath: string | null = null;

    try {
      // ── Step 2: Multi-Modal Input Processing ────────────────────────────
      if (type === 'text') {
        extractedText = rawText;

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

      // Check if user is asking to perform tax actions via WhatsApp (Item 25 from docx)
      if (/\b(tax|vat|cit|file tax|taxes|tax return|tax action)\b/i.test(extractedText)) {
        await this.whatsappService.sendTextMessage(
          from,
          'Tax filing and management is available on our website. Please visit https://www.rovabusiness.com/app/tax to perform your tax actions securely.\n\nView full dashboard: https://www.rovabusiness.com'
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
      let replyMessage = aiResponse.reply || '';

      // Remove automatic monthly transaction record blocks if present
      replyMessage = replyMessage.replace(/🗒️ Transactions [^\n]+\n(?:• [^\n]+\n?)*/g, '').trim();

      // Remove any leftover asterisks
      replyMessage = replyMessage.replace(/\*/g, '');

      // Add clean dashboard link footer without globe symbol
      replyMessage += `\n\nView full dashboard: https://www.rovabusiness.com`;

      await this.whatsappService.sendTextMessage(from, replyMessage);
      Logger.info(`[WhatsApp Pipeline] Successfully processed ${type} message for user ${user.id}`);

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
