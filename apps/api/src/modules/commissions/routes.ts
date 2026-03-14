import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listCommissionsSchema, summaryQuerySchema, byPromoQuerySchema } from './schema.js';
import { CommissionService } from './service.js';

export async function commissionRoutes(app: FastifyInstance): Promise<void> {
  // Original list endpoint (marketplace adapter based)
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = listCommissionsSchema.parse(request.query);
    const result = await CommissionService.list(
      request.tenantId,
      input,
      app.prisma,
      app.redis,
      request.log,
    );
    reply.status(200).send(result);
  });

  // Summary: aggregate clicks from link_clicks, grouped by day + marketplace + top promos
  app.get('/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = summaryQuerySchema.parse(request.query);
    const result = await CommissionService.getSummary(
      request.tenantId,
      new Date(from),
      new Date(to),
      app.prisma,
      app.redis,
      request.log,
    );
    reply.status(200).send(result);
  });

  // Breakdown by promo: clicks, dispatches, estimated revenue per promo
  app.get('/by-promo', async (request: FastifyRequest, reply: FastifyReply) => {
    const { from, to } = byPromoQuerySchema.parse(request.query);
    const result = await CommissionService.getByPromo(
      request.tenantId,
      new Date(from),
      new Date(to),
      app.prisma,
      app.redis,
      request.log,
    );
    reply.status(200).send(result);
  });
}
