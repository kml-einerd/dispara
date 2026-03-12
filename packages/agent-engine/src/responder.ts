import pino from 'pino';
import type { AgentConfig, Intent, RAGResult } from './types.js';

const logger = pino({ name: 'conversational-responder' });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const BASE_SYSTEM_PROMPT = `Voce e um assistente de promocoes em um grupo de compras.
Responda de forma natural e casual, como se fosse um participante do grupo.
Sempre inclua o link de afiliado de forma natural na resposta.
Mantenha a resposta curta e objetiva (maximo 3-4 linhas).
Nunca diga que e um bot ou assistente.
Responda em portugues brasileiro informal.`;

const NO_PRODUCTS_RESPONSE = 'Hmm, nao encontrei nada sobre isso no momento. Mas fico de olho e aviso se aparecer alguma promo!';

export class ConversationalResponder {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey ?? process.env['OPENROUTER_API_KEY'] ?? '';
    this.model = model ?? 'anthropic/claude-haiku-4-5-20251001';
  }

  async generateResponse(
    config: AgentConfig,
    products: RAGResult[],
    originalMessage: string,
    intent: Intent,
  ): Promise<string> {
    if (products.length === 0) {
      logger.info({ tenantId: config.tenantId, intent }, 'No products found, returning fallback');
      return NO_PRODUCTS_RESPONSE;
    }

    const systemPrompt = this.buildSystemPrompt(config, products, intent);

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 300,
          temperature: 0.7,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: originalMessage },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error({ status: response.status, body: errorBody }, 'OpenRouter API error');
        return NO_PRODUCTS_RESPONSE;
      }

      const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        logger.warn({ tenantId: config.tenantId }, 'No content in responder output');
        return NO_PRODUCTS_RESPONSE;
      }

      return content.trim();
    } catch (err) {
      logger.error({ err, tenantId: config.tenantId }, 'Error generating response');
      return NO_PRODUCTS_RESPONSE;
    }
  }

  private buildSystemPrompt(config: AgentConfig, products: RAGResult[], intent: Intent): string {
    const tenantInstructions = config.systemPrompt
      ? `\n\nInstrucoes adicionais do tenant:\n${config.systemPrompt}`
      : '';

    const productContext = products
      .map((r, i) => {
        const p = r.product;
        const discount = p.originalPrice
          ? ` (era R$${p.originalPrice.toFixed(2)})`
          : '';
        return `Produto ${i + 1}: ${p.name} - R$${p.price.toFixed(2)}${discount} - ${p.marketplace} - Link: ${p.affiliateUrl}`;
      })
      .join('\n');

    return (
      `${BASE_SYSTEM_PROMPT}${tenantInstructions}\n\n` +
      `Intencao detectada: ${intent}\n\n` +
      `Produtos encontrados para recomendar:\n${productContext}\n\n` +
      `IMPORTANTE: Inclua o link de afiliado do produto mais relevante na sua resposta. ` +
      `Se varios produtos forem relevantes, mencione ate 2.`
    );
  }
}
