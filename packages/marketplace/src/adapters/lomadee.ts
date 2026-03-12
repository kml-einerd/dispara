import type { MarketplaceAdapter, Product, SearchOptions } from '../types.js';
import { RateLimiter } from '../rate-limiter.js';

interface LomadeeCredentials {
  apiKey: string;
  sourceId: string;
}

/**
 * Lomadee REST API adapter.
 * Lomadee is a Brazilian affiliate network that covers Magalu, Americanas,
 * Submarino, and other major retailers.
 *
 * Rate limit: 1 request per second as per Lomadee API docs.
 */
export class LomadeeAdapter implements MarketplaceAdapter {
  readonly marketplace = 'MAGALU';
  private readonly credentials: LomadeeCredentials;
  private readonly rateLimiter: RateLimiter;

  constructor(credentials: LomadeeCredentials) {
    this.credentials = credentials;
    // 1 req/sec
    this.rateLimiter = new RateLimiter(1, 1);
  }

  /**
   * Search products via Lomadee Offers API.
   * STUB: Returns mock data with realistic Magalu/Americanas products and BRL prices.
   */
  async searchProducts(query: string, options?: SearchOptions): Promise<Product[]> {
    await this.rateLimiter.acquire();

    // STUB: Replace with real Lomadee API call when credentials provided
    // Real implementation would call:
    // GET https://api.lomadee.com/v3/{appToken}/offer/_search?sourceId={sourceId}&keyword={query}

    const allProducts: Product[] = [
      {
        id: 'magalu_2301',
        name: 'Smart TV Samsung 50" Crystal UHD 4K 50CU7700 Tizen',
        originalPrice: 2899.00,
        promoPrice: 1999.00,
        discountPercent: 31,
        imageUrl: 'https://a-static.mlcdn.com.br/800x560/smart-tv-samsung-50.jpg',
        productUrl: 'https://www.magazineluiza.com.br/smart-tv-samsung-50-crystal-uhd/p/2301/',
        marketplace: 'MAGALU',
        category: 'TVs',
        rating: 4.6,
        soldCount: 22000,
        metadata: { store: 'magazineluiza', lomadeeId: '2301' },
      },
      {
        id: 'magalu_2302',
        name: 'Notebook Lenovo IdeaPad 3i Intel Core i5 8GB 256GB SSD 15.6" Full HD',
        originalPrice: 3499.00,
        promoPrice: 2399.00,
        discountPercent: 31,
        imageUrl: 'https://a-static.mlcdn.com.br/800x560/notebook-lenovo.jpg',
        productUrl: 'https://www.magazineluiza.com.br/notebook-lenovo-ideapad-3i/p/2302/',
        marketplace: 'MAGALU',
        category: 'Informática',
        rating: 4.4,
        soldCount: 18000,
        metadata: { store: 'magazineluiza', lomadeeId: '2302' },
      },
      {
        id: 'magalu_2303',
        name: 'Geladeira/Refrigerador Brastemp Frost Free Duplex 375L BRM44HK',
        originalPrice: 3299.00,
        promoPrice: 2499.00,
        discountPercent: 24,
        imageUrl: 'https://a-static.mlcdn.com.br/800x560/geladeira-brastemp.jpg',
        productUrl: 'https://www.magazineluiza.com.br/geladeira-brastemp-frost-free/p/2303/',
        marketplace: 'MAGALU',
        category: 'Eletrodomésticos',
        rating: 4.5,
        soldCount: 35000,
        metadata: { store: 'magazineluiza', lomadeeId: '2303' },
      },
      {
        id: 'magalu_2304',
        name: 'Smartphone Samsung Galaxy A15 128GB 4GB RAM Tela 6.5" Camera Tripla',
        originalPrice: 1199.00,
        promoPrice: 799.00,
        discountPercent: 33,
        imageUrl: 'https://a-static.mlcdn.com.br/800x560/samsung-galaxy-a15.jpg',
        productUrl: 'https://www.magazineluiza.com.br/smartphone-samsung-galaxy-a15/p/2304/',
        marketplace: 'MAGALU',
        category: 'Celulares',
        rating: 4.3,
        soldCount: 45000,
        metadata: { store: 'magazineluiza', lomadeeId: '2304' },
      },
      {
        id: 'magalu_2305',
        name: 'Maquina de Lavar Electrolux 14kg Essential Care LED14 Branca',
        originalPrice: 2199.00,
        promoPrice: 1599.00,
        discountPercent: 27,
        imageUrl: 'https://a-static.mlcdn.com.br/800x560/lavadora-electrolux.jpg',
        productUrl: 'https://www.magazineluiza.com.br/maquina-lavar-electrolux-14kg/p/2305/',
        marketplace: 'MAGALU',
        category: 'Eletrodomésticos',
        rating: 4.4,
        soldCount: 28000,
        metadata: { store: 'magazineluiza', lomadeeId: '2305' },
      },
      {
        id: 'magalu_2306',
        name: 'Cafeteira Nespresso Vertuo Pop Preta Automatica 127V',
        originalPrice: 599.00,
        promoPrice: 349.00,
        discountPercent: 42,
        imageUrl: 'https://a-static.mlcdn.com.br/800x560/cafeteira-nespresso.jpg',
        productUrl: 'https://www.magazineluiza.com.br/cafeteira-nespresso-vertuo-pop/p/2306/',
        marketplace: 'MAGALU',
        category: 'Cozinha',
        rating: 4.7,
        soldCount: 12000,
        metadata: { store: 'magazineluiza', lomadeeId: '2306' },
      },
      {
        id: 'americanas_2307',
        name: 'Console PlayStation 5 Slim Digital Edition 1TB SSD',
        originalPrice: 3699.00,
        promoPrice: 2999.00,
        discountPercent: 19,
        imageUrl: 'https://a-static.mlcdn.com.br/800x560/ps5-slim.jpg',
        productUrl: 'https://www.americanas.com.br/produto/ps5-slim-digital/p/2307/',
        marketplace: 'MAGALU',
        category: 'Games',
        rating: 4.9,
        soldCount: 55000,
        metadata: { store: 'americanas', lomadeeId: '2307' },
      },
      {
        id: 'magalu_2308',
        name: 'Aspirador de Po e Agua WAP GTW Inox 1500 12L 1400W',
        originalPrice: 349.90,
        promoPrice: 229.90,
        discountPercent: 34,
        imageUrl: 'https://a-static.mlcdn.com.br/800x560/aspirador-wap.jpg',
        productUrl: 'https://www.magazineluiza.com.br/aspirador-wap-gtw/p/2308/',
        marketplace: 'MAGALU',
        category: 'Eletrodomésticos',
        rating: 4.5,
        soldCount: 40000,
        metadata: { store: 'magazineluiza', lomadeeId: '2308' },
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
   * Generate a Lomadee deeplink for the given product URL.
   * STUB: Returns a mock deeplink. Real implementation would call /deeplink endpoint.
   */
  async generateAffiliateLink(productUrl: string): Promise<string> {
    await this.rateLimiter.acquire();

    // STUB: Replace with real Lomadee /deeplink API call when credentials provided
    // Real implementation would call:
    // GET https://api.lomadee.com/v3/{appToken}/deeplink/_create?sourceId={sourceId}&url={productUrl}

    const encodedUrl = encodeURIComponent(productUrl);
    return `https://redir.lomadee.com/v2/deeplink?url=${encodedUrl}&sourceId=${this.credentials.sourceId}`;
  }

  /**
   * Get product details from a Magalu/Americanas product URL via Lomadee.
   * STUB: Returns mock product data.
   */
  async getProductDetails(productUrl: string): Promise<Product> {
    await this.rateLimiter.acquire();

    // STUB: Replace with real Lomadee API call when credentials provided
    const idMatch = productUrl.match(/\/p\/(\w+)/);
    const productId = idMatch?.[1] ?? '2301';

    return {
      id: `magalu_${productId}`,
      name: 'Smart TV Samsung 50" Crystal UHD 4K 50CU7700 Tizen',
      originalPrice: 2899.00,
      promoPrice: 1999.00,
      discountPercent: 31,
      imageUrl: 'https://a-static.mlcdn.com.br/800x560/smart-tv-samsung-50.jpg',
      productUrl,
      marketplace: 'MAGALU',
      category: 'TVs',
      rating: 4.6,
      soldCount: 22000,
      metadata: { store: 'magazineluiza', lomadeeId: productId, fetchedAt: new Date().toISOString() },
    };
  }
}
