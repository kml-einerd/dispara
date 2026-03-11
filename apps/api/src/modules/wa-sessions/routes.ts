import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getWaSessionManager, getBrowserTuple } from '@promospot/wa-manager';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import {
  createSessionBodySchema,
  sessionParamsSchema,
  type CreateSessionBody,
  type SessionParams,
} from './schema.js';

export async function waSessionRoutes(app: FastifyInstance): Promise<void> {
  const waManager = getWaSessionManager();

  // ============================================
  // POST /v1/wa/sessions — Create a new session
  // ============================================
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId;
    const body = createSessionBodySchema.parse(request.body);

    // Create DB record
    const session = await prisma.waSession.create({
      data: {
        tenantId,
        name: body.name,
        phoneNumber: '',
        status: 'CONNECTING',
        browserTuple: '',
      },
    });

    const sessionId = session.id;
    const browserTuple = getBrowserTuple(sessionId);

    // Update with deterministic browser tuple
    await prisma.waSession.update({
      where: { id: sessionId },
      data: { browserTuple: JSON.stringify(browserTuple) },
    });

    // Start Baileys session (fire-and-forget — runs in background)
    waManager.createSession({
      sessionId,
      tenantId,
      phoneNumber: '',
      browserTuple,
      onQR: async (qr) => {
        try {
          await redis.set(`wa:qr:${sessionId}`, qr, 'EX', 60);
        } catch (err) {
          request.log.error({ err, sessionId }, 'Failed to store QR in Redis');
        }
      },
      onConnected: async () => {
        try {
          const sock = waManager.getSession(sessionId);
          const phoneNumber = sock?.user?.id?.split(':')[0] ?? '';
          await prisma.waSession.update({
            where: { id: sessionId },
            data: {
              status: 'CONNECTED',
              phoneNumber,
              lastConnAt: new Date(),
              firstConnAt: session.firstConnAt ?? new Date(),
            },
          });
          await redis.del(`wa:qr:${sessionId}`);
        } catch (err) {
          request.log.error({ err, sessionId }, 'Failed to update session on connect');
        }
      },
      onDisconnected: async (reason) => {
        try {
          await prisma.waSession.update({
            where: { id: sessionId },
            data: {
              status: 'DISCONNECTED',
              lastDisconnAt: new Date(),
            },
          });
          await redis.del(`wa:qr:${sessionId}`);
        } catch (err) {
          request.log.error({ err, sessionId }, 'Failed to update session on disconnect');
        }
      },
      onBanned: async () => {
        try {
          await prisma.waSession.update({
            where: { id: sessionId },
            data: {
              status: 'BANNED',
              healthScore: 0,
              lastDisconnAt: new Date(),
            },
          });
          await redis.del(`wa:qr:${sessionId}`);
        } catch (err) {
          request.log.error({ err, sessionId }, 'Failed to update session on ban');
        }
      },
    }).catch((err) => {
      request.log.error({ err, sessionId }, 'Failed to create Baileys session');
    });

    reply.status(201).send({
      sessionId,
      status: 'CONNECTING' as const,
    });
  });

  // ============================================
  // GET /v1/wa/sessions — List all sessions
  // ============================================
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId;

    const sessions = await prisma.waSession.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      sessions: sessions.map(formatSession),
      total: sessions.length,
    };
  });

  // ============================================
  // DELETE /v1/wa/sessions/:id — Disconnect
  // ============================================
  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId;
    const { id } = sessionParamsSchema.parse((request as FastifyRequest<{ Params: SessionParams }>).params);

    const session = await prisma.waSession.findFirst({
      where: { id, tenantId },
    });

    if (!session) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    await waManager.disconnectSession(id);

    await prisma.waSession.update({
      where: { id },
      data: {
        status: 'DISCONNECTED',
        lastDisconnAt: new Date(),
      },
    });

    await redis.del(`wa:qr:${id}`);

    return { success: true };
  });

  // ============================================
  // GET /v1/wa/sessions/:id/health — Session health
  // ============================================
  app.get('/:id/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId;
    const { id } = sessionParamsSchema.parse((request as FastifyRequest<{ Params: SessionParams }>).params);

    const session = await prisma.waSession.findFirst({
      where: { id, tenantId },
    });

    if (!session) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const runtime = waManager.getSessionHealth(id);

    return {
      id: session.id,
      status: session.status,
      healthScore: session.healthScore,
      warmupDay: session.warmupDay,
      dailyMsgCount: session.dailyMsgCount,
      lastActivity: runtime.lastActivity.toISOString(),
      runtimeStatus: runtime.status,
    };
  });

  // ============================================
  // GET /v1/wa/sessions/:id/qr — Get QR code
  // ============================================
  app.get('/:id/qr', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId;
    const { id } = sessionParamsSchema.parse((request as FastifyRequest<{ Params: SessionParams }>).params);

    const session = await prisma.waSession.findFirst({
      where: { id, tenantId },
    });

    if (!session) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Session not found' } });
    }

    const qr = await redis.get(`wa:qr:${id}`);

    return {
      sessionId: id,
      qr: qr ?? null,
      status: session.status,
    };
  });
}

// ============================================
// Helpers
// ============================================

function formatSession(session: {
  id: string;
  tenantId: string;
  name: string;
  phoneNumber: string;
  status: string;
  healthScore: number;
  warmupDay: number;
  dailyMsgCount: number;
  createdAt: Date;
}) {
  return {
    id: session.id,
    tenantId: session.tenantId,
    name: session.name,
    phoneNumber: session.phoneNumber,
    status: session.status,
    healthScore: session.healthScore,
    warmupDay: session.warmupDay,
    dailyMsgCount: session.dailyMsgCount,
    createdAt: session.createdAt.toISOString(),
  };
}
