import { Bot, webhookCallback } from 'grammy';
import type { Context } from 'grammy';
import pino from 'pino';
import { createCommandComposer, type TelegramServices } from './commands.js';
import { createInlineHandler } from './inline.js';

const logger = pino({ name: 'telegram-bot-manager' });

export interface BotInstance {
  bot: Bot;
  tenantId: string;
}

export class TelegramBotManager {
  private bots: Map<string, BotInstance> = new Map();
  private baseUrl: string;
  private services: TelegramServices;

  constructor(baseUrl: string, services: TelegramServices) {
    this.baseUrl = baseUrl;
    this.services = services;
  }

  async startBot(tenantId: string, botToken: string): Promise<void> {
    if (this.bots.has(tenantId)) {
      logger.warn({ tenantId }, 'Bot already running for tenant, stopping first');
      await this.stopBot(tenantId);
    }

    const bot = new Bot(botToken);

    // Register command handlers
    const commands = createCommandComposer(tenantId, this.services);
    bot.use(commands);

    // Register inline mode handler
    const inlineHandler = createInlineHandler(tenantId, this.services);
    bot.use(inlineHandler);

    // Set webhook
    const webhookUrl = `${this.baseUrl}/v1/telegram/webhook/${tenantId}`;
    await bot.api.setWebhook(webhookUrl);

    // Initialize bot info
    await bot.init();

    this.bots.set(tenantId, { bot, tenantId });
    logger.info({ tenantId, webhookUrl }, 'Bot started with webhook');
  }

  async stopBot(tenantId: string): Promise<void> {
    const instance = this.bots.get(tenantId);
    if (!instance) {
      logger.warn({ tenantId }, 'No bot found for tenant');
      return;
    }

    try {
      await instance.bot.api.deleteWebhook();
    } catch (err) {
      logger.error({ tenantId, err }, 'Failed to delete webhook');
    }

    this.bots.delete(tenantId);
    logger.info({ tenantId }, 'Bot stopped');
  }

  getBot(tenantId: string): BotInstance | undefined {
    return this.bots.get(tenantId);
  }

  getWebhookHandler(tenantId: string) {
    const instance = this.bots.get(tenantId);
    if (!instance) return undefined;
    return webhookCallback(instance.bot, 'fastify');
  }

  async gracefulShutdown(): Promise<void> {
    logger.info({ count: this.bots.size }, 'Shutting down all bots');
    const stopPromises = Array.from(this.bots.keys()).map((tenantId) =>
      this.stopBot(tenantId).catch((err) => {
        logger.error({ tenantId, err }, 'Error stopping bot during shutdown');
      }),
    );
    await Promise.all(stopPromises);
    logger.info('All bots stopped');
  }
}
