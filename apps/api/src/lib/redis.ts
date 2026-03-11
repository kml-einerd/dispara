import { Redis } from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    if (times > 10) return null;
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

/** BullMQ connection config — pass to Queue / Worker constructors */
export const bullConnection = { connection: redis };
