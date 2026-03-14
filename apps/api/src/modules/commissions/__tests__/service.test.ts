import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Prisma ──
const mockPrisma = vi.hoisted(() => ({
  affiliateAccount: {
    findMany: vi.fn(),
  },
}));

vi.mock('../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// ── Mock ShopeeAdapter ──
const mockGetCommissions = vi.hoisted(() => vi.fn());

vi.mock('@dispara/marketplace', () => ({
  ShopeeAdapter: vi.fn().mockImplementation(() => ({
    getCommissions: mockGetCommissions,
  })),
}));

// ── Mock Redis ──
const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

import { CommissionService } from '../service.js';
import type { Commission } from '@dispara/marketplace';

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

const mockCommissions: Commission[] = [
  {
    orderId: 'ORD001',
    itemId: 'ITEM001',
    productName: 'Echo Dot 5',
    orderAmount: 229.0,
    commissionRate: 12.5,
    commissionAmount: 28.63,
    status: 'approved',
    orderDate: new Date('2026-03-10'),
    marketplace: 'SHOPEE',
  },
  {
    orderId: 'ORD002',
    itemId: 'ITEM002',
    productName: 'Fone Bluetooth',
    orderAmount: 89.9,
    commissionRate: 10.0,
    commissionAmount: 8.99,
    status: 'pending',
    orderDate: new Date('2026-03-10'),
    marketplace: 'SHOPEE',
  },
  {
    orderId: 'ORD003',
    itemId: 'ITEM003',
    productName: 'Cabo USB-C',
    orderAmount: 29.9,
    commissionRate: 8.0,
    commissionAmount: 2.39,
    status: 'approved',
    orderDate: new Date('2026-03-12'),
    marketplace: 'SHOPEE',
  },
];

const mockAccount = {
  id: 'acc-001',
  tenantId: TENANT_ID,
  marketplace: 'SHOPEE',
  label: 'Shopee Principal',
  credentials: { appId: 'test-app', appSecret: 'test-secret' },
  status: 'ACTIVE',
  lastSyncAt: null,
  expiresAt: null,
};

describe('CommissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
  });

  describe('list()', () => {
    it('returns aggregated commissions from Shopee', async () => {
      mockPrisma.affiliateAccount.findMany.mockResolvedValue([mockAccount]);
      mockGetCommissions.mockResolvedValue(mockCommissions);

      const result = await CommissionService.list(
        TENANT_ID,
        { period: '30d', marketplace: 'SHOPEE' },
        mockPrisma as any,
        mockRedis as any,
      );

      expect(result.total).toBe(40.01);
      expect(result.totalCount).toBe(3);
      expect(result.period).toBe('30d');
      expect(result.byDay).toHaveLength(2);
      expect(result.byMarketplace).toHaveLength(1);
      expect(result.byMarketplace[0]!.marketplace).toBe('SHOPEE');
    });

    it('aggregates by day correctly', async () => {
      mockPrisma.affiliateAccount.findMany.mockResolvedValue([mockAccount]);
      mockGetCommissions.mockResolvedValue(mockCommissions);

      const result = await CommissionService.list(
        TENANT_ID,
        { period: '7d', marketplace: 'SHOPEE' },
        mockPrisma as any,
        mockRedis as any,
      );

      const mar10 = result.byDay.find(d => d.date === '2026-03-10');
      expect(mar10).toBeDefined();
      expect(mar10!.count).toBe(2);
      expect(mar10!.total).toBe(37.62);

      const mar12 = result.byDay.find(d => d.date === '2026-03-12');
      expect(mar12).toBeDefined();
      expect(mar12!.count).toBe(1);
      expect(mar12!.total).toBe(2.39);
    });

    it('returns ML with noDataAvailable flag when marketplace=all', async () => {
      mockPrisma.affiliateAccount.findMany.mockResolvedValue([mockAccount]);
      mockGetCommissions.mockResolvedValue([]);

      const result = await CommissionService.list(
        TENANT_ID,
        { period: '30d', marketplace: 'all' },
        mockPrisma as any,
        mockRedis as any,
      );

      const ml = result.byMarketplace.find(m => m.marketplace === 'MERCADOLIVRE');
      expect(ml).toBeDefined();
      expect(ml!.noDataAvailable).toBe(true);
      expect(ml!.total).toBe(0);
    });

    it('returns cached response when available', async () => {
      const cached = { total: 100, totalCount: 5, period: '30d', byDay: [], byMarketplace: [] };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await CommissionService.list(
        TENANT_ID,
        { period: '30d', marketplace: 'SHOPEE' },
        mockPrisma as any,
        mockRedis as any,
      );

      expect(result).toEqual(cached);
      expect(mockPrisma.affiliateAccount.findMany).not.toHaveBeenCalled();
    });

    it('caches response with 5min TTL', async () => {
      mockPrisma.affiliateAccount.findMany.mockResolvedValue([]);
      mockGetCommissions.mockResolvedValue([]);

      await CommissionService.list(
        TENANT_ID,
        { period: '7d', marketplace: 'SHOPEE' },
        mockPrisma as any,
        mockRedis as any,
      );

      expect(mockRedis.set).toHaveBeenCalledWith(
        `commissions:${TENANT_ID}:7d:SHOPEE`,
        expect.any(String),
        'EX',
        300,
      );
    });

    it('handles adapter errors gracefully without failing entire request', async () => {
      mockPrisma.affiliateAccount.findMany.mockResolvedValue([mockAccount]);
      mockGetCommissions.mockRejectedValue(new Error('Shopee API down'));

      const result = await CommissionService.list(
        TENANT_ID,
        { period: '30d', marketplace: 'SHOPEE' },
        mockPrisma as any,
        mockRedis as any,
      );

      expect(result.total).toBe(0);
      expect(result.totalCount).toBe(0);
    });

    it('handles multiple accounts for same marketplace', async () => {
      const account2 = { ...mockAccount, id: 'acc-002', label: 'Shopee 2' };
      mockPrisma.affiliateAccount.findMany.mockResolvedValue([mockAccount, account2]);
      mockGetCommissions
        .mockResolvedValueOnce(mockCommissions.slice(0, 2))
        .mockResolvedValueOnce(mockCommissions.slice(2));

      const result = await CommissionService.list(
        TENANT_ID,
        { period: '30d', marketplace: 'SHOPEE' },
        mockPrisma as any,
        mockRedis as any,
      );

      expect(result.totalCount).toBe(3);
      expect(mockGetCommissions).toHaveBeenCalledTimes(2);
    });

    it('returns empty when no affiliate accounts exist', async () => {
      mockPrisma.affiliateAccount.findMany.mockResolvedValue([]);

      const result = await CommissionService.list(
        TENANT_ID,
        { period: '30d', marketplace: 'SHOPEE' },
        mockPrisma as any,
        mockRedis as any,
      );

      expect(result.total).toBe(0);
      expect(result.totalCount).toBe(0);
      expect(result.byDay).toHaveLength(0);
    });

    it('computes avgRate correctly per marketplace', async () => {
      mockPrisma.affiliateAccount.findMany.mockResolvedValue([mockAccount]);
      mockGetCommissions.mockResolvedValue(mockCommissions);

      const result = await CommissionService.list(
        TENANT_ID,
        { period: '30d', marketplace: 'SHOPEE' },
        mockPrisma as any,
        mockRedis as any,
      );

      const shopee = result.byMarketplace[0]!;
      // (12.5 + 10.0 + 8.0) / 3 = 10.17
      expect(shopee.avgRate).toBe(10.17);
    });
  });
});
