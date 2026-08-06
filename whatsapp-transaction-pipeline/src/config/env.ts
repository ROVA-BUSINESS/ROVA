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
  
  // Supabase Config
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  
  // Redis / BullMQ Config
  REDIS_URL: z.string().url(),
  
  // DeepSeek AI Config
  DEEPSEEK_API_KEY: z.string()
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:\n', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
