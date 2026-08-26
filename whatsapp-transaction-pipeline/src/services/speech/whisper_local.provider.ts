import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { SpeechToTextProvider, SpeechTranscriptionResult } from '../../types/providers';
import { Logger } from '../../utils/logger';

const execAsync = promisify(exec);

export class WhisperLocalSpeechProvider implements SpeechToTextProvider {
  name = 'Whisper (Local)';

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('whisper --help', { timeout: 5000 });
      return stdout.includes('whisper');
    } catch {
      return false;
    }
  }

  async transcribe(audioPath: string, _mimeType: string): Promise<SpeechTranscriptionResult> {
    const outputDir = path.dirname(audioPath);
    const command = `whisper "${audioPath}" --model base --language en --output_format txt --output_dir "${outputDir}"`;

    Logger.info(`🎙️ Running ${this.name} on audio: ${audioPath}`);

    try {
      await execAsync(command, { timeout: 120000 });

      const txtPath = audioPath.replace(/\.[^.]+$/, '.txt');
      if (!fs.existsSync(txtPath)) {
        throw new Error('Local Whisper did not produce an output transcript file');
      }

      const text = fs.readFileSync(txtPath, 'utf8').trim();
      fs.unlinkSync(txtPath);

      if (!text) {
        throw new Error('Local Whisper returned empty text');
      }

      return {
        text,
        confidence: 0.9,
        language: 'en',
      };
    } catch (err: any) {
      Logger.error(`${this.name} failed: ${err.message}`);
      throw err;
    }
  }
}
