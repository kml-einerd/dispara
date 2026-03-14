import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { IntentClassifier, ProductRAG, ConversationalResponder, AgentEngine } from '@dispara/agent-engine';
import type { AgentConfig, ProductForRAG } from '@dispara/agent-engine';
import {
  updateAgentConfigSchema,
  agentInteractionsQuerySchema,
  agentStatsQuerySchema,
  interactSchema,
} from './schema.js';

const classifier = new IntentClassifier();

/**
 * Creates a ProductQueryFn that searches the Products table via Prisma.
 * Uses ILIKE text search on name + description, with optional category/maxPrice filters.
 */
function createProductQueryFn() {
  return async (
    tenantId: string,
    searchQuery: string,
    category?: string,
    maxPrice?: number,
  ): Promise<Array<ProductForRAG & { rank?: number }>> => {
    const where: Record<string, unknown> = {
      tenantId,
      isActive: true,
    };

    // Text search on name (ILIKE)
    if (searchQuery) {
      where.OR = [
        { name: { contains: searchQuery, mode: 'insensitive' } },
        { description: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = { contains: category, mode: 'insensitive' };
    }

    if (maxPrice !== undefined && maxPrice > 0) {
      where.price = { lte: maxPrice };
    }

    const products = await prisma.product.findMany({
      where,
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });

    return products.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      name: p.name,
      description: p.description,
      category: p.category,
      price: p.price,
      originalPrice: p.originalPrice ?? undefined,
      affiliateUrl: p.affiliateUrl,
      imageUrl: p.imageUrl ?? undefined,
      marketplace: p.marketplace,
      embedding: p.embedding.length > 0 ? p.embedding : undefined,
    }));
  };
}

const productQueryFn = createProductQueryFn();
const rag = new ProductRAG(productQueryFn);
const responder = new ConversationalResponder();

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

    const totalInteractions = await prisma.agentInteraction.count({
      where: dateFilter,
    });

    const successCount = await prisma.agentInteraction.count({
      where: { ...dateFilter, success: true },
    });

    const latencyAgg = await prisma.agentInteraction.aggregate({
      where: { ...dateFilter, latencyMs: { not: null } },
      _avg: { latencyMs: true },
    });

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

  // ── POST /v1/agent/interact — Full pipeline: classify → RAG → respond ──
  app.post('/interact', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const input = interactSchema.parse(request.body);

    // 1. Get or auto-create agent config for tenant
    let dbConfig = await prisma.agentConfig.findFirst({
      where: { tenantId: request.tenantId, agentType: 'conversational' },
    });

    if (!dbConfig) {
      dbConfig = await prisma.agentConfig.create({
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

    // 3. Search products via RAG (only for busca_produto)
    const ragResults = classification.intent === 'busca_produto'
      ? await rag.searchProducts(request.tenantId, input.message, classification.entities)
      : [];

    // 4. Generate response via responder
    const engineConfig: AgentConfig = {
      tenantId: request.tenantId,
      systemPrompt: dbConfig.systemPrompt ?? '',
      enabled: true,
      enabledGroups: [],
      cooldownMinutes: 0,
      maxResponsesPerHour: 999,
      responseDelayMinMs: 0,
      responseDelayMaxMs: 0,
    };

    const responseText = await responder.generateResponse(
      engineConfig,
      ragResults,
      input.message,
      classification.intent,
    );

    // 5. Map products for frontend
    const products = ragResults.map((r) => ({
      id: r.product.id,
      name: r.product.name,
      originalPrice: r.product.originalPrice ?? r.product.price,
      promoPrice: r.product.price,
      discountPercent: r.product.originalPrice
        ? Math.round((1 - r.product.price / r.product.originalPrice) * 100)
        : 0,
      imageUrl: r.product.imageUrl ?? '',
      productUrl: r.product.affiliateUrl,
      affiliateUrl: r.product.affiliateUrl,
      marketplace: r.product.marketplace,
      category: r.product.category || undefined,
    }));

    const latencyMs = Date.now() - startTime;
    const promoReady = products.length > 0 && classification.intent === 'busca_produto';

    // 6. Save interaction for analytics
    await prisma.agentInteraction.create({
      data: {
        agentConfigId: dbConfig.id,
        userId: request.userId,
        inputPayload: {
          message: input.message,
          context: input.context ?? null,
          intent: classification.intent,
          confidence: classification.confidence,
        } as unknown as Prisma.InputJsonValue,
        outputPayload: {
          response: responseText,
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
      'Agent interact completed',
    );

    reply.status(200).send({
      intent: classification.intent,
      confidence: classification.confidence,
      products,
      response: responseText,
      promoReady,
    });
  });
}
