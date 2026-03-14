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

  // --- busca_produto intent ---

  it('generates response with product info and affiliate link', async () => {
    const responseText = 'Olha, achei esse Nike Air Max 90 por R$499.90! Era R$699.90. Confere aqui: https://aff.link/nike-air-max';
    mockSuccess(responseText);

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'quero um tenis nike',
      'busca_produto',
    );

    expect(result).toBe(responseText);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('returns fallback when no products for busca_produto', async () => {
    const result = await responder.generateResponse(
      makeConfig(),
      [],
      'quero um jetski',
      'busca_produto',
    );

    expect(result).toContain('nao encontrei');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // --- gerar_copy intent ---

  it('returns fallback when no products for gerar_copy', async () => {
    const result = await responder.generateResponse(
      makeConfig(),
      [],
      'gera copy de um fone',
      'gerar_copy',
    );

    expect(result).toContain('nao encontrei');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses higher temperature for gerar_copy', async () => {
    mockSuccess('🔥 PROMO! Nike Air Max por R$499.90 https://aff.link/nike-air-max');

    await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'gera copy do nike',
      'gerar_copy',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.85);
  });

  it('includes copy-specific guidance in system prompt for gerar_copy', async () => {
    mockSuccess('Copy response https://aff.link/nike-air-max');

    await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'gera uma copy pra esse produto',
      'gerar_copy',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).toContain('copy pronta pra divulgar');
    expect(systemMsg.content).toContain('emojis');
  });

  // --- Static responses (non-RAG intents) ---

  it('returns static response for disparar intent', async () => {
    const result = await responder.generateResponse(
      makeConfig(),
      [],
      'dispara essa promo',
      'disparar',
    );

    expect(result).toContain('Promos');
    expect(result).toContain('Disparos');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns static response for status intent', async () => {
    const result = await responder.generateResponse(
      makeConfig(),
      [],
      'como ta a fila?',
      'status',
    );

    expect(result).toContain('painel');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns static response for ajuda intent', async () => {
    const result = await responder.generateResponse(
      makeConfig(),
      [],
      'como funciona?',
      'ajuda',
    );

    expect(result).toContain('Buscar produtos');
    expect(result).toContain('O que voce quer fazer?');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns static response for off_topic intent', async () => {
    const result = await responder.generateResponse(
      makeConfig(),
      [],
      'kkkk mto bom',
      'off_topic',
    );

    expect(result).toContain('buscar algum produto');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // --- Affiliate link post-processing ---

  it('injects affiliate link when LLM omits it for busca_produto', async () => {
    mockSuccess('Achei um tenis legal, ta em promo!');

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'quero um tenis',
      'busca_produto',
    );

    expect(result).toContain('https://aff.link/nike-air-max');
    expect(result).toContain('🔗');
  });

  it('injects affiliate link when LLM omits it for gerar_copy', async () => {
    mockSuccess('🔥 PROMO DO ANO! Nike Air Max por apenas R$499!');

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'gera copy do nike',
      'gerar_copy',
    );

    expect(result).toContain('https://aff.link/nike-air-max');
  });

  it('does NOT inject duplicate link when LLM already included it', async () => {
    const responseWithLink = 'Nike Air Max por R$499! Confere: https://aff.link/nike-air-max';
    mockSuccess(responseWithLink);

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'quero tenis',
      'busca_produto',
    );

    // Should appear exactly once
    const count = (result.match(/https:\/\/aff\.link\/nike-air-max/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('does NOT inject link for non-product intents', async () => {
    mockSuccess('Voce pode acompanhar pelo dashboard');

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'status dos disparos',
      'status',
    );

    expect(result).not.toContain('🔗');
  });

  // --- System prompt construction ---

  it('uses tenant custom system prompt', async () => {
    mockSuccess('Resposta customizada https://aff.link/nike-air-max');

    await responder.generateResponse(
      makeConfig({ systemPrompt: 'Sempre use emojis e linguagem jovem' }),
      [makeRagResult()],
      'quero um fone',
      'gerar_copy',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).toContain('Instrucoes do tenant');
    expect(systemMsg.content).toContain('Sempre use emojis e linguagem jovem');
  });

  it('includes affiliate URL in system prompt', async () => {
    mockSuccess('Confere: https://aff.link/custom-url');

    await responder.generateResponse(
      makeConfig(),
      [makeRagResult({ affiliateUrl: 'https://aff.link/custom-url' })],
      'quero um produto',
      'busca_produto',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).toContain('https://aff.link/custom-url');
  });

  it('includes discount percentage in system prompt', async () => {
    mockSuccess('Resposta https://aff.link/nike-air-max');

    await responder.generateResponse(
      makeConfig(),
      [makeRagResult({ price: 100, originalPrice: 200 })],
      'teste',
      'busca_produto',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).toContain('50% off');
    expect(systemMsg.content).toContain('era R$200.00');
  });

  it('includes marketplace in system prompt', async () => {
    mockSuccess('Resposta https://aff.link/nike-air-max');

    await responder.generateResponse(
      makeConfig(),
      [makeRagResult({ marketplace: 'Mercado Livre' })],
      'teste',
      'busca_produto',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).toContain('Mercado Livre');
  });

  it('does not show discount when originalPrice is absent', async () => {
    mockSuccess('Resposta https://aff.link/nike-air-max');

    await responder.generateResponse(
      makeConfig(),
      [makeRagResult({ originalPrice: undefined })],
      'teste',
      'busca_produto',
    );

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    const systemMsg = body.messages.find((m: any) => m.role === 'system');
    expect(systemMsg.content).not.toContain('era R$');
    expect(systemMsg.content).not.toContain('% off');
  });

  // --- Error handling ---

  it('handles API error gracefully', async () => {
    mockApiError(500);

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'quero um tenis',
      'busca_produto',
    );

    expect(result).toContain('nao encontrei');
  });

  it('handles fetch throw gracefully', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('Network error'));

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'quero um tenis',
      'busca_produto',
    );

    expect(result).toContain('nao encontrei');
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
      'busca_produto',
    );

    expect(result).toContain('nao encontrei');
  });

  it('trims whitespace from response', async () => {
    mockSuccess('  resposta com espacos https://aff.link/nike-air-max  \n');

    const result = await responder.generateResponse(
      makeConfig(),
      [makeRagResult()],
      'teste',
      'busca_produto',
    );

    expect(result).toMatch(/^resposta com espacos/);
  });
});
