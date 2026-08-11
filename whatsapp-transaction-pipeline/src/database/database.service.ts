import { supabase } from '../config/supabase';
import { ExtractedTransaction } from '../types';

export interface WhatsAppTransactionRecord {
  user_id: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  description: string;
  date: string;
  ai_category: string;
  ai_confidence: number;
  is_verified: boolean;
  // Extra metadata stored in notes as JSON
  notes: string;
  // Tags for searchability
  tags: string[];
}

/**
 * Handles all database operations for the WhatsApp transaction pipeline.
 * Mapped to the existing ROVA Supabase schema.
 */
export class DatabaseService {
  /**
   * Saves a validated AI-extracted transaction to the transactions table.
   * Stores raw source text and AI JSON in the `notes` field for audit purposes.
   */
  async saveTransaction(
    userId: string,
    extracted: ExtractedTransaction,
    rawSource: string,
    mediaType: 'text' | 'voice' | 'image' | 'document',
    processingTimeMs: number
  ): Promise<string> {
    // Map DeepSeek transaction_type to our DB schema's type enum
    const dbType = this.mapToDbType(extracted.transaction_type);

    // We store full audit metadata in the notes field as JSON
    const auditMetadata = JSON.stringify({
      whatsapp_source: true,
      media_type: mediaType,
      transaction_type_ai: extracted.transaction_type,
      merchant: extracted.merchant,
      supplier: extracted.supplier,
      customer: extracted.customer,
      payment_method: extracted.payment_method,
      vat: extracted.vat,
      inventory_items: extracted.inventory_items,
      currency: extracted.currency,
      raw_source_text: rawSource.substring(0, 500), // Truncate for storage
      processing_time_ms: processingTimeMs,
    });

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: extracted.amount,
        type: dbType,
        description: extracted.description || `WhatsApp ${extracted.transaction_type} via ${mediaType}`,
        date: extracted.date || new Date().toISOString().split('T')[0],
        ai_category: extracted.category,
        ai_confidence: extracted.confidence,
        is_verified: false, // Always starts unverified from WhatsApp
        notes: auditMetadata,
        tags: ['whatsapp', mediaType, extracted.category.toLowerCase().replace(/\s+/g, '-')],
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to save transaction: ${error.message}`);
    }

    console.log(`💾 Transaction saved: ${data.id}`);
    return data.id;
  }

  /**
   * Checks whether a WhatsApp message has already been processed.
   * Prevents duplicate transactions if Meta re-sends a webhook.
   */
  async isDuplicate(messageId: string): Promise<boolean> {
    const { data } = await supabase
      .from('transactions')
      .select('id')
      .like('notes', `%${messageId}%`)
      .limit(1);

    return (data?.length ?? 0) > 0;
  }

  /**
   * Maps DeepSeek transaction types to the 3-option DB enum.
   */
  private mapToDbType(transactionType: string): 'income' | 'expense' | 'transfer' {
    const incomeTypes = ['Income', 'Customer Payment', 'Loan', 'Owner Capital'];
    const transferTypes = ['Bank Transfer'];

    if (incomeTypes.includes(transactionType)) return 'income';
    if (transferTypes.includes(transactionType)) return 'transfer';
    return 'expense'; // Default: Expense, Inventory Purchase, etc.
  }
}
