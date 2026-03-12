import { describe, it, expect } from 'vitest';
import {
  detectMarketplace,
  formatPrice,
  generateSlug,
  isWithinDispatchWindow,
  getWarmupLimits,
  MARKETPLACE_CONFIGS,
  DISPATCH_WINDOWS,
  WARMUP_GRADUATED,
} from '../index.js';

describe('detectMarketplace()', () => {
  describe('Amazon URLs', () => {
    it('detects amazon.com.br', () => {
      expect(detectMarketplace('https://www.amazon.com.br/dp/B0CHX3QBCH')).toBe('AMAZON');
    });

    it('detects amzn.to short link', () => {
      expect(detectMarketplace('https://amzn.to/3ABC123')).toBe('AMAZON');
    });

    it('detects a.co short link', () => {
      expect(detectMarketplace('https://a.co/d/1234567')).toBe('AMAZON');
    });

    it('is case-insensitive', () => {
      expect(detectMarketplace('https://WWW.AMAZON.COM.BR/dp/B123')).toBe('AMAZON');
    });
  });

  describe('Shopee URLs', () => {
    it('detects shopee.com.br', () => {
      expect(detectMarketplace('https://shopee.com.br/product/123/456')).toBe('SHOPEE');
    });

    it('detects shp.ee short link', () => {
      expect(detectMarketplace('https://shp.ee/abc123')).toBe('SHOPEE');
    });
  });

  describe('Mercado Livre URLs', () => {
    it('detects mercadolivre.com.br', () => {
      expect(detectMarketplace('https://www.mercadolivre.com.br/produto-123')).toBe(
        'MERCADOLIVRE',
      );
    });

    it('detects mercadolibre.com', () => {
      expect(detectMarketplace('https://www.mercadolibre.com/item-MLB-123')).toBe(
        'MERCADOLIVRE',
      );
    });

    it('detects produto.mercadolivre subdomain', () => {
      expect(detectMarketplace('https://produto.mercadolivre.com.br/MLB-123')).toBe(
        'MERCADOLIVRE',
      );
    });
  });

  describe('Magazine Luiza URLs', () => {
    it('detects magazineluiza.com.br', () => {
      expect(
        detectMarketplace('https://www.magazineluiza.com.br/smart-tv/p/2301/'),
      ).toBe('MAGALU');
    });

    it('detects magalu.com', () => {
      expect(detectMarketplace('https://magalu.com/produto/p/123/')).toBe('MAGALU');
    });
  });

  describe('AliExpress URLs', () => {
    it('detects aliexpress.com', () => {
      expect(
        detectMarketplace('https://pt.aliexpress.com/item/1234567890.html'),
      ).toBe('ALIEXPRESS');
    });

    it('detects s.click.aliexpress short link', () => {
      expect(detectMarketplace('https://s.click.aliexpress.com/e/_abc123')).toBe(
        'ALIEXPRESS',
      );
    });
  });

  describe('unknown URLs', () => {
    it('returns null for unknown domains', () => {
      expect(detectMarketplace('https://www.google.com/search?q=fone')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(detectMarketplace('')).toBeNull();
    });

    it('returns null for non-marketplace URLs', () => {
      expect(detectMarketplace('https://www.kabum.com.br/produto/123')).toBeNull();
    });
  });
});

describe('formatPrice()', () => {
  it('formats integer price', () => {
    expect(formatPrice(100)).toBe('R$ 100,00');
  });

  it('formats decimal price', () => {
    expect(formatPrice(29.9)).toBe('R$ 29,90');
  });

  it('formats price with two decimal places', () => {
    expect(formatPrice(1299.99)).toBe('R$ 1299,99');
  });

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('R$ 0,00');
  });

  it('formats large price', () => {
    expect(formatPrice(9999.99)).toBe('R$ 9999,99');
  });

  it('uses comma as decimal separator (BRL standard)', () => {
    const formatted = formatPrice(49.9);
    expect(formatted).toContain(',');
    expect(formatted).not.toMatch(/\.\d{2}$/); // no dot before cents
  });
});

describe('generateSlug()', () => {
  it('converts to lowercase', () => {
    expect(generateSlug('ECHO DOT')).toBe('echo-dot');
  });

  it('replaces spaces with hyphens', () => {
    expect(generateSlug('fone de ouvido bluetooth')).toBe('fone-de-ouvido-bluetooth');
  });

  it('removes accents', () => {
    expect(generateSlug('Eletrônicos e Informática')).toBe('eletronicos-e-informatica');
  });

  it('removes special characters', () => {
    expect(generateSlug('Smart TV 50" Samsung (4K)')).toBe('smart-tv-50-samsung-4k');
  });

  it('collapses multiple hyphens', () => {
    expect(generateSlug('produto   com   espaços')).toBe('produto-com-espacos');
  });

  it('trims leading and trailing hyphens', () => {
    expect(generateSlug(' -produto- ')).toBe('produto');
  });

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('');
  });

  it('creates URL-safe slug from Brazilian product name', () => {
    const slug = generateSlug('Cafeteira Nespresso Vertuo Pop Preta Automática 127V');
    expect(slug).toBe('cafeteira-nespresso-vertuo-pop-preta-automatica-127v');
    expect(slug).toMatch(/^[a-z0-9-]*$/);
  });
});

describe('isWithinDispatchWindow()', () => {
  it('returns true within morning window (09-12h BRT)', () => {
    // 10h BRT = 13h UTC
    const date = new Date('2026-03-11T13:00:00Z');
    expect(isWithinDispatchWindow(date)).toBe(true);
  });

  it('returns true within afternoon window (14-18h BRT)', () => {
    // 15h BRT = 18h UTC
    const date = new Date('2026-03-11T18:00:00Z');
    expect(isWithinDispatchWindow(date)).toBe(true);
  });

  it('returns false outside windows (13h BRT)', () => {
    // 13h BRT = 16h UTC
    const date = new Date('2026-03-11T16:00:00Z');
    expect(isWithinDispatchWindow(date)).toBe(false);
  });

  it('returns false at night (22h BRT)', () => {
    // 22h BRT = 01h+1 UTC
    const date = new Date('2026-03-12T01:00:00Z');
    expect(isWithinDispatchWindow(date)).toBe(false);
  });

  it('returns false at early morning (06h BRT)', () => {
    // 6h BRT = 9h UTC
    const date = new Date('2026-03-11T09:00:00Z');
    expect(isWithinDispatchWindow(date)).toBe(false);
  });
});

describe('getWarmupLimits()', () => {
  it('returns zero limits for day 0', () => {
    const limits = getWarmupLimits(0);
    expect(limits.maxMsgs).toBe(0);
    expect(limits.maxGroups).toBe(0);
  });

  it('returns 10 msgs for day 1', () => {
    const limits = getWarmupLimits(1);
    expect(limits.maxMsgs).toBe(10);
    expect(limits.maxGroups).toBe(3);
  });

  it('returns graduated limits for day 7+', () => {
    const limits = getWarmupLimits(7);
    expect(limits.maxMsgs).toBe(WARMUP_GRADUATED.maxMsgs);
    expect(limits.maxGroups).toBe(WARMUP_GRADUATED.maxGroups);
  });

  it('returns graduated limits for day 30', () => {
    const limits = getWarmupLimits(30);
    expect(limits.maxMsgs).toBe(120);
  });

  it('handles negative days as day 0', () => {
    const limits = getWarmupLimits(-1);
    expect(limits.maxMsgs).toBe(0);
  });
});

describe('MARKETPLACE_CONFIGS', () => {
  it('has all 5 marketplace configs', () => {
    const keys = Object.keys(MARKETPLACE_CONFIGS);
    expect(keys).toContain('SHOPEE');
    expect(keys).toContain('AMAZON');
    expect(keys).toContain('MERCADOLIVRE');
    expect(keys).toContain('MAGALU');
    expect(keys).toContain('ALIEXPRESS');
    expect(keys).toHaveLength(5);
  });

  it('each config has required fields', () => {
    for (const config of Object.values(MARKETPLACE_CONFIGS)) {
      expect(config).toHaveProperty('name');
      expect(config).toHaveProperty('baseUrl');
      expect(config).toHaveProperty('affiliateBaseUrl');
      expect(config).toHaveProperty('rateLimit');
      expect(config).toHaveProperty('urlPatterns');
      expect(Array.isArray(config.urlPatterns)).toBe(true);
      expect(config.urlPatterns.length).toBeGreaterThan(0);
    }
  });
});
