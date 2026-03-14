import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentClassifier } from '../classifier.js';

describe('IntentClassifier', () => {
  let classifier: IntentClassifier;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    classifier = new IntentClassifier('test-api-key');
    fetchSpy = vi.spyOn(globalThis, 'fetch') as unknown as ReturnType<typeof vi.fn>;
  });

  function mockSuccess(data: object) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(data) } }],
      }),
    });
  }

  function mockSuccessRaw(content: string) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content } }],
      }),
    });
  }

  function mockApiError(status = 500) {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status,
      text: async () => 'Internal Server Error',
    });
  }

  it('classifies busca_produto correctly', async () => {
    mockSuccess({
      intent: 'busca_produto',
      confidence: 0.95,
      entities: { productName: 'iPhone 15', brand: 'Apple' },
    });

    const result = await classifier.classifyIntent('qual o preco do iPhone 15?');

    expect(result.intent).toBe('busca_produto');
    expect(result.confidence).toBe(0.95);
    expect(result.entities.productName).toBe('iPhone 15');
    expect(result.entities.brand).toBe('Apple');
  });

  it('classifies gerar_copy correctly', async () => {
    mockSuccess({
      intent: 'gerar_copy',
      confidence: 0.88,
      entities: {},
    });

    const result = await classifier.classifyIntent('gera uma copy pra esse fone');

    expect(result.intent).toBe('gerar_copy');
    expect(result.confidence).toBe(0.88);
  });

  it('classifies disparar correctly', async () => {
    mockSuccess({
      intent: 'disparar',
      confidence: 0.91,
      entities: {},
    });

    const result = await classifier.classifyIntent('dispara essa promo pros grupos');

    expect(result.intent).toBe('disparar');
    expect(result.confidence).toBe(0.91);
  });

  it('classifies status correctly', async () => {
    mockSuccess({
      intent: 'status',
      confidence: 0.93,
      entities: {},
    });

    const result = await classifier.classifyIntent('como ta a fila de disparo?');

    expect(result.intent).toBe('status');
    expect(result.confidence).toBe(0.93);
  });

  it('classifies ajuda correctly', async () => {
    mockSuccess({
      intent: 'ajuda',
      confidence: 0.90,
      entities: {},
    });

    const result = await classifier.classifyIntent('como eu uso esse bot?');

    expect(result.intent).toBe('ajuda');
    expect(result.confidence).toBe(0.90);
  });

  it('classifies off_topic correctly', async () => {
    mockSuccess({
      intent: 'off_topic',
      confidence: 0.99,
      entities: {},
    });

    const result = await classifier.classifyIntent('bom dia pessoal!');

    expect(result.intent).toBe('off_topic');
    expect(result.confidence).toBe(0.99);
    expect(result.entities).toEqual({});
  });

  it('returns off_topic when API errors', async () => {
    mockApiError(500);

    const result = await classifier.classifyIntent('teste');

    expect(result.intent).toBe('off_topic');
    expect(result.confidence).toBe(0.0);
    expect(result.entities).toEqual({});
  });

  it('returns off_topic when fetch throws', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const result = await classifier.classifyIntent('teste');

    expect(result.intent).toBe('off_topic');
    expect(result.confidence).toBe(0.0);
    expect(result.entities).toEqual({});
  });

  it('returns off_topic when response is invalid JSON', async () => {
    mockSuccessRaw('this is not valid json at all');

    const result = await classifier.classifyIntent('teste');

    expect(result.intent).toBe('off_topic');
    expect(result.confidence).toBe(0.0);
  });

  it('returns off_topic when intent is not a valid value', async () => {
    mockSuccess({
      intent: 'unknown_intent',
      confidence: 0.5,
      entities: {},
    });

    const result = await classifier.classifyIntent('teste');

    expect(result.intent).toBe('off_topic');
    expect(result.confidence).toBe(0.0);
  });

  it('extracts entities correctly (productName, category, maxPrice, brand)', async () => {
    mockSuccess({
      intent: 'busca_produto',
      confidence: 0.92,
      entities: {
        productName: 'Galaxy S24',
        category: 'smartphones',
        maxPrice: 3000,
        brand: 'Samsung',
      },
    });

    const result = await classifier.classifyIntent('quero um Galaxy S24 Samsung ate 3000');

    expect(result.entities).toEqual({
      productName: 'Galaxy S24',
      category: 'smartphones',
      maxPrice: 3000,
      brand: 'Samsung',
    });
  });

  it('handles empty message', async () => {
    mockSuccess({
      intent: 'off_topic',
      confidence: 0.0,
      entities: {},
    });

    const result = await classifier.classifyIntent('');

    expect(result.intent).toBe('off_topic');
  });

  it('returns off_topic when response has no content', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: null } }],
      }),
    });

    const result = await classifier.classifyIntent('teste');

    expect(result.intent).toBe('off_topic');
    expect(result.confidence).toBe(0.0);
  });

  it('defaults confidence to 0.5 when confidence is missing from response', async () => {
    mockSuccess({
      intent: 'busca_produto',
      entities: { productName: 'teste' },
    });

    const result = await classifier.classifyIntent('teste');

    expect(result.intent).toBe('busca_produto');
    expect(result.confidence).toBe(0.5);
  });

  it('defaults entities to empty object when missing from response', async () => {
    mockSuccess({
      intent: 'busca_produto',
      confidence: 0.8,
    });

    const result = await classifier.classifyIntent('teste');

    expect(result.entities).toEqual({});
  });

  it('calls OpenRouter API with correct parameters', async () => {
    mockSuccess({
      intent: 'off_topic',
      confidence: 0.5,
      entities: {},
    });

    await classifier.classifyIntent('test message');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
        }),
      }),
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.model).toBe('anthropic/claude-haiku-4-5-20251001');
    expect(body.max_tokens).toBe(256);
    expect(body.temperature).toBe(0.1);
    expect(body.messages).toEqual([
      expect.objectContaining({ role: 'system' }),
      { role: 'user', content: 'test message' },
    ]);
  });
});
