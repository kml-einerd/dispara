import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Plan limits by tier. PlanDefinition rows in DB are the source of truth,
 * but we keep a static fallback so the middleware never needs an extra query
 * when the subscription/plan_definition join is already cached on the request.
 */
const PLAN_LIMITS: Record<string, { maxPromos: number; maxGroups: number; maxDispatches: number }> = {
  STARTER:    { maxPromos: 1,        maxGroups: 5,        maxDispatches: 50 },
  PRO:        { maxPromos: Infinity, maxGroups: Infinity,  maxDispatches: Infinity },
  ENTERPRISE: { maxPromos: Infinity, maxGroups: Infinity,  maxDispatches: Infinity },
};

type GatedFeature = 'promos' | 'groups' | 'dispatches';

/**
 * Maps a request URL + method to the feature being consumed, or null if the
 * request is not a creation action that should be gated.
 */
function detectFeature(url: string, method: string): GatedFeature | null {
  if (method !== 'POST') return null;

  if (url.startsWith('/v1/promos') && !url.includes('/variations')) return 'promos';
  if (url.startsWith('/v1/dispatches')) return 'dispatches';
  if (url.startsWith('/v1/groups')) return 'groups';

  return null;
}

/**
 * Returns the current month period boundaries (UTC).
 */
function currentPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

const FEATURE_TO_METRIC: Record<GatedFeature, string> = {
  promos: 'promos_created',
  dispatches: 'dispatches_sent',
  groups: 'groups_created',
};

const FEATURE_TO_LIMIT_KEY: Record<GatedFeature, 'maxPromos' | 'maxGroups' | 'maxDispatches'> = {
  promos: 'maxPromos',
  dispatches: 'maxDispatches',
  groups: 'maxGroups',
};

/**
 * Fastify onRequest hook that blocks creation endpoints when the tenant has
 * exceeded their plan limits for the current billing period.
 */
export async function usageGateMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const feature = detectFeature(request.url, request.method);
  if (!feature) return;

  const tenantId = request.tenantId;
  if (!tenantId) return;

  const prisma = request.server.prisma;

  // Fetch tenant plan
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });

  if (!tenant) return;

  const limits = PLAN_LIMITS[tenant.plan];
  if (!limits) return;

  const limitKey = FEATURE_TO_LIMIT_KEY[feature];
  const maxAllowed = limits[limitKey];

  // Unlimited plans skip the check
  if (maxAllowed === Infinity) return;

  const { start, end } = currentPeriod();
  const metricType = FEATURE_TO_METRIC[feature];

  // Sum usage for this metric in the current period
  const usage = await prisma.usageMetric.aggregate({
    where: {
      tenantId,
      metricType,
      periodStart: { gte: start },
      periodEnd: { lte: end },
    },
    _sum: { value: true },
  });

  const currentUsage = usage._sum.value ?? 0;

  if (currentUsage >= maxAllowed) {
    reply.status(403).send({
      error: {
        code: 'USAGE_LIMIT_EXCEEDED',
        message: `You have reached the ${feature} limit for your plan (${maxAllowed}). Upgrade to PRO for unlimited access.`,
        details: {
          feature,
          limit: maxAllowed,
          used: currentUsage,
          plan: tenant.plan,
        },
      },
    });
  }
}
