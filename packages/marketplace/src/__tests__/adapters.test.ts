import { describe, it, expect } from 'vitest';
import { AmazonAdapter } from '../adapters/amazon.js';
import { LomadeeAdapter } from '../adapters/lomadee.js';
import type { Product } from '../types.js';

// ── Helpers ──

const REQUIRED_PRODUCT_FIELDS: (keyof Product)[] = [
  'id',
  'name',
  'originalPrice',
  'promoPrice',
  'discountPercent',
  'imageUrl',
  'productUrl',
  'marketplace',
];

function assertValidProduct(product: Product) {
  for (const field of REQUIRED_PRODUCT_FIELDS) {
    expect(product[field], `Missing field: ${field}`).toBeDefined();
  }
  expect(product.originalPrice).toBeGreaterThan(0);
  expect(product.promoPrice).toBeGreaterThan(0);
  expect(product.promoPrice).toBeLessThanOrEqual(product.originalPrice);
  expect(product.discountPercent).toBeGreaterThanOrEqual(0);
  expect(product.discountPercent).toBeLessThanOrEqual(100);
  expect(product.imageUrl).toMatch(/^https?:\/\//);
  expect(product.productUrl).toMatch(/^https?:\/\//);
}

// ── Amazon Adapter ──

describe('AmazonAdapter', () => {
  const adapter = new AmazonAdapter({
    accessKey: 'test-access-key',
    secretKey: 'test-secret-key',
    partnerTag: 'dispara-20',
  });

  it('has correct marketplace identifier', () => {
    expect(adapter.marketplace).toBe('AMAZON');
  });

  describe('searchProducts()', () => {
    it('returns array of products', async () => {
      const products = await adapter.searchProducts('kindle');
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
    });

    it('returns products with all required fields', async () => {
      const products = await adapter.searchProducts('echo');
      for (const product of products) {
        assertValidProduct(product);
        expect(product.marketplace).toBe('AMAZON');
      }
    });

    it('respects limit option', async () => {
      const products = await adapter.searchProducts('eletrônicos', { limit: 2 });
      expect(products.length).toBeLessThanOrEqual(2);
    });

    it('filters by minPrice', async () => {
      const products = await adapter.searchProducts('eletrônicos', { minPrice: 300 });
      for (const product of products) {
        expect(product.promoPrice).toBeGreaterThanOrEqual(300);
      }
    });

    it('filters by maxPrice', async () => {
      const products = await adapter.searchProducts('eletrônicos', { maxPrice: 250 });
      for (const product of products) {
        expect(product.promoPrice).toBeLessThanOrEqual(250);
      }
    });

    it('sorts by price ascending', async () => {
      const products = await adapter.searchProducts('eletrônicos', { sortBy: 'price' });
      for (let i = 1; i < products.length; i++) {
        expect(products[i]!.promoPrice).toBeGreaterThanOrEqual(products[i - 1]!.promoPrice);
      }
    });

    it('sorts by discount descending', async () => {
      const products = await adapter.searchProducts('eletrônicos', { sortBy: 'discount' });
      for (let i = 1; i < products.length; i++) {
        expect(products[i]!.discountPercent).toBeLessThanOrEqual(products[i - 1]!.discountPercent);
      }
    });

    it('returns all products for unmatched query', async () => {
      const products = await adapter.searchProducts('xyznonexistent12345');
      expect(products.length).toBeGreaterThan(0);
    });
  });

  describe('generateAffiliateLink()', () => {
    it('returns valid URL with partner tag', async () => {
      const url = await adapter.generateAffiliateLink('https://www.amazon.com.br/dp/B0CHX3QBCH');
      expect(url).toContain('tag=dispara-20');
      expect(url).toContain('amazon.com.br');
    });

    it('replaces existing tag parameter', async () => {
      const url = await adapter.generateAffiliateLink(
        'https://www.amazon.com.br/dp/B0CHX3QBCH?tag=old-tag-20',
      );
      expect(url).toContain('tag=dispara-20');
      expect(url).not.toContain('old-tag-20');
    });
  });

  describe('getProductDetails()', () => {
    it('returns single product with correct fields', async () => {
      const product = await adapter.getProductDetails('https://www.amazon.com.br/dp/B0CHX3QBCH');
      assertValidProduct(product);
      expect(product.id).toBe('B0CHX3QBCH');
      expect(product.marketplace).toBe('AMAZON');
    });

    it('extracts ASIN from URL', async () => {
      const product = await adapter.getProductDetails('https://www.amazon.com.br/dp/B0BSHF7WHW');
      expect(product.id).toBe('B0BSHF7WHW');
    });

    it('uses productUrl from input', async () => {
      const inputUrl = 'https://www.amazon.com.br/dp/B0CHX3QBCH';
      const product = await adapter.getProductDetails(inputUrl);
      expect(product.productUrl).toBe(inputUrl);
    });
  });
});

// Shopee tests are in shopee.test.ts (requires fetch mocking)

// ── Lomadee Adapter ──

describe('LomadeeAdapter', () => {
  const adapter = new LomadeeAdapter({
    apiKey: 'test-api-key',
    sourceId: 'test-source-id',
  });

  it('has correct marketplace identifier', () => {
    expect(adapter.marketplace).toBe('MAGALU');
  });

  describe('searchProducts()', () => {
    it('returns array of products', async () => {
      const products = await adapter.searchProducts('tv samsung');
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
    });

    it('returns products with all required fields', async () => {
      const products = await adapter.searchProducts('notebook');
      for (const product of products) {
        assertValidProduct(product);
        expect(product.marketplace).toBe('MAGALU');
      }
    });

    it('respects limit option', async () => {
      const products = await adapter.searchProducts('eletrodomésticos', { limit: 2 });
      expect(products.length).toBeLessThanOrEqual(2);
    });

    it('filters by price range', async () => {
      const products = await adapter.searchProducts('eletrodomésticos', {
        minPrice: 500,
        maxPrice: 2000,
      });
      for (const product of products) {
        expect(product.promoPrice).toBeGreaterThanOrEqual(500);
        expect(product.promoPrice).toBeLessThanOrEqual(2000);
      }
    });

    it('sorts by price ascending', async () => {
      const products = await adapter.searchProducts('eletrodomésticos', { sortBy: 'price' });
      for (let i = 1; i < products.length; i++) {
        expect(products[i]!.promoPrice).toBeGreaterThanOrEqual(products[i - 1]!.promoPrice);
      }
    });
  });

  describe('generateAffiliateLink()', () => {
    it('returns Lomadee deeplink URL', async () => {
      const url = await adapter.generateAffiliateLink(
        'https://www.magazineluiza.com.br/smart-tv-samsung-50/p/2301/',
      );
      expect(url).toContain('redir.lomadee.com');
      expect(url).toContain('sourceId=test-source-id');
      expect(url).toContain(encodeURIComponent('magazineluiza.com.br'));
    });
  });

  describe('getProductDetails()', () => {
    it('returns single product with correct fields', async () => {
      const product = await adapter.getProductDetails(
        'https://www.magazineluiza.com.br/smart-tv/p/2301/',
      );
      assertValidProduct(product);
      expect(product.marketplace).toBe('MAGALU');
    });

    it('extracts product ID from URL', async () => {
      const product = await adapter.getProductDetails(
        'https://www.magazineluiza.com.br/produto/p/ABCD/',
      );
      expect(product.id).toBe('magalu_ABCD');
    });
  });
});
