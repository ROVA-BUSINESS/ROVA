import { createWorker } from 'tesseract.js';
import { OCRProvider, OCRExtractionResult } from '../../types/providers';
import { Logger } from '../../utils/logger';

export class TesseractOCRProvider implements OCRProvider {
  name = 'Tesseract.js (Node.js Native)';

  async isAvailable(): Promise<boolean> {
    // Pure Node.js dependency — always available anywhere Node runs!
    return true;
  }

  async extractText(imagePath: string, _mimeType: string): Promise<OCRExtractionResult> {
    Logger.info(`🔤 Running ${this.name} on image: ${imagePath}`);

    try {
      const worker = await createWorker('eng');
      const { data } = await worker.recognize(imagePath);
      await worker.terminate();

      const text = data.text ? data.text.trim() : '';
      const confidence = data.confidence ? Math.min(1.0, data.confidence / 100) : 0.75;

      if (!text) {
        throw new Error('Tesseract returned empty text');
      }

      Logger.info(`✅ Tesseract extracted ${text.length} characters (confidence: ${confidence.toFixed(2)})`);

      return {
        text,
        confidence: Number(confidence.toFixed(2)),
      };
    } catch (err: any) {
      Logger.error(`${this.name} failed: ${err.message}`);
      throw err;
    }
  }
}
