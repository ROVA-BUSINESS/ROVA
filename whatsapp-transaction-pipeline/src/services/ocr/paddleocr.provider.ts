import { exec } from 'child_process';
import { promisify } from 'util';
import { OCRProvider, OCRExtractionResult } from '../../types/providers';
import { Logger } from '../../utils/logger';

const execAsync = promisify(exec);

export class PaddleOCRProvider implements OCRProvider {
  name = 'PaddleOCR (Local)';

  async isAvailable(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('python -c "import paddleocr; print(\'ok\')"', { timeout: 10000 });
      return stdout.includes('ok');
    } catch {
      return false;
    }
  }

  async extractText(imagePath: string, _mimeType: string): Promise<OCRExtractionResult> {
    const pythonScript = `
import sys
import json
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
result = ocr.ocr(sys.argv[1], cls=True)
texts = []
confidences = []
if result and result[0]:
    for line in result[0]:
        if line and len(line) >= 2:
            texts.append(line[1][0])
            confidences.append(line[1][1])

avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
print(json.dumps({"text": " ".join(texts), "confidence": avg_conf}))
`;

    const escapedScript = pythonScript.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    const command = `python -c "${escapedScript}" "${imagePath}"`;

    Logger.info(`🔍 Running ${this.name} on image: ${imagePath}`);

    try {
      const { stdout } = await execAsync(command, { timeout: 60000 });
      const parsed = JSON.parse(stdout.trim());
      
      const text = parsed.text || '';
      const confidence = parsed.confidence || 0.85;

      if (!text.trim()) {
        throw new Error('PaddleOCR returned empty text from image');
      }

      return {
        text,
        confidence: Number(confidence.toFixed(2)),
      };
    } catch (err: any) {
      Logger.error(`${this.name} failed: ${err.message}`);
      throw err;
    }
  }
}
