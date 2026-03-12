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

  function mockSuccess(variations: Array<{ label: string; tone: string; text: string }>) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(variations) } }],
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
      mockSuccess([
        { label: 'urgente', tone: 'urgente', text: 'CORRE! Echo Dot por R$ 229,00!' },
        { label: 'casual', tone: 'casual', text: 'Olha esse precinho do Echo Dot!' },
        { label: 'formal', tone: 'formal', text: 'Oferta especial: Echo Dot com 43% OFF' },
      ]);

      const variations = await generator.generateVariations(sampleProduct, 3);

      expect(variations).toHaveLength(3);
    });

    it('each variation has required fields (label, text, tone, charCount)', async () => {
      mockSuccess([
        { label: 'urgente', tone: 'urgente', text: 'Promo urgente aqui!' },
        { label: 'casual', tone: 'casual', text: 'Olha que legal esse produto!' },
        { label: 'formal', tone: 'formal', text: 'Oferta especial disponivel.' },
      ]);

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
      mockSuccess([
        { label: 'urgente', tone: 'urgente', text: shortText },
        { label: 'casual', tone: 'casual', text: shortText },
        { label: 'formal', tone: 'formal', text: shortText },
      ]);

      const variations = await generator.generateVariations(sampleProduct, 3);

      for (const v of variations) {
        expect(v.charCount).toBeLessThan(500);
      }
    });

    it('calls OpenRouter API with correct model and parameters', async () => {
      mockSuccess([
        { label: 'urgente', tone: 'urgente', text: 'test' },
      ]);

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
      expect(body.max_tokens).toBe(1024);
    });

    it('retries once on first failure, then succeeds', async () => {
      // First call fails (API error)
      mockApiError();
      // Second call succeeds
      mockSuccess([
        { label: 'urgente', tone: 'urgente', text: 'Retry success!' },
      ]);

      const variations = await generator.generateVariations(sampleProduct, 1);

      expect(variations).toHaveLength(1);
      expect(variations[0]!.text).toBe('Retry success!');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('falls back to template copies when API fails twice', async () => {
      mockApiError();
      mockApiError();

      const variations = await generator.generateVariations(sampleProduct, 3);

      expect(variations).toHaveLength(3);
      expect(variations[0]!.text).toContain('R$');
      expect(variations[0]!.tone).toBe('urgente');
      expect(variations[1]!.tone).toBe('casual');
      expect(variations[2]!.tone).toBe('formal');
    });

    it('fallback copies contain product name and price', async () => {
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

      const variations = await generator.generateVariations(sampleProduct, 3);

      expect(variations).toHaveLength(3);
      expect(variations[0]!.text).toContain('R$');
    });

    it('defaults to 3 variations when count not specified', async () => {
      mockSuccess([
        { label: 'urgente', tone: 'urgente', text: 'u' },
        { label: 'casual', tone: 'casual', text: 'c' },
        { label: 'formal', tone: 'formal', text: 'f' },
      ]);

      await generator.generateVariations(sampleProduct);

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      const userMsg = body.messages.find((m: any) => m.role === 'user');
      expect(userMsg.content).toContain('3 variacoes');
    });
  });
});
