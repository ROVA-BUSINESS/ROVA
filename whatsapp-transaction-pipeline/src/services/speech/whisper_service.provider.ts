import fs from 'fs';
import { SpeechToTextProvider, SpeechTranscriptionResult } from '../../types/providers';
import { env } from '../../config/env';
import { Logger } from '../../utils/logger';

export class WhisperServiceSpeechProvider implements SpeechToTextProvider {
  name = 'Whisper Service / Free Speech API';

  private getServiceUrl(): string | undefined {
    return env.WHISPER_SERVICE_URL || process.env.WHISPER_SERVICE_URL;
  }

  async isAvailable(): Promise<boolean> {
    const serviceUrl = this.getServiceUrl();
    const groqKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY;
    const hfToken = process.env.HF_API_TOKEN;
    return !!serviceUrl || !!groqKey || !!hfToken || true;
  }

  async transcribe(audioPath: string, mimeType: string): Promise<SpeechTranscriptionResult> {
    const serviceUrl = this.getServiceUrl();
    const groqKey = env.GROQ_API_KEY || process.env.GROQ_API_KEY;
    Logger.info(`🎙️ Running ${this.name} on audio: ${audioPath}`);

    try {
      const audioBuffer = fs.readFileSync(audioPath);

      // Path A: Custom / Self-hosted Whisper Microservice HTTP Endpoint
      if (serviceUrl) {
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer], { type: mimeType || 'audio/wav' }), 'audio.wav');
        formData.append('model', 'base');

        const response = await fetch(serviceUrl, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data: any = await response.json();
          const text = data.text || data.transcript || '';
          if (text.trim()) {
            return { text: text.trim(), confidence: data.confidence || 0.90, language: data.language || 'en' };
          }
        }
      }

      // Path B: Groq Free Whisper API (100% Free - 14,400 requests/day)
      if (groqKey) {
        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer], { type: mimeType || 'audio/wav' }), 'audio.wav');
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('language', 'en');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}` },
          body: formData,
        });

        if (response.ok) {
          const data: any = await response.json();
          const text = data.text || '';
          if (text.trim()) {
            return { text: text.trim(), confidence: 0.95, language: 'en' };
          }
        }
      }

      // Path C: Hugging Face Free Inference Router API for Whisper
      const hfToken = process.env.HF_API_TOKEN;
      const hfEndpoint = 'https://router.huggingface.co/hf-inference/v1/audio/transcriptions';

      const headers: Record<string, string> = {
        'Content-Type': mimeType || 'audio/wav',
      };
      if (hfToken) {
        headers['Authorization'] = `Bearer ${hfToken}`;
      }

      const response = await fetch(hfEndpoint, {
        method: 'POST',
        headers,
        body: audioBuffer,
      });

      if (!response.ok) {
        throw new Error(`Speech API status ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      const text = data.text || '';

      if (!text.trim()) {
        throw new Error('Speech API returned empty transcript');
      }

      return {
        text: text.trim(),
        confidence: 0.92,
        language: 'en',
      };
    } catch (err: any) {
      Logger.error(`${this.name} failed: ${err.message}`);
      throw err;
    }
  }
}
