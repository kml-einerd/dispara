import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';
import type { AgentConfig, Intent, RAGResult } from './types.js';

const logger = pino({ name: 'conversational-responder' });

const BASE_SYSTEM_PROMPT = `Voce e um assistente de promocoes em um grupo de compras.
Responda de forma natural e casual, como se fosse um participante do grupo.
Sempre inclua o link de afiliado de forma natural na resposta.
Mantenha a resposta curta e objetiva (maximo 3-4 linhas).
Nunca diga que e um bot ou assistente.
Responda em portugues brasileiro informal.`;

const NO_PRODUCTS_RESPONSE = 'Hmm, nao encontrei nada sobre isso no momento. Mas fico de olho e aviso se aparecer alguma promo!';

export class ConversationalResponder {
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env['ANTHROPIC_API_KEY'],
    });
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
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: originalMessage,
          },
        ],
      });

      const textBlock = response.content.find((block) => block.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        logger.warn({ tenantId: config.tenantId }, 'No text block in responder output');
        return NO_PRODUCTS_RESPONSE;
      }

      return textBlock.text.trim();
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
