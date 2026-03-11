import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Queue } from 'bullmq';
import { createDispatchSchema, listDispatchesQuery } from './schema.js';
import type { CreateDispatchBody, ListDispatchesQuery } from './schema.js';
import { QUEUES, isWithinDispatchWindow, type DispatchJobData } from '@promospot/shared';

export async function dispatchRoutes(app: FastifyInstance): Promise<void> {

  const dispatchQueue = new Queue(QUEUES.DISPATCH, { connection: app.redis });
  const priorityQueue = new Queue(QUEUES.DISPATCH_PRIORITY, { connection: app.redis });

  // POST /v1/dispatches — create dispatch
  app.post('/', async (req: FastifyRequest<{ Body: CreateDispatchBody }>, reply: FastifyReply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return reply.status(401).send({ error: 'x-tenant-id required' });

    const body = createDispatchSchema.parse(req.body);

    // Validate all groups belong to tenant and are active
    const groups = await app.prisma.waGroup.findMany({
      where: {
        id: { in: body.groupIds },
        tenantId,
        isActive: true,
      },
      include: {
        session: { select: { id: true, status: true, warmupDay: true, dailyMsgCount: true } },
      },
    });

    if (groups.length === 0) {
      return reply.status(400).send({ error: 'No valid active groups found' });
    }

    const missingIds = body.groupIds.filter(id => !groups.find(g => g.id === id));
    if (missingIds.length > 0) {
      app.log.warn({ missingIds }, 'Some groups not found or inactive');
    }

    // Check dispatch window for immediate dispatches
    const isScheduled = !!body.scheduledAt;
    if (!isScheduled && !isWithinDispatchWindow()) {
      return reply.status(400).send({
        error: 'Outside dispatch window (09-12h, 14-18h BRT). Use scheduledAt for later.',
      });
    }

    // Create dispatch record
    const dispatch = await app.prisma.dispatch.create({
      data: {
        tenantId,
        promoId: body.promoId,
        copyTemplate: body.copyTemplate,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
        priority: body.priority,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        totalGroups: groups.length,
        status: isScheduled ? 'PENDING' : 'PROCESSING',
        startedAt: isScheduled ? null : new Date(),
        items: {
          create: groups.map(group => ({
            groupId: group.id,
            sessionId: group.session.id,
            status: 'PENDING',
          })),
        },
      },
      include: { items: true },
    });

    // Enqueue jobs for each group
    const queue = body.priority === 1 ? priorityQueue : dispatchQueue;

    const jobs = dispatch.items.map((item, index) => ({
      name: `dispatch-${dispatch.id}-${item.id}`,
      data: {
        dispatchId: dispatch.id,
        dispatchItemId: item.id,
        groupId: item.groupId,
        waGroupJid: groups.find(g => g.id === item.groupId)!.waGroupId,
        sessionId: item.sessionId!,
        tenantId,
        copyTemplate: body.copyTemplate,
        mediaUrl: body.mediaUrl,
        mediaType: body.mediaType,
      } satisfies DispatchJobData,
      opts: {
        delay: isScheduled
          ? Math.max(0, new Date(body.scheduledAt!).getTime() - Date.now())
          : index * 15_000, // stagger by ~15s per group
        attempts: 5,
        backoff: { type: 'exponential' as const, delay: 30_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 604_800 },
      },
    }));

    await queue.addBulk(jobs);

    app.log.info({
      dispatchId: dispatch.id,
      totalGroups: groups.length,
      priority: body.priority,
      scheduled: isScheduled,
    }, 'Dispatch created');

    return reply.status(201).send({
      id: dispatch.id,
      status: dispatch.status,
      totalGroups: dispatch.totalGroups,
      scheduledAt: dispatch.scheduledAt,
    });
  });

  // GET /v1/dispatches — list dispatches
  app.get('/', async (req: FastifyRequest<{ Querystring: ListDispatchesQuery }>, reply: FastifyReply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return reply.status(401).send({ error: 'x-tenant-id required' });

    const query = listDispatchesQuery.parse(req.query);
    const where: Record<string, unknown> = { tenantId };
    if (query.status) where.status = query.status;
    if (query.cursor) where.id = { gt: query.cursor };

    const dispatches = await app.prisma.dispatch.findMany({
      where,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return {
      data: dispatches,
      cursor: dispatches.length === query.limit ? dispatches[dispatches.length - 1]?.id : null,
    };
  });

  // GET /v1/dispatches/:id — dispatch details
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return reply.status(401).send({ error: 'x-tenant-id required' });

    const dispatch = await app.prisma.dispatch.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        items: {
          include: {
            group: { select: { name: true, waGroupId: true } },
            session: { select: { phoneNumber: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!dispatch) return reply.status(404).send({ error: 'Dispatch not found' });
    return dispatch;
  });

  // DELETE /v1/dispatches/:id — cancel pending dispatch
  app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return reply.status(401).send({ error: 'x-tenant-id required' });

    const dispatch = await app.prisma.dispatch.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!dispatch) return reply.status(404).send({ error: 'Dispatch not found' });

    if (dispatch.status !== 'PENDING' && dispatch.status !== 'PROCESSING') {
      return reply.status(400).send({ error: `Cannot cancel dispatch with status: ${dispatch.status}` });
    }

    // Remove pending jobs from queue
    const pendingItems = await app.prisma.dispatchItem.findMany({
      where: { dispatchId: dispatch.id, status: { in: ['PENDING', 'QUEUED'] } },
    });

    for (const item of pendingItems) {
      if (item.jobId) {
        try {
          const job = await dispatchQueue.getJob(item.jobId);
          if (job) await job.remove();
        } catch { /* job may already be processed */ }
        try {
          const job = await priorityQueue.getJob(item.jobId);
          if (job) await job.remove();
        } catch { /* job may already be processed */ }
      }
    }

    // Update dispatch and items status
    await app.prisma.$transaction([
      app.prisma.dispatch.update({
        where: { id: dispatch.id },
        data: { status: 'CANCELLED' },
      }),
      app.prisma.dispatchItem.updateMany({
        where: {
          dispatchId: dispatch.id,
          status: { in: ['PENDING', 'QUEUED'] },
        },
        data: { status: 'CANCELLED' },
      }),
    ]);

    app.log.info({ dispatchId: dispatch.id }, 'Dispatch cancelled');
    return { status: 'cancelled', id: dispatch.id };
  });

  // POST /v1/dispatches/:id/retry — retry failed dispatch
  app.post('/:id/retry', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) return reply.status(401).send({ error: 'x-tenant-id required' });

    const dispatch = await app.prisma.dispatch.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        items: {
          where: { status: 'FAILED' },
          include: { group: true },
        },
      },
    });

    if (!dispatch) return reply.status(404).send({ error: 'Dispatch not found' });
    if (dispatch.items.length === 0) {
      return reply.status(400).send({ error: 'No failed items to retry' });
    }

    // Reset failed items and re-enqueue
    await app.prisma.dispatchItem.updateMany({
      where: {
        dispatchId: dispatch.id,
        status: 'FAILED',
      },
      data: { status: 'PENDING', attempts: 0, lastError: null },
    });

    await app.prisma.dispatch.update({
      where: { id: dispatch.id },
      data: { status: 'PROCESSING', failedCount: 0 },
    });

    const jobs = dispatch.items.map((item, index) => ({
      name: `dispatch-retry-${dispatch.id}-${item.id}`,
      data: {
        dispatchId: dispatch.id,
        dispatchItemId: item.id,
        groupId: item.groupId,
        waGroupJid: item.group.waGroupId,
        sessionId: item.sessionId!,
        tenantId,
        copyTemplate: dispatch.copyTemplate,
        mediaUrl: dispatch.mediaUrl ?? undefined,
        mediaType: dispatch.mediaType ?? undefined,
      } satisfies DispatchJobData,
      opts: {
        delay: index * 15_000,
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 30_000 },
      },
    }));

    await dispatchQueue.addBulk(jobs);

    app.log.info({ dispatchId: dispatch.id, retryCount: dispatch.items.length }, 'Dispatch retry initiated');
    return { status: 'retrying', retryCount: dispatch.items.length };
  });
}
