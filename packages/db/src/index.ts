import { PrismaClient } from '@prisma/client';
import { createTenantExtension } from './tenant-context.js';

// Re-export all Prisma types for convenience
export { Prisma, PrismaClient } from '@prisma/client';
export type {
  Tenant,
  User,
  AffiliateAccount,
  WaSession,
  Group,
  GroupMember,
  Promo,
  PromoVariation,
  Dispatch,
  DispatchItem,
  PromoFeed,
  PromoFeedItem,
  LinkSpot,
  LinkClick,
  AnalyticsEvent,
  AgentConfig,
  AgentInteraction,
  Subscription,
  PlanDefinition,
  UsageMetric,
} from '@prisma/client';

// Re-export enums
export {
  Plan,
  UserRole,
  Marketplace,
  AccountStatus,
  WaSessionStatus,
  PromoStatus,
  Channel,
  DispatchStatus,
  DispatchItemStatus,
  SubscriptionStatus,
} from '@prisma/client';

// Singleton instance for the application
let prismaInstance: PrismaClient | null = null;

/**
 * Creates and configures a PrismaClient instance with tenant context middleware.
 *
 * Uses a singleton pattern to avoid creating multiple database connections.
 * In development, logs queries for debugging. In production, only logs errors.
 *
 * @param options - Optional PrismaClient constructor options
 * @returns Configured PrismaClient instance
 *
 * @example
 * ```typescript
 * const db = createPrismaClient();
 * const tenants = await db.tenant.findMany();
 * ```
 */
export function createPrismaClient(options?: {
  datasourceUrl?: string;
  enableLogging?: boolean;
}): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  const logLevels: Array<'query' | 'info' | 'warn' | 'error'> =
    options?.enableLogging || process.env.NODE_ENV === 'development'
      ? ['query', 'warn', 'error']
      : ['error'];

  prismaInstance = new PrismaClient({
    log: logLevels,
    datasourceUrl: options?.datasourceUrl,
  });

  return prismaInstance;
}

/**
 * Creates a PrismaClient with tenant-scoped query extensions applied.
 * All queries through this client will be scoped to the specified tenant.
 *
 * @param tenantId - UUID of the tenant to scope queries to
 * @param options - Optional PrismaClient constructor options
 * @returns Extended PrismaClient with tenant scoping
 */
export function createTenantPrismaClient(
  tenantId: string,
  options?: { datasourceUrl?: string; enableLogging?: boolean },
) {
  const client = new PrismaClient({
    log: options?.enableLogging ? ['query', 'warn', 'error'] : ['error'],
    datasourceUrl: options?.datasourceUrl,
  });

  return createTenantExtension(client, tenantId);
}

/**
 * Disconnects the singleton PrismaClient instance.
 * Call this during graceful shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

// Re-export tenant context utilities
export { createTenantExtension } from './tenant-context.js';
