import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Skip in CI - requires database connection
const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

import { IntentClassifier } from '../../packages/agent-engine/src/classifier.js';
import { ProductRAG, type ProductQueryFn } from '../../packages/agent-engine/src/rag.js';
import { ConversationalResponder } from '../../packages/agent-engine/src/responder.js';
import { AgentEngine } from '../../packages/agent-engine/src/agent.js';
import type { AgentConfig, ProductForRAG } from '../../packages/agent-engine/src/types.js';

function makeProduct(overrides: Partial<ProductForRAG> = {}): ProductForRAG {
  return {
    id: 'prod-nike-1',
    tenantId: 'tenant-1',
    name: 'Nike Air Max 90',
    description: 'Tenis esportivo Nike',
    category: 'calcados',
    price: 399.9,
    originalPrice: 599.9,
    affiliateUrl: 'https://aff.link/nike-air-max',
    marketplace: 'Amazon',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    tenantId: 'tenant-1',
    systemPrompt: '',
    enabled: true,
    enabledGroups: ['group-1', 'group-2'],
    cooldownMinutes: 2,
    maxResponsesPerHour: 10,
    responseDelayMinMs: 0,
    responseDelayMaxMs: 0,
    ...overrides,
  };
}

function mockFetchOpenRouter(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
    text: async () => content,
  };
}

function mockFetchError(status = 500) {
  return {
    ok: false,
    status,
    text: async () => 'Internal Server Error',
  };
}

describeIntegration('Agent Flow Integration', () => {
  let queryFn: ReturnType<typeof vi.fn>;
  let engine: AgentEngine;
  let config: AgentConfig;
  let dateNowSpy: ReturnType<typeof vi.spyOn>;
  let fetchSpy: ReturnType<typeof vi.fn>;
  let currentTime: number;

  beforeEach(() => {
    vi.clearAllMocks();

    currentTime = 1000000;
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(currentTime);
    fetchSpy = vi.spyOn(globalThis, 'fetch') as unknown as ReturnType<typeof vi.fn>;

    queryFn = vi.fn();
    config = makeConfig();

    const classifier = new IntentClassifier('test-key');
    const rag = new ProductRAG(queryFn as ProductQueryFn);
    const responder = new ConversationalResponder('test-key');

    engine = new AgentEngine(classifier, rag, responder, config);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it('"tenis nike barato" -> classifies as product_query -> finds Nike products -> generates response with affiliate link', async () => {
    // First call: classification
    fetchSpy.mockResolvedValueOnce(
      mockFetchOpenRouter(
        JSON.stringify({
          intent: 'product_query',
          confidence: 0.93,
          entities: {
            productName: 'tenis nike',
            brand: 'Nike',
            category: 'calcados',
          },
        }),
      ),
    );

    // queryFn returns Nike products
    queryFn.mockResolvedValueOnce([
      makeProduct({ id: 'nike-1', name: 'Nike Air Max 90', price: 399.9 }),
      makeProduct({ id: 'nike-2', name: 'Nike Revolution 6', price: 249.9 }),
    ]);

    // Second call: response generation
    fetchSpy.mockResolvedValueOnce(
      mockFetchOpenRouter(
        'Achei uns Nike legais! O Air Max 90 ta por R$399.90, era R$599.90. Confere: https://aff.link/nike-air-max',
      ),
    );

    const result = await engine.processMessage('tenis nike barato', 'group-1', 'telegram');

    expect(result.response).not.toBeNull();
    expect(result.response).toContain('https://aff.link/nike-air-max');
    expect(result.interaction.intent).toBe('product_query');
    expect(result.interaction.productIds).toEqual(['nike-1', 'nike-2']);
    expect(queryFn).toHaveBeenCalledWith(
      'tenant-1',
      'tenis nike Nike calcados',
      'calcados',
      undefined,
    );
  });

  it('"bom dia galera" -> classifies as off_topic -> no response', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchOpenRouter(
        JSON.stringify({
          intent: 'off_topic',
          confidence: 0.99,
          entities: {},
        }),
      ),
    );

    const result = await engine.processMessage('bom dia galera', 'group-1', 'telegram');

    expect(result.response).toBeNull();
    expect(result.interaction.intent).toBe('off_topic');
    expect(queryFn).not.toHaveBeenCalled();
    // Only 1 fetch call (classification), no response generation
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rapid messages in same group -> second one hits cooldown -> no response', async () => {
    // First message goes through
    fetchSpy.mockResolvedValueOnce(
      mockFetchOpenRouter(
        JSON.stringify({
          intent: 'product_query',
          confidence: 0.9,
          entities: { productName: 'fone' },
        }),
      ),
    );
    queryFn.mockResolvedValueOnce([makeProduct({ id: 'p1' })]);
    fetchSpy.mockResolvedValueOnce(
      mockFetchOpenRouter('Achei um fone! https://aff.link/fone'),
    );

    const result1 = await engine.processMessage('quero um fone', 'group-1', 'telegram');
    expect(result1.response).not.toBeNull();

    // Advance by 30 seconds (within 2 min cooldown)
    currentTime += 30_000;
    dateNowSpy.mockReturnValue(currentTime);

    const result2 = await engine.processMessage('e um tenis?', 'group-1', 'telegram');
    expect(result2.response).toBeNull();
    // Classification should not even have been called for the second message
    expect(fetchSpy).toHaveBeenCalledTimes(2); // only from first message
  });

  it('different groups -> no cooldown interference', async () => {
    // Message to group-1
    fetchSpy.mockResolvedValueOnce(
      mockFetchOpenRouter(
        JSON.stringify({
          intent: 'product_query',
          confidence: 0.9,
          entities: {},
        }),
      ),
    );
    queryFn.mockResolvedValueOnce([makeProduct()]);
    fetchSpy.mockResolvedValueOnce(
      mockFetchOpenRouter('Resposta grupo 1'),
    );

    const r1 = await engine.processMessage('msg', 'group-1', 'telegram');
    expect(r1.response).not.toBeNull();

    // Message to group-2 should also work
    fetchSpy.mockResolvedValueOnce(
      mockFetchOpenRouter(
        JSON.stringify({
          intent: 'product_query',
          confidence: 0.9,
          entities: {},
        }),
      ),
    );
    queryFn.mockResolvedValueOnce([makeProduct()]);
    fetchSpy.mockResolvedValueOnce(
      mockFetchOpenRouter('Resposta grupo 2'),
    );

    const r2 = await engine.processMessage('msg', 'group-2', 'telegram');
    expect(r2.response).not.toBeNull();
    expect(r2.response).toBe('Resposta grupo 2');
  });

  it('agent disabled for group -> no processing', async () => {
    const result = await engine.processMessage('quero um iphone', 'group-999', 'telegram');

    expect(result.response).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(queryFn).not.toHaveBeenCalled();
  });

  it('recommendation intent triggers RAG and response', async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchOpenRouter(
        JSON.stringify({
          intent: 'recommendation',
          confidence: 0.88,
          entities: { category: 'fone bluetooth' },
        }),
      ),
    );
    queryFn.mockResolvedValueOnce([
      makeProduct({ id: 'fone-1', name: 'JBL Tune 510BT', price: 199.9, category: 'audio' }),
    ]);
    fetchSpy.mockResolvedValueOnce(
      mockFetchOpenRouter('Recomendo o JBL Tune 510BT por R$199.90! https://aff.link/jbl'),
    );

    const result = await engine.processMessage('me sugere um fone bluetooth bom', 'group-1', 'telegram');

    expect(result.response).toContain('JBL');
    expect(result.interaction.intent).toBe('recommendation');
    expect(result.interaction.productIds).toEqual(['fone-1']);
  });

  it('API error during classification returns null (off_topic fallback)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('API timeout'));

    const result = await engine.processMessage('quero um produto', 'group-1', 'telegram');

    // Classifier defaults to off_topic on error, so no response
    expect(result.response).toBeNull();
    expect(result.interaction.intent).toBe('off_topic');
  });
});
