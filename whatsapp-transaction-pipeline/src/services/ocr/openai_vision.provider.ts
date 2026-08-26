import fs from 'fs';
import axios from 'axios';
import { OCRProvider, OCRExtractionResult } from '../../types/providers';
import { env } from '../../config/env';
import { Logger } from '../../utils/logger';

export class OpenAIVisionOCRProvider implements OCRProvider {
  name = 'OpenAI Vision OCR';

  async isAvailable(): Promise<boolean> {
    return Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 5);
  }

  async extractText(imagePath: string, mimeType: string): Promise<OCRExtractionResult> {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured for OpenAI Vision OCR provider');
    }

    Logger.info(`👁️ Running ${this.name} on image: ${imagePath}`);

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const validMimeType = mimeType || 'image/jpeg';

    const prompt = `You are a high-accuracy financial OCR assistant for Nigerian businesses.
Analyze this document/receipt image and extract ALL readable text and structured metadata.

Extract precisely:
- Full raw text transcript
- Document Type (receipt, invoice, payment_evidence, expense, purchase, other)
- Supplier/Business/Merchant Name
- Date (YYYY-MM-DD or readable format)
- Invoice/Receipt Number
- Account Number / Payment Reference (if visible)
- Line Items (Item name, quantity, unit price, total)
- Tax / VAT amount
- Total Amount (in NGN or specified currency)
- Overall OCR Confidence (0.0 to 1.0)

Return strictly valid JSON with this structure:
{
  "text": "full extracted raw text...",
  "documentType": "receipt",
  "confidence": 0.95,
  "metadata": {
    "supplier": "ABC Stores",
    "totalAmount": 20000,
    "date": "2026-08-24",
    "invoiceNumber": "INV-1234",
    "accountNumber": "",
    "items": [
      { "name": "Printer Paper", "quantity": 5, "unit_price": 4000, "total": 20000 }
    ]
  }
}`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${validMimeType};base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI Vision returned an empty response');
      }

      const parsed = JSON.parse(content);

      return {
        text: parsed.text || '',
        documentType: parsed.documentType || 'receipt',
        confidence: parsed.confidence || 0.9,
        metadata: parsed.metadata || {},
      };
    } catch (err: any) {
      Logger.error(`${this.name} failed: ${err.message}`);
      throw err;
    }
  }
}
