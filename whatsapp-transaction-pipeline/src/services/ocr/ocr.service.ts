import { OCRProvider, OCRExtractionResult } from '../../types/providers';
import { PaddleOCRProvider } from './paddleocr.provider';
import { OpenAIVisionOCRProvider } from './openai_vision.provider';
import { env } from '../../config/env';
import { Logger } from '../../utils/logger';

export class OCRService {
  private providers: OCRProvider[] = [];

  constructor() {
    // Register available providers in priority order
    this.providers = [
      new PaddleOCRProvider(),
      new OpenAIVisionOCRProvider(),
    ];
  }

  /**
   * Extracts text and structured metadata from an image or document file using the best active provider.
   */
  async processImage(filePath: string, mimeType: string): Promise<OCRExtractionResult> {
    const configuredProvider = env.OCR_PROVIDER;

    // Try configured provider first if explicitly set to non-auto
    if (configuredProvider === 'paddle') {
      const paddle = this.providers.find((p) => p instanceof PaddleOCRProvider);
      if (paddle && (await paddle.isAvailable())) {
        try {
          return await paddle.extractText(filePath, mimeType);
        } catch (err: any) {
          Logger.warn(`Primary OCR Provider (PaddleOCR) failed: ${err.message}. Attempting fallbacks...`);
        }
      }
    } else if (configuredProvider === 'openai') {
      const openai = this.providers.find((p) => p instanceof OpenAIVisionOCRProvider);
      if (openai && (await openai.isAvailable())) {
        try {
          return await openai.extractText(filePath, mimeType);
        } catch (err: any) {
          Logger.warn(`Primary OCR Provider (OpenAI Vision) failed: ${err.message}. Attempting fallbacks...`);
        }
      }
    }

    // Auto / Fallback strategy: try each available provider
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        try {
          Logger.info(`Executing OCR via ${provider.name}...`);
          const result = await provider.extractText(filePath, mimeType);
          if (result && result.text.trim()) {
            return result;
          }
        } catch (err: any) {
          Logger.warn(`Provider ${provider.name} failed during execution: ${err.message}`);
        }
      }
    }

    // Fallback: heuristic error message for blurry or unreadable files
    throw new Error('UNREADABLE_IMAGE: The image or document could not be read clearly by any available OCR engine. Please ensure good lighting and clear text focus.');
  }
}
