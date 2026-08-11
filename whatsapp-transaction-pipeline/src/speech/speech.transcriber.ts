import { exec } from 'child_process';
import { promisify } from 'util';
import { env } from '../config/env';

const execAsync = promisify(exec);

/**
 * Wraps the locally installed Whisper model.
 * Whisper must be installed via: pip install openai-whisper
 * The model runs entirely on local hardware — voice data never leaves the server.
 */
export class SpeechTranscriber {
  /**
   * Transcribes a WAV audio file to text using local Whisper.
   * @param audioPath - Path to the .wav file
   * @returns Transcribed text string
   */
  async transcribe(audioPath: string): Promise<string> {
    // We call the Whisper CLI directly.
    // --model base is a good balance of speed/accuracy for Nigerian-accented English.
    // --language en forces English to improve accuracy for Nigerian SMEs.
    // --output_format txt outputs only a clean text file.
    const command = `whisper "${audioPath}" --model base --language en --output_format txt --output_dir "${audioPath.replace(/[^/\\]*$/, '')}"`;

    console.log('🎙️  Transcribing audio with Whisper (local)...');
    
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 120000 }); // 2 min timeout
      if (stderr && !stderr.includes('Detected language')) {
        // Whisper often prints info to stderr, only throw on real errors
        console.warn('Whisper stderr:', stderr);
      }

      // Read the generated .txt file
      const fs = await import('fs');
      const txtPath = audioPath.replace(/\.[^.]+$/, '.txt');
      
      if (!fs.existsSync(txtPath)) {
        throw new Error('Whisper did not produce a text output file');
      }
      
      const transcript = fs.readFileSync(txtPath, 'utf8').trim();
      
      // Clean up the txt file
      fs.unlinkSync(txtPath);
      
      console.log(`✅ Transcription complete: "${transcript.substring(0, 80)}..."`);
      return transcript;
    } catch (err: any) {
      if (err.message?.includes('whisper') && err.message?.includes('not recognized')) {
        throw new Error('Whisper is not installed. Run: pip install openai-whisper');
      }
      throw err;
    }
  }
}
