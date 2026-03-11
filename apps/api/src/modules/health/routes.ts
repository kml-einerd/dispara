import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

const APP_VERSION = process.env.npm_package_version || '0.1.0';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/health
   * Basic liveness check — always returns 200 if the process is running.
   */
  app.get('/', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: APP_VERSION,
    uptime: process.uptime(),
  }));

  /**
   * GET /v1/health/ready
   * Readiness check — verifies DB + Redis connectivity.
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
