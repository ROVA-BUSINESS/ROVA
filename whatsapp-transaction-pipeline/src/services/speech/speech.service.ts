import { SpeechToTextProvider, SpeechTranscriptionResult } from '../../types/providers';
import { WhisperLocalSpeechProvider } from './whisper_local.provider';
import { WhisperServiceSpeechProvider } from './whisper_service.provider';
import { OpenAIWhisperSpeechProvider } from './openai_whisper.provider';
import { AudioConverter } from '../../media/audio.converter';
import { env } from '../../config/env';
import { Logger } from '../../utils/logger';

export class SpeechToTextService {
  private providers: SpeechToTextProvider[] = [];
  private audioConverter = new AudioConverter();

  constructor() {
    // Priority order (Free Speech STT first):
    // 1. Whisper (Local CLI / python)
    // 2. Whisper Service / HuggingFace Free Inference API
    // 3. OpenAI Whisper API (optional paid fallback)
    this.providers = [
      new WhisperLocalSpeechProvider(),
      new WhisperServiceSpeechProvider(),
      new OpenAIWhisperSpeechProvider(),
    ];
  }

  /**
   * Converts and transcribes a WhatsApp audio file to text.
   * Accepts raw audio path (e.g. .ogg/.m4a) and outputs high-accuracy English transcription.
   */
  async processAudio(audioPath: string, mimeType: string): Promise<{ transcript: string; convertedPath: string | null; confidence: number }> {
    let wavPath: string | null = null;

    try {
      // Step 1: Convert audio to 16kHz WAV mono format for optimal Speech-to-Text recognition
      wavPath = await this.audioConverter.convertToWav(audioPath);
    } catch (err: any) {
      Logger.warn(`FFmpeg audio conversion failed for ${audioPath}: ${err.message}. Using original audio file.`);
      wavPath = audioPath;
    }

    const targetAudio = wavPath || audioPath;
    const configuredProvider = env.SPEECH_PROVIDER;

    // Try configured provider if specified
    if (configuredProvider === 'whisper_local') {
      const local = this.providers.find((p) => p instanceof WhisperLocalSpeechProvider);
      if (local && (await local.isAvailable())) {
        try {
          const res = await local.transcribe(targetAudio, 'audio/wav');
          return { transcript: res.text, convertedPath: wavPath, confidence: res.confidence };
        } catch (err: any) {
          Logger.warn(`Local Whisper Speech provider failed: ${err.message}. Trying fallback...`);
        }
      }
    } else if (configuredProvider === 'whisper_service') {
      const serviceProvider = this.providers.find((p) => p instanceof WhisperServiceSpeechProvider);
      if (serviceProvider && (await serviceProvider.isAvailable())) {
        try {
          const res = await serviceProvider.transcribe(targetAudio, 'audio/wav');
          return { transcript: res.text, convertedPath: wavPath, confidence: res.confidence };
        } catch (err: any) {
          Logger.warn(`Whisper Service speech provider failed: ${err.message}. Trying fallback...`);
        }
      }
    } else if (configuredProvider === 'openai_whisper') {
      const api = this.providers.find((p) => p instanceof OpenAIWhisperSpeechProvider);
      if (api && (await api.isAvailable())) {
        try {
          const res = await api.transcribe(targetAudio, 'audio/wav');
          return { transcript: res.text, convertedPath: wavPath, confidence: res.confidence };
        } catch (err: any) {
          Logger.warn(`OpenAI Whisper API speech provider failed: ${err.message}. Trying fallback...`);
        }
      }
    }

    // Auto / Fallback strategy: try each active provider in order
    for (const provider of this.providers) {
      if (await provider.isAvailable()) {
        try {
          Logger.info(`Executing Speech-to-Text via ${provider.name}...`);
          const result = await provider.transcribe(targetAudio, 'audio/wav');
          if (result && result.text.trim()) {
            return { transcript: result.text, convertedPath: wavPath, confidence: result.confidence };
          }
        } catch (err: any) {
          Logger.warn(`Speech provider ${provider.name} failed: ${err.message}`);
        }
      }
    }

    throw new Error('UNCLEAR_AUDIO: Could not transcribe voice note. Please record again in a quiet area or send a text message.');
  }
}
