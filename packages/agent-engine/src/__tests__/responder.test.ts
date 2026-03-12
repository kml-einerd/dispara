import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversationalResponder } from '../responder.js';
import type { AgentConfig, RAGResult, ProductForRAG } from '../types.js';

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    tenantId: 'tenant-1',
    systemPrompt: '',
    enabled: true,
    enabledGroups: ['group-1'],
    cooldownMinutes: 5,
    maxResponsesPerHour: 10,
    responseDelayMinMs: 0,
    responseDelayMaxMs: 0,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ProductForRAG> = {}): ProductForRAG {
  return {
    id: 'prod-1',
    tenantId: 'tenant-1',
    name: 'Nike Air Max 90',
    description: 'Tenis classico',
    category: 'calcados',
    price: 499.9,
    originalPrice: 699.9,
    affiliateUrl: 'https://aff.link/nike-air-max',
    marketplace: 'Amazon',
    ...overrides,
  };
}

function makeRagResult(productOverrides: Partial<ProductForRAG> = {}): RAGResult {
  return {
    product: makeProduct(productOverrides),
    score: 0.95,
  };
}

describe('ConversationalResponder', () => {
  let responder: ConversationalResponder;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    responder = new ConversationalResponder('test-api-key');
    fetchSpy = vi.spyOn(globalThis, 'fetch') as unknown as ReturnType<typeof vi.fn>;
  });

  function mockSuccess(content: string) {
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

  it('generates response with product info and affiliate link', async () => {
    const responseText = 'Olha, achei esse Nike Air Max 90 por R$499.90! Era R$699.90. Confere aqui: https://aff.link/nike-air-max';
    mockSuccess(responseText);

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'quero um tenis nike',
      'product_query',
    );

    expect(result).toBe(responseText);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('generates "nao encontrei" message when no products', async () => {
    const result = await responder.generateResponse(
      makeConfig(),
      [],
      'quero um jetski',
      'product_query',
    );

    expect(result).toContain('nao encontrei');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses tenant custom system prompt', async () => {
    mockSuccess('Resposta customizada');

    await responder.generateResponse(
      makeConfig({ systemPrompt: 'Sempre use emojis e linguagem jovem' }),
      [makeRagResult()],
      'quero um fone',
      'recommendation',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).toContain('Instrucoes adicionais do tenant');
    expect(systemMsg.content).toContain('Sempre use emojis e linguagem jovem');
  });

  it('handles API error gracefully', async () => {
    mockApiError(500);

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'quero um tenis',
      'product_query',
    );

    expect(result).toContain('nao encontrei');
  });

  it('handles fetch throw gracefully', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'quero um tenis',
      'product_query',
    );

    expect(result).toContain('nao encontrei');
  });

  it('response system prompt contains affiliate URL from product', async () => {
    mockSuccess('Confere: https://aff.link/custom-url');

    await responder.generateResponse(
      makeConfig(),
      [makeRagResult({ affiliateUrl: 'https://aff.link/custom-url' })],
      'quero um produto',
      'product_query',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).toContain('https://aff.link/custom-url');
  });

  it('includes product price and marketplace in system prompt', async () => {
    mockSuccess('Resposta');

    await responder.generateResponse(
      makeConfig(),
      [makeRagResult({ price: 299.99, marketplace: 'Mercado Livre' })],
      'teste',
      'price_check',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).toContain('R$299.99');
    expect(systemMsg.content).toContain('Mercado Livre');
  });

  it('includes intent in system prompt', async () => {
    mockSuccess('Resposta');

    await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'me indica um fone bom',
      'recommendation',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).toContain('Intencao detectada: recommendation');
  });

  it('returns fallback when response has no content', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: null } }],
      }),
    });

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'teste',
      'product_query',
    );

    expect(result).toContain('nao encontrei');
  });

  it('trims whitespace from response', async () => {
    mockSuccess('  resposta com espacos  \n');

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'teste',
      'product_query',
    );

    expect(result).toBe('resposta com espacos');
  });

  it('shows discount info when originalPrice is present', async () => {
    mockSuccess('Resposta');

    await responder.generateResponse(
      makeConfig(),
      [makeRagResult({ price: 100, originalPrice: 200 })],
      'teste',
      'product_query',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).toContain('(era R$200.00)');
  });

  it('does not show discount info when originalPrice is absent', async () => {
    mockSuccess('Resposta');

    await responder.generateResponse(
      makeConfig(),
      [makeRagResult({ originalPrice: undefined })],
      'teste',
      'product_query',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).not.toContain('(era R$');
  });
});
