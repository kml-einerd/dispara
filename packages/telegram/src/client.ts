import pino from 'pino';
import type {
  TelegramOutboundMessage,
  TelegramSendResult,
  TelegramSession,
} from './types.js';

const logger = pino({ name: '@promospot/telegram' });

/**
 * Lightweight Telegram Bot API client.
 * Wraps fetch calls to the Bot API — no external SDK dependency.
 */
export class TelegramClient {
  private readonly baseUrl: string;

  constructor(private readonly session: TelegramSession) {
    this.baseUrl = `https://api.telegram.org/bot${session.botToken}`;
  }

  /** Send a text message */
  async sendMessage(msg: TelegramOutboundMessage): Promise<TelegramSendResult> {
    if (msg.photo) return this.sendPhoto(msg);
    if (msg.document) return this.sendDocument(msg);

    const body = {
      chat_id: msg.chatId,
      text: msg.text,
      parse_mode: msg.parseMode,
      reply_to_message_id: msg.replyToMessageId,
      disable_notification: msg.disableNotification,
    };

    return this.call('sendMessage', body);
  }

  /** Send a photo with optional caption */
  async sendPhoto(msg: TelegramOutboundMessage): Promise<TelegramSendResult> {
    const body = {
      chat_id: msg.chatId,
      photo: msg.photo!.url,
      caption: msg.photo!.caption ?? msg.text,
      parse_mode: msg.parseMode,
      reply_to_message_id: msg.replyToMessageId,
      disable_notification: msg.disableNotification,
    };

    return this.call('sendPhoto', body);
  }

  /** Send a document with optional caption */
  async sendDocument(msg: TelegramOutboundMessage): Promise<TelegramSendResult> {
    const body = {
      chat_id: msg.chatId,
      document: msg.document!.url,
      caption: msg.document!.caption ?? msg.text,
      parse_mode: msg.parseMode,
      reply_to_message_id: msg.replyToMessageId,
      disable_notification: msg.disableNotification,
    };

    return this.call('sendDocument', body);
  }

  /** Verify bot token is valid */
  async getMe(): Promise<{ ok: boolean; username?: string }> {
    const res = await this.call('getMe', {});
    return { ok: res.ok, username: this.session.botUsername };
  }

  /** Generic Bot API call */
  private async call(method: string, body: Record<string, unknown>): Promise<TelegramSendResult> {
    const url = `${this.baseUrl}/${method}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { ok: boolean; result?: { message_id: number } };

      if (!data.ok) {
        logger.warn({ method, chatId: body.chat_id, data }, 'Telegram API error');
        return { ok: false, chatId: body.chat_id as string, error: JSON.stringify(data) };
      }

      return {
        ok: true,
        messageId: data.result?.message_id,
        chatId: body.chat_id as string,
      };
    } catch (err) {
      logger.error({ method, err }, 'Telegram API request failed');
      return { ok: false, chatId: body.chat_id as string, error: String(err) };
    }
  }
}
