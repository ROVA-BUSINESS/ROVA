import { AIProvider, UnifiedInputPayload, ROVAAIResponse, StructuredTransactionOutput } from '../../types/providers';
import { CentralROVAAIProvider } from './central_rova_ai.provider';
import { DeepSeekAIProvider } from './deepseek_ai.provider';
import { Logger } from '../../utils/logger';

export class ROVAAIService {
  private primaryProvider: AIProvider;
  private fallbackProvider: AIProvider;

  constructor() {
    this.primaryProvider = new CentralROVAAIProvider();
    this.fallbackProvider = new DeepSeekAIProvider();
  }

  /**
   * Main entry point for the Unified ROVA AI Pipeline.
   * Handles text, OCR extracted text, and Speech-to-Text transcriptions identically.
   */
  async process(userId: string, payload: UnifiedInputPayload): Promise<ROVAAIResponse> {
    Logger.info(`🧠 ROVAAIService processing input type: ${payload.messageType} for User: ${userId}`);

    try {
      // Step 1: Call Central ROVA AI Agent
      return await this.primaryProvider.processMessage(userId, payload);
    } catch (primaryErr: any) {
      Logger.warn(`Primary AI Provider failed: ${primaryErr.message}. Attempting fallback provider...`);
      try {
        return await this.fallbackProvider.processMessage(userId, payload);
      } catch (fallbackErr: any) {
        Logger.error(`All AI Providers failed: ${fallbackErr.message}`);
        return {
          reply: "⚠️ ROVA AI is temporarily unable to process your request. Please try again shortly or log in at https://www.rovabusiness.com",
          requiresConfirmation: false,
        };
      }
    }
  }

  /**
   * Formats a clear text confirmation bubble for voice or OCR inputs showing
   * transcribed text to the user so they can review, edit, or confirm.
   */
  formatTranscriptionVerificationMessage(type: 'voice' | 'ocr', extractedText: string, metadata?: any): string {
    const header = type === 'voice' 
      ? '🎙️ Voice Note Transcribed' 
      : '📷 Document/Receipt OCR Extracted';

    let summaryText = `${header}:\n"${extractedText}"\n\n`;

    if (metadata && metadata.totalAmount) {
      summaryText += `• Extracted Amount: ₦${Number(metadata.totalAmount).toLocaleString()}\n`;
    }
    if (metadata && metadata.supplier) {
      summaryText += `• Supplier/Merchant: ${metadata.supplier}\n`;
    }
    if (metadata && metadata.date) {
      summaryText += `• Date: ${metadata.date}\n`;
    }

    summaryText += `\nWould you like me to process this? If anything is incorrect, reply with your correction or edit.`;

    return summaryText;
  }
}
