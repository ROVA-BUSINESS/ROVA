import fs from 'fs';
import { OCRProvider, OCRExtractionResult } from '../../types/providers';
import { env } from '../../config/env';
import { Logger } from '../../utils/logger';

export class OCRSpaceOCRProvider implements OCRProvider {
  name = 'OCR.space (Free API)';

  private getApiKey(): string {
    return env.OCR_SPACE_API_KEY || process.env.OCR_SPACE_API_KEY || 'helloworld';
  }

  async isAvailable(): Promise<boolean> {
    // OCR.space is available if internet access is present; defaults to 'helloworld' free tier key
    return true;
  }

  async extractText(imagePath: string, mimeType: string): Promise<OCRExtractionResult> {
    const apiKey = this.getApiKey();
    Logger.info(`🔍 Running ${this.name} on image: ${imagePath}`);

    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = `data:${mimeType || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`;

      const formData = new URLSearchParams();
      formData.append('apikey', apiKey);
      formData.append('base64Image', base64Image);
      formData.append('language', 'eng');
      formData.append('isTable', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2'); // Engine 2 is optimized for receipts & documents

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new Error(`OCR.space API HTTP error ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();

      if (data.IsErroredOnProcessing) {
        const errorMsg = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(', ') : (data.ErrorMessage || 'OCR.space processing failed');
        throw new Error(`OCR.space Error: ${errorMsg}`);
      }

      const parsedResults = data.ParsedResults || [];
      const extractedText = parsedResults.map((r: any) => r.ParsedText || '').join('\n').trim();

      if (!extractedText) {
        throw new Error('OCR.space returned empty text from image');
      }

      return {
        text: extractedText,
        confidence: 0.88,
      };
    } catch (err: any) {
      Logger.error(`${this.name} failed: ${err.message}`);
      throw err;
    }
  }
}
