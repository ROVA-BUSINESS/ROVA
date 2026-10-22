import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { SpeechToTextService } from '../services/speech/speech.service';
import { OCRService } from '../services/ocr/ocr.service';
import { Logger } from '../utils/logger';

const router = Router();
const speechService = new SpeechToTextService();
const ocrService = new OCRService();

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../tmp/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '';
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const audioUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'audio/webm',
      'audio/ogg',
      'audio/wav',
      'audio/x-wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/m4a',
      'audio/x-m4a',
      'audio/mp4',
      'video/webm',
      'video/ogg',
    ];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB max
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ];
    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported document/image format: ${file.mimetype}`));
    }
  },
});

// ── Voice Transcription Endpoint ─────────────────────────────────────────────
router.post(
  '/transcribe',
  audioUpload.single('audio'),
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No audio file provided in request (field name: "audio")' });
      return;
    }

    const filePath = file.path;
    const mimeType = file.mimetype || 'audio/webm';
    Logger.info(`🎙️ [Web AI] Processing voice transcription: ${file.originalname} (${file.size} bytes, ${mimeType})`);

    try {
      const result = await speechService.processAudio(filePath, mimeType);

      res.status(200).json({
        success: true,
        transcript: result.transcript,
        confidence: result.confidence || 0.95,
        originalName: file.originalname,
        sizeBytes: file.size,
        mimeType,
      });
    } catch (err: any) {
      Logger.error(`[Web AI] Voice transcription failed: ${err.message}`);
      res.status(500).json({
        success: false,
        error: err.message || 'Voice transcription failed. Please speak clearly or record again.',
      });
    } finally {
      // Safe cleanup of temporary upload file
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupErr) {
        console.warn('Failed to clean up temp audio file:', cleanupErr);
      }
    }
  }
);

// Helper to extract structured receipt details from raw OCR text
function extractReceiptEntities(rawText: string) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Extract amount
  let totalAmount: number | null = null;
  const amountRegex = /(?:total|amount|due|paid|balance|net|sum|grand\s*total)[^\d\n]*[₦N]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i;
  const generalCurrencyRegex = /[₦N]\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/g;

  const totalMatch = rawText.match(amountRegex);
  if (totalMatch && totalMatch[1]) {
    totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
  } else {
    // Find largest currency occurrence
    const currencyMatches = [...rawText.matchAll(generalCurrencyRegex)];
    if (currencyMatches.length > 0) {
      const amounts = currencyMatches
        .map(m => parseFloat(m[1].replace(/,/g, '')))
        .filter(n => !isNaN(n) && n > 0);
      if (amounts.length > 0) {
        totalAmount = Math.max(...amounts);
      }
    }
  }

  // Extract date
  let detectedDate: string | null = null;
  const dateRegex = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i;
  const dateMatch = rawText.match(dateRegex);
  if (dateMatch) {
    detectedDate = dateMatch[1];
  }

  // Merchant name heuristic (usually top lines of receipt)
  let merchant: string | null = null;
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const line = lines[i];
    if (
      line.length > 2 &&
      !line.match(/receipt|invoice|bill|tax|date|tel|phone|welcome|thank/i) &&
      !line.match(/^\d+/)
    ) {
      merchant = line;
      break;
    }
  }

  // Document type
  let documentType = 'receipt';
  if (/invoice/i.test(rawText)) documentType = 'invoice';
  else if (/bill/i.test(rawText)) documentType = 'bill';
  else if (/payment\s*voucher/i.test(rawText)) documentType = 'payment_voucher';

  return {
    merchant,
    totalAmount,
    date: detectedDate,
    documentType,
    lineCount: lines.length,
    uncertainFields: [
      ...(!totalAmount ? ['total_amount'] : []),
      ...(!merchant ? ['merchant'] : []),
      ...(!detectedDate ? ['date'] : []),
    ],
  };
}

// ── Vision / OCR Document Processing Endpoint ────────────────────────────────
router.post(
  '/ocr',
  imageUpload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No image or document provided in request (field name: "file")' });
      return;
    }

    const filePath = file.path;
    const mimeType = file.mimetype || 'image/jpeg';
    Logger.info(`🔍 [Web AI] Processing OCR: ${file.originalname} (${file.size} bytes, ${mimeType})`);

    try {
      const ocrResult = await ocrService.processImage(filePath, mimeType);
      const parsedData = extractReceiptEntities(ocrResult.text);

      res.status(200).json({
        success: true,
        text: ocrResult.text,
        confidence: ocrResult.confidence || 0.90,
        documentType: ocrResult.documentType || parsedData.documentType,
        parsedData,
        originalName: file.originalname,
        sizeBytes: file.size,
        mimeType,
      });
    } catch (err: any) {
      Logger.error(`[Web AI] OCR extraction failed: ${err.message}`);
      res.status(500).json({
        success: false,
        error: err.message || 'Could not extract text from the document. Please ensure good lighting and clear text.',
      });
    } finally {
      // Safe cleanup of temporary upload file
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupErr) {
        console.warn('Failed to clean up temp image file:', cleanupErr);
      }
    }
  }
);

export default router;
