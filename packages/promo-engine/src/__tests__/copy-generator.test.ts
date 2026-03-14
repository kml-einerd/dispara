import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Product } from '@dispara/marketplace';
import { CopyGenerator } from '../copy-generator.js';

const sampleProduct: Product = {
  id: 'B0CHX3QBCH',
  name: 'Echo Dot 5a geracao com Alexa - Smart Speaker',
  originalPrice: 399.0,
  promoPrice: 229.0,
  discountPercent: 43,
  imageUrl: 'https://m.media-amazon.com/images/I/71xoR4A-YzL.jpg',
  productUrl: 'https://www.amazon.com.br/dp/B0CHX3QBCH',
  marketplace: 'AMAZON',
  category: 'Eletrônicos',
  rating: 4.7,
  soldCount: 50000,
};

describe('CopyGenerator', () => {
  let generator: CopyGenerator;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new CopyGenerator('test-api-key');
    fetchSpy = vi.spyOn(globalThis, 'fetch') as unknown as ReturnType<typeof vi.fn>;
  });

  function mockToneResponse(text: string) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: text } }],
      }),
    });
  }

  function mockApiError() {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
  }

  describe('generateVariations()', () => {
    it('returns specified count of variations', async () => {
      mockToneResponse('🔥 CORRE! Echo Dot por R$ 229,00!');
      mockToneResponse('Gente, olha esse precinho!');
      mockToneResponse('📢 Oferta Especial: Echo Dot com 43% OFF');

      const variations = await generator.generateVariations(sampleProduct, 3);

      expect(variations).toHaveLength(3);
    });

    it('each variation has required fields (label, text, tone, charCount)', async () => {
      mockToneResponse('Promo urgente aqui!');
      mockToneResponse('Olha que legal esse produto!');
      mockToneResponse('Oferta especial disponivel.');

      const variations = await generator.generateVariations(sampleProduct, 3);

      for (const v of variations) {
        expect(v).toHaveProperty('label');
        expect(v).toHaveProperty('text');
        expect(v).toHaveProperty('tone');
        expect(v).toHaveProperty('charCount');
        expect(typeof v.text).toBe('string');
        expect(v.text.length).toBeGreaterThan(0);
        expect(v.charCount).toBe(v.text.length);
      }
    });

    it('each variation has copyText < 500 chars', async () => {
      const shortText = 'Oferta incrivel! Echo Dot por apenas R$ 229,00 com 43% de desconto!';
      mockToneResponse(shortText);
      mockToneResponse(shortText);
      mockToneResponse(shortText);

      const variations = await generator.generateVariations(sampleProduct, 3);

      for (const v of variations) {
        expect(v.charCount).toBeLessThan(500);
      }
    });

    it('calls OpenRouter API with correct model and parameters', async () => {
      mockToneResponse('test copy');

      await generator.generateVariations(sampleProduct, 1);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
        }),
      );

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.model).toBe('anthropic/claude-haiku-4-5-20251001');
      expect(body.max_tokens).toBe(512);
    });

    it('uses fallback copies when API fails for a tone', async () => {
      mockApiError();
      mockToneResponse('Casual copy here!');
      mockToneResponse('Formal copy here!');

      const variations = await generator.generateVariations(sampleProduct, 3);

      expect(variations).toHaveLength(3);
      const fallback = variations.find(v => v.tone === 'urgente');
      expect(fallback).toBeDefined();
      expect(fallback!.text).toContain(sampleProduct.name);
      expect(fallback!.text).toContain('R$');
    });

    it('falls back to template copies when all API calls fail', async () => {
      mockApiError();
      mockApiError();
      mockApiError();

      const variations = await generator.generateVariations(sampleProduct, 3);

      expect(variations).toHaveLength(3);
      for (const v of variations) {
        expect(v.text).toContain(sampleProduct.name);
        expect(v.text).toContain('229,00');
      }
    });

    it('fallback copies contain product name and price', async () => {
      mockApiError();
      mockApiError();
      mockApiError();

      const variations = await generator.generateVariations(sampleProduct, 3);

      for (const v of variations) {
        expect(v.text).toContain(sampleProduct.name);
        expect(v.text).toContain('229,00');
        expect(v.charCount).toBeGreaterThan(0);
      }
    });

    it('falls back when API returns no content', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: null } }],
        }),
      });
      mockApiError();
      mockApiError();

      const variations = await generator.generateVariations(sampleProduct, 3);

      expect(variations).toHaveLength(3);
      expect(variations[0]!.text).toContain('R$');
    });

    it('defaults to 5 variations when count not specified', async () => {
      mockToneResponse('u');
      mockToneResponse('c');
      mockToneResponse('f');
      mockToneResponse('d');
      mockToneResponse('e');

      const variations = await generator.generateVariations(sampleProduct);

      expect(variations).toHaveLength(5);
      expect(fetchSpy).toHaveBeenCalledTimes(5);
    });

    it('calls onVariation callback for each variation', async () => {
      mockToneResponse('urgente copy');
      mockToneResponse('casual copy');

      const callback = vi.fn();
      await generator.generateVariations(sampleProduct, 2, { onVariation: callback });

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('assigns correct tone labels to each variation', async () => {
      mockToneResponse('urgente copy');
      mockToneResponse('casual copy');
      mockToneResponse('formal copy');

      const variations = await generator.generateVariations(sampleProduct, 3);

      expect(variations.map(v => v.tone)).toEqual(
        expect.arrayContaining(['urgente', 'casual', 'formal']),
      );
    });
  });

  describe('generateForTone()', () => {
    it('generates a single variation for a specific tone', async () => {
      mockToneResponse('🔥 CORRE! Promo incrivel!');

      const variation = await generator.generateForTone(sampleProduct, 'urgente');

      expect(variation.tone).toBe('urgente');
      expect(variation.label).toBe('urgente');
      expect(variation.text).toBe('🔥 CORRE! Promo incrivel!');
      expect(variation.charCount).toBe('🔥 CORRE! Promo incrivel!'.length);
    });

    it('throws when API returns error', async () => {
      mockApiError();

      await expect(generator.generateForTone(sampleProduct, 'casual'))
        .rejects.toThrow('OpenRouter API error: 500');
    });

    it('throws when API returns no content', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: null } }],
        }),
      });

      await expect(generator.generateForTone(sampleProduct, 'formal'))
        .rejects.toThrow('No content in OpenRouter response for tone: formal');
    });

    it('includes few-shot example in messages', async () => {
      mockToneResponse('test');

      await generator.generateForTone(sampleProduct, 'urgente');

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.messages).toHaveLength(4);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[2].role).toBe('assistant');
      expect(body.messages[3].role).toBe('user');
    });
  });
});
