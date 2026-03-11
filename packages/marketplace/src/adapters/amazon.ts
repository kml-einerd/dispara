import type { MarketplaceAdapter, Product, SearchOptions } from '../types.js';
import { RateLimiter } from '../rate-limiter.js';

interface AmazonCredentials {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  marketplace?: string;
}

/**
 * Amazon Product Advertising API (PA-API 5.0) adapter.
 * Uses the Amazon Associates/Creators program for affiliate links.
 *
 * Rate limit: 1 TPS (Transaction Per Second) as per PA-API throttling.
 */
export class AmazonAdapter implements MarketplaceAdapter {
  readonly marketplace = 'AMAZON';
  private readonly credentials: AmazonCredentials;
  private readonly rateLimiter: RateLimiter;

  constructor(credentials: AmazonCredentials) {
    this.credentials = {
      ...credentials,
      marketplace: credentials.marketplace ?? 'www.amazon.com.br',
    };
    // PA-API enforces 1 TPS
    this.rateLimiter = new RateLimiter(1, 1);
  }

  /**
   * Search products on Amazon via PA-API SearchItems operation.
   * STUB: Returns mock data with realistic Amazon BR products.
   */
  async searchProducts(query: string, options?: SearchOptions): Promise<Product[]> {
    await this.rateLimiter.acquire();

    // STUB: Replace with real PA-API SearchItems call when credentials provided
    // Real implementation would call:
    // POST https://webservices.amazon.com.br/paapi5/searchitems
    // with HMAC-SHA256 signed request

    const allProducts: Product[] = [
      {
        id: 'B0CHX3QBCH',
        name: 'Echo Dot 5a geracao com Alexa - Smart Speaker com som envolvente',
        originalPrice: 399.00,
        promoPrice: 229.00,
        discountPercent: 43,
        imageUrl: 'https://m.media-amazon.com/images/I/71xoR4A-YzL._AC_SL1000_.jpg',
        productUrl: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
        marketplace: 'AMAZON',
        category: 'Eletrônicos',
        rating: 4.7,
        soldCount: 50000,
        metadata: { asin: 'B0CHX3QBCH', brand: 'Amazon' },
      },
      {
        id: 'B0BSHF7WHW',
        name: 'Kindle 11a geracao - Com tela de 6" e 16 GB',
        originalPrice: 499.00,
        promoPrice: 339.00,
        discountPercent: 32,
        imageUrl: 'https://m.media-amazon.com/images/I/61SUj2aKoEL._AC_SL1000_.jpg',
        productUrl: 'https://www.amazon.com.br/dp/B0BSHF7WHW',
        marketplace: 'AMAZON',
        category: 'Eletrônicos',
        rating: 4.6,
        soldCount: 80000,
        metadata: { asin: 'B0BSHF7WHW', brand: 'Amazon' },
      },
      {
        id: 'B09V3KXJPB',
        name: 'Fire TV Stick Lite com Controle Remoto por Voz com Alexa',
        originalPrice: 329.00,
        promoPrice: 189.00,
        discountPercent: 43,
        imageUrl: 'https://m.media-amazon.com/images/I/51TjJOTfslL._AC_SL1000_.jpg',
        productUrl: 'https://www.amazon.com.br/dp/B09V3KXJPB',
        marketplace: 'AMAZON',
        category: 'Eletrônicos',
        rating: 4.5,
        soldCount: 120000,
        metadata: { asin: 'B09V3KXJPB', brand: 'Amazon' },
      },
      {
        id: 'B0D1XD1ZV3',
        name: 'JBL Tune 520BT Fone de Ouvido Bluetooth sem Fio',
        originalPrice: 299.99,
        promoPrice: 179.90,
        discountPercent: 40,
        imageUrl: 'https://m.media-amazon.com/images/I/51JbsHSktkL._AC_SL1200_.jpg',
        productUrl: 'https://www.amazon.com.br/dp/B0D1XD1ZV3',
        marketplace: 'AMAZON',
        category: 'Eletrônicos',
        rating: 4.4,
        soldCount: 35000,
        metadata: { asin: 'B0D1XD1ZV3', brand: 'JBL' },
      },
      {
        id: 'B0CG6NR413',
        name: 'Carregador Portatil Samsung 10000mAh USB-C Carga Rapida 25W',
        originalPrice: 199.00,
        promoPrice: 119.90,
        discountPercent: 40,
        imageUrl: 'https://m.media-amazon.com/images/I/51Q-M7RDZOL._AC_SL1000_.jpg',
        productUrl: 'https://www.amazon.com.br/dp/B0CG6NR413',
        marketplace: 'AMAZON',
        category: 'Celulares e Acessórios',
        rating: 4.5,
        soldCount: 25000,
        metadata: { asin: 'B0CG6NR413', brand: 'Samsung' },
      },
      {
        id: 'B07FZ8S74R',
        name: 'Logitech MX Master 3S Mouse sem fio ergonomico com rolagem rapida',
        originalPrice: 699.00,
        promoPrice: 449.00,
        discountPercent: 36,
        imageUrl: 'https://m.media-amazon.com/images/I/61ni3t1ryQL._AC_SL1500_.jpg',
        productUrl: 'https://www.amazon.com.br/dp/B07FZ8S74R',
        marketplace: 'AMAZON',
        category: 'Informática',
        rating: 4.8,
        soldCount: 45000,
        metadata: { asin: 'B07FZ8S74R', brand: 'Logitech' },
      },
      {
        id: 'B0BN72D6MK',
        name: 'Cadeira Gamer ThunderX3 EC3 Ergonomica Preta',
        originalPrice: 1299.00,
        promoPrice: 799.00,
        discountPercent: 38,
        imageUrl: 'https://m.media-amazon.com/images/I/61MBsOq-URL._AC_SL1000_.jpg',
        productUrl: 'https://www.amazon.com.br/dp/B0BN72D6MK',
        marketplace: 'AMAZON',
        category: 'Móveis',
        rating: 4.3,
        soldCount: 15000,
        metadata: { asin: 'B0BN72D6MK', brand: 'ThunderX3' },
      },
      {
        id: 'B0CXLP1R9T',
        name: 'Fritadeira Eletrica Air Fryer Philco 4.4L PFR16P',
        originalPrice: 399.90,
        promoPrice: 249.90,
        discountPercent: 38,
        imageUrl: 'https://m.media-amazon.com/images/I/61bK3m7N-LL._AC_SL1000_.jpg',
        productUrl: 'https://www.amazon.com.br/dp/B0CXLP1R9T',
        marketplace: 'AMAZON',
        category: 'Cozinha',
        rating: 4.5,
        soldCount: 30000,
        metadata: { asin: 'B0CXLP1R9T', brand: 'Philco' },
      },
    ];

    let filtered = allProducts.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.category?.toLowerCase().includes(query.toLowerCase()) ||
      query.toLowerCase().split(' ').some(term => p.name.toLowerCase().includes(term))
    );

    // If no match by query, return all (simulating broad search)
    if (filtered.length === 0) {
      filtered = allProducts;
    }

    // Apply price filters
    if (options?.minPrice !== undefined) {
      filtered = filtered.filter(p => p.promoPrice >= options.minPrice!);
    }
    if (options?.maxPrice !== undefined) {
      filtered = filtered.filter(p => p.promoPrice <= options.maxPrice!);
    }

    // Apply sorting
    if (options?.sortBy === 'price') {
      filtered.sort((a, b) => a.promoPrice - b.promoPrice);
    } else if (options?.sortBy === 'discount') {
      filtered.sort((a, b) => b.discountPercent - a.discountPercent);
    }

    // Apply limit
    const limit = options?.limit ?? 10;
    return filtered.slice(0, limit);
  }

  /**
   * Generates an Amazon affiliate link by appending the partner tag.
   * This is a real implementation - Amazon affiliate links work via URL parameter.
   */
  async generateAffiliateLink(productUrl: string): Promise<string> {
    await this.rateLimiter.acquire();

    const url = new URL(productUrl);

    // Remove existing tag if present
    url.searchParams.delete('tag');
    // Add affiliate tag
    url.searchParams.set('tag', this.credentials.partnerTag);

    return url.toString();
  }

  /**
   * Get detailed product info from Amazon product URL.
   * STUB: Returns mock product data. Real implementation would use PA-API GetItems.
   */
  async getProductDetails(productUrl: string): Promise<Product> {
    await this.rateLimiter.acquire();

    // STUB: Replace with real PA-API GetItems call when credentials provided
    // Extract ASIN from URL for realistic stub
    const asinMatch = productUrl.match(/\/dp\/([A-Z0-9]{10})/);
    const asin = asinMatch?.[1] ?? 'B0CHX3QBCH';

    return {
      id: asin,
      name: 'Echo Dot 5a geracao com Alexa - Smart Speaker com som envolvente',
      originalPrice: 399.00,
      promoPrice: 229.00,
      discountPercent: 43,
      imageUrl: 'https://m.media-amazon.com/images/I/71xoR4A-YzL._AC_SL1000_.jpg',
      productUrl,
      marketplace: 'AMAZON',
      category: 'Eletrônicos',
      rating: 4.7,
      soldCount: 50000,
      metadata: { asin, brand: 'Amazon', fetchedAt: new Date().toISOString() },
    };
  }
}
