import axios from 'axios';
import { AIProvider, UnifiedInputPayload, ROVAAIResponse, StructuredTransactionOutput } from '../../types/providers';
import { env } from '../../config/env';
import { Logger } from '../../utils/logger';

export class DeepSeekAIProvider implements AIProvider {
  name = 'DeepSeek AI Provider';

  async processMessage(_userId: string, input: UnifiedInputPayload): Promise<ROVAAIResponse> {
    const apiKey = env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Neither DEEPSEEK_API_KEY nor OPENAI_API_KEY is configured');
    }

    const endpoint = env.DEEPSEEK_API_KEY
      ? 'https://api.deepseek.com/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const model = env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-4o-mini';

    const systemPrompt = `You are ROVA AI, an expert financial ERP reasoning system for Nigerian SMEs.
Your job is to analyze input text (from typing, OCR, or speech-to-text) and convert it into structured accounting JSON.

CRITICAL INSTRUCTIONS:
1. Never invent missing financial data. If total_amount or key items are ambiguous or missing, set confidence < 0.80 and specify clarification_needed.
2. Produce a human natural response showing what ROVA understood before making financial changes.
3. For Nigerian currency, always use NGN (₦).
4. Return ONLY valid JSON matching this schema:

{
  "intent": "record_expense" | "record_sale" | "create_invoice" | "query_inventory" | "query_sales" | "query_expenses" | "unknown",
  "source": "${input.messageType === 'voice' ? 'voice' : input.messageType === 'image' || input.messageType === 'document' ? 'ocr' : 'text'}",
  "document_type": "receipt" | "invoice" | "payment_evidence" | "expense" | "purchase" | "other",
  "date": "YYYY-MM-DD",
  "supplier": "Business or seller name",
  "merchant": "Merchant name",
  "customer": "Customer name",
  "total_amount": 0,
  "currency": "NGN",
  "items": [
    { "name": "Item name", "quantity": 1, "unit": "pack/carton/unit", "unit_price": 0, "total": 0 }
  ],
  "confidence": 0.95,
  "requires_confirmation": true,
  "summary_message": "Readable natural explanation showing extracted details and asking confirmation",
  "clarification_needed": ""
}`;

    try {
      const response = await axios.post(
        endpoint,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input.rawInputText || '' },
          ],
          temperature: 0.1,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const raw = response.data?.choices?.[0]?.message?.content || '{}';
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed: StructuredTransactionOutput = JSON.parse(cleaned);

      const reply = parsed.summary_message || `Extracted transaction of ₦${parsed.total_amount?.toLocaleString()}. Would you like to record it?`;

      return {
        reply,
        structuredOutput: parsed,
        requiresConfirmation: parsed.requires_confirmation !== false,
        confirmationSummary: `Record ${parsed.intent} of ₦${parsed.total_amount}`,
      };
    } catch (err: any) {
      Logger.error(`${this.name} failed: ${err.message}`);
      throw err;
    }
  }
}
