import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentEngine } from '../agent.js';
import { IntentClassifier } from '../classifier.js';
import { ProductRAG } from '../rag.js';
import { ConversationalResponder } from '../responder.js';
import type { AgentConfig, ClassificationResult, RAGResult, ProductForRAG } from '../types.js';

// Mock all dependencies
vi.mock('../classifier.js', () => ({
  IntentClassifier: vi.fn().mockImplementation(() => ({
    classifyIntent: vi.fn(),
  })),
}));

vi.mock('../rag.js', () => ({
  ProductRAG: vi.fn().mockImplementation(() => ({
    searchProducts: vi.fn(),
  })),
}));

vi.mock('../responder.js', () => ({
  ConversationalResponder: vi.fn().mockImplementation(() => ({
    generateResponse: vi.fn(),
  })),
}));

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    tenantId: 'tenant-1',
    systemPrompt: '',
    enabled: true,
    enabledGroups: ['group-1', 'group-2'],
    cooldownMinutes: 2,
    maxResponsesPerHour: 5,
    responseDelayMinMs: 0,
    responseDelayMaxMs: 0,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ProductForRAG> = {}): ProductForRAG {
  return {
    id: 'prod-1',
    tenantId: 'tenant-1',
    name: 'Test Product',
    description: 'Desc',
    category: 'electronics',
    price: 99.99,
    affiliateUrl: 'https://aff.link/test',
    marketplace: 'Amazon',
    ...overrides,
  };
}

function makeClassification(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    intent: 'product_query',
    confidence: 0.9,
    entities: {},
    ...overrides,
  };
}

describe('AgentEngine', () => {
  let engine: AgentEngine;
  let classifier: InstanceType<typeof IntentClassifier>;
  let rag: InstanceType<typeof ProductRAG>;
  let responder: InstanceType<typeof ConversationalResponder>;
  let config: AgentConfig;
  let dateNowSpy: ReturnType<typeof vi.spyOn>;
  let currentTime: number;

  beforeEach(() => {
    vi.clearAllMocks();

    // Use Date.now spy instead of fake timers to avoid setTimeout issues
    currentTime = 1000000;
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(currentTime);

    classifier = new IntentClassifier();
    rag = new ProductRAG(vi.fn());
    responder = new ConversationalResponder();
    config = makeConfig();
    engine = new AgentEngine(classifier, rag, responder, config);
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  it('full flow: message -> classify -> RAG -> respond', async () => {
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    const searchMock = rag.searchProducts as ReturnType<typeof vi.fn>;
    const respondMock = responder.generateResponse as ReturnType<typeof vi.fn>;

    classifyMock.mockResolvedValueOnce(makeClassification({
      intent: 'product_query',
      entities: { productName: 'iPhone 15' },
    }));
    searchMock.mockResolvedValueOnce([
      { product: makeProduct({ id: 'p1' }), score: 0.9 },
    ] satisfies RAGResult[]);
    respondMock.mockResolvedValueOnce('Achei o iPhone 15 por R$99.99! https://aff.link/test');

    const result = await engine.processMessage('quero um iPhone 15', 'group-1', 'telegram');

    expect(classifyMock).toHaveBeenCalledWith('quero um iPhone 15');
    expect(searchMock).toHaveBeenCalledWith('tenant-1', 'quero um iPhone 15', { productName: 'iPhone 15' });
    expect(respondMock).toHaveBeenCalledOnce();
    expect(result.response).toContain('iPhone 15');
    expect(result.interaction.intent).toBe('product_query');
    expect(result.interaction.productIds).toEqual(['p1']);
  });

  it('skips processing when agent disabled for group', async () => {
    const result = await engine.processMessage('teste', 'group-unknown', 'telegram');

    expect(result.response).toBeNull();
    expect(classifier.classifyIntent).not.toHaveBeenCalled();
  });

  it('skips processing when agent is globally disabled', async () => {
    engine.updateConfig(makeConfig({ enabled: false }));

    const result = await engine.processMessage('teste', 'group-1', 'telegram');

    expect(result.response).toBeNull();
    expect(classifier.classifyIntent).not.toHaveBeenCalled();
  });

  it('returns null for off_topic messages (silence)', async () => {
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    classifyMock.mockResolvedValueOnce(makeClassification({ intent: 'off_topic' }));

    const result = await engine.processMessage('bom dia pessoal!', 'group-1', 'telegram');

    expect(result.response).toBeNull();
    expect(result.interaction.intent).toBe('off_topic');
    expect(rag.searchProducts).not.toHaveBeenCalled();
  });

  it('cooldown prevents rapid responses in same group', async () => {
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    const searchMock = rag.searchProducts as ReturnType<typeof vi.fn>;
    const respondMock = responder.generateResponse as ReturnType<typeof vi.fn>;

    // First message goes through
    classifyMock.mockResolvedValueOnce(makeClassification());
    searchMock.mockResolvedValueOnce([{ product: makeProduct(), score: 0.9 }]);
    respondMock.mockResolvedValueOnce('Resposta 1');

    const result1 = await engine.processMessage('msg 1', 'group-1', 'telegram');
    expect(result1.response).toBe('Resposta 1');

    // Advance time by 30 seconds (within 2 min cooldown)
    currentTime += 30_000;
    dateNowSpy.mockReturnValue(currentTime);

    // Second message within cooldown period should be blocked
    const result2 = await engine.processMessage('msg 2', 'group-1', 'telegram');
    expect(result2.response).toBeNull();
    // classifyIntent should NOT have been called for the second message
    expect(classifyMock).toHaveBeenCalledTimes(1);
  });

  it('cooldown expires after configured time', async () => {
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    const searchMock = rag.searchProducts as ReturnType<typeof vi.fn>;
    const respondMock = responder.generateResponse as ReturnType<typeof vi.fn>;

    // First message
    classifyMock.mockResolvedValueOnce(makeClassification());
    searchMock.mockResolvedValueOnce([{ product: makeProduct(), score: 0.9 }]);
    respondMock.mockResolvedValueOnce('Resposta 1');

    await engine.processMessage('msg 1', 'group-1', 'telegram');

    // Advance past cooldown (2 min = 120000ms)
    currentTime += 130_000;
    dateNowSpy.mockReturnValue(currentTime);

    // Now it should go through
    classifyMock.mockResolvedValueOnce(makeClassification());
    searchMock.mockResolvedValueOnce([{ product: makeProduct(), score: 0.9 }]);
    respondMock.mockResolvedValueOnce('Resposta 2');

    const result2 = await engine.processMessage('msg 2', 'group-1', 'telegram');
    expect(result2.response).toBe('Resposta 2');
  });

  it('rate limit (max responses per hour) works', async () => {
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    const searchMock = rag.searchProducts as ReturnType<typeof vi.fn>;
    const respondMock = responder.generateResponse as ReturnType<typeof vi.fn>;

    // Use config with maxResponsesPerHour = 2, cooldownMinutes = 0
    engine.updateConfig(makeConfig({ maxResponsesPerHour: 2, cooldownMinutes: 0 }));

    // Send 2 messages (both should go through)
    for (let i = 0; i < 2; i++) {
      classifyMock.mockResolvedValueOnce(makeClassification());
      searchMock.mockResolvedValueOnce([{ product: makeProduct(), score: 0.9 }]);
      respondMock.mockResolvedValueOnce(`Resposta ${i}`);
      // Small time advance between messages to avoid cooldown
      currentTime += 100;
      dateNowSpy.mockReturnValue(currentTime);
    }

    const r1 = await engine.processMessage('msg 1', 'group-1', 'telegram');
    expect(r1.response).toBe('Resposta 0');

    const r2 = await engine.processMessage('msg 2', 'group-1', 'telegram');
    expect(r2.response).toBe('Resposta 1');

    // Third message should be blocked by rate limit
    currentTime += 100;
    dateNowSpy.mockReturnValue(currentTime);

    const r3 = await engine.processMessage('msg 3', 'group-1', 'telegram');
    expect(r3.response).toBeNull();
    expect(classifyMock).toHaveBeenCalledTimes(2);
  });

  it('updateConfig() changes engine behavior', async () => {
    // Disable the agent via config update
    engine.updateConfig(makeConfig({ enabled: false }));

    const result = await engine.processMessage('teste', 'group-1', 'telegram');
    expect(result.response).toBeNull();

    // Re-enable
    engine.updateConfig(makeConfig({ enabled: true }));
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    classifyMock.mockResolvedValueOnce(makeClassification({ intent: 'off_topic' }));

    const result2 = await engine.processMessage('teste', 'group-1', 'telegram');
    expect(result2.interaction.intent).toBe('off_topic');
    expect(classifyMock).toHaveBeenCalledOnce();
  });

  it('clearCooldowns() resets state', async () => {
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    const searchMock = rag.searchProducts as ReturnType<typeof vi.fn>;
    const respondMock = responder.generateResponse as ReturnType<typeof vi.fn>;

    // First message
    classifyMock.mockResolvedValueOnce(makeClassification());
    searchMock.mockResolvedValueOnce([{ product: makeProduct(), score: 0.9 }]);
    respondMock.mockResolvedValueOnce('Resposta 1');

    await engine.processMessage('msg 1', 'group-1', 'telegram');

    // Without clearing, second msg would be blocked by cooldown
    // Clear cooldowns
    engine.clearCooldowns();

    // Now it should go through even without time advancing
    classifyMock.mockResolvedValueOnce(makeClassification());
    searchMock.mockResolvedValueOnce([{ product: makeProduct(), score: 0.9 }]);
    respondMock.mockResolvedValueOnce('Resposta 2');

    const result = await engine.processMessage('msg 2', 'group-1', 'telegram');
    expect(result.response).toBe('Resposta 2');
  });

  it('productIds are included in interaction record', async () => {
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    const searchMock = rag.searchProducts as ReturnType<typeof vi.fn>;
    const respondMock = responder.generateResponse as ReturnType<typeof vi.fn>;

    classifyMock.mockResolvedValueOnce(makeClassification());
    searchMock.mockResolvedValueOnce([
      { product: makeProduct({ id: 'prod-a' }), score: 0.9 },
      { product: makeProduct({ id: 'prod-b' }), score: 0.7 },
    ]);
    respondMock.mockResolvedValueOnce('Achei dois produtos!');

    const result = await engine.processMessage('quero produtos', 'group-1', 'telegram');

    expect(result.interaction.productIds).toEqual(['prod-a', 'prod-b']);
    expect(result.interaction.tenantId).toBe('tenant-1');
    expect(result.interaction.groupId).toBe('group-1');
    expect(result.interaction.platform).toBe('telegram');
  });

  it('different groups do not share cooldowns', async () => {
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    const searchMock = rag.searchProducts as ReturnType<typeof vi.fn>;
    const respondMock = responder.generateResponse as ReturnType<typeof vi.fn>;

    // First message to group-1
    classifyMock.mockResolvedValueOnce(makeClassification());
    searchMock.mockResolvedValueOnce([{ product: makeProduct(), score: 0.9 }]);
    respondMock.mockResolvedValueOnce('Resposta g1');

    await engine.processMessage('msg', 'group-1', 'telegram');

    // Message to group-2 should still work (no cooldown interference)
    classifyMock.mockResolvedValueOnce(makeClassification());
    searchMock.mockResolvedValueOnce([{ product: makeProduct(), score: 0.9 }]);
    respondMock.mockResolvedValueOnce('Resposta g2');

    const result = await engine.processMessage('msg', 'group-2', 'telegram');
    expect(result.response).toBe('Resposta g2');
  });

  it('interaction records responseTimeMs', async () => {
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    classifyMock.mockResolvedValueOnce(makeClassification({ intent: 'off_topic' }));

    const result = await engine.processMessage('msg', 'group-1', 'telegram');

    expect(typeof result.interaction.responseTimeMs).toBe('number');
  });

  it('uses groupName when provided', async () => {
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    classifyMock.mockResolvedValueOnce(makeClassification({ intent: 'off_topic' }));

    const result = await engine.processMessage('msg', 'group-1', 'telegram', 'Promos BR');

    expect(result.interaction.groupName).toBe('Promos BR');
  });

  it('defaults groupName to groupId when not provided', async () => {
    const classifyMock = classifier.classifyIntent as ReturnType<typeof vi.fn>;
    classifyMock.mockResolvedValueOnce(makeClassification({ intent: 'off_topic' }));

    const result = await engine.processMessage('msg', 'group-1', 'telegram');

    expect(result.interaction.groupName).toBe('group-1');
  });
});
