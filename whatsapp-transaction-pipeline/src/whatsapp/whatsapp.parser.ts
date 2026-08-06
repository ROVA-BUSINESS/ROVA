import { ParsedMessage, MediaPayload, TextPayload } from '../types';

/**
 * Parses the raw WhatsApp Cloud API message object into our internal format.
 * Note: WhatsApp sends voice notes as type "audio" — we remap to "voice" internally.
 */
export class WhatsAppParser {
  parse(message: any): ParsedMessage | null {
    const waType = message.type as string;

    switch (waType) {
      case 'text':
        return {
          type: 'text',
          payload: { text: message.text?.body ?? '' } as TextPayload,
        };

      case 'audio': // WhatsApp sends voice notes as "audio"
        return {
          type: 'voice',  // Remap to our internal "voice" type
          payload: {
            mediaId: message.audio?.id,
            mimeType: message.audio?.mime_type,
          } as MediaPayload,
        };

      case 'image':
        return {
          type: 'image',
          payload: {
            mediaId: message.image?.id,
            mimeType: message.image?.mime_type,
            caption: message.image?.caption,
          } as MediaPayload,
        };

      case 'document':
        return {
          type: 'document',
          payload: {
            mediaId: message.document?.id,
            mimeType: message.document?.mime_type,
            caption: message.document?.caption,
          } as MediaPayload,
        };

      default:
        return null;
    }
  }
}
