import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromoEngine } from '../pipeline.js';
import type { PromoInput } from '../pipeline.js';
import type { MarketplaceAdapter, Product } from '@dispara/marketplace';
import type { CopyVariation } from '@dispara/shared';

// Mock detectMarketplace from shared
vi.mock('@dispara/shared', () => ({
  detectMarketplace: vi.fn((url: string) => {
    if (url.includes('amazon')) return 'AMAZON';
    if (url.includes('shopee')) return 'SHOPEE';
    if (url.includes('magazineluiza') || url.includes('magalu')) return 'MAGALU';
    if (url.includes('mercadolivre')) return 'MERCADOLIVRE';
    return null;
  }),
}));

// ── Helpers ──

function createMockProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'PROD001',
    name: 'Fone JBL Tune 520BT Bluetooth',
    originalPrice: 299.9,
    promoPrice: 179.9,
    discountPercent: 40,
    imageUrl: 'https://cdn.example.com/fone-jbl.jpg',
    productUrl: 'https://www.amazon.com.br/dp/PROD001',
    marketplace: 'AMAZON',
    category: 'Eletrônicos',
    rating: 4.5,
    ...overrides,
  };
}

function createMockVariations(count = 3): CopyVariation[] {
  const tones: CopyVariation['tone'][] = ['urgente', 'casual', 'formal'];
  return Array.from({ length: count }, (_, i) => ({
    label: tones[i % 3]!,
    text: `Promo copy variation ${i + 1} - Fone JBL por R$ 179,90!`,
    tone: tones[i % 3]!,
    charCount: 45,
  }));
}

function createMockAdapter(marketplace: string): MarketplaceAdapter {
  return {
    marketplace,
    searchProducts: vi.fn().mockResolvedValue([createMockProduct({ marketplace })]),
    generateAffiliateLink: vi
      .fn()
      .mockResolvedValue(`https://affiliate.example.com/link?tag=dispara`),
    getProductDetails: vi.fn().mockResolvedValue(createMockProduct({ marketplace })),
  };
}

function createMockCopyGenerator() {
  return {
    generateVariations: vi.fn().mockResolvedValue(createMockVariations()),
  };
}

describe('PromoEngine', () => {
  let amazonAdapter: MarketplaceAdapter;
  let shopeeAdapter: MarketplaceAdapter;
  let copyGenerator: ReturnType<typeof createMockCopyGenerator>;
  let engine: PromoEngine;
  let adaptersMap: Map<string, MarketplaceAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();

    amazonAdapter = createMockAdapter('AMAZON');
    shopeeAdapter = createMockAdapter('SHOPEE');
    copyGenerator = createMockCopyGenerator();

    adaptersMap = new Map([
      ['AMAZON', amazonAdapter],
      ['SHOPEE', shopeeAdapter],
    ]);

    engine = new PromoEngine(adaptersMap, copyGenerator as any);
  });

  describe('generatePromo() with URL', () => {
    it('detects marketplace from URL and uses correct adapter', async () => {
      const input: PromoInput = {
        url: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      const result = await engine.generatePromo(input);

      expect(amazonAdapter.getProductDetails).toHaveBeenCalledWith(input.url);
      expect(result.marketplace).toBe('AMAZON');
    });

    it('returns PromoResult with all required fields', async () => {
      const input: PromoInput = {
        url: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      const result = await engine.generatePromo(input);

      expect(result).toHaveProperty('product');
      expect(result).toHaveProperty('affiliateUrl');
      expect(result).toHaveProperty('copyVariations');
      expect(result).toHaveProperty('imageUrl');
      expect(result).toHaveProperty('marketplace');
      expect(result).toHaveProperty('generatedAt');
      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(result.copyVariations).toHaveLength(3);
      expect(typeof result.affiliateUrl).toBe('string');
    });

    it('generates affiliate link from product URL', async () => {
      const input: PromoInput = {
        url: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      await engine.generatePromo(input);

      expect(amazonAdapter.generateAffiliateLink).toHaveBeenCalled();
    });

    it('generates copy variations via CopyGenerator', async () => {
      const input: PromoInput = {
        url: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      await engine.generatePromo(input);

      expect(copyGenerator.generateVariations).toHaveBeenCalledWith(
        expect.any(Object),
        3,
      );
    });

    it('throws when marketplace cannot be detected from URL', async () => {
      const input: PromoInput = {
        url: 'https://www.unknown-store.com/product/123',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      await expect(engine.generatePromo(input)).rejects.toThrow(
        'Could not detect marketplace from URL',
      );
    });

    it('throws when adapter is not configured for detected marketplace', async () => {
      const input: PromoInput = {
        url: 'https://www.magazineluiza.com.br/produto/p/123',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      await expect(engine.generatePromo(input)).rejects.toThrow(
        'Marketplace adapter not configured: MAGALU',
      );
    });
  });

  describe('generatePromo() with keyword', () => {
    it('searches correct marketplace adapter', async () => {
      const input: PromoInput = {
        keyword: 'fone bluetooth',
        marketplace: 'AMAZON',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      const result = await engine.generatePromo(input);

      expect(amazonAdapter.searchProducts).toHaveBeenCalledWith('fone bluetooth', {
        limit: 1,
        sortBy: 'relevance',
      });
      expect(result.marketplace).toBe('AMAZON');
    });

    it('throws when no products found for keyword', async () => {
      (amazonAdapter.searchProducts as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const input: PromoInput = {
        keyword: 'xyznonexistent',
        marketplace: 'AMAZON',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      await expect(engine.generatePromo(input)).rejects.toThrow(
        'No products found for keyword',
      );
    });

    it('throws when neither url nor keyword+marketplace provided', async () => {
      const input: PromoInput = {
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      await expect(engine.generatePromo(input)).rejects.toThrow(
        'Either url or (keyword + marketplace) must be provided',
      );
    });
  });

  describe('generateFromKeyword()', () => {
    it('searches across all configured marketplaces when no marketplace specified', async () => {
      const results = await engine.generateFromKeyword('fone bluetooth');

      expect(amazonAdapter.searchProducts).toHaveBeenCalledWith('fone bluetooth', {
        limit: 5,
        sortBy: 'discount',
      });
      expect(shopeeAdapter.searchProducts).toHaveBeenCalledWith('fone bluetooth', {
        limit: 5,
        sortBy: 'discount',
      });
    });

    it('searches only specified marketplace', async () => {
      const results = await engine.generateFromKeyword('fone bluetooth', 'AMAZON');

      expect(amazonAdapter.searchProducts).toHaveBeenCalled();
      expect(shopeeAdapter.searchProducts).not.toHaveBeenCalled();
    });

    it('returns promo results sorted by discount', async () => {
      const highDiscount = createMockProduct({ discountPercent: 60 });
      const lowDiscount = createMockProduct({ discountPercent: 20 });
      (amazonAdapter.searchProducts as ReturnType<typeof vi.fn>).mockResolvedValue([lowDiscount]);
      (shopeeAdapter.searchProducts as ReturnType<typeof vi.fn>).mockResolvedValue([highDiscount]);

      const results = await engine.generateFromKeyword('fone');

      expect(results.length).toBeGreaterThan(0);
    });

    it('handles adapter failure gracefully (Promise.allSettled)', async () => {
      (amazonAdapter.searchProducts as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Amazon API down'),
      );
      (shopeeAdapter.searchProducts as ReturnType<typeof vi.fn>).mockResolvedValue([
        createMockProduct({ marketplace: 'SHOPEE' }),
      ]);

      const results = await engine.generateFromKeyword('fone');

      // Should still return results from Shopee
      expect(results.length).toBeGreaterThan(0);
    });

    it('throws for unconfigured marketplace', async () => {
      await expect(engine.generateFromKeyword('fone', 'MAGALU')).rejects.toThrow(
        'Marketplace adapter not configured: MAGALU',
      );
    });

    it('returns empty array when all adapters fail', async () => {
      (amazonAdapter.searchProducts as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('fail'),
      );
      (shopeeAdapter.searchProducts as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('fail'),
      );

      const results = await engine.generateFromKeyword('fone');

      expect(results).toHaveLength(0);
    });
  });

  describe('image handling', () => {
    it('uses product imageUrl when no imageStorage configured', async () => {
      const input: PromoInput = {
        url: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      const result = await engine.generatePromo(input);

      expect(result.imageUrl).toBe('https://cdn.example.com/fone-jbl.jpg');
    });

    it('uses imageStorage when configured and upload succeeds', async () => {
      const mockStorage = {
        upload: vi.fn().mockResolvedValue('https://storage.example.com/stored-image.jpg'),
        getPublicUrl: vi.fn(),
      };

      const engineWithStorage = new PromoEngine(adaptersMap, copyGenerator as any, mockStorage);

      const input: PromoInput = {
        url: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      const result = await engineWithStorage.generatePromo(input);

      expect(mockStorage.upload).toHaveBeenCalled();
      expect(result.imageUrl).toBe('https://storage.example.com/stored-image.jpg');
    });

    it('falls back to marketplace image when storage upload fails', async () => {
      const mockStorage = {
        upload: vi.fn().mockRejectedValue(new Error('Storage down')),
        getPublicUrl: vi.fn(),
      };

      const engineWithStorage = new PromoEngine(adaptersMap, copyGenerator as any, mockStorage);

      const input: PromoInput = {
        url: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
        tenantId: 'tenant-123',
        userId: 'user-456',
      };

      const result = await engineWithStorage.generatePromo(input);

      expect(result.imageUrl).toBe('https://cdn.example.com/fone-jbl.jpg');
    });
  });
});
