import { describe, it, expect } from 'vitest';
import { createMarketplaceAdapter } from '../factory.js';
import { AmazonAdapter } from '../adapters/amazon.js';
import { ShopeeAdapter } from '../adapters/shopee.js';
import { LomadeeAdapter } from '../adapters/lomadee.js';

describe('createMarketplaceAdapter (MarketplaceFactory)', () => {
  const amazonCreds = {
    accessKey: 'ak',
    secretKey: 'sk',
    partnerTag: 'tag-20',
  };

  const shopeeCreds = {
    appId: 'app123',
    appSecret: 'secret456',
  };

  const lomadeeCreds = {
    apiKey: 'api-key',
    sourceId: 'src-id',
  };

  it('creates AmazonAdapter for "AMAZON"', () => {
    const adapter = createMarketplaceAdapter('AMAZON', amazonCreds);
    expect(adapter).toBeInstanceOf(AmazonAdapter);
    expect(adapter.marketplace).toBe('AMAZON');
  });

  it('creates AmazonAdapter case-insensitively', () => {
    const adapter = createMarketplaceAdapter('amazon', amazonCreds);
    expect(adapter).toBeInstanceOf(AmazonAdapter);
  });

  it('creates ShopeeAdapter for "SHOPEE"', () => {
    const adapter = createMarketplaceAdapter('SHOPEE', shopeeCreds);
    expect(adapter).toBeInstanceOf(ShopeeAdapter);
    expect(adapter.marketplace).toBe('SHOPEE');
  });

  it('creates LomadeeAdapter for "MAGALU"', () => {
    const adapter = createMarketplaceAdapter('MAGALU', lomadeeCreds);
    expect(adapter).toBeInstanceOf(LomadeeAdapter);
    expect(adapter.marketplace).toBe('MAGALU');
  });

  it('creates LomadeeAdapter for "MERCADOLIVRE"', () => {
    const adapter = createMarketplaceAdapter('MERCADOLIVRE', lomadeeCreds);
    expect(adapter).toBeInstanceOf(LomadeeAdapter);
  });

  it('creates LomadeeAdapter for "ALIEXPRESS"', () => {
    const adapter = createMarketplaceAdapter('ALIEXPRESS', lomadeeCreds);
    expect(adapter).toBeInstanceOf(LomadeeAdapter);
  });

  it('throws for unknown marketplace', () => {
    expect(() => createMarketplaceAdapter('UNKNOWN', {})).toThrow(
      'Unsupported marketplace: "UNKNOWN"',
    );
  });

  it('throws with list of supported marketplaces', () => {
    expect(() => createMarketplaceAdapter('WISH', {})).toThrow(
      'Supported marketplaces: AMAZON, SHOPEE, MAGALU, MERCADOLIVRE, ALIEXPRESS',
    );
  });

  it('accepts snake_case credential keys', () => {
    const adapter = createMarketplaceAdapter('AMAZON', {
      access_key: 'ak',
      secret_key: 'sk',
      partner_tag: 'tag-20',
    });
    expect(adapter).toBeInstanceOf(AmazonAdapter);
  });

  it('accepts snake_case credential keys for Shopee', () => {
    const adapter = createMarketplaceAdapter('SHOPEE', {
      app_id: 'app123',
      app_secret: 'secret456',
    });
    expect(adapter).toBeInstanceOf(ShopeeAdapter);
  });

  it('accepts snake_case credential keys for Lomadee', () => {
    const adapter = createMarketplaceAdapter('MAGALU', {
      api_key: 'key',
      source_id: 'sid',
    });
    expect(adapter).toBeInstanceOf(LomadeeAdapter);
  });
});
