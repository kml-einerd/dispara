import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock bullmq
const mockQueueAdd = vi.fn();
const mockQueueAddBulk = vi.fn();
const mockQueueClose = vi.fn();

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    addBulk: mockQueueAddBulk,
    close: mockQueueClose,
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

// Mock grammy
vi.mock('grammy', () => ({
  Api: vi.fn().mockImplementation(() => ({
    sendMessage: vi.fn().mockResolvedValue({}),
    sendPhoto: vi.fn().mockResolvedValue({}),
    sendVideo: vi.fn().mockResolvedValue({}),
    sendAnimation: vi.fn().mockResolvedValue({}),
  })),
}));

import { Worker } from 'bullmq';
import { TelegramDispatcher, type DispatchJobData } from '../../packages/telegram/src/dispatch.js';

describe('Telegram Dispatch Integration', () => {
  let dispatcher: TelegramDispatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    dispatcher = new TelegramDispatcher({
      redis: { host: 'localhost', port: 6379 },
    });
  });

  it('dispatch to multiple channels creates correct number of jobs', async () => {
    const channels = ['-100111', '-100222', '-100333', '-100444', '-100555'];
    const jobs: DispatchJobData[] = channels.map((chatId) => ({
      tenantId: 'tenant-1',
      botToken: 'fake-token',
      chatId,
      text: 'Promo do dia!',
    }));

    mockQueueAddBulk.mockResolvedValueOnce(
      channels.map((_, i) => ({ id: `job-${i}` })),
    );

    const ids = await dispatcher.addBulk(jobs);

    expect(ids).toHaveLength(5);
    expect(mockQueueAddBulk).toHaveBeenCalledWith(
      jobs.map((data) => ({ name: 'send-message', data })),
    );
  });

  it('each job has correct chatId and text', async () => {
    const channels = ['-100aaa', '-100bbb'];
    const promoText = 'iPhone 15 Pro por R$5499! Confere: https://aff.link/iphone';

    const jobs: DispatchJobData[] = channels.map((chatId) => ({
      tenantId: 'tenant-1',
      botToken: 'fake-token',
      chatId,
      text: promoText,
    }));

    mockQueueAddBulk.mockResolvedValueOnce([{ id: 'j1' }, { id: 'j2' }]);

    await dispatcher.addBulk(jobs);

    const calledJobs = mockQueueAddBulk.mock.calls[0][0] as Array<{ name: string; data: DispatchJobData }>;

    expect(calledJobs[0].data.chatId).toBe('-100aaa');
    expect(calledJobs[0].data.text).toBe(promoText);
    expect(calledJobs[1].data.chatId).toBe('-100bbb');
    expect(calledJobs[1].data.text).toBe(promoText);
  });

  it('rate limiting configuration is correct (30 msg/s)', () => {
    dispatcher.startWorker();

    const workerCalls = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(workerCalls.length).toBeGreaterThan(0);

    const workerOptions = workerCalls[0][2] as Record<string, any>;

    expect(workerOptions.limiter).toEqual({
      max: 30,
      duration: 1000,
    });
  });

  it('individual job addition works correctly', async () => {
    mockQueueAdd.mockResolvedValueOnce({ id: 'single-job-1' });

    const jobId = await dispatcher.addJob({
      tenantId: 'tenant-1',
      botToken: 'fake-token',
      chatId: '-100999',
      text: 'Oferta relampago!',
    });

    expect(jobId).toBe('single-job-1');
    expect(mockQueueAdd).toHaveBeenCalledWith('send-message', {
      tenantId: 'tenant-1',
      botToken: 'fake-token',
      chatId: '-100999',
      text: 'Oferta relampago!',
    });
  });

  it('dispatch with media includes mediaUrl and mediaType', async () => {
    mockQueueAdd.mockResolvedValueOnce({ id: 'media-job-1' });

    const data: DispatchJobData = {
      tenantId: 'tenant-1',
      botToken: 'fake-token',
      chatId: '-100999',
      text: 'Confere essa promo!',
      mediaUrl: 'https://cdn.example.com/promo.jpg',
      mediaType: 'photo',
    };

    await dispatcher.addJob(data);

    expect(mockQueueAdd).toHaveBeenCalledWith('send-message', data);
  });

  it('graceful shutdown closes queue', async () => {
    mockQueueClose.mockResolvedValueOnce(undefined);

    await dispatcher.gracefulShutdown();

    expect(mockQueueClose).toHaveBeenCalled();
  });
});
