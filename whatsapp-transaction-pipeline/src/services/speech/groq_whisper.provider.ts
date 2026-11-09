import fs from 'fs';
import axios from 'axios';
import { SpeechToTextProvider, SpeechTranscriptionResult } from '../../types/providers';
import { env } from '../../config/env';
import { Logger } from '../../utils/logger';

export class GroqWhisperSpeechProvider implements SpeechToTextProvider {
  name = 'Groq Whisper v3 Large';

  private getApiKey(): string | undefined {
    return env.GROQ_API_KEY || process.env.GROQ_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    const key = this.getApiKey();
    return Boolean(key && key.startsWith('gsk_'));
  }

  async transcribe(audioPath: string, mimeType: string): Promise<SpeechTranscriptionResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured for Groq Whisper speech provider');
    }

    Logger.info(`🎙️ Running Groq Whisper v3 on audio: ${audioPath}`);

    const fileBuffer = fs.readFileSync(audioPath);
    const boundary = `----NodeFormBoundary${Math.random().toString(16).substring(2)}`;
    const prompt = 'Nigerian financial transaction speech. Context: Naira, Kobo, cartons, packs, supplier, customer, expense, sale, POS, NEPA, invoice, payment, transfer.';

    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n`;

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="language"\r\n\r\nen\r\n`;

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="prompt"\r\n\r\n${prompt}\r\n`;

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="file"; filename="voice.wav"\r\n`;
    body += `Content-Type: ${mimeType || 'audio/wav'}\r\n\r\n`;

    const bodyEnd = `\r\n--${boundary}--\r\n`;

    const payloadBuffer = Buffer.concat([
      Buffer.from(body, 'utf8'),
      fileBuffer,
      Buffer.from(bodyEnd, 'utf8'),
    ]);

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        payloadBuffer,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          timeout: 30000,
        }
      );

      const text = response.data?.text || '';
      if (!text.trim()) {
        throw new Error('Groq Whisper returned empty text');
      }

      Logger.info(`✅ Groq Whisper transcription success: "${text.substring(0, 80)}..."`);
      return {
        text: text.trim(),
        confidence: 0.95,
        language: 'en',
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.error?.message || err.message;
      Logger.error(`Groq Whisper API transcription failed: ${errMsg}`);
      throw new Error(`Groq Whisper transcription failed: ${errMsg}`);
    }
  }
}

