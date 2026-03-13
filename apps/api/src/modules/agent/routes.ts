import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { IntentClassifier } from '@dispara/agent-engine';
import {
  updateAgentConfigSchema,
  agentInteractionsQuerySchema,
  agentStatsQuerySchema,
  interactSchema,
} from './schema.js';

const classifier = new IntentClassifier();

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

  // ── POST /v1/agent/interact — Copilot chat interaction ──
  app.post('/interact', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const input = interactSchema.parse(request.body);

    // 1. Get or auto-create agent config for tenant
    let config = await prisma.agentConfig.findFirst({
      where: { tenantId: request.tenantId, agentType: 'conversational' },
    });

    if (!config) {
      config = await prisma.agentConfig.create({
        data: {
          tenantId: request.tenantId,
          agentType: 'conversational',
          model: 'claude-sonnet-4-6',
          temperature: 0.7,
          maxTokens: 1024,
          isActive: true,
        },
      });
    }

    // 2. Classify intent
    const classification = await classifier.classifyIntent(input.message);

    // 3. Search tenant's active promos in DB
    const searchTerms = classification.entities.productName
      ?? classification.entities.brand
      ?? classification.entities.category
      ?? input.message;

    const promos = await prisma.promo.findMany({
      where: {
        tenantId: request.tenantId,
        status: 'ACTIVE',
        productName: { contains: searchTerms, mode: 'insensitive' },
      },
      include: { variations: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    // If keyword search found nothing, fall back to latest active promos
    const results = promos.length > 0
      ? promos
      : await prisma.promo.findMany({
          where: { tenantId: request.tenantId, status: 'ACTIVE' },
          include: { variations: true },
          take: 5,
          orderBy: { createdAt: 'desc' },
        });

    // 4. Map promos to frontend Product format
    const products = results.map((p) => ({
      id: p.id,
      name: p.productName,
      originalPrice: Number(p.originalPrice),
      promoPrice: Number(p.promoPrice),
      discountPercent: p.discountPercent,
      imageUrl: p.imageUrl ?? '',
      productUrl: p.productUrl,
      affiliateUrl: p.affiliateUrl,
      marketplace: p.marketplace,
      category: p.category ?? undefined,
      variations: p.variations.map((v) => ({
        id: v.id,
        label: v.label,
        copyText: v.copyText,
        isDefault: v.isDefault,
      })),
    }));

    // 5. Build a text response based on intent
    let response: string;
    const promoReady = products.length > 0 && classification.intent !== 'off_topic';

    if (classification.intent === 'off_topic') {
      response = 'Não entendi 😅 Tente digitar o nome de um produto, colar um link ou enviar uma foto!';
    } else if (products.length === 0) {
      response = 'Não encontrei promoções ativas no momento. Cadastre produtos na aba Promos primeiro!';
    } else {
      response = `Encontrei ${products.length} ${products.length === 1 ? 'produto' : 'produtos'}! Clique no que quiser para gerar o anúncio 👆`;
    }

    const latencyMs = Date.now() - startTime;

    // 6. Save interaction for analytics
    await prisma.agentInteraction.create({
      data: {
        agentConfigId: config.id,
        userId: request.userId,
        inputPayload: {
          message: input.message,
          context: input.context ?? null,
          intent: classification.intent,
          confidence: classification.confidence,
        } as unknown as Prisma.InputJsonValue,
        outputPayload: {
          productCount: products.length,
          intent: classification.intent,
          promoReady,
        } as unknown as Prisma.InputJsonValue,
        latencyMs,
        success: true,
      },
    });

    app.log.info(
      { tenantId: request.tenantId, intent: classification.intent, productCount: products.length, latencyMs },
      'Copilot interact completed',
    );

    reply.status(200).send({
      intent: classification.intent,
      confidence: classification.confidence,
      products,
      response,
      promoReady,
    });
  });
}
