/** Telegram Bot session per tenant */
export interface TelegramSession {
  tenantId: string;
  botToken: string;
  botUsername: string;
  status: 'active' | 'inactive' | 'error';
  createdAt: Date;
}

/** Outbound message to a Telegram channel/group */
export interface TelegramOutboundMessage {
  chatId: string | number;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  photo?: {
    url: string;
    caption?: string;
  };
  document?: {
    url: string;
    caption?: string;
  };
  replyToMessageId?: number;
  disableNotification?: boolean;
}

/** Result of a send operation */
export interface TelegramSendResult {
  ok: boolean;
  messageId?: number;
  chatId: string | number;
  error?: string;
}

/** Telegram rate limit config */
export interface TelegramRateLimitConfig {
  maxMessagesPerSecond: number;
  maxMessagesPerMinute: number;
  burstSize: number;
}

/** Default rate limits — Telegram allows 30 msgs/sec per bot */
export const DEFAULT_RATE_LIMITS: TelegramRateLimitConfig = {
  maxMessagesPerSecond: 25,
  maxMessagesPerMinute: 1200,
  burstSize: 30,
};
