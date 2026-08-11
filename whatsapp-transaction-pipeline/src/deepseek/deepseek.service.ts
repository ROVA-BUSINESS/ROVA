import axios from 'axios';
import { z } from 'zod';
import { env } from '../config/env';
import { ExtractedTransaction } from '../types';

// Zod schema to strictly validate what DeepSeek returns
export const TransactionSchema = z.object({
  transaction_type: z.enum([
    'Income',
    'Expense',
    'Inventory Purchase',
    'Fixed Asset Purchase',
    'Customer Payment',
    'Supplier Payment',
    'Loan',
    'Owner Capital',
    'Owner Withdrawal',
    'Bank Transfer',
  ]),
  category: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('NGN'),
  merchant: z.string().default(''),
  supplier: z.string().default(''),
  customer: z.string().default(''),
  payment_method: z.string().default(''),
  date: z.string().default(''),
  description: z.string().default(''),
  vat: z.number().default(0),
  inventory_items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unit_price: z.number(),
    })
  ).default([]),
  confidence: z.number().min(0).max(1),
});

const SYSTEM_PROMPT = `You are an expert accounting assistant for Nigerian SMEs using ROVA ERP.

Your ONLY job is to analyze extracted text (from OCR or speech-to-text) and return structured accounting data as JSON.

IMPORTANT RULES:
1. Return ONLY valid JSON. No explanation, no markdown, no code blocks.
2. You do NOT perform OCR or speech recognition. You only analyze provided text.
3. Always include a "confidence" score between 0 and 1.
4. For Nigerian currency, use "NGN". 
5. Classify the transaction_type from ONLY these options:
   - Income
   - Expense
   - Inventory Purchase
   - Fixed Asset Purchase
   - Customer Payment
   - Supplier Payment
   - Loan
   - Owner Capital
   - Owner Withdrawal
   - Bank Transfer

Category examples:
- Fuel → Transportation
- Internet subscription → Utilities
- Salary → Payroll
- Rice, Beans, Garri → Inventory
- Laptop, Generator → Equipment
- POS charges → Bank Charges
- NEPA, electricity → Utilities
- Rent → Rent

If inventory_items are present, list each item with name, quantity, and unit_price.
If you cannot confidently determine the transaction, set confidence below 0.80.

Return ONLY this JSON format:
{
  "transaction_type": "",
  "category": "",
  "amount": 0,
  "currency": "NGN",
  "merchant": "",
  "supplier": "",
  "customer": "",
  "payment_method": "",
  "date": "",
  "description": "",
  "vat": 0,
  "inventory_items": [],
  "confidence": 0.0
}`;

/**
 * Sends extracted text to DeepSeek API for accounting entity extraction.
 * DeepSeek's job is ONLY to analyze text — never to do OCR or transcription.
 */
export class DeepSeekService {
  private readonly apiUrl = 'https://api.deepseek.com/chat/completions';

  async extractTransaction(rawText: string): Promise<ExtractedTransaction> {
    const response = await axios.post(
      this.apiUrl,
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Extract the accounting transaction from this text:\n\n${rawText}` },
        ],
        temperature: 0.1, // Low temperature for deterministic, structured output
        max_tokens: 1024,
      },
      {
        headers: {
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('DeepSeek returned an empty response');
    }

    // Strip potential markdown code fences DeepSeek sometimes adds
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(`DeepSeek returned invalid JSON: ${cleaned.substring(0, 200)}`);
    }

    // Validate against our Zod schema
    const result = TransactionSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`DeepSeek response failed validation: ${result.error.message}`);
    }

    return result.data as ExtractedTransaction;
  }
}
