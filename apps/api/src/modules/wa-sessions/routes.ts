import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getWaSessionManager, getBrowserTuple } from '@dispara/wa-manager';
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

    const tempId = crypto.randomUUID();
    const browserTuple = getBrowserTuple(tempId);

    // Create DB record (starts as DISCONNECTED until QR is scanned)
    const session = await prisma.waSession.create({
      data: {
        tenantId,
        name: body.name,
        phoneNumber: '',
        status: 'DISCONNECTED',
        metadata: {
          browserTuple,
          connecting: true,
        },
      },
    });

    const sessionId = session.id;

    // Start Baileys session (fire-and-forget — runs in background)
    waManager.createSession({
      sessionId,
      tenantId,
      phoneNumber: '',
      prisma,
      browserTuple,
      onQR: async (qr) => {
        try {
          await redis.set(`wa:qr:${sessionId}`, qr, 'EX', 120);
        } catch (err) {
          request.log.error({ err, sessionId }, 'Failed to store QR in Redis');
        }
      },
      onConnected: async () => {
        try {
          const sock = waManager.getSession(sessionId);
          let phoneNumber = sock?.user?.id?.split(':')[0] ?? '';
          if (!phoneNumber) {
            await new Promise(r => setTimeout(r, 2000));
            phoneNumber = sock?.user?.id?.split(':')[0] ?? '';
          }
          await prisma.waSession.update({
            where: { id: sessionId },
            data: {
              status: 'CONNECTED',
              phoneNumber,
              lastConnAt: new Date(),
              firstConnAt: session.firstConnAt ?? new Date(),
              metadata: { browserTuple, connecting: false },
            },
          });
          await redis.del(`wa:qr:${sessionId}`);
        } catch (err) {
          request.log.error({ err, sessionId }, 'Failed to update session on connect');
        }
      },
      onDisconnected: async (_reason) => {
        try {
          await prisma.waSession.update({
            where: { id: sessionId },
            data: {
              status: 'DISCONNECTED',
              metadata: { browserTuple, connecting: false },
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
              metadata: { browserTuple, connecting: false, bannedAt: new Date().toISOString() },
            },
          });
          await redis.del(`wa:qr:${sessionId}`);
        } catch (err) {
          request.log.error({ err, sessionId }, 'Failed to update session on ban');
        }
      },
    }).catch(async (err) => {
      request.log.error({ err, sessionId }, 'Failed to create Baileys session');
      try {
        await prisma.waSession.update({
          where: { id: sessionId },
          data: { status: 'DISCONNECTED', metadata: { browserTuple, connecting: false } },
        });
      } catch (dbErr) {
        request.log.error({ dbErr, sessionId }, 'Failed to update session status after creation error');
      }
    });

    reply.status(201).send({
      id: sessionId,
      status: 'CONNECTING' as const,
    });
  });

  // ============================================
  // GET /v1/wa/sessions — List all sessions
  // ============================================
  app.get('/', async (request: FastifyRequest, _reply: FastifyReply) => {
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
    const meta = session.metadata as Record<string, unknown> | null;

    return {
      id,
      qr: qr ?? null,
      status: meta?.connecting ? 'CONNECTING' : session.status,
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
