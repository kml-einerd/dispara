import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';
import type { ClassificationResult, Intent } from './types.js';

const logger = pino({ name: 'intent-classifier' });

const CLASSIFICATION_SYSTEM_PROMPT = `You are an intent classifier for a promotional products bot in Brazilian Portuguese groups.
Classify the user message into one of these intents:
- product_query: user is asking about a specific product
- price_check: user is asking about prices or deals
- recommendation: user is asking for product recommendations or suggestions
- off_topic: message is not related to products, prices, or shopping

Return ONLY valid JSON with this structure:
{
  "intent": "product_query" | "price_check" | "recommendation" | "off_topic",
  "confidence": 0.0 to 1.0,
  "entities": {
    "productName": "string or null",
    "category": "string or null",
    "maxPrice": number or null,
    "brand": "string or null"
  }
}

Be strict: casual conversation, greetings, memes, and non-shopping messages are always off_topic.`;

const DEFAULT_RESULT: ClassificationResult = {
  intent: 'off_topic',
  confidence: 0.0,
  entities: {},
};

export class IntentClassifier {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'],
    });
  }

  async classifyIntent(message: string): Promise<ClassificationResult> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        temperature: 0.1,
        system: CLASSIFICATION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        logger.warn({ message }, 'No text block in classification response');
        return DEFAULT_RESULT;
      }

      const parsed = JSON.parse(textBlock.text) as {
        intent?: string;
        confidence?: number;
        entities?: ClassificationResult['entities'];
      };

      const validIntents: Intent[] = ['product_query', 'price_check', 'recommendation', 'off_topic'];
      if (!parsed.intent || !validIntents.includes(parsed.intent as Intent)) {
        logger.warn({ parsed, message }, 'Invalid intent in classification response');
        return DEFAULT_RESULT;
      }

      return {
        intent: parsed.intent as Intent,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        entities: parsed.entities ?? {},
      };
    } catch (err) {
      logger.error({ err, message }, 'Error classifying intent, defaulting to off_topic');
      return DEFAULT_RESULT;
    }
  }
}
