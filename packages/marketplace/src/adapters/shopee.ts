import { createHash } from 'node:crypto';
import { fetchWithTimeout } from '@dispara/shared';
import type {
  MarketplaceAdapter,
  Product,
  SearchOptions,
  Commission,
  DateRange,
} from '../types.js';
import { RateLimiter } from '../rate-limiter.js';

const SHOPEE_GRAPHQL_URL = 'https://open-api.affiliate.shopee.com.br/graphql';

export interface ShopeeCredentials {
  appId: string;
  appSecret: string;
}

interface ShopeeGraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code: number } }>;
}

interface ProductOfferNode {
  itemId: string;
  productName: string;
  productLink: string;
  offerLink: string;
  imageUrl: string;
  price: number;
  priceMin?: number;
  priceMax?: number;
  commissionRate: number;
  commission: number;
  sales: number;
  ratingStar: number;
  shop?: { shopId: string; shopName: string };
}

interface ConversionNode {
  orderId: string;
  itemId: string;
  productName: string;
  orderAmount: number;
  commissionRate: number;
  commission: number;
  status: string;
  orderTime: string;
}

/**
 * Shopee Affiliate Program GraphQL API adapter.
 * Auth: HMAC SHA256 signature (AppId + Timestamp + Payload + Secret).
 * Rate limit: ~100 req/min (community estimate, not officially documented).
 */
export class ShopeeAdapter implements MarketplaceAdapter {
  readonly marketplace = 'SHOPEE';
  private readonly credentials: ShopeeCredentials;
  private readonly rateLimiter: RateLimiter;
  private retryDelayMs = 1000;

  constructor(credentials: ShopeeCredentials) {
    this.credentials = credentials;
    this.rateLimiter = new RateLimiter(10, 100 / 60);
  }

  /**
   * Compute SHA256 signature: SHA256(AppId + Timestamp + Payload + Secret)
   */
  private sign(payload: string, timestamp: string): string {
    const raw = this.credentials.appId + timestamp + payload + this.credentials.appSecret;
    return createHash('sha256').update(raw, 'utf-8').digest('hex');
  }

  /**
   * Execute a GraphQL request against the Shopee Affiliate API.
   */
  private async graphql<T>(body: { query: string; variables?: Record<string, unknown> }): Promise<T> {
    await this.rateLimiter.acquire();

    const payload = JSON.stringify(body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = this.sign(payload, timestamp);

    const response = await fetchWithTimeout(SHOPEE_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `SHA256 Credential=${this.credentials.appId},Timestamp=${timestamp},Signature=${signature}`,
      },
      body: payload,
    }, 15_000);

    if (response.status === 429) {
      const delay = this.retryDelayMs;
      this.retryDelayMs = Math.min(this.retryDelayMs * 2, 30000);
      await new Promise(r => setTimeout(r, delay));
      this.retryDelayMs = 1000;
      return this.graphql<T>(body);
    }

    if (!response.ok) {
      throw new Error(`Shopee API HTTP ${response.status}: ${await response.text()}`);
    }

    const json = (await response.json()) as ShopeeGraphQLResponse<T>;

    if (json.errors?.length) {
      const err = json.errors[0]!;
      throw new Error(`Shopee GraphQL error ${err.extensions?.code ?? 'unknown'}: ${err.message}`);
    }

    if (!json.data) {
      throw new Error('Shopee API returned empty data');
    }

    return json.data;
  }

  private mapSortBy(sortBy?: string): number {
    switch (sortBy) {
      case 'price': return 3;
      case 'discount': return 4;
      default: return 5; // relevance
    }
  }

  async searchProducts(query: string, options?: SearchOptions): Promise<Product[]> {
    const limit = Math.min(options?.limit ?? 20, 50);

    const data = await this.graphql<{
      productOfferV2: { nodes: ProductOfferNode[] };
    }>({
      query: `
        query ProductSearch($keyword: String!, $limit: Int!, $sortType: Int!) {
          productOfferV2(keyword: $keyword, listType: 1, sortType: $sortType, page: 1, limit: $limit) {
            nodes {
              itemId
              productName
              productLink
              offerLink
              imageUrl
              price
              priceMin
              priceMax
              commissionRate
              commission
              sales
              ratingStar
              shop { shopId shopName }
            }
          }
        }
      `,
      variables: {
        keyword: query,
        limit,
        sortType: this.mapSortBy(options?.sortBy),
      },
    });

    let products = (data.productOfferV2.nodes ?? []).map((node): Product => {
      const originalPrice = node.priceMax ?? node.price;
      const promoPrice = node.priceMin ?? node.price;
      const discountPercent =
        originalPrice > promoPrice
          ? Math.round(((originalPrice - promoPrice) / originalPrice) * 100)
          : 0;

      return {
        id: node.itemId,
        name: node.productName,
        originalPrice,
        promoPrice,
        discountPercent,
        imageUrl: node.imageUrl,
        productUrl: node.productLink,
        marketplace: 'SHOPEE',
        rating: node.ratingStar,
        soldCount: node.sales,
        metadata: {
          offerLink: node.offerLink,
          commissionRate: node.commissionRate,
          commission: node.commission,
          shopId: node.shop?.shopId,
          shopName: node.shop?.shopName,
        },
      };
    });

    if (options?.minPrice !== undefined) {
      products = products.filter(p => p.promoPrice >= options.minPrice!);
    }
    if (options?.maxPrice !== undefined) {
      products = products.filter(p => p.promoPrice <= options.maxPrice!);
    }

    return products;
  }

  async generateAffiliateLink(productUrl: string, subIds?: string[]): Promise<string> {
    const variables: Record<string, unknown> = {
      input: { originUrl: productUrl },
    };
    if (subIds?.length) {
      (variables.input as Record<string, unknown>).subIds = subIds;
    }

    const data = await this.graphql<{
      generateShortLink: { shortLink: string };
    }>({
      query: `
        mutation GenerateShortLink($input: GenerateShortLinkInput!) {
          generateShortLink(input: $input) {
            shortLink
          }
        }
      `,
      variables,
    });

    return data.generateShortLink.shortLink;
  }

  async getProductDetails(productUrl: string): Promise<Product> {
    // Extract item name/id from Shopee URL for keyword search
    const urlMatch = productUrl.match(/i\.(\d+)\.(\d+)/);
    const keyword = urlMatch ? urlMatch[2]! : productUrl.split('/').pop()?.replace(/-/g, ' ') ?? '';

    const results = await this.searchProducts(keyword, { limit: 1 });

    if (results.length > 0) {
      return { ...results[0]!, productUrl };
    }

    throw new Error(`Product not found for URL: ${productUrl}`);
  }

  async getCommissions(dateRange: DateRange): Promise<Commission[]> {
    const data = await this.graphql<{
      conversionReport: { nodes: ConversionNode[] };
    }>({
      query: `
        query ConversionReport($startDate: String!, $endDate: String!) {
          conversionReport(startDate: $startDate, endDate: $endDate) {
            nodes {
              orderId
              itemId
              productName
              orderAmount
              commissionRate
              commission
              status
              orderTime
            }
          }
        }
      `,
      variables: {
        startDate: dateRange.start.toISOString().split('T')[0],
        endDate: dateRange.end.toISOString().split('T')[0],
      },
    });

    return (data.conversionReport.nodes ?? []).map((node): Commission => ({
      orderId: node.orderId,
      itemId: node.itemId,
      productName: node.productName,
      orderAmount: node.orderAmount,
      commissionRate: node.commissionRate,
      commissionAmount: node.commission,
      status: this.mapCommissionStatus(node.status),
      orderDate: new Date(node.orderTime),
      marketplace: 'SHOPEE',
    }));
  }

  private mapCommissionStatus(status: string): Commission['status'] {
    const s = status.toLowerCase();
    if (s.includes('approv') || s.includes('confirm')) return 'approved';
    if (s.includes('reject') || s.includes('cancel')) return 'rejected';
    return 'pending';
  }
}
