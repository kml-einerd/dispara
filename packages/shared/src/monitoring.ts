import pino from 'pino';
import { fetchWithTimeout } from './index.js';

const logger = pino({ name: 'monitor' });

interface AlertConfig {
  telegramToken?: string;
  telegramChatId?: string;
}

let config: AlertConfig = {};

export function initMonitoring(cfg: AlertConfig) {
  config = cfg;
}

export async function sendAlert(level: 'warning' | 'critical', title: string, details: string) {
  const emoji = level === 'critical' ? '🚨' : '⚠️';
  const message = `${emoji} *${title}*\n\n${details}`;

  logger[level === 'critical' ? 'error' : 'warn']({ title, details }, 'Alert fired');

  if (config.telegramToken && config.telegramChatId) {
    try {
      await fetchWithTimeout(
        `https://api.telegram.org/bot${config.telegramToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text: message,
            parse_mode: 'Markdown',
          }),
        },
        10_000,
      );
    } catch (err) {
      logger.error({ err }, 'Failed to send Telegram alert');
    }
  }
}
