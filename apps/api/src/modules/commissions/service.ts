import type { PrismaClient, Marketplace } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';
import type { Commission, DateRange } from '@dispara/marketplace';
import { ShopeeAdapter } from '@dispara/marketplace';
import type {
  ListCommissionsInput,
  CommissionsResponse,
  CommissionsSummaryResponse,
  CommissionsByPromoResponse,
  DailyCommission,
  MarketplaceCommission,
} from './schema.js';

const CACHE_TTL = 300; // 5 minutes
const ESTIMATED_REVENUE_PER_CLICK = 0.15; // R$0.15 estimated per click

function periodToDays(period: string): number {
  switch (period) {
    case '7d': return 7;
    case '90d': return 90;
    default: return 30;
  }
}

function buildDateRange(period: string): DateRange {
  const days = periodToDays(period);
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start, end };
}

function aggregateByDay(commissions: Commission[]): DailyCommission[] {
  const map = new Map<string, { total: number; count: number }>();

  for (const c of commissions) {
    const date = c.orderDate.toISOString().split('T')[0]!;
    const entry = map.get(date) ?? { total: 0, count: 0 };
    entry.total += c.commissionAmount;
    entry.count += 1;
    map.set(date, entry);
  }

  return Array.from(map.entries())
    .map(([date, { total, count }]) => ({ date, total: Math.round(total * 100) / 100, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateByMarketplace(commissions: Commission[]): MarketplaceCommission[] {
  const map = new Map<string, { total: number; count: number; rateSum: number }>();

  for (const c of commissions) {
    const entry = map.get(c.marketplace) ?? { total: 0, count: 0, rateSum: 0 };
    entry.total += c.commissionAmount;
    entry.count += 1;
    entry.rateSum += c.commissionRate;
    map.set(c.marketplace, entry);
  }

  return Array.from(map.entries()).map(([marketplace, { total, count, rateSum }]) => ({
    marketplace,
    total: Math.round(total * 100) / 100,
    count,
    avgRate: Math.round((rateSum / count) * 100) / 100,
  }));
}

export class CommissionService {
  /**
   * Original list method — fetches from marketplace adapters (Shopee API).
   */
  static async list(
    tenantId: string,
    input: ListCommissionsInput,
    prisma: PrismaClient,
    redis: Redis,
    log?: FastifyBaseLogger,
  ): Promise<CommissionsResponse> {
    const cacheKey = `commissions:${tenantId}:${input.period}:${input.marketplace}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CommissionsResponse;
    }

    const dateRange = buildDateRange(input.period);
    const marketplaces: Marketplace[] = input.marketplace === 'all'
      ? ['SHOPEE', 'MERCADOLIVRE']
      : [input.marketplace as Marketplace];

    const allCommissions: Commission[] = [];
    const byMarketplace: MarketplaceCommission[] = [];

    for (const mp of marketplaces) {
      if (mp === 'MERCADOLIVRE') {
        byMarketplace.push({
          marketplace: 'MERCADOLIVRE',
          total: 0,
          count: 0,
          avgRate: 0,
          noDataAvailable: true,
        });
        continue;
      }

      const accounts = await prisma.affiliateAccount.findMany({
        where: { tenantId, marketplace: mp, status: 'ACTIVE' },
      });

      for (const account of accounts) {
        const creds = account.credentials as { appId: string; appSecret: string };
        const adapter = new ShopeeAdapter(creds);

        try {
          const commissions = await adapter.getCommissions(dateRange);
          allCommissions.push(...commissions);
        } catch (err) {
          log?.error({ err, accountId: account.id, marketplace: mp }, 'Failed to fetch commissions');
        }
      }
    }

    const aggregatedByMp = aggregateByMarketplace(allCommissions);
    const mergedByMarketplace = [
      ...aggregatedByMp,
      ...byMarketplace.filter(m => !aggregatedByMp.some(a => a.marketplace === m.marketplace)),
    ];

    const response: CommissionsResponse = {
      total: Math.round(allCommissions.reduce((sum, c) => sum + c.commissionAmount, 0) * 100) / 100,
      totalCount: allCommissions.length,
      period: input.period,
      byDay: aggregateByDay(allCommissions),
      byMarketplace: mergedByMarketplace,
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL);

    return response;
  }

  /**
   * Summary: aggregate clicks from link_clicks + link_spots within a date range.
   * Computes estimated revenue, groups by day and marketplace, finds top promos.
   */
  static async getSummary(
    tenantId: string,
    from: Date,
    to: Date,
    prisma: PrismaClient,
    redis: Redis,
    log?: FastifyBaseLogger,
  ): Promise<CommissionsSummaryResponse> {
    const cacheKey = `commissions:summary:${tenantId}:${from.toISOString()}:${to.toISOString()}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CommissionsSummaryResponse;
    }

    log?.debug({ tenantId, from, to }, 'Computing commissions summary');

    // Get all link spots for this tenant with their associated clicks
    const linkSpots = await prisma.linkSpot.findMany({
      where: { tenantId, isActive: true },
      include: {
        clicks: {
          where: {
            createdAt: { gte: from, lte: to },
          },
        },
      },
    });

    // We need to correlate linkSpots back to promos via affiliateUrl
    const promos = await prisma.promo.findMany({
      where: { tenantId },
      select: {
        id: true,
        productName: true,
        marketplace: true,
        affiliateUrl: true,
      },
    });

    // Build a map of affiliateUrl -> promo for quick lookups
    const urlToPromo = new Map<string, typeof promos[0]>();
    for (const p of promos) {
      urlToPromo.set(p.affiliateUrl, p);
    }

    let totalClicks = 0;
    const dayMap = new Map<string, { clicks: number; revenue: number }>();
    const mpMap = new Map<string, { clicks: number; revenue: number }>();
    const promoMap = new Map<string, { promo: typeof promos[0]; clicks: number; revenue: number }>();

    for (const spot of linkSpots) {
      const clickCount = spot.clicks.length;
      if (clickCount === 0) continue;

      totalClicks += clickCount;
      const revenue = clickCount * ESTIMATED_REVENUE_PER_CLICK;

      // Find the associated promo
      const promo = urlToPromo.get(spot.affiliateUrl) ?? urlToPromo.get(spot.targetUrl);

      // By day
      for (const click of spot.clicks) {
        const date = click.createdAt.toISOString().split('T')[0]!;
        const day = dayMap.get(date) ?? { clicks: 0, revenue: 0 };
        day.clicks += 1;
        day.revenue += ESTIMATED_REVENUE_PER_CLICK;
        dayMap.set(date, day);
      }

      // By marketplace
      const marketplace = promo?.marketplace ?? 'UNKNOWN';
      const mp = mpMap.get(marketplace) ?? { clicks: 0, revenue: 0 };
      mp.clicks += clickCount;
      mp.revenue += revenue;
      mpMap.set(marketplace, mp);

      // By promo
      if (promo) {
        const existing = promoMap.get(promo.id) ?? { promo, clicks: 0, revenue: 0 };
        existing.clicks += clickCount;
        existing.revenue += revenue;
        promoMap.set(promo.id, existing);
      }
    }

    const totalEstimatedRevenue = Math.round(totalClicks * ESTIMATED_REVENUE_PER_CLICK * 100) / 100;

    const byDay: DailyCommission[] = Array.from(dayMap.entries())
      .map(([date, { clicks, revenue }]) => ({
        date,
        total: Math.round(revenue * 100) / 100,
        count: clicks,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byMarketplace = Array.from(mpMap.entries())
      .map(([marketplace, { clicks, revenue }]) => ({
        marketplace,
        clicks,
        estimatedRevenue: Math.round(revenue * 100) / 100,
      }));

    const topPromos = Array.from(promoMap.values())
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10)
      .map(({ promo, clicks, revenue }) => ({
        promoId: promo.id,
        productName: promo.productName,
        clicks,
        estimatedRevenue: Math.round(revenue * 100) / 100,
      }));

    const response: CommissionsSummaryResponse = {
      totalClicks,
      totalEstimatedRevenue,
      byDay,
      byMarketplace,
      topPromos,
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL);

    return response;
  }

  /**
   * By-promo breakdown: each promo with clicks, dispatches, and estimated revenue.
   */
  static async getByPromo(
    tenantId: string,
    from: Date,
    to: Date,
    prisma: PrismaClient,
    redis: Redis,
    log?: FastifyBaseLogger,
  ): Promise<CommissionsByPromoResponse> {
    const cacheKey = `commissions:bypromo:${tenantId}:${from.toISOString()}:${to.toISOString()}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as CommissionsByPromoResponse;
    }

    log?.debug({ tenantId, from, to }, 'Computing commissions by promo');

    // Get promos with their dispatches count in the period
    const promosWithDispatches = await prisma.promo.findMany({
      where: { tenantId },
      select: {
        id: true,
        productName: true,
        marketplace: true,
        affiliateUrl: true,
        dispatches: {
          where: {
            createdAt: { gte: from, lte: to },
          },
          select: {
            id: true,
            sentCount: true,
          },
        },
      },
    });

    // Get link spots with clicks in the period
    const linkSpots = await prisma.linkSpot.findMany({
      where: { tenantId, isActive: true },
      include: {
        clicks: {
          where: {
            createdAt: { gte: from, lte: to },
          },
          select: { id: true },
        },
      },
    });

    // Map affiliateUrl -> click count
    const urlToClicks = new Map<string, number>();
    for (const spot of linkSpots) {
      const count = spot.clicks.length;
      if (count > 0) {
        const existing = urlToClicks.get(spot.affiliateUrl) ?? 0;
        urlToClicks.set(spot.affiliateUrl, existing + count);
        // Also map targetUrl
        const existingTarget = urlToClicks.get(spot.targetUrl) ?? 0;
        urlToClicks.set(spot.targetUrl, existingTarget + count);
      }
    }

    let totalClicks = 0;
    let totalDispatches = 0;
    let totalEstimatedRevenue = 0;

    const promoResults = promosWithDispatches.map((promo) => {
      const clicks = urlToClicks.get(promo.affiliateUrl) ?? 0;
      const dispatches = promo.dispatches.reduce((sum, d) => sum + d.sentCount, 0);
      const estimatedRevenue = Math.round(clicks * ESTIMATED_REVENUE_PER_CLICK * 100) / 100;

      totalClicks += clicks;
      totalDispatches += dispatches;
      totalEstimatedRevenue += estimatedRevenue;

      return {
        promoId: promo.id,
        productName: promo.productName,
        marketplace: promo.marketplace,
        clicks,
        dispatches,
        estimatedRevenue,
        affiliateUrl: promo.affiliateUrl,
      };
    });

    // Sort by clicks descending
    promoResults.sort((a, b) => b.clicks - a.clicks);

    const response: CommissionsByPromoResponse = {
      promos: promoResults,
      totalClicks,
      totalDispatches,
      totalEstimatedRevenue: Math.round(totalEstimatedRevenue * 100) / 100,
    };

    await redis.set(cacheKey, JSON.stringify(response), 'EX', CACHE_TTL);

    return response;
  }
}
