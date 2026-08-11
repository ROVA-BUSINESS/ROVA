export type WhatsAppMessageType = 'text' | 'audio' | 'image' | 'document';
export type MessageType = 'text' | 'voice' | 'image' | 'document' | 'unsupported';


export interface ParsedMessage {
  type: MessageType;
  payload: TextPayload | MediaPayload;
}

export interface TextPayload {
  text: string;
}

export interface MediaPayload {
  mediaId: string;
  mimeType: string;
  caption?: string;
}

export interface TransactionJobData {
  from: string;         // WhatsApp phone number
  messageId: string;    // For idempotency
  type: MessageType;
  payload: TextPayload | MediaPayload;
}

export interface ExtractedTransaction {
  transaction_type: string;
  category: string;
  amount: number;
  currency: string;
  merchant: string;
  supplier: string;
  customer: string;
  payment_method: string;
  date: string;
  description: string;
  vat: number;
  inventory_items: InventoryItem[];
  confidence: number;
}

export interface InventoryItem {
  name: string;
  quantity: number;
  unit_price: number;
}
