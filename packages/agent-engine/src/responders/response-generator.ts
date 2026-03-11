import pino from 'pino';
import type { AgentConfig, AgentResponse, ClassifiedIntent, ProductMatch } from '../types.js';

const logger = pino({ name: '@promospot/agent-engine/responder' });

/**
 * Generates a conversational response based on classified intent and retrieved products.
 * Stub — will call Claude Haiku for natural language generation.
 */
export async function generateResponse(
  intent: ClassifiedIntent,
  products: ProductMatch[],
  config: AgentConfig,
): Promise<AgentResponse> {
  const delay = randomDelay(config.responseDelayMinMs, config.responseDelayMaxMs);

  if (intent.confidence < config.minConfidence) {
    return { text: '', products: [], delayMs: 0, shouldRespond: false };
  }

  if (intent.intent === 'greeting') {
    return { text: '', products: [], delayMs: 0, shouldRespond: false };
  }

  if (products.length === 0) {
    logger.debug({ intent }, 'No products found, skipping response');
    return { text: '', products: [], delayMs: 0, shouldRespond: false };
  }

  // TODO: replace with Claude Haiku call for natural copy
  const top = products[0]!;
  const text = `Olha, eu recomendo o ${top.name} — tá R$${top.price.toFixed(2)}! ${top.affiliateLink}`;

  return { text, products, delayMs: delay, shouldRespond: true };
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
