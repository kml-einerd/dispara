import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock bullmq
const mockQueueAdd = vi.fn();
const mockQueueAddBulk = vi.fn();
const mockQueueClose = vi.fn();
const mockWorkerClose = vi.fn();
const mockWorkerOn = vi.fn();

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    addBulk: mockQueueAddBulk,
    close: mockQueueClose,
  })),
  Worker: vi.fn().mockImplementation((_name: string, processor: Function, _opts: unknown) => {
    // Store the processor so tests can invoke it
    (Worker as any).__processor = processor;
    return {
      on: mockWorkerOn,
      close: mockWorkerClose,
    };
  }),
}));

// Mock grammy Api
const mockSendMessage = vi.fn();
const mockSendPhoto = vi.fn();
const mockSendVideo = vi.fn();
const mockSendAnimation = vi.fn();

vi.mock('grammy', () => ({
  Api: vi.fn().mockImplementation(() => ({
    sendMessage: mockSendMessage,
    sendPhoto: mockSendPhoto,
    sendVideo: mockSendVideo,
    sendAnimation: mockSendAnimation,
  })),
}));

import { Queue, Worker } from 'bullmq';
import { TelegramDispatcher, type DispatchJobData } from '../dispatch.js';

function makeJobData(overrides: Partial<DispatchJobData> = {}): DispatchJobData {
  return {
    tenantId: 'tenant-1',
    botToken: 'fake-bot-token',
    chatId: '-100123456',
    text: 'Promo imperdivel!',
    ...overrides,
  };
}

describe('TelegramDispatcher', () => {
  let dispatcher: TelegramDispatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new TelegramDispatcher({
      redis: { host: 'localhost', port: 6379 },
    });
  });

  describe('addJob', () => {
    it('creates job with correct data', async () => {
      mockQueueAdd.mockResolvedValueOnce({ id: 'job-1' });

      const data = makeJobData();
      const jobId = await dispatcher.addJob(data);

      expect(jobId).toBe('job-1');
      expect(mockQueueAdd).toHaveBeenCalledWith('send-message', data);
    });
  });

  describe('addBulk', () => {
    it('creates multiple jobs', async () => {
      const jobs = [
        makeJobData({ chatId: '-100111' }),
        makeJobData({ chatId: '-100222' }),
        makeJobData({ chatId: '-100333' }),
      ];
      mockQueueAddBulk.mockResolvedValueOnce([
        { id: 'j1' },
        { id: 'j2' },
        { id: 'j3' },
      ]);

      const ids = await dispatcher.addBulk(jobs);

      expect(ids).toEqual(['j1', 'j2', 'j3']);
      expect(mockQueueAddBulk).toHaveBeenCalledWith(
        jobs.map((data) => ({ name: 'send-message', data })),
      );
    });
  });

  describe('worker processing', () => {
    it('sends text message when no media', async () => {
      dispatcher.startWorker();

      // Get the processor function that was passed to the Worker constructor
      const workerCalls = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls;
      expect(workerCalls.length).toBeGreaterThan(0);
      const processor = workerCalls[0][1] as (job: any) => Promise<void>;

      mockSendMessage.mockResolvedValueOnce({});

      await processor({
        data: makeJobData(),
        id: 'job-1',
      });

      expect(mockSendMessage).toHaveBeenCalledWith('-100123456', 'Promo imperdivel!');
    });

    it('sends photo when mediaType is photo', async () => {
      dispatcher.startWorker();

      const processor = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as (job: any) => Promise<void>;
      mockSendPhoto.mockResolvedValueOnce({});

      await processor({
        data: makeJobData({
          mediaUrl: 'https://example.com/photo.jpg',
          mediaType: 'photo',
        }),
        id: 'job-2',
      });

      expect(mockSendPhoto).toHaveBeenCalledWith(
        '-100123456',
        'https://example.com/photo.jpg',
        { caption: 'Promo imperdivel!' },
      );
    });

    it('sends video when mediaType is video', async () => {
      dispatcher.startWorker();

      const processor = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as (job: any) => Promise<void>;
      mockSendVideo.mockResolvedValueOnce({});

      await processor({
        data: makeJobData({
          mediaUrl: 'https://example.com/video.mp4',
          mediaType: 'video',
        }),
        id: 'job-3',
      });

      expect(mockSendVideo).toHaveBeenCalledWith(
        '-100123456',
        'https://example.com/video.mp4',
        { caption: 'Promo imperdivel!' },
      );
    });

    it('sends animation when mediaType is animation', async () => {
      dispatcher.startWorker();

      const processor = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as (job: any) => Promise<void>;
      mockSendAnimation.mockResolvedValueOnce({});

      await processor({
        data: makeJobData({
          mediaUrl: 'https://example.com/anim.gif',
          mediaType: 'animation',
        }),
        id: 'job-4',
      });

      expect(mockSendAnimation).toHaveBeenCalledWith(
        '-100123456',
        'https://example.com/anim.gif',
        { caption: 'Promo imperdivel!' },
      );
    });

    it('throws error on failure (so BullMQ retries)', async () => {
      dispatcher.startWorker();

      const processor = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as (job: any) => Promise<void>;
      mockSendMessage.mockRejectedValueOnce(new Error('Telegram API error'));

      await expect(
        processor({ data: makeJobData(), id: 'job-fail' }),
      ).rejects.toThrow('Telegram API error');
    });
  });

  describe('worker configuration', () => {
    it('configures rate limiter with 30 msgs/s', () => {
      dispatcher.startWorker();

      const workerCalls = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const options = workerCalls[0][2] as Record<string, any>;

      expect(options.limiter).toEqual({
        max: 30,
        duration: 1000,
      });
    });

    it('registers event handlers for completed, failed, and error', () => {
      dispatcher.startWorker();

      const onCalls = mockWorkerOn.mock.calls.map((c: any[]) => c[0]);
      expect(onCalls).toContain('completed');
      expect(onCalls).toContain('failed');
      expect(onCalls).toContain('error');
    });

    it('does not start a second worker if one is already running', () => {
      dispatcher.startWorker();
      dispatcher.startWorker();

      expect(Worker).toHaveBeenCalledTimes(1);
    });
  });

  describe('gracefulShutdown', () => {
    it('closes worker and queue', async () => {
      dispatcher.startWorker();

      mockWorkerClose.mockResolvedValueOnce(undefined);
      mockQueueClose.mockResolvedValueOnce(undefined);

      await dispatcher.gracefulShutdown();

      expect(mockWorkerClose).toHaveBeenCalled();
      expect(mockQueueClose).toHaveBeenCalled();
    });

    it('closes only queue when no worker is running', async () => {
      mockQueueClose.mockResolvedValueOnce(undefined);

      await dispatcher.gracefulShutdown();

      expect(mockWorkerClose).not.toHaveBeenCalled();
      expect(mockQueueClose).toHaveBeenCalled();
    });
  });

  describe('Queue configuration', () => {
    it('creates queue with correct default job options', () => {
      const queueCalls = (Queue as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const options = queueCalls[0][1] as Record<string, any>;

      expect(options.defaultJobOptions.attempts).toBe(3);
      expect(options.defaultJobOptions.backoff).toEqual({
        type: 'fixed',
        delay: 5000,
      });
    });
  });
});
