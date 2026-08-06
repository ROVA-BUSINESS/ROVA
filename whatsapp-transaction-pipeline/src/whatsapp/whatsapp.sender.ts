import axios from 'axios';
import { env } from '../config/env';
import { formatCurrency } from '../utils/formatting';

/**
 * Handles all outbound communication back to WhatsApp users via Meta Graph API.
 */
export class WhatsAppSender {
  private readonly baseUrl = `https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  private readonly headers = {
    Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };

  async sendText(to: string, text: string): Promise<void> {
    try {
      await axios.post(
        this.baseUrl,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: text },
        },
        { headers: this.headers }
      );
      console.log(`📤 Message sent to ${to}`);
    } catch (err: any) {
      console.error(`Failed to send WhatsApp message to ${to}:`, err?.response?.data ?? err.message);
    }
  }

  /**
   * Builds the appropriate reply based on the transaction type according to PRD specs.
   */
  buildSuccessReply(transactionType: string, amount: number, currency: string = 'NGN'): string {
    const formatted = formatCurrency(amount, currency);
    const typeLower = transactionType.toLowerCase();

    if (typeLower.includes('income') || typeLower.includes('customer payment')) {
      return `Income of ${formatted} has been recorded successfully.`;
    }

    if (typeLower.includes('inventory')) {
      return `Inventory updated successfully.`;
    }

    if (typeLower.includes('expense') || typeLower.includes('supplier payment')) {
      return `Expense of ${formatted} has been recorded successfully.`;
    }

    return `Transaction of ${formatted} has been recorded successfully.`;
  }

}
