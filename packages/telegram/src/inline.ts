import { Composer } from 'grammy';
import type { Context, InlineQueryResult } from 'grammy';
import pino from 'pino';
import type { TelegramServices, ProductInfo } from './commands.js';

const logger = pino({ name: 'telegram-inline' });

function formatPromoMessage(product: ProductInfo): string {
  const discount = product.originalPrice
    ? `\nDe: R$${product.originalPrice.toFixed(2)}`
    : '';

  return (
    `${product.name}\n` +
    `${discount}\n` +
    `Por: R$${product.price.toFixed(2)}\n` +
    `${product.marketplace}\n\n` +
    `${product.affiliateUrl}`
  );
}

export function createInlineHandler(tenantId: string, services: TelegramServices): Composer<Context> {
  const composer = new Composer<Context>();

  composer.on('inline_query', async (ctx) => {
    const query = ctx.inlineQuery.query.trim();

    if (!query || query.length < 2) {
      await ctx.answerInlineQuery([]);
      return;
    }

    logger.info({ tenantId, query }, 'Inline query received');

    try {
      const products = await services.searchProducts(tenantId, query);

      const results: InlineQueryResult[] = products.map((product, index) => {
        const message = formatPromoMessage(product);

        return {
          type: 'article' as const,
          id: product.id || String(index),
          title: product.name,
          description: `R$${product.price.toFixed(2)} - ${product.marketplace}`,
          input_message_content: {
            message_text: message,
            parse_mode: undefined,
          },
        };
      });

      await ctx.answerInlineQuery(results, { cache_time: 60 });
    } catch (err) {
      logger.error({ tenantId, query, err }, 'Error handling inline query');
      await ctx.answerInlineQuery([]);
    }
  });

  return composer;
}
