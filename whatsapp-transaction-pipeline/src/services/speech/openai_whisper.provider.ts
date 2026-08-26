import fs from 'fs';
import axios from 'axios';
import { SpeechToTextProvider, SpeechTranscriptionResult } from '../../types/providers';
import { env } from '../../config/env';
import { Logger } from '../../utils/logger';

export class OpenAIWhisperSpeechProvider implements SpeechToTextProvider {
  name = 'OpenAI Whisper API';

  private getApiKey(): string | undefined {
    return env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    const key = this.getApiKey();
    return Boolean(key && key.length > 5);
  }

  async transcribe(audioPath: string, mimeType: string): Promise<SpeechTranscriptionResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured for OpenAI Whisper speech provider');
    }

    Logger.info(`🎙️ Running ${this.name} on audio: ${audioPath}`);

    const fileBuffer = fs.readFileSync(audioPath);
    
    // Construct boundary & body manually or with native FormData if available
    const boundary = `----NodeFormBoundary${Math.random().toString(16).substring(2)}`;
    
    const prompt = 'Nigerian English financial transaction speech. Context: Naira, Kobo, cartons, packs, supplier, customer, expense, sale, POS, NEPA, invoice, payment, transfer.';

    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`;
    
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="language"\r\n\r\nen\r\n`;
    
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="prompt"\r\n\r\n${prompt}\r\n`;

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n`;
    body += `Content-Type: ${mimeType || 'audio/wav'}\r\n\r\n`;

    const bodyEnd = `\r\n--${boundary}--\r\n`;

    const payloadBuffer = Buffer.concat([
      Buffer.from(body, 'utf8'),
      fileBuffer,
      Buffer.from(bodyEnd, 'utf8'),
    ]);

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        payloadBuffer,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          timeout: 45000,
        }
      );

      const text = response.data?.text || '';
      if (!text.trim()) {
        throw new Error('OpenAI Whisper API returned empty text');
      }

      return {
        text: text.trim(),
        confidence: 0.95,
        language: 'en',
      };
    } catch (err: any) {
      Logger.error(`${this.name} failed: ${err.message}`);
      throw err;
    }
  }
}
