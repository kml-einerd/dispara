import pino from 'pino';
import type { ClassificationResult, Intent } from './types.js';

const logger = pino({ name: 'intent-classifier' });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env['OPENROUTER_API_KEY'] ?? '';
    this.model = model ?? 'anthropic/claude-haiku-4-5-20251001';
  }

  async classifyIntent(message: string): Promise<ClassificationResult> {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 256,
          temperature: 0.1,
          messages: [
            { role: 'system', content: CLASSIFICATION_SYSTEM_PROMPT },
            { role: 'user', content: message },
          ],
        }),
      });
      const response = res as unknown as { ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown> };

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error({ status: response.status, body: errorBody }, 'OpenRouter API error');
        return DEFAULT_RESULT;
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        logger.warn({ message }, 'No content in classification response');
        return DEFAULT_RESULT;
      }

      const parsed = JSON.parse(content) as {
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
