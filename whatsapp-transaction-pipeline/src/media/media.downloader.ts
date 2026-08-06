import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

/**
 * Handles downloading media files from WhatsApp Cloud API.
 * After processing, all downloaded files are deleted to comply with
 * data minimization principles (NDPR/GDPR).
 */
export class MediaDownloader {
  private readonly tempDir = path.join(__dirname, '../../tmp');
  private readonly headers = {
    Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
  };

  constructor() {
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Step 1: Get the media's actual download URL from Meta using the media ID.
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      { headers: this.headers }
    );
    return response.data.url as string;
  }

  /**
   * Step 2: Download the media binary to our local temp directory.
   * Returns the local file path.
   */
  async download(mediaId: string, mimeType: string): Promise<string> {
    const mediaUrl = await this.getMediaUrl(mediaId);
    const extension = this.getExtension(mimeType);
    const filePath = path.join(this.tempDir, `${mediaId}.${extension}`);

    const response = await axios.get(mediaUrl, {
      headers: this.headers,
      responseType: 'arraybuffer',
    });

    fs.writeFileSync(filePath, response.data);
    console.log(`⬇️  Media downloaded: ${filePath}`);
    return filePath;
  }

  /**
   * Deletes a file from the temp directory. Should be called after processing.
   */
  deleteFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Deleted temp file: ${filePath}`);
      }
    } catch (err) {
      console.error(`Failed to delete file ${filePath}:`, err);
    }
  }

  private getExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/ogg; codecs=opus': 'ogg',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    return map[mimeType] ?? 'bin';
  }
}
