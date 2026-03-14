/**
 * Core interface that all marketplace adapters must implement.
 * Each adapter handles product search, affiliate link generation, and product details
 * for a specific marketplace (Amazon, Shopee, Lomadee/Magalu).
 */
export interface MarketplaceAdapter {
  /** The marketplace identifier (e.g. 'AMAZON', 'SHOPEE', 'MAGALU') */
  readonly marketplace: string;

  /**
   * Search for products on the marketplace.
   * @param query - Search query string
   * @param options - Optional search filters and pagination
   * @returns Array of matching products
   */
  searchProducts(query: string, options?: SearchOptions): Promise<Product[]>;

  /**
   * Generate an affiliate link for a given product URL.
   * @param productUrl - The original product URL
   * @returns The affiliate-tagged URL
   */
  generateAffiliateLink(productUrl: string): Promise<string>;

  /**
   * Get detailed product information from a product URL.
   * @param productUrl - The product page URL
   * @returns Full product details
   */
  getProductDetails(productUrl: string): Promise<Product>;
}

/** Options for filtering and sorting product search results */
export interface SearchOptions {
  /** Maximum number of results to return (default: 10) */
  limit?: number;
  /** Minimum price filter in BRL */
  minPrice?: number;
  /** Maximum price filter in BRL */
  maxPrice?: number;
  /** Sort order for results */
  sortBy?: 'price' | 'relevance' | 'discount';
}

/** Normalized product representation across all marketplaces */
export interface Product {
  /** Unique product identifier from the marketplace */
  id: string;
  /** Product name/title */
  name: string;
  /** Original price before discount (BRL) */
  originalPrice: number;
  /** Current promotional price (BRL) */
  promoPrice: number;
  /** Discount percentage (0-100) */
  discountPercent: number;
  /** Primary product image URL */
  imageUrl: string;
  /** Direct URL to the product page */
  productUrl: string;
  /** Marketplace identifier */
  marketplace: string;
  /** Product category */
  category?: string;
  /** Average rating (0-5) */
  rating?: number;
  /** Total units sold */
  soldCount?: number;
  /** Additional marketplace-specific metadata */
  metadata?: Record<string, unknown>;
}

/** Date range for commission queries */
export interface DateRange {
  start: Date;
  end: Date;
}

/** Normalized commission/conversion record */
export interface Commission {
  orderId: string;
  itemId: string;
  productName: string;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  orderDate: Date;
  marketplace: string;
  metadata?: Record<string, unknown>;
}
