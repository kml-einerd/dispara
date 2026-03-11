import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyWebSocket from '@fastify/websocket';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

const app = Fastify({ logger: true });

// Plugins
await app.register(cors, { origin: true });
await app.register(fastifyWebSocket);

// Decorate with shared instances
app.decorate('prisma', prisma);
app.decorate('redis', redis);

// Health check
app.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
}));

// Register route modules
// These will be added in FASE 1-4
// await app.register(waSessionRoutes, { prefix: '/v1/wa/sessions' });
// await app.register(groupRoutes, { prefix: '/v1/groups' });
// await app.register(dispatchRoutes, { prefix: '/v1/dispatches' });

// Graceful shutdown
const signals = ['SIGTERM', 'SIGINT'] as const;
for (const signal of signals) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down...`);
    await app.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}

// Start
const port = Number(process.env.API_PORT ?? 3001);
const host = process.env.API_HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  logger.info(`PromoSpot API running on ${host}:${port}`);
} catch (err) {
  logger.error(err);
  process.exit(1);
}

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    redis: Redis;
  }
}
