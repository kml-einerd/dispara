import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { importGroupsSchema, updateGroupSchema, listGroupsQuery } from './schema.js';
import type { ImportGroupsBody, UpdateGroupBody, ListGroupsQuery } from './schema.js';

export async function groupRoutes(app: FastifyInstance): Promise<void> {

  // GET /v1/groups — list groups for tenant
  app.get('/', async (req: FastifyRequest<{ Querystring: ListGroupsQuery }>, reply: FastifyReply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return reply.status(401).send({ error: 'x-tenant-id required' });

    const query = listGroupsQuery.parse(req.query);
    const where: Record<string, unknown> = { tenantId };

    if (query.sessionId) where.sessionId = query.sessionId;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';
    if (query.cursor) where.id = { gt: query.cursor };

    const groups = await app.prisma.group.findMany({
      where,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        session: { select: { phoneNumber: true, status: true } },
        _count: { select: { dispatchItems: true } },
      },
    });

    return {
      data: groups,
      cursor: groups.length === query.limit ? groups[groups.length - 1]?.id : null,
    };
  });

  // POST /v1/groups/import — import groups from a WA session
  app.post('/import', async (req: FastifyRequest<{ Body: ImportGroupsBody }>, reply: FastifyReply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return reply.status(401).send({ error: 'x-tenant-id required' });

    const { sessionId } = importGroupsSchema.parse(req.body);

    // Verify session belongs to tenant
    const session = await app.prisma.waSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!session) return reply.status(404).send({ error: 'Session not found' });

    // Get WA manager from app context (will be set up in FASE 1)
    const waManager = (app as any).waManager;
    if (!waManager) return reply.status(503).send({ error: 'WA Manager not available' });

    try {
      const groups = await waManager.fetchGroups(sessionId);

      const imported = [];
      for (const group of groups) {
        const upserted = await app.prisma.group.upsert({
          where: {
            tenantId_externalId: { tenantId, externalId: group.id },
          },
          create: {
            tenantId,
            sessionId,
            externalId: group.id,
            name: group.subject ?? 'Unknown Group',
            description: group.desc ?? '',
            memberCount: group.participants?.length ?? 0,
            inviteLink: group.inviteCode ?? null,
          },
          update: {
            name: group.subject ?? 'Unknown Group',
            description: group.desc ?? '',
            memberCount: group.participants?.length ?? 0,
            inviteLink: group.inviteCode ?? null,
            sessionId,
          },
        });
        imported.push(upserted);
      }

      return { imported: imported.length, groups: imported };
    } catch (err) {
      app.log.error({ err, sessionId }, 'Failed to import groups');
      return reply.status(500).send({ error: 'Failed to import groups from WhatsApp' });
    }
  });

  // GET /v1/groups/:id — group details
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return reply.status(401).send({ error: 'x-tenant-id required' });

    const group = await app.prisma.group.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        session: { select: { phoneNumber: true, status: true, healthScore: true } },
        _count: { select: { dispatchItems: true } },
      },
    });

    if (!group) return reply.status(404).send({ error: 'Group not found' });
    return group;
  });

  // PATCH /v1/groups/:id — update group config
  app.patch('/:id', async (req: FastifyRequest<{ Params: { id: string }; Body: UpdateGroupBody }>, reply: FastifyReply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return reply.status(401).send({ error: 'x-tenant-id required' });

    const body = updateGroupSchema.parse(req.body);

    const existing = await app.prisma.group.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!existing) return reply.status(404).send({ error: 'Group not found' });

    const { metadata, ...rest } = body;
    const updated = await app.prisma.group.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(metadata !== undefined && { metadata: metadata as Prisma.InputJsonValue }),
      },
    });

    return updated;
  });
}
