import { MessageType } from './index';

export type DocumentType = 'receipt' | 'invoice' | 'payment_evidence' | 'expense' | 'purchase' | 'other';
export type IntentType = 'record_expense' | 'record_sale' | 'create_invoice' | 'query_inventory' | 'query_sales' | 'query_expenses' | 'unknown';

export interface InventoryItemOutput {
  name: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  total: number;
}

export interface StructuredTransactionOutput {
  intent: IntentType;
  source: 'ocr' | 'voice' | 'text';
  document_type?: DocumentType;
  date?: string;
  supplier?: string;
  merchant?: string;
  customer?: string;
  account_number?: string;
  invoice_number?: string;
  total_amount: number;
  currency: string;
  items: InventoryItemOutput[];
  tax_amount?: number;
  confidence: number;
  requires_confirmation: boolean;
  raw_text?: string;
  summary_message?: string;
  clarification_needed?: string;
}

export interface OCRExtractionResult {
  text: string;
  documentType?: DocumentType;
  confidence: number;
  metadata?: {
    supplier?: string;
    totalAmount?: number;
    date?: string;
    invoiceNumber?: string;
    accountNumber?: string;
    items?: InventoryItemOutput[];
  };
}

export interface SpeechTranscriptionResult {
  text: string;
  confidence: number;
  language?: string;
  durationSeconds?: number;
}

export interface UnifiedInputPayload {
  userId: string;
  source: 'whatsapp' | 'web';
  messageType: MessageType;
  rawInputText?: string;
  ocrResult?: OCRExtractionResult;
  speechResult?: SpeechTranscriptionResult;
  mediaUrl?: string;
  caption?: string;
}

export interface ROVAAIResponse {
  reply: string;
  structuredOutput?: StructuredTransactionOutput;
  requiresConfirmation: boolean;
  confirmationSummary?: string;
  pendingToolCall?: any;
  toolExecuted?: boolean;
}

// ── PROVIDER INTERFACES ──────────────────────────────────────────────────

export interface OCRProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  extractText(imagePath: string, mimeType: string): Promise<OCRExtractionResult>;
}

export interface SpeechToTextProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  transcribe(audioPath: string, mimeType: string): Promise<SpeechTranscriptionResult>;
}

export interface AIProvider {
  name: string;
  processMessage(userId: string, input: UnifiedInputPayload): Promise<ROVAAIResponse>;
}
