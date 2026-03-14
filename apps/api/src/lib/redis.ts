import { Redis } from 'ioredis';
import pino from 'pino';

const logger = pino({ name: 'redis' });

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    if (times > 10) return null;
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err: Error) => {
  logger.error({ err: err.message }, 'Redis connection error');
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

/** BullMQ connection config — pass to Queue / Worker constructors */
export const bullConnection = { connection: redis };
