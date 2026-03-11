import type { MarketplaceAdapter, Product, SearchOptions } from '../types.js';
import { RateLimiter } from '../rate-limiter.js';

interface ShopeeCredentials {
  appId: string;
  appSecret: string;
}

/**
 * Shopee Affiliate Program GraphQL API adapter.
 * Uses Shopee's affiliate API for product search and link generation.
 *
 * Rate limit: 100 requests per minute as per Shopee affiliate API docs.
 */
export class ShopeeAdapter implements MarketplaceAdapter {
  readonly marketplace = 'SHOPEE';
  private readonly credentials: ShopeeCredentials;
  private readonly rateLimiter: RateLimiter;

  constructor(credentials: ShopeeCredentials) {
    this.credentials = credentials;
    // 100 req/min = ~1.67 req/sec
    this.rateLimiter = new RateLimiter(10, 100 / 60);
  }

  /**
   * Search products on Shopee via Affiliate API.
   * STUB: Returns mock data with realistic Shopee BR products and BRL prices.
   */
  async searchProducts(query: string, options?: SearchOptions): Promise<Product[]> {
    await this.rateLimiter.acquire();

    // STUB: Replace with real Shopee GraphQL API call when credentials provided
    // Real implementation would call:
    // POST https://affiliate.shopee.com.br/graphql
    // mutation: generateShortLink / query: searchProducts

    const allProducts: Product[] = [
      {
        id: 'shopee_1001',
        name: 'Fone de Ouvido Bluetooth QCY T13 ANC TWS - Cancelamento de Ruido',
        originalPrice: 149.90,
        promoPrice: 59.90,
        discountPercent: 60,
        imageUrl: 'https://cf.shopee.com.br/file/sg-11134201-22100-kh4fone.jpg',
        productUrl: 'https://shopee.com.br/product/123456/1001',
        marketplace: 'SHOPEE',
        category: 'Eletrônicos',
        rating: 4.8,
        soldCount: 150000,
        metadata: { shopId: '123456', itemId: '1001' },
      },
      {
        id: 'shopee_1002',
        name: 'Relogio Smartwatch Xiaomi Redmi Watch 3 Active GPS Bluetooth',
        originalPrice: 349.90,
        promoPrice: 179.90,
        discountPercent: 49,
        imageUrl: 'https://cf.shopee.com.br/file/sg-11134201-22100-smartwatch.jpg',
        productUrl: 'https://shopee.com.br/product/123456/1002',
        marketplace: 'SHOPEE',
        category: 'Relógios',
        rating: 4.7,
        soldCount: 85000,
        metadata: { shopId: '123456', itemId: '1002' },
      },
      {
        id: 'shopee_1003',
        name: 'Kit 5 Cuecas Box Microfibra Lisa Premium Confort Masculina',
        originalPrice: 79.90,
        promoPrice: 29.90,
        discountPercent: 63,
        imageUrl: 'https://cf.shopee.com.br/file/sg-11134201-22100-cuecas.jpg',
        productUrl: 'https://shopee.com.br/product/789012/1003',
        marketplace: 'SHOPEE',
        category: 'Moda Masculina',
        rating: 4.5,
        soldCount: 200000,
        metadata: { shopId: '789012', itemId: '1003' },
      },
      {
        id: 'shopee_1004',
        name: 'Pelicula Vidro Temperado iPhone 15 Pro Max 9D Cobertura Total',
        originalPrice: 39.90,
        promoPrice: 9.90,
        discountPercent: 75,
        imageUrl: 'https://cf.shopee.com.br/file/sg-11134201-22100-pelicula.jpg',
        productUrl: 'https://shopee.com.br/product/345678/1004',
        marketplace: 'SHOPEE',
        category: 'Celulares e Acessórios',
        rating: 4.6,
        soldCount: 500000,
        metadata: { shopId: '345678', itemId: '1004' },
      },
      {
        id: 'shopee_1005',
        name: 'Aspirador de Po Robo Xiaomi E10 Mop 2 em 1 Wi-Fi Alexa',
        originalPrice: 999.90,
        promoPrice: 649.90,
        discountPercent: 35,
        imageUrl: 'https://cf.shopee.com.br/file/sg-11134201-22100-robo.jpg',
        productUrl: 'https://shopee.com.br/product/567890/1005',
        marketplace: 'SHOPEE',
        category: 'Eletrodomésticos',
        rating: 4.4,
        soldCount: 30000,
        metadata: { shopId: '567890', itemId: '1005' },
      },
      {
        id: 'shopee_1006',
        name: 'Tenis Nike Revolution 6 Masculino Corrida Original',
        originalPrice: 349.99,
        promoPrice: 199.90,
        discountPercent: 43,
        imageUrl: 'https://cf.shopee.com.br/file/sg-11134201-22100-nike.jpg',
        productUrl: 'https://shopee.com.br/product/901234/1006',
        marketplace: 'SHOPEE',
        category: 'Calçados',
        rating: 4.6,
        soldCount: 75000,
        metadata: { shopId: '901234', itemId: '1006' },
      },
      {
        id: 'shopee_1007',
        name: 'Base Liquida Matte Ruby Rose HB-8053 Cobertura Total 29ml',
        originalPrice: 29.90,
        promoPrice: 14.90,
        discountPercent: 50,
        imageUrl: 'https://cf.shopee.com.br/file/sg-11134201-22100-base.jpg',
        productUrl: 'https://shopee.com.br/product/112233/1007',
        marketplace: 'SHOPEE',
        category: 'Beleza',
        rating: 4.3,
        soldCount: 180000,
        metadata: { shopId: '112233', itemId: '1007' },
      },
      {
        id: 'shopee_1008',
        name: 'Limpador Multiuso Veja Limpeza Pesada 500ml Pack 6 Unidades',
        originalPrice: 49.90,
        promoPrice: 32.90,
        discountPercent: 34,
        imageUrl: 'https://cf.shopee.com.br/file/sg-11134201-22100-veja.jpg',
        productUrl: 'https://shopee.com.br/product/445566/1008',
        marketplace: 'SHOPEE',
        category: 'Casa e Limpeza',
        rating: 4.7,
        soldCount: 60000,
        metadata: { shopId: '445566', itemId: '1008' },
      },
    ];

    let filtered = allProducts.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.category?.toLowerCase().includes(query.toLowerCase()) ||
      query.toLowerCase().split(' ').some(term => p.name.toLowerCase().includes(term))
    );

    if (filtered.length === 0) {
      filtered = allProducts;
    }

    if (options?.minPrice !== undefined) {
      filtered = filtered.filter(p => p.promoPrice >= options.minPrice!);
    }
    if (options?.maxPrice !== undefined) {
      filtered = filtered.filter(p => p.promoPrice <= options.maxPrice!);
    }

    if (options?.sortBy === 'price') {
      filtered.sort((a, b) => a.promoPrice - b.promoPrice);
    } else if (options?.sortBy === 'discount') {
      filtered.sort((a, b) => b.discountPercent - a.discountPercent);
    }

    const limit = options?.limit ?? 10;
    return filtered.slice(0, limit);
  }

  /**
   * Generates a Shopee affiliate short link via GraphQL API.
   * STUB: Returns a mock short link. Real implementation would call generateShortLink mutation.
   */
  async generateAffiliateLink(productUrl: string): Promise<string> {
    await this.rateLimiter.acquire();

    // STUB: Replace with real Shopee GraphQL generateShortLink mutation
    // Real implementation would call:
    // POST https://affiliate.shopee.com.br/graphql
    // mutation { generateShortLink(input: { originUrl: $productUrl }) { shortLink } }

    const shortCode = Math.random().toString(36).substring(2, 8);
    return `https://shp.ee/aff_${shortCode}`;
  }

  /**
   * Get product details from Shopee product URL.
   * STUB: Returns mock product data.
   */
  async getProductDetails(productUrl: string): Promise<Product> {
    await this.rateLimiter.acquire();

    // STUB: Replace with real Shopee API call when credentials provided
    const urlMatch = productUrl.match(/product\/(\d+)\/(\d+)/);
    const shopId = urlMatch?.[1] ?? '123456';
    const itemId = urlMatch?.[2] ?? '1001';

    return {
      id: `shopee_${itemId}`,
      name: 'Fone de Ouvido Bluetooth QCY T13 ANC TWS - Cancelamento de Ruido',
      originalPrice: 149.90,
      promoPrice: 59.90,
      discountPercent: 60,
      imageUrl: 'https://cf.shopee.com.br/file/sg-11134201-22100-kh4fone.jpg',
      productUrl,
      marketplace: 'SHOPEE',
      category: 'Eletrônicos',
      rating: 4.8,
      soldCount: 150000,
      metadata: { shopId, itemId, fetchedAt: new Date().toISOString() },
    };
  }
}
