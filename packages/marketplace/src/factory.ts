import type { MarketplaceAdapter } from './types.js';
import { AmazonAdapter } from './adapters/amazon.js';
import { ShopeeAdapter } from './adapters/shopee.js';
import { LomadeeAdapter } from './adapters/lomadee.js';

/**
 * Factory function to create marketplace adapters.
 *
 * @param marketplace - Marketplace identifier (AMAZON, SHOPEE, MAGALU, MERCADOLIVRE, ALIEXPRESS)
 * @param credentials - Marketplace-specific credentials
 * @returns A configured MarketplaceAdapter instance
 * @throws Error if the marketplace is not supported
 *
 * @example
 * ```typescript
 * const amazon = createMarketplaceAdapter('AMAZON', {
 *   accessKey: 'your-access-key',
 *   secretKey: 'your-secret-key',
 *   partnerTag: 'your-tag-20',
 * });
 *
 * const products = await amazon.searchProducts('kindle');
 * ```
 */
export function createMarketplaceAdapter(
  marketplace: string,
  credentials: Record<string, string>,
): MarketplaceAdapter {
  switch (marketplace.toUpperCase()) {
    case 'AMAZON':
      return new AmazonAdapter({
        accessKey: credentials.accessKey ?? credentials.access_key ?? '',
        secretKey: credentials.secretKey ?? credentials.secret_key ?? '',
        partnerTag: credentials.partnerTag ?? credentials.partner_tag ?? '',
        marketplace: credentials.marketplace,
      });

    case 'SHOPEE':
      return new ShopeeAdapter({
        appId: credentials.appId ?? credentials.app_id ?? '',
        appSecret: credentials.appSecret ?? credentials.app_secret ?? '',
      });

    case 'MAGALU':
    case 'MERCADOLIVRE':
      // Both use Lomadee as the affiliate network in Brazil
      return new LomadeeAdapter({
        apiKey: credentials.apiKey ?? credentials.api_key ?? '',
        sourceId: credentials.sourceId ?? credentials.source_id ?? '',
      });

    case 'ALIEXPRESS':
      // AliExpress adapter not yet implemented - use Lomadee as placeholder
      // TODO: Implement dedicated AliExpress Portals API adapter
      return new LomadeeAdapter({
        apiKey: credentials.apiKey ?? credentials.api_key ?? '',
        sourceId: credentials.sourceId ?? credentials.source_id ?? '',
      });

    default:
      throw new Error(
        `Unsupported marketplace: "${marketplace}". ` +
        `Supported marketplaces: AMAZON, SHOPEE, MAGALU, MERCADOLIVRE, ALIEXPRESS`,
      );
  }
}
