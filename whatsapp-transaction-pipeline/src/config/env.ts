import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // WhatsApp Config
  META_APP_SECRET: z.string(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string(),
  WHATSAPP_ACCESS_TOKEN: z.string(),
  WHATSAPP_PHONE_NUMBER_ID: z.string(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_FLOW_ID: z.string().optional(),
  
  // Supabase Config
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  
  // Redis / BullMQ Config
  REDIS_URL: z.string().url(),

  // AI & Processing Config
  DEEPSEEK_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OCR_SPACE_API_KEY: z.string().optional(),
  PADDLE_OCR_URL: z.string().url().optional(),
  WHISPER_SERVICE_URL: z.string().url().optional(),
  OCR_PROVIDER: z.enum(['paddle', 'ocr_space', 'tesseract', 'openai', 'auto']).default('auto'),
  SPEECH_PROVIDER: z.enum(['whisper_local', 'whisper_service', 'openai_whisper', 'auto']).default('auto'),
  AI_PROVIDER: z.enum(['central_rova', 'deepseek', 'openai']).default('central_rova'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:\n', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
