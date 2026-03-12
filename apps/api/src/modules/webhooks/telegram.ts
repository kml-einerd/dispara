import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/**
 * Telegram webhook handler.
 *
 * Receives incoming updates from Telegram for each tenant's bot.
 * Route: POST /v1/telegram/webhook/:tenantId
 *
 * This route is PUBLIC (bypasses tenant middleware since tenantId comes from URL path).
 * The tenant middleware already skips routes that are not in the auth-required prefixes,
 * but we validate the tenantId against the DB.
 */
export async function telegramWebhookRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /v1/telegram/webhook/:tenantId — Receive Telegram updates ──
  app.post(
    '/:tenantId',
    async (
      request: FastifyRequest<{
        Params: { tenantId: string };
        Body: TelegramUpdate;
      }>,
      reply: FastifyReply,
    ) => {
      const { tenantId } = request.params;
      const update = request.body;

      if (!update) {
        reply.status(200).send({ ok: true });
        return;
      }

      // Extract chat info from the update
      const message = update.message ?? update.channel_post;
      if (!message) {
        // Not a message update (could be callback_query, edited_message, etc.)
        // Return 200 to acknowledge receipt
        reply.status(200).send({ ok: true });
        return;
      }

      const chatId = String(message.chat.id);
      const chatType = message.chat.type; // 'private', 'group', 'supergroup', 'channel'

      // Find the bot for this tenant that matches this chat
      const channel = await prisma.telegramChannel.findFirst({
        where: {
          tenantId,
          chatId,
          isActive: true,
        },
        include: {
          bot: {
            select: {
              id: true,
              botToken: true,
              botUsername: true,
              isActive: true,
            },
          },
        },
      });

      if (!channel || !channel.bot.isActive) {
        // Unknown channel or inactive bot — acknowledge silently
        app.log.debug(
          { tenantId, chatId, chatType },
          'Webhook received for unknown or inactive channel',
        );
        reply.status(200).send({ ok: true });
        return;
      }

      // If agent is not enabled on this channel, just acknowledge
      if (!channel.agentEnabled) {
        reply.status(200).send({ ok: true });
        return;
      }

      // Extract the text content
      const text = message.text ?? message.caption;
      if (!text) {
        reply.status(200).send({ ok: true });
        return;
      }

      const senderId = message.from?.id ? String(message.from.id) : 'unknown';
      const senderName = message.from?.first_name ?? 'Unknown';

      app.log.info(
        {
          tenantId,
          chatId,
          senderId,
          botUsername: channel.bot.botUsername,
          textLength: text.length,
        },
        'Processing Telegram message for AI agent',
      );

      // Find agent config for this tenant
      const agentConfig = await prisma.agentConfig.findFirst({
        where: {
          tenantId,
          agentType: 'conversational',
          isActive: true,
        },
      });

      if (!agentConfig) {
        app.log.debug({ tenantId }, 'No active agent config, skipping AI response');
        reply.status(200).send({ ok: true });
        return;
      }

      // Process message and generate AI response
      const startTime = Date.now();
      let responseText: string | null = null;
      let success = true;
      let errorMessage: string | null = null;
      let tokenCount: number | null = null;

      try {
        // Import agent engine dynamically to avoid circular deps
        const agentEngine = await import('@dispara/agent-engine' as string);
        const processAgentMessage = agentEngine.processAgentMessage as
          | ((opts: any) => Promise<{ text: string; tokenCount?: number }>)
          | undefined;

        if (!processAgentMessage) {
          throw new Error('processAgentMessage not exported from @dispara/agent-engine');
        }

        const result = await processAgentMessage({
          tenantId,
          agentConfig: {
            systemPrompt: agentConfig.systemPrompt ?? undefined,
            model: agentConfig.model,
            temperature: agentConfig.temperature,
            maxTokens: agentConfig.maxTokens,
            metadata: agentConfig.metadata as Record<string, unknown> | undefined,
          },
          message: {
            text,
            senderId,
            senderName,
            chatId,
            chatType,
          },
        });

        responseText = result.text;
        tokenCount = result.tokenCount ?? null;
      } catch (err) {
        success = false;
        errorMessage = err instanceof Error ? err.message : String(err);
        app.log.error({ err, tenantId, chatId }, 'Agent processing failed');
      }

      const latencyMs = Date.now() - startTime;

      // Record the interaction
      await prisma.agentInteraction.create({
        data: {
          agentConfigId: agentConfig.id,
          userId: senderId,
          inputPayload: {
            text,
            senderId,
            senderName,
            chatId,
            chatType,
            intent: 'PRODUCT_QUERY', // TODO: classify intent from agent engine
            groupId: chatId,
          },
          outputPayload: responseText ? { text: responseText } : Prisma.JsonNull,
          tokenCount,
          latencyMs,
          success,
          errorMessage,
        },
      });

      // Send the response back to Telegram if we have one
      if (responseText) {
        try {
          const sendUrl = `https://api.telegram.org/bot${channel.bot.botToken}/sendMessage`;
          const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: responseText,
              reply_to_message_id: message.message_id,
              parse_mode: 'Markdown',
            }),
          });

          if (!sendResponse.ok) {
            const errBody = await sendResponse.text();
            app.log.error(
              { tenantId, chatId, status: sendResponse.status, body: errBody },
              'Failed to send Telegram response',
            );
          }
        } catch (err) {
          app.log.error({ err, tenantId, chatId }, 'Failed to send Telegram response');
        }
      }

      reply.status(200).send({ ok: true });
    },
  );
}

// ── Telegram Update types (minimal) ──

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: unknown;
}
