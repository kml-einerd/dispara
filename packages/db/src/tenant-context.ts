import { PrismaClient } from '@prisma/client';

/**
 * Models that require tenant_id scoping.
 * Every query to these models will automatically include tenant_id filtering.
 */
const TENANT_SCOPED_MODELS = new Set([
  'User',
  'AffiliateAccount',
  'WaSession',
  'Group',
  'GroupMember',
  'Promo',
  'PromoVariation',
  'Dispatch',
  'DispatchItem',
  'PromoFeed',
  'PromoFeedItem',
  'LinkSpot',
  'LinkClick',
  'AnalyticsEvent',
  'AgentConfig',
  'AgentInteraction',
  'Subscription',
  'UsageMetric',
]);

/**
 * Models that have tenant_id directly (not through a relation).
 * These get the where clause injected directly.
 */
const DIRECT_TENANT_MODELS = new Set([
  'User',
  'AffiliateAccount',
  'WaSession',
  'Group',
  'Promo',
  'Dispatch',
  'PromoFeed',
  'LinkSpot',
  'AnalyticsEvent',
  'AgentConfig',
  'Subscription',
  'UsageMetric',
]);

/**
 * Creates a tenant-scoped PrismaClient using Prisma Client Extensions.
 *
 * Uses the Prisma 6 `$extends` API with `$allOperations` to intercept
 * all database operations and automatically inject tenant_id filtering
 * for multi-tenant isolation.
 *
 * For queries (findMany, findFirst, findUnique, count, aggregate):
 * - Injects `tenantId` into the WHERE clause
 *
 * For mutations (create, update, delete):
 * - Injects `tenantId` into the data/where as appropriate
 *
 * @param client - PrismaClient instance to extend
 * @param tenantId - UUID of the tenant to scope all queries to
 * @returns Extended PrismaClient with tenant scoping applied
 *
 * @example
 * ```typescript
 * const prisma = new PrismaClient();
 * const tenantDb = createTenantExtension(prisma, 'tenant-uuid-here');
 *
 * // This query will automatically filter by tenant_id
 * const sessions = await tenantDb.waSession.findMany();
 * // SQL: SELECT * FROM wa_sessions WHERE tenant_id = 'tenant-uuid-here'
 * ```
 */
export function createTenantExtension(client: PrismaClient, tenantId: string) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !DIRECT_TENANT_MODELS.has(model)) {
            return query(args);
          }

          switch (operation) {
            // Read operations: inject tenantId into where clause
            case 'findFirst':
            case 'findMany':
            case 'count':
            case 'aggregate':
            case 'groupBy': {
              args.where = args.where ?? {};
              (args.where as Record<string, unknown>).tenantId = tenantId;
              break;
            }

            case 'findUnique':
            case 'findUniqueOrThrow': {
              // Add tenantId to the where clause for extra safety
              args.where = args.where ?? {};
              (args.where as Record<string, unknown>).tenantId = tenantId;
              break;
            }

            // Write operations
            case 'create': {
              args.data = args.data ?? {};
              (args.data as Record<string, unknown>).tenantId = tenantId;
              break;
            }

            case 'createMany': {
              if (Array.isArray(args.data)) {
                (args as Record<string, unknown>).data = (
                  args.data as Record<string, unknown>[]
                ).map((item) => ({
                  ...item,
                  tenantId,
                }));
              }
              break;
            }

            case 'update':
            case 'updateMany':
            case 'delete':
            case 'deleteMany': {
              args.where = args.where ?? {};
              (args.where as Record<string, unknown>).tenantId = tenantId;
              break;
            }

            case 'upsert': {
              args.where = args.where ?? {};
              (args.where as Record<string, unknown>).tenantId = tenantId;
              args.create = args.create ?? {};
              (args.create as Record<string, unknown>).tenantId = tenantId;
              break;
            }

            default:
              break;
          }

          return query(args);
        },
      },
    },
  });
}
