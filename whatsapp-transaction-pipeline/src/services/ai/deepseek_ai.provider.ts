import axios from 'axios';
import { AIProvider, UnifiedInputPayload, ROVAAIResponse } from '../../types/providers';
import { env } from '../../config/env';
import { Logger } from '../../utils/logger';

const MASTER_SYSTEM_PROMPT = `You are ROVA AI, an intelligent, helpful and friendly AI assistant. You are a general-purpose conversational assistant capable of answering questions, explaining concepts, helping with problems, brainstorming ideas, discussing different subjects and engaging in natural conversations.
Understand the user's message based on its meaning and context, not just keywords.
Communicate naturally, intelligently and clearly. Ask follow-up questions when necessary. Maintain conversation context and adapt your explanations to the user's needs.
You are not restricted to accounting, finance or business. You can discuss general knowledge, technology, education, science, entertainment, everyday life and other appropriate topics.
Never force a conversation into an accounting workflow. Never display generic fallback messages simply because a user's message does not match predefined commands.
Be honest about uncertainty. Never invent facts or claim to have performed actions you have not performed.
Your primary objective is to provide an intelligent, natural and useful conversational experience.`;

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

    try {
      const response = await axios.post(
        endpoint,
        {
          model,
          messages: [
            { role: 'system', content: MASTER_SYSTEM_PROMPT },
            { role: 'user', content: input.rawInputText || '' },
          ],
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const reply = response.data?.choices?.[0]?.message?.content || 'Hello! How can I help you today?';

      return {
        reply,
        toolExecuted: false,
      };
    } catch (err: any) {
      Logger.error(`${this.name} failed: ${err.message}`);
      throw err;
    }
  }
}
