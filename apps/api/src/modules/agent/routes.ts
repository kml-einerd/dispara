import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  updateAgentConfigSchema,
  agentInteractionsQuerySchema,
  agentStatsQuerySchema,
} from './schema.js';

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /v1/agent/config — Upsert agent config for tenant ──
  app.post('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = updateAgentConfigSchema.parse(request.body);

    const config = await prisma.agentConfig.upsert({
      where: {
        tenantId_agentType: {
          tenantId: request.tenantId,
          agentType: 'conversational',
        },
      },
      create: {
        tenantId: request.tenantId,
        agentType: 'conversational',
        systemPrompt: input.systemPrompt ?? null,
        model: input.model ?? 'claude-sonnet-4-6',
        temperature: input.temperature ?? 0.7,
        maxTokens: input.maxTokens ?? 1024,
        isActive: input.isActive ?? true,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
      update: {
        ...(input.systemPrompt !== undefined && { systemPrompt: input.systemPrompt }),
        ...(input.model !== undefined && { model: input.model }),
        ...(input.temperature !== undefined && { temperature: input.temperature }),
        ...(input.maxTokens !== undefined && { maxTokens: input.maxTokens }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.metadata !== undefined && { metadata: input.metadata as Prisma.InputJsonValue }),
      },
    });

    app.log.info({ tenantId: request.tenantId, configId: config.id }, 'Agent config upserted');
    reply.status(200).send({ config });
  });

  // ── GET /v1/agent/config — Get agent config for tenant ──
  app.get('/config', async (request: FastifyRequest, reply: FastifyReply) => {
    const config = await prisma.agentConfig.findFirst({
      where: {
        tenantId: request.tenantId,
        agentType: 'conversational',
      },
    });

    if (!config) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'Agent config not found. Create one via POST /v1/agent/config.',
        },
      });
      return;
    }

    reply.status(200).send({ config });
  });

  // ── GET /v1/agent/interactions — Paginated interactions list ──
  app.get('/interactions', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = agentInteractionsQuerySchema.parse(request.query);

    // Find config for this tenant first
    const config = await prisma.agentConfig.findFirst({
      where: { tenantId: request.tenantId, agentType: 'conversational' },
      select: { id: true },
    });

    if (!config) {
      reply.status(200).send({ data: [], cursor: null });
      return;
    }

    const where: Record<string, unknown> = {
      agentConfigId: config.id,
    };

    if (query.cursor) {
      where.id = { lt: query.cursor };
    }

    if (query.intent) {
      where.inputPayload = {
        path: ['intent'],
        equals: query.intent,
      };
    }

    if (query.groupId) {
      where.inputPayload = {
        ...((where.inputPayload as Record<string, unknown>) ?? {}),
        path: ['groupId'],
        equals: query.groupId,
      };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate && { gte: new Date(query.startDate) }),
        ...(query.endDate && { lte: new Date(query.endDate) }),
      };
    }

    const interactions = await prisma.agentInteraction.findMany({
      where,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
    });

    const cursor = interactions.length === query.limit
      ? interactions[interactions.length - 1]?.id
      : null;

    reply.status(200).send({ data: interactions, cursor });
  });

  // ── GET /v1/agent/stats — Aggregated agent stats ──
  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const { period } = agentStatsQuerySchema.parse(request.query);

    const config = await prisma.agentConfig.findFirst({
      where: { tenantId: request.tenantId, agentType: 'conversational' },
      select: { id: true },
    });

    if (!config) {
      reply.status(200).send({
        totalInteractions: 0,
        byIntent: {},
        avgLatencyMs: 0,
        successRate: 0,
        topGroups: [],
      });
      return;
    }

    const now = new Date();
    const periodStart = new Date(now);
    if (period === 'day') periodStart.setDate(now.getDate() - 1);
    else if (period === 'week') periodStart.setDate(now.getDate() - 7);
    else periodStart.setMonth(now.getMonth() - 1);

    const dateFilter = {
      agentConfigId: config.id,
      createdAt: { gte: periodStart },
    };

    // Total interactions count
    const totalInteractions = await prisma.agentInteraction.count({
      where: dateFilter,
    });

    // Success count for rate calculation
    const successCount = await prisma.agentInteraction.count({
      where: { ...dateFilter, success: true },
    });

    // Average latency
    const latencyAgg = await prisma.agentInteraction.aggregate({
      where: { ...dateFilter, latencyMs: { not: null } },
      _avg: { latencyMs: true },
    });

    // Interactions by intent (using raw query since groupBy on JSON fields is complex)
    const allInteractions = await prisma.agentInteraction.findMany({
      where: dateFilter,
      select: { inputPayload: true },
    });

    const byIntent: Record<string, number> = {};
    const groupCounts: Record<string, number> = {};

    for (const interaction of allInteractions) {
      const payload = interaction.inputPayload as Record<string, unknown> | null;
      if (payload) {
        const intent = (payload.intent as string) ?? 'UNKNOWN';
        byIntent[intent] = (byIntent[intent] ?? 0) + 1;

        const groupId = payload.groupId as string | undefined;
        if (groupId) {
          groupCounts[groupId] = (groupCounts[groupId] ?? 0) + 1;
        }
      }
    }

    // Top groups sorted by interaction count
    const topGroups = Object.entries(groupCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([groupId, count]) => ({ groupId, count }));

    reply.status(200).send({
      totalInteractions,
      byIntent,
      avgLatencyMs: Math.round(latencyAgg._avg.latencyMs ?? 0),
      successRate: totalInteractions > 0 ? +(successCount / totalInteractions).toFixed(4) : 0,
      topGroups,
      period,
      periodStart: periodStart.toISOString(),
    });
  });
}
