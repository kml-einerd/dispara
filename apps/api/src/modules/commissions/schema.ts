import { z } from 'zod';

export const listCommissionsSchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
  marketplace: z.enum(['SHOPEE', 'MERCADOLIVRE', 'all']).default('all'),
});

export type ListCommissionsInput = z.infer<typeof listCommissionsSchema>;

export const summaryQuerySchema = z.object({
  from: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  to: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }),
});

export type SummaryQueryInput = z.infer<typeof summaryQuerySchema>;

export const byPromoQuerySchema = z.object({
  from: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }),
  to: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }),
});

export type ByPromoQueryInput = z.infer<typeof byPromoQuerySchema>;

export interface DailyCommission {
  date: string;
  total: number;
  count: number;
}

export interface MarketplaceCommission {
  marketplace: string;
  total: number;
  count: number;
  avgRate: number;
  noDataAvailable?: boolean;
}

export interface CommissionsResponse {
  total: number;
  totalCount: number;
  period: string;
  byDay: DailyCommission[];
  byMarketplace: MarketplaceCommission[];
}

export interface CommissionsSummaryResponse {
  totalClicks: number;
  totalEstimatedRevenue: number;
  byDay: DailyCommission[];
  byMarketplace: { marketplace: string; clicks: number; estimatedRevenue: number }[];
  topPromos: { promoId: string; productName: string; clicks: number; estimatedRevenue: number }[];
}

export interface CommissionsByPromoResponse {
  promos: {
    promoId: string;
    productName: string;
    marketplace: string;
    clicks: number;
    dispatches: number;
    estimatedRevenue: number;
    affiliateUrl: string;
  }[];
  totalClicks: number;
  totalDispatches: number;
  totalEstimatedRevenue: number;
}
