import './types.js';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyWebSocket from '@fastify/websocket';
import { promoRoutes } from './modules/promos/routes.js';
import { healthRoutes } from './modules/health/routes.js';
import { waSessionRoutes } from './modules/wa-sessions/routes.js';
import { groupRoutes } from './modules/groups/routes.js';
import { dispatchRoutes } from './modules/dispatches/routes.js';
import { agentRoutes } from './modules/agent/routes.js';
import { telegramRoutes } from './modules/telegram/routes.js';
import { telegramWebhookRoutes } from './modules/webhooks/telegram.js';
import { authRoutes } from './modules/auth/routes.js';
import { gateRoutes } from './modules/gate/routes.js';
import { feedRoutes } from './modules/feeds/routes.js';
import { linkRoutes } from './modules/links/routes.js';
import { oauthRoutes } from './modules/oauth/routes.js';
import { commissionRoutes } from './modules/commissions/routes.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { usageGateMiddleware } from './middleware/usage-gate.js';
import { errorHandler } from './middleware/error-handler.js';
import { WebSocketGateway } from './plugins/websocket-gateway.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { getWaSessionManager, getBrowserTuple } from '@dispara/wa-manager';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// ── Decorators ──
app.decorateRequest('tenantId', '');
app.decorateRequest('userId', '');
app.decorate('prisma', prisma);
app.decorate('redis', redis);

// ── Plugins ──
await app.register(cors, { origin: true });
await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => {
    // Per-tenant rate limiting (falls back to IP if no tenant)
    return (req.headers['x-tenant-id'] as string) || req.ip;
  },
});
await app.register(fastifyWebSocket);

// ── WebSocket Gateway ──
const wsGateway = new WebSocketGateway(app);
await wsGateway.register();
app.decorate('wsGateway', wsGateway);

// ── WA Manager event forwarding to WebSocket ──
const waManager = getWaSessionManager();
app.decorate('waManager', waManager);

waManager.on('qr', ({ sessionId, tenantId, qr }) => {
  wsGateway.broadcastQR(sessionId, tenantId, qr);
});

waManager.on('connected', ({ sessionId, tenantId }) => {
  wsGateway.broadcastSessionHealth(sessionId, tenantId, {
    status: 'CONNECTED',
    healthScore: 100,
    dailyMsgCount: 0,
  });
});

waManager.on('disconnected', ({ sessionId, tenantId, reason }) => {
  wsGateway.broadcastSessionHealth(sessionId, tenantId, {
    status: 'DISCONNECTED',
    healthScore: 0,
    dailyMsgCount: 0,
  });
});

waManager.on('banned', ({ sessionId, tenantId }) => {
  wsGateway.broadcastSessionHealth(sessionId, tenantId, {
    status: 'BANNED',
    healthScore: 0,
    dailyMsgCount: 0,
  });
});

// ── Restore active WA sessions from DB ──
const activeSessions = await prisma.waSession.findMany({
  where: { status: 'CONNECTED' },
});
for (const session of activeSessions) {
  try {
    waManager.createSession({
      sessionId: session.id,
      tenantId: session.tenantId,
      phoneNumber: session.phoneNumber,
      prisma,
      browserTuple: ((session.metadata as Record<string, unknown>)?.browserTuple as [string, string, string] | undefined) ?? getBrowserTuple(session.id),
      onQR: async (qr) => {
        await redis.set(`wa:qr:${session.id}`, qr, 'EX', 120).catch(() => {});
      },
      onConnected: async () => {
        await prisma.waSession.update({
          where: { id: session.id },
          data: { lastConnAt: new Date() },
        }).catch(() => {});
      },
      onDisconnected: async () => {
        await prisma.waSession.update({
          where: { id: session.id },
          data: { status: 'DISCONNECTED' },
        }).catch(() => {});
      },
      onBanned: async () => {
        await prisma.waSession.update({
          where: { id: session.id },
          data: { status: 'BANNED', healthScore: 0 },
        }).catch(() => {});
      },
    });
    app.log.info({ sessionId: session.id }, 'Restored WA session from DB');
  } catch (err) {
    app.log.warn({ sessionId: session.id, err }, 'Failed to restore WA session');
  }
}

// ── Global hooks ──
app.addHook('onRequest', tenantMiddleware);
app.addHook('onRequest', usageGateMiddleware);

// ── Error handler ──
app.setErrorHandler(errorHandler);

// ── Routes ──
await app.register(healthRoutes, { prefix: '/v1/health' });
await app.register(promoRoutes, { prefix: '/v1/promos' });
await app.register(waSessionRoutes, { prefix: '/v1/wa/sessions' });
await app.register(groupRoutes, { prefix: '/v1/groups' });
await app.register(dispatchRoutes, { prefix: '/v1/dispatches' });
await app.register(agentRoutes, { prefix: '/v1/agent' });
await app.register(telegramRoutes, { prefix: '/v1/telegram' });
await app.register(telegramWebhookRoutes, { prefix: '/v1/telegram/webhook' });
await app.register(authRoutes, { prefix: '/v1/auth' });
await app.register(gateRoutes, { prefix: '/v1/gate' });
await app.register(feedRoutes, { prefix: '/v1/feeds' });
await app.register(linkRoutes, { prefix: '/v1/links' });
await app.register(oauthRoutes, { prefix: '/v1/oauth' });
await app.register(commissionRoutes, { prefix: '/v1/commissions' });

// ── Graceful shutdown ──
const signals = ['SIGTERM', 'SIGINT'] as const;
for (const signal of signals) {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    wsGateway.shutdown();
    await waManager.disconnectAll();
    await app.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}

// ── Start ──
const port = Number(process.env.API_PORT) || 3001;
const host = process.env.API_HOST || '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`Dispara API v2 running on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { app };
