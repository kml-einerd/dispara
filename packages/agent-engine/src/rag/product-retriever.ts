import pino from 'pino';
import type { ProductMatch } from '../types.js';

const logger = pino({ name: '@promospot/agent-engine/rag' });

/**
 * Retrieves relevant products for a given query.
 * Stub — will be backed by PostgreSQL full-text search + optional vector similarity.
 */
export async function retrieveProducts(
  _tenantId: string,
  _query: string,
  _limit: number = 3,
): Promise<ProductMatch[]> {
  logger.debug({ _tenantId, _query, _limit }, 'Product retrieval stub called');

  // TODO: implement with Prisma query against products table
  // SELECT * FROM promos WHERE tenant_id = $1
  //   AND to_tsvector('portuguese', name || ' ' || category) @@ plainto_tsquery('portuguese', $2)
  //   ORDER BY ts_rank(...) DESC LIMIT $3
  return [];
}
