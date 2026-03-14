import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShopeeAdapter } from '../adapters/shopee.js';
import type { Commission } from '../types.js';

const CREDENTIALS = { appId: 'test-app-id', appSecret: 'test-secret' };

function mockFetchResponse(data: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve({ data }),
    text: () => Promise.resolve(JSON.stringify({ data })),
  });
}

function mockFetchError(errors: Array<{ message: string; extensions?: { code: number } }>) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ errors }),
    text: () => Promise.resolve(JSON.stringify({ errors })),
  });
}

describe('ShopeeAdapter', () => {
  let adapter: ShopeeAdapter;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    adapter = new ShopeeAdapter(CREDENTIALS);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('has correct marketplace identifier', () => {
    expect(adapter.marketplace).toBe('SHOPEE');
  });

  // ── Auth / Signature ──

  describe('SHA256 signature', () => {
    it('sends correct Authorization header format', async () => {
      const fetchSpy = mockFetchResponse({
        productOfferV2: { nodes: [] },
      });
      globalThis.fetch = fetchSpy;

      await adapter.searchProducts('test');

      const [, init] = fetchSpy.mock.calls[0]!;
      const authHeader = init.headers['Authorization'] as string;

      expect(authHeader).toMatch(
        /^SHA256 Credential=test-app-id,Timestamp=\d+,Signature=[a-f0-9]{64}$/,
      );
    });

    it('uses POST method with JSON content type', async () => {
      const fetchSpy = mockFetchResponse({
        productOfferV2: { nodes: [] },
      });
      globalThis.fetch = fetchSpy;

      await adapter.searchProducts('test');

      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(url).toBe('https://open-api.affiliate.shopee.com.br/graphql');
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('sends payload as JSON string in body', async () => {
      const fetchSpy = mockFetchResponse({
        productOfferV2: { nodes: [] },
      });
      globalThis.fetch = fetchSpy;

      await adapter.searchProducts('celular');

      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init.body);
      expect(body.query).toContain('productOfferV2');
      expect(body.variables.keyword).toBe('celular');
    });
  });

  // ── searchProducts ──

  describe('searchProducts()', () => {
    const mockNodes = [
      {
        itemId: '12345',
        productName: 'Fone Bluetooth XYZ',
        productLink: 'https://shopee.com.br/fone-xyz-i.100.12345',
        offerLink: 'https://s.shopee.com.br/abc123',
        imageUrl: 'https://cf.shopee.com.br/file/img.jpg',
        price: 89.90,
        priceMin: 59.90,
        priceMax: 89.90,
        commissionRate: 0.08,
        commission: 4.79,
        sales: 1500,
        ratingStar: 4.8,
        shop: { shopId: '100', shopName: 'Loja Tech' },
      },
      {
        itemId: '67890',
        productName: 'Capa iPhone 15',
        productLink: 'https://shopee.com.br/capa-i.200.67890',
        offerLink: 'https://s.shopee.com.br/def456',
        imageUrl: 'https://cf.shopee.com.br/file/img2.jpg',
        price: 29.90,
        priceMin: 19.90,
        priceMax: 29.90,
        commissionRate: 0.06,
        commission: 1.19,
        sales: 5000,
        ratingStar: 4.5,
        shop: { shopId: '200', shopName: 'Capas BR' },
      },
    ];

    it('maps API response to Product[] correctly', async () => {
      globalThis.fetch = mockFetchResponse({ productOfferV2: { nodes: mockNodes } });

      const products = await adapter.searchProducts('fone');

      expect(products).toHaveLength(2);
      expect(products[0]).toMatchObject({
        id: '12345',
        name: 'Fone Bluetooth XYZ',
        originalPrice: 89.90,
        promoPrice: 59.90,
        marketplace: 'SHOPEE',
        rating: 4.8,
        soldCount: 1500,
      });
      expect(products[0]!.discountPercent).toBe(33); // (89.90-59.90)/89.90 ≈ 33%
      expect(products[0]!.metadata).toMatchObject({
        offerLink: 'https://s.shopee.com.br/abc123',
        commissionRate: 0.08,
        shopId: '100',
      });
    });

    it('filters by minPrice client-side', async () => {
      globalThis.fetch = mockFetchResponse({ productOfferV2: { nodes: mockNodes } });

      const products = await adapter.searchProducts('fone', { minPrice: 50 });

      expect(products).toHaveLength(1);
      expect(products[0]!.promoPrice).toBeGreaterThanOrEqual(50);
    });

    it('filters by maxPrice client-side', async () => {
      globalThis.fetch = mockFetchResponse({ productOfferV2: { nodes: mockNodes } });

      const products = await adapter.searchProducts('fone', { maxPrice: 30 });

      expect(products).toHaveLength(1);
      expect(products[0]!.promoPrice).toBeLessThanOrEqual(30);
    });

    it('passes sortType to API based on sortBy option', async () => {
      const fetchSpy = mockFetchResponse({ productOfferV2: { nodes: [] } });
      globalThis.fetch = fetchSpy;

      await adapter.searchProducts('test', { sortBy: 'price' });

      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body);
      expect(body.variables.sortType).toBe(3);
    });

    it('caps limit at 50', async () => {
      const fetchSpy = mockFetchResponse({ productOfferV2: { nodes: [] } });
      globalThis.fetch = fetchSpy;

      await adapter.searchProducts('test', { limit: 100 });

      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body);
      expect(body.variables.limit).toBe(50);
    });

    it('handles empty results', async () => {
      globalThis.fetch = mockFetchResponse({ productOfferV2: { nodes: [] } });

      const products = await adapter.searchProducts('xyznonexistent');
      expect(products).toHaveLength(0);
    });
  });

  // ── generateAffiliateLink ──

  describe('generateAffiliateLink()', () => {
    it('returns short link from API', async () => {
      globalThis.fetch = mockFetchResponse({
        generateShortLink: { shortLink: 'https://s.shopee.com.br/abc123' },
      });

      const link = await adapter.generateAffiliateLink('https://shopee.com.br/product-i.100.200');

      expect(link).toBe('https://s.shopee.com.br/abc123');
    });

    it('sends originUrl in mutation variables', async () => {
      const fetchSpy = mockFetchResponse({
        generateShortLink: { shortLink: 'https://s.shopee.com.br/x' },
      });
      globalThis.fetch = fetchSpy;

      await adapter.generateAffiliateLink('https://shopee.com.br/test-product');

      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body);
      expect(body.query).toContain('generateShortLink');
      expect(body.variables.input.originUrl).toBe('https://shopee.com.br/test-product');
    });

    it('includes subIds when provided', async () => {
      const fetchSpy = mockFetchResponse({
        generateShortLink: { shortLink: 'https://s.shopee.com.br/x' },
      });
      globalThis.fetch = fetchSpy;

      await adapter.generateAffiliateLink('https://shopee.com.br/test', ['telegram', 'campanha1']);

      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body);
      expect(body.variables.input.subIds).toEqual(['telegram', 'campanha1']);
    });
  });

  // ── getProductDetails ──

  describe('getProductDetails()', () => {
    it('extracts itemId from Shopee URL pattern', async () => {
      const fetchSpy = mockFetchResponse({
        productOfferV2: {
          nodes: [
            {
              itemId: '789',
              productName: 'Produto Test',
              productLink: 'https://shopee.com.br/p',
              offerLink: 'https://s.shopee.com.br/x',
              imageUrl: 'https://img.shopee.com.br/x.jpg',
              price: 100,
              commissionRate: 0.05,
              commission: 5,
              sales: 100,
              ratingStar: 4.0,
            },
          ],
        },
      });
      globalThis.fetch = fetchSpy;

      const product = await adapter.getProductDetails('https://shopee.com.br/produto-i.100.789');

      expect(product.productUrl).toBe('https://shopee.com.br/produto-i.100.789');
    });

    it('throws when product not found', async () => {
      globalThis.fetch = mockFetchResponse({ productOfferV2: { nodes: [] } });

      await expect(
        adapter.getProductDetails('https://shopee.com.br/inexistente'),
      ).rejects.toThrow('Product not found');
    });
  });

  // ── getCommissions ──

  describe('getCommissions()', () => {
    const mockConversions = [
      {
        orderId: 'ORD001',
        itemId: '12345',
        productName: 'Fone Bluetooth',
        orderAmount: 89.90,
        commissionRate: 0.08,
        commission: 7.19,
        status: 'approved',
        orderTime: '2026-03-10T14:30:00Z',
      },
      {
        orderId: 'ORD002',
        itemId: '67890',
        productName: 'Capa iPhone',
        orderAmount: 29.90,
        commissionRate: 0.06,
        commission: 1.79,
        status: 'pending',
        orderTime: '2026-03-11T10:00:00Z',
      },
    ];

    it('maps conversion report to Commission[]', async () => {
      globalThis.fetch = mockFetchResponse({
        conversionReport: { nodes: mockConversions },
      });

      const commissions = await adapter.getCommissions({
        start: new Date('2026-03-10'),
        end: new Date('2026-03-12'),
      });

      expect(commissions).toHaveLength(2);
      expect(commissions[0]).toMatchObject({
        orderId: 'ORD001',
        commissionAmount: 7.19,
        status: 'approved',
        marketplace: 'SHOPEE',
      });
    });

    it('sends date range as ISO date strings', async () => {
      const fetchSpy = mockFetchResponse({ conversionReport: { nodes: [] } });
      globalThis.fetch = fetchSpy;

      await adapter.getCommissions({
        start: new Date('2026-03-01'),
        end: new Date('2026-03-15'),
      });

      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body);
      expect(body.variables.startDate).toBe('2026-03-01');
      expect(body.variables.endDate).toBe('2026-03-15');
    });

    it('maps status strings correctly', async () => {
      globalThis.fetch = mockFetchResponse({
        conversionReport: {
          nodes: [
            { ...mockConversions[0], status: 'confirmed' },
            { ...mockConversions[1], status: 'cancelled' },
          ],
        },
      });

      const commissions = await adapter.getCommissions({
        start: new Date('2026-03-01'),
        end: new Date('2026-03-15'),
      });

      expect(commissions[0]!.status).toBe('approved');
      expect(commissions[1]!.status).toBe('rejected');
    });
  });

  // ── Error Handling ──

  describe('error handling', () => {
    it('throws on GraphQL errors', async () => {
      globalThis.fetch = mockFetchError([
        { message: 'Invalid Signature', extensions: { code: 10020 } },
      ]);

      await expect(adapter.searchProducts('test')).rejects.toThrow('Invalid Signature');
    });

    it('throws on non-OK HTTP status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      await expect(adapter.searchProducts('test')).rejects.toThrow('Shopee API HTTP 500');
    });

    it('retries on 429 with backoff', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 429,
            text: () => Promise.resolve('Too Many Requests'),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: { productOfferV2: { nodes: [] } } }),
          text: () => Promise.resolve(''),
        });
      });

      const products = await adapter.searchProducts('test');

      expect(callCount).toBe(2);
      expect(products).toHaveLength(0);
    }, 10000);
  });
});
