import type { ClassifiedIntent, InboundMessage } from '../types.js';

/** Keyword-based intent classifier (stub — swap for LLM classifier later) */
export function classifyIntent(message: InboundMessage): ClassifiedIntent {
  const text = message.text.toLowerCase();

  const productKeywords = ['indica', 'recomend', 'suggest', 'alguém tem', 'qual melhor', 'bom e barato'];
  const priceKeywords = ['preço', 'preco', 'quanto custa', 'valor', 'promoção', 'desconto'];
  const greetingKeywords = ['bom dia', 'boa tarde', 'boa noite', 'oi', 'olá', 'eai'];

  if (productKeywords.some(kw => text.includes(kw))) {
    return { intent: 'recommendation', confidence: 0.7, entities: {} };
  }

  if (priceKeywords.some(kw => text.includes(kw))) {
    return { intent: 'price_check', confidence: 0.7, entities: {} };
  }

  if (greetingKeywords.some(kw => text.includes(kw))) {
    return { intent: 'greeting', confidence: 0.8, entities: {} };
  }

  return { intent: 'unknown', confidence: 0.0, entities: {} };
}
