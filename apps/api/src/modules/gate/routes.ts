import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

/**
 * Static plan limits — mirrors usage-gate middleware.
 */
const PLAN_LIMITS: Record<string, Record<string, number>> = {
  STARTER:    { promos: 1,        groups: 5,        dispatches: 50 },
  PRO:        { promos: -1,       groups: -1,       dispatches: -1 },
  ENTERPRISE: { promos: -1,       groups: -1,       dispatches: -1 },
};

const METRIC_MAP: Record<string, string> = {
  promos: 'promos_created',
  groups: 'groups_created',
  dispatches: 'dispatches_sent',
};

function currentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function gateRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /v1/gate/status
   *
   * Returns current usage vs limits for the authenticated tenant.
   */
  app.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const prisma = request.server.prisma;
    const tenantId = request.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, name: true },
    });

    if (!tenant) {
      reply.status(404).send({
        error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
      });
      return;
    }

    const limits = PLAN_LIMITS[tenant.plan] ?? PLAN_LIMITS.STARTER;
    const { start, end } = currentPeriod();

    // Fetch all usage metrics for this period in one query
    const metrics = await prisma.usageMetric.groupBy({
      by: ['metricType'],
      where: {
        tenantId,
        periodStart: { gte: start },
        periodEnd: { lte: end },
      },
      _sum: { value: true },
    });

    const usageMap: Record<string, number> = {};
    for (const m of metrics) {
      usageMap[m.metricType] = m._sum.value ?? 0;
    }

    const features = Object.entries(METRIC_MAP).map(([feature, metricType]) => {
      const limit = limits[feature] ?? 0;
      const used = usageMap[metricType] ?? 0;
      return {
        feature,
        limit: limit === -1 ? null : limit, // null = unlimited
        used,
        exceeded: limit !== -1 && used >= limit,
      };
    });

    reply.send({
      plan: tenant.plan,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      features,
    });
  });

  /**
   * POST /v1/gate/unlock
   *
   * Upgrades a STARTER tenant to PRO. Requires name + email (no payment).
   * Idempotent: if already PRO/ENTERPRISE, returns success.
   */
  app.post(
    '/unlock',
    async (
      request: FastifyRequest<{ Body: { name: string; email: string } }>,
      reply: FastifyReply,
    ) => {
      const prisma = request.server.prisma;
      const tenantId = request.tenantId;
      const body = request.body as { name?: string; email?: string } | undefined;

      if (!body?.name?.trim() || !body?.email?.trim()) {
        reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Both name and email are required.',
          },
        });
        return;
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true },
      });

      if (!tenant) {
        reply.status(404).send({
          error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
        });
        return;
      }

      // Already upgraded
      if (tenant.plan !== 'STARTER') {
        reply.send({ plan: tenant.plan, upgraded: false, message: 'Already on a premium plan.' });
        return;
      }

      // Find PRO plan definition
      const proPlan = await prisma.planDefinition.findUnique({
        where: { plan: 'PRO' },
      });

      const now = new Date();
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

      // Use a transaction: upgrade tenant + create subscription record
      await prisma.$transaction([
        prisma.tenant.update({
          where: { id: tenantId },
          data: { plan: 'PRO' },
        }),
        ...(proPlan
          ? [
              prisma.subscription.create({
                data: {
                  tenantId,
                  planDefinitionId: proPlan.id,
                  status: 'ACTIVE',
                  currentPeriodStart: periodStart,
                  currentPeriodEnd: periodEnd,
                  metadata: {
                    unlockName: body.name.trim(),
                    unlockEmail: body.email.trim(),
                    unlockedAt: now.toISOString(),
                  },
                },
              }),
            ]
          : []),
      ]);

      request.log.info(
        { tenantId, email: body.email.trim() },
        'Tenant upgraded to PRO via gate unlock',
      );

      reply.send({ plan: 'PRO', upgraded: true, message: 'Upgraded to PRO successfully!' });
    },
  );
}
