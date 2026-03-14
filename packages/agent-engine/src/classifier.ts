import pino from 'pino';
import type { ClassificationResult, Intent } from './types.js';

const logger = pino({ name: 'intent-classifier' });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const VALID_INTENTS: Intent[] = [
  'busca_produto',
  'gerar_copy',
  'disparar',
  'status',
  'ajuda',
  'off_topic',
];

const CLASSIFICATION_SYSTEM_PROMPT = `Voce e um classificador de intencoes para um bot de promocoes em grupos brasileiros de WhatsApp/Telegram.

Classifique a mensagem do usuario em UMA destas intencoes:

- busca_produto: usuario pergunta sobre produto especifico, preco, oferta, recomendacao, ou quer encontrar algo pra comprar
- gerar_copy: usuario quer criar texto/copy/anuncio para divulgar um produto ou promocao
- disparar: usuario quer enviar/disparar mensagem para grupos, agendar envio, ou gerenciar filas de disparo
- status: usuario pergunta sobre status de disparos, numeros, sessoes, filas, metricas ou configuracoes do sistema
- ajuda: usuario pede ajuda, nao sabe usar o sistema, pergunta como funciona, ou pede instrucoes
- off_topic: mensagem casual, cumprimentos, memes, conversas que nao tem relacao com produtos ou o sistema

Retorne APENAS JSON valido com esta estrutura:
{
  "intent": "busca_produto" | "gerar_copy" | "disparar" | "status" | "ajuda" | "off_topic",
  "confidence": 0.0 a 1.0,
  "entities": {
    "productName": "string ou null",
    "category": "string ou null",
    "maxPrice": numero ou null,
    "brand": "string ou null"
  }
}

Seja estrito: conversa casual, saudacoes e memes sao sempre off_topic.
Entidades so sao relevantes para busca_produto. Para outros intents, retorne entities vazio.`;

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

      const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleaned) as {
        intent?: string;
        confidence?: number;
        entities?: ClassificationResult['entities'];
      };

      if (!parsed.intent || !VALID_INTENTS.includes(parsed.intent as Intent)) {
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
