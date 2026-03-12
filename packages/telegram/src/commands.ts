import { Composer } from 'grammy';
import type { Context } from 'grammy';
import pino from 'pino';

const logger = pino({ name: 'telegram-commands' });

export interface PromoInfo {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  affiliateUrl: string;
  marketplace: string;
}

export interface DispatchStats {
  totalSent: number;
  successRate: number;
  lastDispatchAt: Date | null;
}

export interface ProductInfo {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  affiliateUrl: string;
  imageUrl?: string;
  marketplace: string;
}

export interface TelegramServices {
  getActivePromos(tenantId: string): Promise<PromoInfo[]>;
  getDispatchStats(tenantId: string): Promise<DispatchStats>;
  triggerDispatch(tenantId: string, promoId: string, channelIds: string[]): Promise<string>;
  searchProducts(tenantId: string, query: string): Promise<ProductInfo[]>;
}

export function createCommandComposer(tenantId: string, services: TelegramServices): Composer<Context> {
  const composer = new Composer<Context>();

  composer.command('start', async (ctx) => {
    logger.info({ tenantId, chatId: ctx.chat?.id }, '/start command received');
    await ctx.reply(
      `Bem-vindo ao Dispara! Seu assistente de promos.\n\n` +
        `Comandos disponiveis:\n` +
        `/promos - Ver promos ativas\n` +
        `/dispatch - Disparar promos para canais (admin)\n` +
        `/stats - Ver estatisticas de disparos\n\n` +
        `Voce tambem pode usar o modo inline: digite @nomedoBot seguido de um termo para buscar produtos.`,
    );
  });

  composer.command('promos', async (ctx) => {
    logger.info({ tenantId, chatId: ctx.chat?.id }, '/promos command received');

    try {
      const promos = await services.getActivePromos(tenantId);

      if (promos.length === 0) {
        await ctx.reply('Nenhuma promo ativa no momento.');
        return;
      }

      const lines = promos.map((p) => {
        const discount = p.originalPrice
          ? ` (de R$${p.originalPrice.toFixed(2)})`
          : '';
        return `- ${p.name}\n  R$${p.price.toFixed(2)}${discount}\n  ${p.marketplace} | ${p.affiliateUrl}`;
      });

      await ctx.reply(`Promos ativas:\n\n${lines.join('\n\n')}`);
    } catch (err) {
      logger.error({ tenantId, err }, 'Error fetching promos');
      await ctx.reply('Erro ao buscar promos. Tente novamente mais tarde.');
    }
  });

  composer.command('dispatch', async (ctx) => {
    logger.info({ tenantId, chatId: ctx.chat?.id }, '/dispatch command received');

    // Admin check: only chat admins or private chats can trigger dispatch
    if (ctx.chat?.type !== 'private') {
      try {
        const member = await ctx.getChatMember(ctx.from!.id);
        if (!['administrator', 'creator'].includes(member.status)) {
          await ctx.reply('Apenas administradores podem disparar promos.');
          return;
        }
      } catch (err) {
        logger.error({ tenantId, err }, 'Error checking admin status');
        await ctx.reply('Erro ao verificar permissoes.');
        return;
      }
    }

    const args = ctx.match?.toString().trim();
    if (!args) {
      await ctx.reply(
        'Uso: /dispatch <promo_id> <channel_id1,channel_id2,...>\n\n' +
          'Exemplo: /dispatch promo_123 @canal1,@canal2',
      );
      return;
    }

    const [promoId, channelIdsRaw] = args.split(/\s+/);
    if (!promoId || !channelIdsRaw) {
      await ctx.reply('Formato invalido. Use: /dispatch <promo_id> <channel_ids>');
      return;
    }

    const channelIds = channelIdsRaw.split(',').map((c) => c.trim());

    try {
      const jobId = await services.triggerDispatch(tenantId, promoId, channelIds);
      await ctx.reply(`Disparo iniciado! Job ID: ${jobId}`);
    } catch (err) {
      logger.error({ tenantId, err }, 'Error triggering dispatch');
      await ctx.reply('Erro ao iniciar disparo. Tente novamente.');
    }
  });

  composer.command('stats', async (ctx) => {
    logger.info({ tenantId, chatId: ctx.chat?.id }, '/stats command received');

    try {
      const stats = await services.getDispatchStats(tenantId);
      const lastDispatch = stats.lastDispatchAt
        ? stats.lastDispatchAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        : 'Nunca';

      await ctx.reply(
        `Estatisticas de disparo:\n\n` +
          `Total enviados: ${stats.totalSent}\n` +
          `Taxa de sucesso: ${(stats.successRate * 100).toFixed(1)}%\n` +
          `Ultimo disparo: ${lastDispatch}`,
      );
    } catch (err) {
      logger.error({ tenantId, err }, 'Error fetching stats');
      await ctx.reply('Erro ao buscar estatisticas. Tente novamente.');
    }
  });

  return composer;
}
