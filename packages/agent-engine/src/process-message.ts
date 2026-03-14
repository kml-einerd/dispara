import pino from 'pino';
import { IntentClassifier } from './classifier.js';
import { ProductRAG, type ProductQueryFn } from './rag.js';
import { ConversationalResponder } from './responder.js';
import type { Intent } from './types.js';

const logger = pino({ name: 'process-message' });

export interface ProcessAgentMessageOptions {
  tenantId: string;
  agentConfig: {
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    metadata?: Record<string, unknown>;
  };
  message: {
    text: string;
    senderId: string;
    senderName: string;
    chatId: string;
    chatType: string;
  };
  productQueryFn?: ProductQueryFn;
}

export interface ProcessAgentMessageResult {
  text: string;
  intent: Intent;
  confidence: number;
  productIds: string[];
  tokenCount?: number;
}

/**
 * Stateless wrapper for webhook integrations (Telegram, WhatsApp).
 * Creates classifier + RAG + responder per call — no cooldown management.
 * Cooldown/rate-limiting should be handled at the webhook layer.
 */
export async function processAgentMessage(
  opts: ProcessAgentMessageOptions,
): Promise<ProcessAgentMessageResult> {
  const { tenantId, agentConfig, message } = opts;

  const classifier = new IntentClassifier(
    undefined, // uses OPENROUTER_API_KEY env
    'anthropic/claude-haiku-4-5-20251001', // cheap model for classify
  );

  const responder = new ConversationalResponder(
    undefined,
    agentConfig.model ?? 'anthropic/claude-sonnet-4-6',
  );

  // 1. Classify
  const classification = await classifier.classifyIntent(message.text);

  logger.info(
    { tenantId, chatId: message.chatId, intent: classification.intent, confidence: classification.confidence },
    'Webhook message classified',
  );

  // 2. RAG search (busca_produto needs products to recommend, gerar_copy needs products for copy with affiliate links)
  const RAG_INTENTS: Intent[] = ['busca_produto', 'gerar_copy'];
  let productIds: string[] = [];
  const ragResults = [];

  if (RAG_INTENTS.includes(classification.intent) && opts.productQueryFn) {
    const rag = new ProductRAG(opts.productQueryFn);
    const results = await rag.searchProducts(tenantId, message.text, classification.entities);
    ragResults.push(...results);
    productIds = results.map((r) => r.product.id);
  }

  // 3. Generate response
  const config = {
    tenantId,
    systemPrompt: agentConfig.systemPrompt ?? '',
    enabled: true,
    enabledGroups: [message.chatId],
    cooldownMinutes: 0,
    maxResponsesPerHour: 999,
    responseDelayMinMs: 0,
    responseDelayMaxMs: 0,
  };

  const text = await responder.generateResponse(
    config,
    ragResults,
    message.text,
    classification.intent,
  );

  return {
    text,
    intent: classification.intent,
    confidence: classification.confidence,
    productIds,
  };
}
