/**
 * Simple structured logger for the ROVA WhatsApp Pipeline.
 */
export class Logger {
  static info(message: string, meta?: any): void {
    console.log(`[INFO] [${new Date().toISOString()}] ${message}`, meta ? JSON.stringify(meta) : '');
  }

  static warn(message: string, meta?: any): void {
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}`, meta ? JSON.stringify(meta) : '');
  }

  static error(message: string, meta?: any): void {
    console.error(`[ERROR] [${new Date().toISOString()}] ${message}`, meta ? JSON.stringify(meta) : '');
  }
}
