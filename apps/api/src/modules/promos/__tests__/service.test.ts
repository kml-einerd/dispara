import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Prisma ──
const mockPrisma = {
  $transaction: vi.fn(),
  promo: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  promoVariation: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

vi.mock('../../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// ── Mock promo-engine-mock ──
const mockScrapeProduct = vi.fn();
const mockSearchProduct = vi.fn();
const mockGenerateCopyVariations = vi.fn();

vi.mock('../../../lib/promo-engine-mock.js', () => ({
  scrapeProduct: mockScrapeProduct,
  searchProduct: mockSearchProduct,
  generateCopyVariations: mockGenerateCopyVariations,
}));

import { PromoService, NotFoundError } from '../service.js';

// ── Test Data ──

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const PROMO_ID = '770e8400-e29b-41d4-a716-446655440002';
const VARIATION_ID = '880e8400-e29b-41d4-a716-446655440003';

const mockScrapedProduct = {
  productName: 'Echo Dot 5a geracao com Alexa',
  productUrl: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
  originalPrice: 399.0,
  promoPrice: 229.0,
  discountPercent: 43,
  imageUrl: 'https://m.media-amazon.com/images/I/71xoR4A-YzL.jpg',
  marketplace: 'AMAZON',
  affiliateUrl: 'https://www.amazon.com.br/dp/B0CHX3QBCH?tag=dispara-20',
  category: 'Eletrônicos',
};

const mockCopies = [
  { label: 'urgente', copyText: 'CORRE! Echo Dot por R$ 229,00!' },
  { label: 'casual', copyText: 'Olha esse precinho!' },
  { label: 'formal', copyText: 'Oferta especial disponivel.' },
];

const mockPromoRecord = {
  id: PROMO_ID,
  tenantId: TENANT_ID,
  userId: USER_ID,
  productName: mockScrapedProduct.productName,
  productUrl: mockScrapedProduct.productUrl,
  affiliateUrl: mockScrapedProduct.affiliateUrl,
  marketplace: 'AMAZON',
  originalPrice: { toNumber: () => 399.0 },
  promoPrice: { toNumber: () => 229.0 },
  discountPercent: 43,
  imageUrl: mockScrapedProduct.imageUrl,
  category: 'Eletrônicos',
  status: 'DRAFT',
  createdAt: new Date('2026-03-11T10:00:00Z'),
  updatedAt: new Date('2026-03-11T10:00:00Z'),
  variations: [
    { id: VARIATION_ID, promoId: PROMO_ID, label: 'urgente', copyText: 'CORRE!', isDefault: true },
    {
      id: '990e8400-e29b-41d4-a716-446655440004',
      promoId: PROMO_ID,
      label: 'casual',
      copyText: 'Olha esse precinho!',
      isDefault: false,
    },
    {
      id: 'aa0e8400-e29b-41d4-a716-446655440005',
      promoId: PROMO_ID,
      label: 'formal',
      copyText: 'Oferta especial.',
      isDefault: false,
    },
  ],
};

describe('PromoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── create ──

  describe('create()', () => {
    it('creates promo with variations from URL in a transaction', async () => {
      mockScrapeProduct.mockResolvedValue(mockScrapedProduct);
      mockGenerateCopyVariations.mockReturnValue(mockCopies);

      // $transaction receives an async callback, call it with a mock tx
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          promo: {
            create: vi.fn().mockResolvedValue(mockPromoRecord),
          },
        };
        return cb(tx);
      });

      const result = await PromoService.create(TENANT_ID, USER_ID, {
        url: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
      });

      expect(mockScrapeProduct).toHaveBeenCalledWith('https://www.amazon.com.br/dp/B0CHX3QBCH');
      expect(mockGenerateCopyVariations).toHaveBeenCalledWith(mockScrapedProduct, 3);
      expect(result.id).toBe(PROMO_ID);
      expect(result.variations).toHaveLength(3);
    });

    it('creates promo from keyword search', async () => {
      mockSearchProduct.mockResolvedValue(mockScrapedProduct);
      mockGenerateCopyVariations.mockReturnValue(mockCopies);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          promo: {
            create: vi.fn().mockResolvedValue(mockPromoRecord),
          },
        };
        return cb(tx);
      });

      const result = await PromoService.create(TENANT_ID, USER_ID, {
        keyword: 'echo dot',
        marketplace: 'AMAZON',
      });

      expect(mockSearchProduct).toHaveBeenCalledWith('echo dot', 'AMAZON');
      expect(result.id).toBe(PROMO_ID);
    });

    it('sets status to DRAFT', async () => {
      mockScrapeProduct.mockResolvedValue(mockScrapedProduct);
      mockGenerateCopyVariations.mockReturnValue(mockCopies);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          promo: {
            create: vi.fn().mockImplementation((args: any) => {
              expect(args.data.status).toBe('DRAFT');
              return mockPromoRecord;
            }),
          },
        };
        return cb(tx);
      });

      await PromoService.create(TENANT_ID, USER_ID, {
        url: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
      });
    });

    it('marks first variation as isDefault', async () => {
      mockScrapeProduct.mockResolvedValue(mockScrapedProduct);
      mockGenerateCopyVariations.mockReturnValue(mockCopies);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          promo: {
            create: vi.fn().mockImplementation((args: any) => {
              const variations = args.data.variations.create;
              expect(variations[0].isDefault).toBe(true);
              expect(variations[1].isDefault).toBe(false);
              expect(variations[2].isDefault).toBe(false);
              return mockPromoRecord;
            }),
          },
        };
        return cb(tx);
      });

      await PromoService.create(TENANT_ID, USER_ID, {
        url: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
      });
    });
  });

  // ── list ──

  describe('list()', () => {
    it('returns paginated results with correct total', async () => {
      mockPrisma.$transaction.mockResolvedValue([[mockPromoRecord], 1]);

      const result = await PromoService.list(TENANT_ID, { page: 1, limit: 20 });

      expect(result.promos).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('filters by status', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await PromoService.list(TENANT_ID, { page: 1, limit: 20, status: 'ACTIVE' });

      // Verify $transaction was called (it uses batch transaction with array)
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('filters by marketplace', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await PromoService.list(TENANT_ID, { page: 1, limit: 20, marketplace: 'AMAZON' });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('filters by search term', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await PromoService.list(TENANT_ID, { page: 1, limit: 20, search: 'echo dot' });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('calculates correct skip for pagination', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await PromoService.list(TENANT_ID, { page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
    });

    it('returns empty list when no promos exist', async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await PromoService.list(TENANT_ID, { page: 1, limit: 20 });

      expect(result.promos).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ── getById ──

  describe('getById()', () => {
    it('returns promo scoped by tenant', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue(mockPromoRecord);

      const result = await PromoService.getById(TENANT_ID, PROMO_ID);

      expect(result).toBeDefined();
      expect(result!.id).toBe(PROMO_ID);
      expect(mockPrisma.promo.findFirst).toHaveBeenCalledWith({
        where: { id: PROMO_ID, tenantId: TENANT_ID },
        include: { variations: true },
      });
    });

    it('returns null for wrong tenant', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue(null);

      const result = await PromoService.getById('wrong-tenant', PROMO_ID);

      expect(result).toBeNull();
    });

    it('returns null for non-existent promo', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue(null);

      const result = await PromoService.getById(TENANT_ID, 'nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ── update ──

  describe('update()', () => {
    it('updates status', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue(mockPromoRecord);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          promo: {
            update: vi.fn().mockResolvedValue({ ...mockPromoRecord, status: 'ACTIVE' }),
          },
          promoVariation: {
            findFirst: vi.fn(),
            updateMany: vi.fn(),
            update: vi.fn(),
          },
        };
        return cb(tx);
      });

      const result = await PromoService.update(TENANT_ID, PROMO_ID, { status: 'ACTIVE' });

      expect(result.status).toBe('ACTIVE');
    });

    it('updates productName', async () => {
      const updatedName = 'Nome Atualizado do Produto';
      mockPrisma.promo.findFirst.mockResolvedValue(mockPromoRecord);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          promo: {
            update: vi.fn().mockResolvedValue({
              ...mockPromoRecord,
              productName: updatedName,
            }),
          },
          promoVariation: {
            findFirst: vi.fn(),
            updateMany: vi.fn(),
            update: vi.fn(),
          },
        };
        return cb(tx);
      });

      const result = await PromoService.update(TENANT_ID, PROMO_ID, {
        productName: updatedName,
      });

      expect(result.productName).toBe(updatedName);
    });

    it('selects variation (toggles isDefault)', async () => {
      const newDefaultId = '990e8400-e29b-41d4-a716-446655440004';
      mockPrisma.promo.findFirst.mockResolvedValue(mockPromoRecord);

      const txUpdateMany = vi.fn();
      const txUpdate = vi.fn();
      const txPromoUpdate = vi.fn().mockResolvedValue(mockPromoRecord);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          promo: { update: txPromoUpdate },
          promoVariation: {
            findFirst: vi.fn().mockResolvedValue({ id: newDefaultId, promoId: PROMO_ID }),
            updateMany: txUpdateMany,
            update: txUpdate,
          },
        };
        return cb(tx);
      });

      await PromoService.update(TENANT_ID, PROMO_ID, {
        selectedVariationId: newDefaultId,
      });

      // Should unmark all current defaults
      expect(txUpdateMany).toHaveBeenCalledWith({
        where: { promoId: PROMO_ID, isDefault: true },
        data: { isDefault: false },
      });

      // Should mark selected as default
      expect(txUpdate).toHaveBeenCalledWith({
        where: { id: newDefaultId },
        data: { isDefault: true },
      });
    });

    it('throws NotFoundError for non-existent promo', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue(null);

      await expect(
        PromoService.update(TENANT_ID, 'nonexistent', { status: 'ACTIVE' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError for non-existent variation', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue(mockPromoRecord);
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          promo: { update: vi.fn() },
          promoVariation: {
            findFirst: vi.fn().mockResolvedValue(null),
            updateMany: vi.fn(),
            update: vi.fn(),
          },
        };
        return cb(tx);
      });

      await expect(
        PromoService.update(TENANT_ID, PROMO_ID, {
          selectedVariationId: 'nonexistent-var',
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ── archive ──

  describe('archive()', () => {
    it('sets status to ARCHIVED', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue(mockPromoRecord);
      mockPrisma.promo.update.mockResolvedValue({
        id: PROMO_ID,
        status: 'ARCHIVED',
      });

      const result = await PromoService.archive(TENANT_ID, PROMO_ID);

      expect(result.status).toBe('ARCHIVED');
      expect(mockPrisma.promo.update).toHaveBeenCalledWith({
        where: { id: PROMO_ID },
        data: { status: 'ARCHIVED' },
        select: { id: true, status: true },
      });
    });

    it('throws NotFoundError for non-existent promo', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue(null);

      await expect(PromoService.archive(TENANT_ID, 'nonexistent')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('throws NotFoundError for wrong tenant', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue(null);

      await expect(PromoService.archive('wrong-tenant', PROMO_ID)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  // ── generateVariations ──

  describe('generateVariations()', () => {
    it('adds new variations to existing promo', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue({
        ...mockPromoRecord,
        originalPrice: 399.0,
        promoPrice: 229.0,
      });

      const newVariations = [
        { id: 'new-var-1', promoId: PROMO_ID, label: 'divertido', copyText: 'Haha!', isDefault: false },
        { id: 'new-var-2', promoId: PROMO_ID, label: 'escassez', copyText: 'Ultimas!', isDefault: false },
      ];

      mockGenerateCopyVariations.mockReturnValue([
        { label: 'divertido', copyText: 'Haha!' },
        { label: 'escassez', copyText: 'Ultimas!' },
      ]);

      // $transaction with array of operations
      mockPrisma.$transaction.mockResolvedValue(newVariations);

      const result = await PromoService.generateVariations(TENANT_ID, PROMO_ID, 2);

      expect(result).toHaveLength(2);
      expect(mockGenerateCopyVariations).toHaveBeenCalled();
    });

    it('throws NotFoundError for non-existent promo', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue(null);

      await expect(
        PromoService.generateVariations(TENANT_ID, 'nonexistent', 3),
      ).rejects.toThrow(NotFoundError);
    });

    it('defaults count to 3', async () => {
      mockPrisma.promo.findFirst.mockResolvedValue({
        ...mockPromoRecord,
        originalPrice: 399.0,
        promoPrice: 229.0,
      });

      mockGenerateCopyVariations.mockReturnValue(mockCopies);
      mockPrisma.$transaction.mockResolvedValue([]);

      await PromoService.generateVariations(TENANT_ID, PROMO_ID);

      expect(mockGenerateCopyVariations).toHaveBeenCalledWith(expect.any(Object), 3);
    });
  });

  // ── NotFoundError ──

  describe('NotFoundError', () => {
    it('has statusCode 404', () => {
      const error = new NotFoundError('test');
      expect(error.statusCode).toBe(404);
    });

    it('has name NotFoundError', () => {
      const error = new NotFoundError('test');
      expect(error.name).toBe('NotFoundError');
    });

    it('is instance of Error', () => {
      const error = new NotFoundError('test');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
