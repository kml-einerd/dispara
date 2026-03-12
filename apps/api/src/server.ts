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
import { tenantMiddleware } from './middleware/tenant.js';
import { errorHandler } from './middleware/error-handler.js';
import { WebSocketGateway } from './plugins/websocket-gateway.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { getWaSessionManager } from '@dispara/wa-manager';

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
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
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

// ── Global hooks ──
app.addHook('onRequest', tenantMiddleware);

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
