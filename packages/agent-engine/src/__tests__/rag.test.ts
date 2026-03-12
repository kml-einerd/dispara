import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductRAG, type ProductQueryFn } from '../rag.js';
import type { ProductForRAG } from '../types.js';

function makeProduct(overrides: Partial<ProductForRAG> = {}): ProductForRAG {
  return {
    id: overrides.id ?? 'prod-1',
    tenantId: overrides.tenantId ?? 'tenant-1',
    name: overrides.name ?? 'Test Product',
    description: overrides.description ?? 'A test product',
    category: overrides.category ?? 'electronics',
    price: overrides.price ?? 99.99,
    originalPrice: overrides.originalPrice,
    affiliateUrl: overrides.affiliateUrl ?? 'https://aff.link/test',
    imageUrl: overrides.imageUrl,
    marketplace: overrides.marketplace ?? 'Amazon',
  };
}

describe('ProductRAG', () => {
  let queryFn: ReturnType<typeof vi.fn>;
  let rag: ProductRAG;

  beforeEach(() => {
    queryFn = vi.fn();
    rag = new ProductRAG(queryFn as ProductQueryFn);
  });

  it('returns top 3 products when more are available', async () => {
    const products = Array.from({ length: 5 }, (_, i) =>
      makeProduct({ id: `prod-${i}`, name: `Product ${i}` }),
    );
    queryFn.mockResolvedValueOnce(products);

    const results = await rag.searchProducts('tenant-1', 'test query', {});

    expect(results).toHaveLength(3);
    expect(results[0].product.id).toBe('prod-0');
    expect(results[1].product.id).toBe('prod-1');
    expect(results[2].product.id).toBe('prod-2');
  });

  it('returns empty array when no products match', async () => {
    queryFn.mockResolvedValueOnce([]);

    const results = await rag.searchProducts('tenant-1', 'nonexistent', {});

    expect(results).toEqual([]);
  });

  it('builds search query from entities (productName + brand + category)', async () => {
    queryFn.mockResolvedValueOnce([makeProduct()]);

    await rag.searchProducts('tenant-1', 'original query', {
      productName: 'iPhone 15',
      brand: 'Apple',
      category: 'smartphones',
    });

    expect(queryFn).toHaveBeenCalledWith(
      'tenant-1',
      'iPhone 15 Apple smartphones',
      'smartphones',
      undefined,
    );
  });

  it('falls back to original query when no entities', async () => {
    queryFn.mockResolvedValueOnce([]);

    await rag.searchProducts('tenant-1', 'quero um fone bom', {});

    expect(queryFn).toHaveBeenCalledWith(
      'tenant-1',
      'quero um fone bom',
      undefined,
      undefined,
    );
  });

  it('passes maxPrice filter to queryFn', async () => {
    queryFn.mockResolvedValueOnce([]);

    await rag.searchProducts('tenant-1', 'fone barato', {
      maxPrice: 200,
      category: 'audio',
    });

    expect(queryFn).toHaveBeenCalledWith(
      'tenant-1',
      'audio',
      'audio',
      200,
    );
  });

  it('handles queryFn errors gracefully (returns [])', async () => {
    queryFn.mockRejectedValueOnce(new Error('Database connection failed'));

    const results = await rag.searchProducts('tenant-1', 'test', {});

    expect(results).toEqual([]);
  });

  it('uses product rank as score when available', async () => {
    const products = [
      { ...makeProduct({ id: 'p1' }), rank: 0.95 },
      { ...makeProduct({ id: 'p2' }), rank: 0.8 },
    ];
    queryFn.mockResolvedValueOnce(products);

    const results = await rag.searchProducts('tenant-1', 'query', {});

    expect(results[0].score).toBe(0.95);
    expect(results[1].score).toBe(0.8);
  });

  it('uses positional score when product rank is not available', async () => {
    const products = [
      makeProduct({ id: 'p1' }),
      makeProduct({ id: 'p2' }),
      makeProduct({ id: 'p3' }),
    ];
    queryFn.mockResolvedValueOnce(products);

    const results = await rag.searchProducts('tenant-1', 'query', {});

    expect(results[0].score).toBe(1.0);
    expect(results[1].score).toBe(0.5);
    expect(results[2].score).toBeCloseTo(0.333, 2);
  });

  it('builds search query with only productName when other entities are missing', async () => {
    queryFn.mockResolvedValueOnce([]);

    await rag.searchProducts('tenant-1', 'original', {
      productName: 'AirPods',
    });

    expect(queryFn).toHaveBeenCalledWith(
      'tenant-1',
      'AirPods',
      undefined,
      undefined,
    );
  });

  it('returns fewer than 3 results when only 1 or 2 products exist', async () => {
    queryFn.mockResolvedValueOnce([makeProduct()]);

    const results = await rag.searchProducts('tenant-1', 'query', {});

    expect(results).toHaveLength(1);
  });
});
