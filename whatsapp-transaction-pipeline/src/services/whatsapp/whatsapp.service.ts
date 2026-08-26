import { WhatsAppParser } from '../../whatsapp/whatsapp.parser';
import { WhatsAppSender } from '../../whatsapp/whatsapp.sender';
import { ParsedMessage } from '../../types';

export class WhatsAppService {
  private parser = new WhatsAppParser();
  private sender = new WhatsAppSender();

  parseIncomingMessage(rawMessage: any): ParsedMessage | null {
    return this.parser.parse(rawMessage);
  }

  async sendTextMessage(toPhone: string, text: string): Promise<void> {
    await this.sender.sendText(toPhone, text);
  }
}
