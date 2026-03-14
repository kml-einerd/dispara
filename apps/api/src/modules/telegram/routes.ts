import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Queue } from 'bullmq';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { QUEUES, fetchWithTimeout } from '@dispara/shared';
import {
  registerBotSchema,
  updateChannelSchema,
  dispatchSchema,
} from './schema.js';

export async function telegramRoutes(app: FastifyInstance): Promise<void> {
  const telegramQueue = new Queue(QUEUES.TELEGRAM_DISPATCH, { connection: redis as any });

  // ── POST /v1/telegram/bots — Register a new Telegram bot ──
  app.post('/bots', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = registerBotSchema.parse(request.body);

    // Validate bot token by calling Telegram getMe API
    let botInfo: { id: number; username: string; first_name: string };
    try {
      const response = await fetchWithTimeout(`https://api.telegram.org/bot${input.botToken}/getMe`);
      const data = (await response.json()) as {
        ok: boolean;
        result?: { id: number; username: string; first_name: string };
        description?: string;
      };

      if (!data.ok || !data.result) {
        reply.status(400).send({
          error: {
            code: 'INVALID_BOT_TOKEN',
            message: `Telegram API rejected the token: ${data.description ?? 'unknown error'}`,
          },
        });
        return;
      }

      botInfo = data.result;
    } catch (err) {
      app.log.error({ err }, 'Failed to validate Telegram bot token');
      reply.status(502).send({
        error: {
          code: 'TELEGRAM_API_ERROR',
          message: 'Failed to reach Telegram API to validate bot token',
        },
      });
      return;
    }

    // Check if bot already registered for this tenant
    const existing = await prisma.telegramBot.findFirst({
      where: {
        tenantId: request.tenantId,
        botUsername: botInfo.username,
      },
    });

    if (existing) {
      reply.status(409).send({
        error: {
          code: 'BOT_ALREADY_EXISTS',
          message: `Bot @${botInfo.username} is already registered for this tenant`,
        },
      });
      return;
    }

    const bot = await prisma.telegramBot.create({
      data: {
        tenantId: request.tenantId,
        botToken: input.botToken,
        botUsername: botInfo.username,
        name: input.name ?? botInfo.first_name,
        isActive: true,
      },
    });

    app.log.info(
      { tenantId: request.tenantId, botId: bot.id, username: botInfo.username },
      'Telegram bot registered',
    );

    reply.status(201).send({
      bot: {
        id: bot.id,
        botUsername: bot.botUsername,
        name: bot.name,
        isActive: bot.isActive,
        createdAt: bot.createdAt,
      },
    });
  });

  // ── GET /v1/telegram/bots — List tenant's bots ──
  app.get('/bots', async (request: FastifyRequest, reply: FastifyReply) => {
    const bots = await prisma.telegramBot.findMany({
      where: { tenantId: request.tenantId },
      select: {
        id: true,
        botUsername: true,
        name: true,
        isActive: true,
        webhookUrl: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { channels: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    reply.status(200).send({ data: bots });
  });

  // ── DELETE /v1/telegram/bots/:botId — Remove bot ──
  app.delete(
    '/bots/:botId',
    async (
      request: FastifyRequest<{ Params: { botId: string } }>,
      reply: FastifyReply,
    ) => {
      const bot = await prisma.telegramBot.findFirst({
        where: {
          id: request.params.botId,
          tenantId: request.tenantId,
        },
      });

      if (!bot) {
        reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Bot not found' },
        });
        return;
      }

      await prisma.telegramBot.delete({
        where: { id: bot.id },
      });

      app.log.info(
        { tenantId: request.tenantId, botId: bot.id },
        'Telegram bot removed',
      );

      reply.status(200).send({ deleted: true, id: bot.id });
    },
  );

  // ── GET /v1/telegram/bots/:botId/channels — List channels for a bot ──
  app.get(
    '/bots/:botId/channels',
    async (
      request: FastifyRequest<{ Params: { botId: string } }>,
      reply: FastifyReply,
    ) => {
      // Verify bot belongs to tenant
      const bot = await prisma.telegramBot.findFirst({
        where: {
          id: request.params.botId,
          tenantId: request.tenantId,
        },
        select: { id: true },
      });

      if (!bot) {
        reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Bot not found' },
        });
        return;
      }

      const channels = await prisma.telegramChannel.findMany({
        where: {
          tenantId: request.tenantId,
          botId: bot.id,
        },
        orderBy: { createdAt: 'desc' },
      });

      reply.status(200).send({ data: channels });
    },
  );

  // ── PATCH /v1/telegram/channels/:channelId — Update channel settings ──
  app.patch(
    '/channels/:channelId',
    async (
      request: FastifyRequest<{ Params: { channelId: string } }>,
      reply: FastifyReply,
    ) => {
      const input = updateChannelSchema.parse(request.body);

      const channel = await prisma.telegramChannel.findFirst({
        where: {
          id: request.params.channelId,
          tenantId: request.tenantId,
        },
      });

      if (!channel) {
        reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Channel not found' },
        });
        return;
      }

      const updated = await prisma.telegramChannel.update({
        where: { id: channel.id },
        data: {
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(input.agentEnabled !== undefined && { agentEnabled: input.agentEnabled }),
        },
      });

      app.log.info(
        { tenantId: request.tenantId, channelId: channel.id, changes: input },
        'Telegram channel updated',
      );

      reply.status(200).send({ channel: updated });
    },
  );

  // ── POST /v1/telegram/dispatch — Create dispatch to channels ──
  app.post('/dispatch', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = dispatchSchema.parse(request.body);

    // Validate all channels belong to tenant and are active
    const channels = await prisma.telegramChannel.findMany({
      where: {
        id: { in: input.channelIds },
        tenantId: request.tenantId,
        isActive: true,
      },
      include: {
        bot: { select: { id: true, botToken: true, isActive: true } },
      },
    });

    if (channels.length === 0) {
      reply.status(400).send({
        error: {
          code: 'NO_VALID_CHANNELS',
          message: 'No valid active channels found for the provided IDs',
        },
      });
      return;
    }

    const missingIds = input.channelIds.filter(id => !channels.find(c => c.id === id));
    if (missingIds.length > 0) {
      app.log.warn({ missingIds }, 'Some channels not found or inactive');
    }

    // Filter out channels whose bot is inactive
    const activeChannels = channels.filter(c => c.bot.isActive);
    if (activeChannels.length === 0) {
      reply.status(400).send({
        error: {
          code: 'NO_ACTIVE_BOTS',
          message: 'All matching channels have inactive bots',
        },
      });
      return;
    }

    // Generate a dispatch batch ID
    const dispatchId = crypto.randomUUID();

    // Create dispatch items in DB
    const items = await prisma.$transaction(
      activeChannels.map(channel =>
        prisma.telegramDispatchItem.create({
          data: {
            dispatchId,
            channelId: channel.id,
            chatId: channel.chatId,
            botId: channel.bot.id,
            text: input.text,
            mediaUrl: input.mediaUrl ?? null,
            mediaType: input.mediaType ?? null,
            status: 'PENDING',
          },
        }),
      ),
    );

    // Enqueue jobs staggered by 2s each
    const jobs = items.map((item, index) => ({
      name: `tg-dispatch-${dispatchId}-${item.id}`,
      data: {
        dispatchId,
        dispatchItemId: item.id,
        channelId: item.channelId,
        chatId: item.chatId,
        botId: item.botId,
        tenantId: request.tenantId,
        text: input.text,
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType,
      },
      opts: {
        delay: index * 2000,
        attempts: 3,
        backoff: { type: 'exponential' as const, delay: 10_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 604_800 },
      },
    }));

    await telegramQueue.addBulk(jobs);

    app.log.info(
      { dispatchId, totalChannels: activeChannels.length, tenantId: request.tenantId },
      'Telegram dispatch created',
    );

    reply.status(201).send({
      dispatchId,
      totalChannels: activeChannels.length,
      skippedChannels: missingIds.length + (channels.length - activeChannels.length),
      items: items.map(i => ({ id: i.id, channelId: i.channelId, chatId: i.chatId, status: i.status })),
    });
  });

  // ── GET /v1/telegram/dispatch/:dispatchId/status — Dispatch status ──
  app.get(
    '/dispatch/:dispatchId/status',
    async (
      request: FastifyRequest<{ Params: { dispatchId: string } }>,
      reply: FastifyReply,
    ) => {
      const items = await prisma.telegramDispatchItem.findMany({
        where: { dispatchId: request.params.dispatchId },
        orderBy: { createdAt: 'asc' },
      });

      if (items.length === 0) {
        reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Dispatch not found' },
        });
        return;
      }

      // Verify at least one item belongs to tenant (via channel lookup)
      const channelIds = [...new Set(items.map(i => i.channelId))];
      const tenantChannels = await prisma.telegramChannel.findMany({
        where: {
          id: { in: channelIds },
          tenantId: request.tenantId,
        },
        select: { id: true },
      });

      if (tenantChannels.length === 0) {
        reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Dispatch not found' },
        });
        return;
      }

      const summary = {
        total: items.length,
        pending: items.filter(i => i.status === 'PENDING').length,
        queued: items.filter(i => i.status === 'QUEUED').length,
        sending: items.filter(i => i.status === 'SENDING').length,
        sent: items.filter(i => i.status === 'SENT').length,
        failed: items.filter(i => i.status === 'FAILED').length,
        cancelled: items.filter(i => i.status === 'CANCELLED').length,
      };

      reply.status(200).send({
        dispatchId: request.params.dispatchId,
        summary,
        items: items.map(i => ({
          id: i.id,
          channelId: i.channelId,
          chatId: i.chatId,
          status: i.status,
          attempts: i.attempts,
          lastError: i.lastError,
          sentAt: i.sentAt,
        })),
      });
    },
  );
}
