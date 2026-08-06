import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';

// Point fluent-ffmpeg to the bundled ffmpeg-static binary
// This removes the need for a system-wide FFmpeg installation
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

/**
 * Converts WhatsApp audio files (typically .ogg/opus) to WAV format
 * which is what the local Whisper model expects for transcription.
 */
export class AudioConverter {
  /**
   * Converts an audio file to 16kHz mono WAV.
   * Returns the path to the converted .wav file.
   */
  async convertToWav(inputPath: string): Promise<string> {
    const outputPath = inputPath.replace(/\.[^.]+$/, '.wav');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .audioFrequency(16000)  // Whisper works best with 16kHz
        .audioChannels(1)       // Mono
        .audioCodec('pcm_s16le')
        .format('wav')
        .output(outputPath)
        .on('end', () => {
          console.log(`🎵 Audio converted to WAV: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('FFmpeg conversion error:', err.message);
          reject(err);
        })
        .run();
    });
  }
}
