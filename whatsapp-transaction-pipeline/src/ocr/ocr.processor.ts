import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Wraps the locally installed PaddleOCR.
 * PaddleOCR must be installed via: pip install paddlepaddle paddleocr
 * Images are processed locally — image data never leaves the server.
 */
export class OCRProcessor {
  /**
   * Extracts all readable text from an image using PaddleOCR.
   * @param imagePath - Path to the image file (jpg, png, webp)
   * @returns Extracted text as a single string
   */
  async extractText(imagePath: string): Promise<string> {
    // Inline Python script so we don't need a separate .py file
    const pythonScript = `
import sys
import json
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
result = ocr.ocr(sys.argv[1], cls=True)
texts = []
for line in result:
    if line:
        for word_info in line:
            if word_info and len(word_info) >= 2:
                texts.append(word_info[1][0])
print(' '.join(texts))
`;

    const escapedScript = pythonScript.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const command = `python -c "${escapedScript}" "${imagePath}"`;

    console.log('🔍 Running PaddleOCR on image (local)...');

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
      
      const extracted = stdout.trim();
      if (!extracted) {
        throw new Error('PaddleOCR returned no text from image');
      }
      
      console.log(`✅ OCR extracted ${extracted.length} characters`);
      return extracted;
    } catch (err: any) {
      if (err.message?.includes('No module named')) {
        throw new Error('PaddleOCR is not installed. Run: pip install paddlepaddle paddleocr');
      }
      throw err;
    }
  }
}
