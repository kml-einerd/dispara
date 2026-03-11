import { Queue, Worker, type Job } from 'bullmq';
import type { RedisOptions } from 'ioredis';
import { Api } from 'grammy';
import pino from 'pino';

const logger = pino({ name: 'telegram-dispatch' });

const QUEUE_NAME = 'dispatch-telegram';
const MAX_MESSAGES_PER_SECOND = 30;

export interface DispatchJobData {
  tenantId: string;
  botToken: string;
  chatId: string;
  text: string;
  mediaUrl?: string;
  mediaType?: 'photo' | 'video' | 'animation';
}

export interface TelegramDispatcherOptions {
  redis: RedisOptions;
  concurrency?: number;
}

export class TelegramDispatcher {
  private queue: Queue<DispatchJobData>;
  private worker: Worker<DispatchJobData> | null = null;
  private redisOptions: RedisOptions;
  private concurrency: number;

  constructor(options: TelegramDispatcherOptions) {
    this.redisOptions = options.redis;
    this.concurrency = options.concurrency ?? 5;

    this.queue = new Queue<DispatchJobData>(QUEUE_NAME, {
      connection: this.redisOptions,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: false,
      },
    });
  }

  async addJob(data: DispatchJobData): Promise<string> {
    const job = await this.queue.add('send-message', data, {
      rateLimiterKey: `telegram:${data.botToken}`,
    });
    logger.info({ jobId: job.id, tenantId: data.tenantId, chatId: data.chatId }, 'Dispatch job added');
    return job.id!;
  }

  async addBulk(jobs: DispatchJobData[]): Promise<string[]> {
    const bulkJobs = jobs.map((data) => ({
      name: 'send-message',
      data,
      opts: {
        rateLimiterKey: `telegram:${data.botToken}`,
      },
    }));

    const results = await this.queue.addBulk(bulkJobs);
    const ids = results.map((j) => j.id!);
    logger.info({ count: ids.length }, 'Bulk dispatch jobs added');
    return ids;
  }

  startWorker(): void {
    if (this.worker) {
      logger.warn('Worker already running');
      return;
    }

    this.worker = new Worker<DispatchJobData>(
      QUEUE_NAME,
      async (job: Job<DispatchJobData>) => {
        await this.processJob(job);
      },
      {
        connection: this.redisOptions,
        concurrency: this.concurrency,
        limiter: {
          max: MAX_MESSAGES_PER_SECOND,
          duration: 1000,
        },
      },
    );

    this.worker.on('completed', (job) => {
      logger.info({ jobId: job.id, tenantId: job.data.tenantId }, 'Dispatch job completed');
    });

    this.worker.on('failed', (job, err) => {
      if (!job) return;
      const isExhausted = job.attemptsMade >= (job.opts.attempts ?? 3);
      if (isExhausted) {
        logger.error(
          { jobId: job.id, tenantId: job.data.tenantId, chatId: job.data.chatId, err },
          'Dispatch job moved to dead letter queue after exhausting retries',
        );
      } else {
        logger.warn(
          { jobId: job.id, tenantId: job.data.tenantId, attempt: job.attemptsMade, err },
          'Dispatch job failed, will retry',
        );
      }
    });

    this.worker.on('error', (err) => {
      logger.error({ err }, 'Worker error');
    });

    logger.info({ concurrency: this.concurrency }, 'Dispatch worker started');
  }

  private async processJob(job: Job<DispatchJobData>): Promise<void> {
    const { botToken, chatId, text, mediaUrl, mediaType } = job.data;

    const api = new Api(botToken);

    try {
      if (mediaUrl && mediaType) {
        switch (mediaType) {
          case 'photo':
            await api.sendPhoto(chatId, mediaUrl, { caption: text });
            break;
          case 'video':
            await api.sendVideo(chatId, mediaUrl, { caption: text });
            break;
          case 'animation':
            await api.sendAnimation(chatId, mediaUrl, { caption: text });
            break;
          default:
            await api.sendMessage(chatId, text);
        }
      } else {
        await api.sendMessage(chatId, text);
      }
    } catch (err) {
      logger.error({ jobId: job.id, chatId, err }, 'Failed to send Telegram message');
      throw err;
    }
  }

  async gracefulShutdown(): Promise<void> {
    logger.info('Shutting down dispatch worker');
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
    logger.info('Dispatch worker stopped');
  }
}
