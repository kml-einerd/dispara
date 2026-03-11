import pino from 'pino';
import type { ClassificationResult, ProductForRAG, RAGResult } from './types.js';

const logger = pino({ name: 'product-rag' });

const MAX_RESULTS = 3;

export type ProductQueryFn = (
  tenantId: string,
  searchQuery: string,
  category?: string,
  maxPrice?: number,
) => Promise<Array<ProductForRAG & { rank?: number }>>;

export class ProductRAG {
  private queryFn: ProductQueryFn;

  constructor(queryFn: ProductQueryFn) {
    this.queryFn = queryFn;
  }

  async searchProducts(
    tenantId: string,
    query: string,
    entities: ClassificationResult['entities'],
  ): Promise<RAGResult[]> {
    try {
      const searchQuery = this.buildSearchQuery(query, entities);

      logger.info({ tenantId, searchQuery, entities }, 'Searching products');

      const products = await this.queryFn(
        tenantId,
        searchQuery,
        entities.category,
        entities.maxPrice,
      );

      const results: RAGResult[] = products.slice(0, MAX_RESULTS).map((product, index) => ({
        product,
        score: product.rank ?? 1.0 / (index + 1),
      }));

      logger.info({ tenantId, resultCount: results.length }, 'Product search completed');
      return results;
    } catch (err) {
      logger.error({ tenantId, query, err }, 'Error searching products');
      return [];
    }
  }

  private buildSearchQuery(query: string, entities: ClassificationResult['entities']): string {
    const parts: string[] = [];

    if (entities.productName) {
      parts.push(entities.productName);
    }

    if (entities.brand) {
      parts.push(entities.brand);
    }

    if (entities.category) {
      parts.push(entities.category);
    }

    // If entities didn't produce useful search terms, fall back to the original query
    if (parts.length === 0) {
      return query;
    }

    return parts.join(' ');
  }
}
