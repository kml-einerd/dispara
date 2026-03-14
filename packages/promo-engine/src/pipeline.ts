import type { MarketplaceAdapter, Product } from '@dispara/marketplace';
import type { CopyVariation, Product as SharedProduct } from '@dispara/shared';
import { detectMarketplace } from '@dispara/shared';
import { CopyGenerator } from './copy-generator.js';
import type { ImageStorage } from './image-storage.js';
import type { ImageGenerator } from './image-generator.js';

/** Input for promo generation */
export interface PromoInput {
  /** Product URL to generate promo from */
  url?: string;
  /** Search keyword (alternative to URL) */
  keyword?: string;
  /** Target marketplace (required when using keyword) */
  marketplace?: string;
  /** Tenant UUID for scoping */
  tenantId: string;
  /** User UUID who initiated the promo */
  userId: string;
}

/** Complete promo generation result */
export interface PromoResult {
  /** Normalized product data */
  product: Product;
  /** Affiliate-tagged URL */
  affiliateUrl: string;
  /** AI-generated copy variations */
  copyVariations: CopyVariation[];
  /** Product image URL (from marketplace or stored copy) */
  imageUrl: string;
  /** AI-generated promo image URL (if ImageGenerator is configured) */
  generatedImageUrl?: string;
  /** Marketplace identifier */
  marketplace: string;
  /** Timestamp of generation */
  generatedAt: Date;
}

/**
 * Main promo generation pipeline.
 *
 * Orchestrates the full flow from product URL/keyword to a complete promo:
 * 1. Detect marketplace from URL
 * 2. Get product details via marketplace adapter
 * 3. Generate affiliate link
 * 4. Generate 3 copy variations via Claude Haiku
 * 5. Use marketplace product image (v1 - no AI image gen)
 * 6. Return complete PromoResult
 *
 * Target latency: < 5s p95
 */
export class PromoEngine {
  private readonly marketplaceAdapters: Map<string, MarketplaceAdapter>;
  private readonly copyGenerator: CopyGenerator;
  private readonly imageStorage?: ImageStorage;
  private readonly imageGenerator?: ImageGenerator;


  /**
   * @param marketplaceAdapters - Map of marketplace name to adapter instance
   * @param copyGenerator - Claude Haiku copy generator
   * @param imageStorage - Optional image storage (Supabase for v1)
   * @param imageGenerator - Optional AI image generator
   */
  constructor(
    marketplaceAdapters: Map<string, MarketplaceAdapter>,
    copyGenerator: CopyGenerator,
    imageStorage?: ImageStorage,
    imageGenerator?: ImageGenerator,
  ) {
    this.marketplaceAdapters = marketplaceAdapters;
    this.copyGenerator = copyGenerator;
    this.imageStorage = imageStorage;
    this.imageGenerator = imageGenerator;
  }

  /**
   * Main entry point: generates a complete promo from a product URL or keyword.
   *
   * When a URL is provided, the pipeline:
   * 1. Auto-detects the marketplace
   * 2. Fetches product details
   * 3. Generates affiliate link
   * 4. Generates copy variations via Claude Haiku
   * 5. Optionally stores the product image
   *
   * @param input - Product URL or keyword with tenant context
   * @returns Complete promo result ready for dispatch
   * @throws Error if marketplace not detected or adapter not configured
   */
  async generatePromo(input: PromoInput): Promise<PromoResult> {
    const startTime = Date.now();

    // Step 1: Determine marketplace and get adapter
    let marketplace: string;
    let adapter: MarketplaceAdapter;

    if (input.url) {
      const detected = detectMarketplace(input.url);
      if (!detected) {
        throw new Error(
          `Could not detect marketplace from URL: ${input.url}. ` +
          `Supported: AMAZON, SHOPEE, MERCADOLIVRE, MAGALU, ALIEXPRESS`,
        );
      }
      marketplace = detected;
      adapter = this.getAdapter(marketplace);
    } else if (input.keyword && input.marketplace) {
      marketplace = input.marketplace.toUpperCase();
      adapter = this.getAdapter(marketplace);
    } else {
      throw new Error('Either url or (keyword + marketplace) must be provided');
    }

    // Step 2: Get product details
    let product: Product;
    if (input.url) {
      product = await adapter.getProductDetails(input.url);
    } else {
      const products = await adapter.searchProducts(input.keyword!, { limit: 1, sortBy: 'relevance' });
      if (products.length === 0) {
        throw new Error(`No products found for keyword: "${input.keyword}" on ${marketplace}`);
      }
      product = products[0]!;
    }

    // Step 3: Generate affiliate link
    const affiliateUrl = await adapter.generateAffiliateLink(product.productUrl);

    // Step 4: Generate copy variations via Claude Haiku
    const copyVariations = await this.copyGenerator.generateVariations(product, 3);

    // Step 5: Handle product image
    let imageUrl = product.imageUrl;
    if (this.imageStorage && product.imageUrl) {
      try {
        const promoId = crypto.randomUUID();
        imageUrl = await this.imageStorage.upload(input.tenantId, promoId, product.imageUrl);
      } catch {
        // Fall back to original marketplace image URL
        imageUrl = product.imageUrl;
      }
    }

    // Step 6: Generate AI promo image (if generator configured)
    let generatedImageUrl: string | undefined;
    if (this.imageGenerator) {
      try {
        const generated = await this.imageGenerator.generatePromoImage(product as any);

        if (this.imageStorage && generated.imageUrl.startsWith('data:')) {
          const base64Data = generated.imageUrl.split(',')[1]!;
          const buffer = Buffer.from(base64Data, 'base64').buffer;
          generatedImageUrl = await this.imageStorage.uploadBuffer(
            input.tenantId, crypto.randomUUID(), buffer, 'image/png',
          );
        } else {
          generatedImageUrl = generated.imageUrl;
        }
      } catch (err) {
        console.warn('[PromoEngine] Image generation failed, continuing without:', err);
      }
    }

    const elapsed = Date.now() - startTime;
    if (elapsed > 5000) {
      console.warn(`[PromoEngine] Slow generation: ${elapsed}ms (target: <5000ms)`);
    }

    return {
      product,
      affiliateUrl,
      copyVariations,
      imageUrl,
      generatedImageUrl,
      marketplace,
      generatedAt: new Date(),
    };
  }

  /**
   * Generates multiple promos from a keyword search across marketplaces.
   * Searches across configured marketplaces and picks the best deals.
   *
   * @param keyword - Search term
   * @param marketplace - Optional: limit to a specific marketplace
   * @returns Array of promo results sorted by discount percentage
   */
  async generateFromKeyword(keyword: string, marketplace?: string): Promise<PromoResult[]> {
    // Determine which adapters to search
    let adaptersToSearch: Array<[string, MarketplaceAdapter]>;

    if (marketplace) {
      const key = marketplace.toUpperCase();
      const adapter = this.marketplaceAdapters.get(key);
      if (!adapter) {
        throw new Error(`Marketplace adapter not configured: ${key}`);
      }
      adaptersToSearch = [[key, adapter]];
    } else {
      adaptersToSearch = Array.from(this.marketplaceAdapters.entries());
    }

    // Search all marketplaces in parallel
    const searchResults = await Promise.allSettled(
      adaptersToSearch.map(async ([name, adapter]) => {
        const products = await adapter.searchProducts(keyword, {
          limit: 5,
          sortBy: 'discount',
        });
        return { marketplace: name, products };
      }),
    );

    // Collect all successful products
    const allProducts: Array<{ marketplace: string; product: Product }> = [];

    for (const result of searchResults) {
      if (result.status === 'fulfilled') {
        for (const product of result.value.products) {
          allProducts.push({
            marketplace: result.value.marketplace,
            product,
          });
        }
      }
    }

    // Sort by discount and take top results
    allProducts.sort((a, b) => b.product.discountPercent - a.product.discountPercent);
    const topProducts = allProducts.slice(0, 10);

    // Generate promos for top products in parallel (max 5 concurrent)
    const promoResults: PromoResult[] = [];
    const batchSize = 5;

    for (let i = 0; i < topProducts.length; i += batchSize) {
      const batch = topProducts.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async ({ marketplace: mkt, product }) => {
          const adapter = this.getAdapter(mkt);
          const affiliateUrl = await adapter.generateAffiliateLink(product.productUrl);
          const copyVariations = await this.copyGenerator.generateVariations(product, 3);

          return {
            product,
            affiliateUrl,
            copyVariations,
            imageUrl: product.imageUrl,
            marketplace: mkt,
            generatedAt: new Date(),
          } satisfies PromoResult;
        }),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          promoResults.push(result.value);
        }
      }
    }

    return promoResults;
  }

  /**
   * Gets a marketplace adapter by name, throwing if not configured.
   */
  private getAdapter(marketplace: string): MarketplaceAdapter {
    const adapter = this.marketplaceAdapters.get(marketplace.toUpperCase());
    if (!adapter) {
      throw new Error(
        `Marketplace adapter not configured: ${marketplace}. ` +
        `Available: ${Array.from(this.marketplaceAdapters.keys()).join(', ')}`,
      );
    }
    return adapter;
  }
}
