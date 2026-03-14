import type { MarketplaceAdapter, Product, SearchOptions } from '../types.js';
import { RateLimiter } from '../rate-limiter.js';

interface MercadoLivreCredentials {
  /** App ID from developers.mercadolivre.com.br */
  appId: string;
  /** App secret for OAuth (optional — public endpoints don't require auth) */
  appSecret?: string;
  /** Access token for authenticated endpoints (6h TTL, refresh via OAuth) */
  accessToken?: string;
  /** Affiliate tracking tool ID (matt_tool parameter) */
  mattTool?: string;
  /** Affiliate tracking word/campaign ID (matt_word parameter) */
  mattWord?: string;
}

const ML_API_BASE = 'https://api.mercadolibre.com';
const ML_SITE_ID = 'MLB';

/**
 * Mercado Livre API adapter using the public Developers API.
 *
 * Search: GET /sites/MLB/search?q={query} (public, no auth)
 * Details: GET /items/{item_id} (public for most fields)
 * Affiliate links: URL construction with matt_tool/matt_word params (no official API exists).
 *
 * Rate limits: 500 GET/min per app, 1500 req/min total.
 * Docs: developers.mercadolivre.com.br
 */
export class MercadoLivreAdapter implements MarketplaceAdapter {
  readonly marketplace = 'MERCADOLIVRE';
  private readonly credentials: MercadoLivreCredentials;
  private readonly rateLimiter: RateLimiter;

  constructor(credentials: MercadoLivreCredentials) {
    this.credentials = credentials;
    // 500 GET/min ≈ 8.33 req/sec, burst of 10
    this.rateLimiter = new RateLimiter(10, 500 / 60);
  }

  async searchProducts(query: string, options?: SearchOptions): Promise<Product[]> {
    await this.rateLimiter.acquire();

    const params = new URLSearchParams({
      q: query,
      limit: String(options?.limit ?? 10),
    });

    if (options?.minPrice !== undefined) {
      params.set('price', `${options.minPrice}-*`);
    }
    if (options?.maxPrice !== undefined) {
      const current = params.get('price');
      if (current) {
        params.set('price', current.replace('*', String(options.maxPrice)));
      } else {
        params.set('price', `*-${options.maxPrice}`);
      }
    }
    if (options?.sortBy === 'price') {
      params.set('sort', 'price_asc');
    } else if (options?.sortBy === 'relevance') {
      params.set('sort', 'relevance');
    }

    const url = `${ML_API_BASE}/sites/${ML_SITE_ID}/search?${params}`;
    const headers: Record<string, string> = {};
    if (this.credentials.accessToken) {
      headers['Authorization'] = `Bearer ${this.credentials.accessToken}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`ML search failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as {
      results: Array<{
        id: string;
        title: string;
        price: number;
        original_price: number | null;
        thumbnail: string;
        permalink: string;
        category_id: string;
        sold_quantity: number;
      }>;
    };

    let products = data.results.map((item): Product => {
      const original = item.original_price ?? item.price;
      const discount = original > item.price
        ? Math.round(((original - item.price) / original) * 100)
        : 0;

      return {
        id: item.id,
        name: item.title,
        originalPrice: original,
        promoPrice: item.price,
        discountPercent: discount,
        imageUrl: item.thumbnail?.replace('-I.jpg', '-O.jpg') ?? '',
        productUrl: item.permalink,
        marketplace: 'MERCADOLIVRE',
        category: item.category_id,
        soldCount: item.sold_quantity,
        metadata: { mlId: item.id, categoryId: item.category_id },
      };
    });

    if (options?.sortBy === 'discount') {
      products.sort((a, b) => b.discountPercent - a.discountPercent);
    }

    return products;
  }

  /**
   * Constructs an affiliate-tagged URL using matt_tool/matt_word parameters.
   *
   * IMPORTANT: There is NO official API for generating ML affiliate links.
   * This uses URL parameter construction which is the only programmatic approach.
   * The official way is via the Affiliate Portal (manual, desktop-only, QR login).
   *
   * If matt_tool/matt_word are not configured, returns the original URL unchanged.
   */
  async generateAffiliateLink(productUrl: string): Promise<string> {
    const { mattTool, mattWord } = this.credentials;

    if (!mattTool) {
      return productUrl;
    }

    const url = new URL(productUrl);
    url.searchParams.set('matt_tool', mattTool);
    if (mattWord) {
      url.searchParams.set('matt_word', mattWord);
    }

    return url.toString();
  }

  async getProductDetails(productUrl: string): Promise<Product> {
    await this.rateLimiter.acquire();

    const itemId = this.extractItemId(productUrl);
    if (!itemId) {
      throw new Error(`Could not extract ML item ID from URL: ${productUrl}`);
    }

    const headers: Record<string, string> = {};
    if (this.credentials.accessToken) {
      headers['Authorization'] = `Bearer ${this.credentials.accessToken}`;
    }

    const res = await fetch(`${ML_API_BASE}/items/${itemId}`, { headers });
    if (!res.ok) {
      throw new Error(`ML getItem failed: ${res.status} ${res.statusText}`);
    }

    const item = await res.json() as {
      id: string;
      title: string;
      price: number;
      original_price: number | null;
      base_price: number;
      pictures: Array<{ url: string }>;
      permalink: string;
      category_id: string;
      sold_quantity: number;
      available_quantity: number;
      seller_id: number;
      date_created: string;
      last_updated: string;
    };

    const original = item.original_price ?? item.base_price ?? item.price;
    const discount = original > item.price
      ? Math.round(((original - item.price) / original) * 100)
      : 0;

    return {
      id: item.id,
      name: item.title,
      originalPrice: original,
      promoPrice: item.price,
      discountPercent: discount,
      imageUrl: item.pictures?.[0]?.url ?? '',
      productUrl: item.permalink,
      marketplace: 'MERCADOLIVRE',
      category: item.category_id,
      soldCount: item.sold_quantity,
      metadata: {
        mlId: item.id,
        categoryId: item.category_id,
        sellerId: item.seller_id,
        availableQty: item.available_quantity,
        createdAt: item.date_created,
        updatedAt: item.last_updated,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Extracts ML item ID (e.g. MLB1234567890) from various URL formats:
   * - /MLB-1234567890-... (listing URL with dashes)
   * - /p/MLB12345 (catalog URL)
   * - /items/MLB1234567890 (API URL)
   */
  private extractItemId(url: string): string | null {
    // Format: MLB-1234567890 in path (listing permalink)
    const dashMatch = url.match(/\/(MLB)-?(\d+)/i);
    if (dashMatch) {
      return `${dashMatch[1].toUpperCase()}${dashMatch[2]}`;
    }

    // Format: /p/MLB12345 (catalog)
    const catalogMatch = url.match(/\/p\/(MLB\d+)/i);
    if (catalogMatch) {
      return catalogMatch[1].toUpperCase();
    }

    return null;
  }
}
