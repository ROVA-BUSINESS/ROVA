import { Redis } from 'ioredis';
import { env } from './env';

let redisClient: Redis | null = null;
let redisHealthy = false;
let lastErrorLogTime = 0;

export function isRedisAvailable(): boolean {
  return redisHealthy && redisClient !== null && redisClient.status === 'ready';
}

export function markRedisUnusable(reason: string): void {
  if (redisHealthy) {
    redisHealthy = false;
    console.warn(`⚠️ Redis disabled (${reason}). Seamlessly switching to In-Memory pipeline.`);
  }
}

if (env.QUEUE_DRIVER !== 'memory' && env.REDIS_URL) {
  try {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy: (times) => {
        if (!redisHealthy && times > 3) {
          // Cease aggressive reconnecting if rate-limited or unavailable
          return null;
        }
        return Math.min(times * 1000, 15000);
      },
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
      redisHealthy = true;
    });

    redisClient.on('ready', () => {
      redisHealthy = true;
    });

    redisClient.on('error', (err) => {
      const now = Date.now();
      const msg = err.message || '';

      if (msg.includes('max requests limit exceeded')) {
        markRedisUnusable('Upstash quota limit 500,000 exceeded');
      }

      // Throttle error logs to once every 60 seconds to prevent Render log congestion
      if (now - lastErrorLogTime > 60000) {
        lastErrorLogTime = now;
        console.error('❌ Redis error:', msg);
      }
    });
  } catch (err: any) {
    console.error('Failed to initialize Redis client:', err.message);
    redisHealthy = false;
  }
} else {
  console.log('ℹ️ Redis not configured or QUEUE_DRIVER=memory. Using local in-memory transaction pipeline.');
  redisHealthy = false;
}

export const redis = redisClient;
