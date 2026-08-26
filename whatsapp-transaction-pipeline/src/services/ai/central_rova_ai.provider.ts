import axios from 'axios';
import { AIProvider, UnifiedInputPayload, ROVAAIResponse } from '../../types/providers';
import { env } from '../../config/env';
import { Logger } from '../../utils/logger';

export class CentralROVAAIProvider implements AIProvider {
  name = 'Central ROVA AI Agent (Supabase)';

  async processMessage(userId: string, input: UnifiedInputPayload): Promise<ROVAAIResponse> {
    const supabaseUrl = env.SUPABASE_URL;
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

    let contentToSend = input.rawInputText || '';

    // Annotate input source for the Central AI Agent so it formats natural verification replies
    if (input.messageType === 'voice') {
      contentToSend = `[Voice Note Transcribed]: "${contentToSend}"`;
    } else if (input.messageType === 'image' || input.messageType === 'document') {
      contentToSend = `[Document/Receipt OCR Extracted]: "${contentToSend}"`;
    }

    // If caption accompanies image/document, include it
    if (input.caption) {
      contentToSend = `Caption: ${input.caption}\n\n${contentToSend}`;
    }

    Logger.info(`🤖 Calling Central ROVA AI Agent for User: ${userId} | Input length: ${contentToSend.length}`);

    try {
      const response = await axios.post(
        `${supabaseUrl}/functions/v1/ai-chat`,
        {
          messages: [{ role: 'user', content: contentToSend }],
          context: { userId, source: 'whatsapp' },
          source: 'whatsapp',
        },
        {
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 35000,
        }
      );

      const reply = response.data?.reply;
      if (!reply) {
        throw new Error('Central ROVA AI Agent returned an empty reply');
      }

      return {
        reply,
        requiresConfirmation: Boolean(response.data?.requiresConfirmation),
        confirmationSummary: response.data?.confirmationSummary,
        pendingToolCall: response.data?.pendingToolCall,
        toolExecuted: Boolean(response.data?.toolExecuted),
      };
    } catch (err: any) {
      Logger.error(`Central ROVA AI Agent call failed: ${err.message}`);
      throw err;
    }
  }
}
