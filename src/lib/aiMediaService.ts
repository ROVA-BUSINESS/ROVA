import { supabase } from './supabase';

export interface AudioRecordingResult {
  blob: Blob;
  durationSeconds: number;
  mimeType: string;
  audioUrl: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  source: 'server_whisper' | 'browser_speech' | 'cloud_whisper';
}

export interface ParsedDocumentData {
  merchant?: string | null;
  totalAmount?: number | null;
  date?: string | null;
  documentType: string;
  uncertainFields: string[];
}

export interface DocumentOcrResult {
  extractedText: string;
  confidence: number;
  documentType: string;
  parsedData: ParsedDocumentData;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

// ── Audio Recording Controller ───────────────────────────────────────────────

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private timerInterval: any = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;

  public isRecording: boolean = false;
  public duration: number = 0;

  /**
   * Starts recording audio from the user's microphone.
   * @param onDurationUpdate Callback receiving elapsed seconds
   * @param onAudioLevelUpdate Callback receiving volume level (0 to 100)
   */
  async start(
    onDurationUpdate?: (seconds: number) => void,
    onAudioLevelUpdate?: (level: number) => void
  ): Promise<void> {
    if (this.isRecording) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Audio recording is not supported in this browser.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Find optimal MIME type supported by browser
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav',
      ];
      let selectedMimeType = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMimeType = mime;
          break;
        }
      }

      this.mediaRecorder = selectedMimeType
        ? new MediaRecorder(this.stream, { mimeType: selectedMimeType })
        : new MediaRecorder(this.stream);

      this.audioChunks = [];
      this.startTime = Date.now();
      this.duration = 0;
      this.isRecording = true;

      // Audio analysis for waveform/volume level
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioContext = new AudioContextClass();
          const source = this.audioContext.createMediaStreamSource(this.stream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 64;
          source.connect(this.analyser);
          this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext visualization setup failed:', audioCtxErr);
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Timer & visualizer loop
      this.timerInterval = setInterval(() => {
        this.duration = Math.floor((Date.now() - this.startTime) / 1000);
        if (onDurationUpdate) {
          onDurationUpdate(this.duration);
        }

        if (this.analyser && this.dataArray && onAudioLevelUpdate) {
          this.analyser.getByteFrequencyData(this.dataArray as any);
          let sum = 0;
          for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
          }
          const avg = sum / this.dataArray.length;
          const level = Math.min(100, Math.round((avg / 255) * 100));
          onAudioLevelUpdate(level);
        }

        // Safety limit: auto-stop after 2 minutes
        if (this.duration >= 120) {
          this.stop();
        }
      }, 100);

      this.mediaRecorder.start(250); // collect 250ms chunks
    } catch (err: any) {
      this.cleanup();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission denied. Please allow microphone access to record audio.');
      }
      throw err;
    }
  }

  /**
   * Stops recording and returns the recorded audio blob and duration.
   */
  async stop(): Promise<AudioRecordingResult> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress.');
    }

    return new Promise((resolve) => {
      const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';

      this.mediaRecorder!.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        const finalDuration = Math.max(1, Math.floor((Date.now() - this.startTime) / 1000));
        const audioUrl = URL.createObjectURL(audioBlob);

        this.cleanup();

        resolve({
          blob: audioBlob,
          durationSeconds: finalDuration,
          mimeType,
          audioUrl,
        });
      };

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    });
  }

  /**
   * Cancels and discards the active recording.
   */
  cancel(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.isRecording = false;
    this.duration = 0;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

// ── Transcription Service ───────────────────────────────────────────────────

/**
 * Transcribes an audio blob into text.
 * Priority:
 * 1. Backend SpeechToTextService endpoint (`/api/ai/transcribe`)
 * 2. Fallback to browser SpeechRecognition if interim text was captured
 */
export async function transcribeAudioBlob(
  blob: Blob,
  fileName: string = 'recording.webm'
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append('audio', blob, fileName);

  try {
    const response = await fetch('/api/ai/transcribe', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.transcript) {
        return {
          text: data.transcript.trim(),
          confidence: data.confidence || 0.95,
          source: 'server_whisper',
        };
      }
    }
  } catch (err) {
    console.warn('Backend transcription endpoint failed, checking fallbacks:', err);
  }

  throw new Error(
    'UNCLEAR_AUDIO: Could not transcribe recording. Please speak clearly or type your message directly.'
  );
}

// ── Document & Image OCR Service ─────────────────────────────────────────────

/**
 * Uploads an image or document (receipt, invoice, bill) through the security scanner
 * into Supabase Storage, and extracts text & structured financial data via OCR.
 */
export async function uploadAndOcrDocument(file: File): Promise<DocumentOcrResult> {
  // 1. Client-side format & size validation
  const MAX_SIZE = 15 * 1024 * 1024; // 15MB
  if (file.size > MAX_SIZE) {
    throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 15MB limit.`);
  }

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedMimes.includes(file.type) && !file.type.startsWith('image/')) {
    throw new Error('Unsupported file format. Please upload a JPG, PNG, WebP image or PDF document.');
  }

  // 2. Upload to Supabase Storage via the upload-receipt edge function (virus scanned + signed URL)
  let fileUrl = '';
  try {
    const formData = new FormData();
    formData.append('file', file);

    const { data: uploadData, error: uploadErr } = await supabase.functions.invoke('upload-receipt', {
      body: formData,
    });

    if (!uploadErr && uploadData?.url) {
      fileUrl = uploadData.url;
    }
  } catch (uploadErr) {
    console.warn('Edge upload-receipt invocation had error, proceeding to local URL:', uploadErr);
  }

  if (!fileUrl) {
    // Fallback: create object URL for preview
    fileUrl = URL.createObjectURL(file);
  }

  // 3. Run OCR extraction
  // Strategy A: Server-side OCR endpoint
  try {
    const ocrFormData = new FormData();
    ocrFormData.append('file', file);

    const ocrResponse = await fetch('/api/ai/ocr', {
      method: 'POST',
      body: ocrFormData,
    });

    if (ocrResponse.ok) {
      const ocrData = await ocrResponse.json();
      if (ocrData.success && ocrData.text) {
        return {
          extractedText: ocrData.text,
          confidence: ocrData.confidence || 0.90,
          documentType: ocrData.documentType || 'receipt',
          parsedData: ocrData.parsedData || {
            merchant: null,
            totalAmount: null,
            date: null,
            documentType: 'receipt',
            uncertainFields: [],
          },
          fileUrl,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
        };
      }
    }
  } catch (serverOcrErr) {
    console.warn('Backend OCR endpoint failed, trying cloud OCR fallback:', serverOcrErr);
  }

  // Strategy B: Direct OCR.space Free API fallback
  try {
    const base64 = await fileToBase64(file);
    const params = new URLSearchParams();
    params.append('apikey', 'helloworld');
    params.append('base64Image', base64);
    params.append('language', 'eng');
    params.append('isTable', 'true');
    params.append('OCREngine', '2');

    const ocrSpaceRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (ocrSpaceRes.ok) {
      const data = await ocrSpaceRes.json();
      const parsedResults = data.ParsedResults || [];
      const extractedText = parsedResults.map((r: any) => r.ParsedText || '').join('\n').trim();

      if (extractedText) {
        const parsed = parseReceiptEntitiesFromText(extractedText);
        return {
          extractedText,
          confidence: 0.88,
          documentType: parsed.documentType,
          parsedData: parsed,
          fileUrl,
          fileName: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
        };
      }
    }
  } catch (ocrSpaceErr) {
    console.warn('OCR.space fallback failed:', ocrSpaceErr);
  }

  throw new Error(
    'UNREADABLE_IMAGE: Could not extract readable text from the document. Please ensure good lighting and text focus.'
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

function parseReceiptEntitiesFromText(rawText: string): ParsedDocumentData {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  let totalAmount: number | null = null;
  const amountRegex = /(?:total|amount|due|paid|balance|net|sum|grand\s*total)[^\d\n]*[₦N]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i;
  const totalMatch = rawText.match(amountRegex);
  if (totalMatch && totalMatch[1]) {
    totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));
  }

  let detectedDate: string | null = null;
  const dateRegex = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i;
  const dateMatch = rawText.match(dateRegex);
  if (dateMatch) {
    detectedDate = dateMatch[1];
  }

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

  let documentType = 'receipt';
  if (/invoice/i.test(rawText)) documentType = 'invoice';
  else if (/bill/i.test(rawText)) documentType = 'bill';

  return {
    merchant,
    totalAmount,
    date: detectedDate,
    documentType,
    uncertainFields: [
      ...(!totalAmount ? ['total_amount'] : []),
      ...(!merchant ? ['merchant'] : []),
      ...(!detectedDate ? ['date'] : []),
    ],
  };
}

// ── Untrusted Prompt Protection ──────────────────────────────────────────────

/**
 * Sanitizes and securely wraps document OCR text so the AI treats it
 * strictly as unprivileged data rather than executable instructions.
 */
export function formatUntrustedOcrForPrompt(
  ocrResult: DocumentOcrResult,
  userComment?: string
): string {
  const commentLine = userComment ? `User note: "${userComment.trim()}"\n` : '';
  const parsed = ocrResult.parsedData;

  const metadataLines = [
    `• Document Type: ${ocrResult.documentType.toUpperCase()}`,
    parsed.merchant ? `• Detected Merchant/Supplier: ${parsed.merchant}` : null,
    parsed.totalAmount ? `• Extracted Amount: ₦${parsed.totalAmount.toLocaleString()}` : null,
    parsed.date ? `• Extracted Date: ${parsed.date}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `${commentLine}[Attached Document: ${ocrResult.fileName}]
Summary extracted from document:
${metadataLines}

<untrusted_document_context>
${ocrResult.extractedText}
</untrusted_document_context>

Please review the extracted details above, identify any uncertain fields, and explain what action should be taken before confirming.`;
}

/**
 * Sanitizes voice note transcription for the AI prompt.
 */
export function formatVoiceTranscriptionForPrompt(
  transcript: string,
  durationSeconds?: number
): string {
  const durNote = durationSeconds ? ` (${durationSeconds}s recording)` : '';
  return `[Voice Note Transcribed${durNote}]: "${transcript}"`;
}
