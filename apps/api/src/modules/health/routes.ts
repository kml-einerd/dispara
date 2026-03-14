import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

const APP_VERSION = '2.0.0';
const startedAt = Date.now();

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/health
   * Full health check — verifies DB + Redis connectivity.
   * Returns 503 if any service is disconnected.
   */
  app.get('/', async (_request, reply) => {
    const services: Record<string, string> = {};

    // ── Database check ──
    try {
      await prisma.$queryRaw`SELECT 1`;
      services.database = 'connected';
    } catch {
      services.database = 'disconnected';
    }

    // ── Redis check ──
    try {
      const pong = await redis.ping();
      services.redis = pong === 'PONG' ? 'connected' : 'disconnected';
    } catch {
      services.redis = 'disconnected';
    }

    const allHealthy = Object.values(services).every((s) => s === 'connected');

    reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'ok' : 'degraded',
      version: APP_VERSION,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      services,
    });
  });

  /**
   * GET /v1/health/ready
   * Readiness check — verifies DB + Redis connectivity with latency details.
   */
  app.get('/ready', async (_request, reply) => {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

    // ── Database check ──
    const dbStart = performance.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'ok',
        latencyMs: Math.round(performance.now() - dbStart),
      };
    } catch (err) {
      checks.database = {
        status: 'error',
        latencyMs: Math.round(performance.now() - dbStart),
        error: err instanceof Error ? err.message : 'Unknown database error',
      };
    }

    // ── Redis check ──
    const redisStart = performance.now();
    try {
      const pong = await redis.ping();
      checks.redis = {
        status: pong === 'PONG' ? 'ok' : 'error',
        latencyMs: Math.round(performance.now() - redisStart),
      };
    } catch (err) {
      checks.redis = {
        status: 'error',
        latencyMs: Math.round(performance.now() - redisStart),
        error: err instanceof Error ? err.message : 'Unknown redis error',
      };
    }

    const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

    reply.status(allHealthy ? 200 : 503).send({
      status: allHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      checks,
    });
  });
}
