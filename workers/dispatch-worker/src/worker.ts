import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import pino from 'pino';
import { QUEUES, GAUSSIAN_DELAY, type DispatchJobData } from '@promospot/shared';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

/**
 * Dynamic imports for dispatch-engine modules.
 * These will be available after packages/dispatch-engine is built.
 */
async function loadDispatchEngine() {
  try {
    const { spinText, applyAntiDetection } = await import('@promospot/dispatch-engine');
    return { spinText, applyAntiDetection };
  } catch {
    logger.warn('dispatch-engine not yet built, using passthrough');
    return {
      spinText: (t: string) => t,
      applyAntiDetection: (t: string) => t,
    };
  }
}

/**
 * Process a single dispatch job: send 1 message to 1 group.
 */
async function processDispatchJob(job: Job<DispatchJobData>): Promise<void> {
  const { dispatchId, dispatchItemId, groupId, waGroupJid, sessionId, tenantId, copyTemplate, mediaUrl, mediaType } = job.data;
  const start = Date.now();

  logger.info({
    jobId: job.id,
    dispatchId,
    groupId,
    sessionId,
    attempt: job.attemptsMade + 1,
  }, 'Processing dispatch job');

  // Update item status to SENDING
  await prisma.dispatchItem.update({
    where: { id: dispatchItemId },
    data: { status: 'SENDING', jobId: job.id, attempts: { increment: 1 } },
  });

  try {
    // Load dispatch engine (spintax, anti-detection)
    const engine = await loadDispatchEngine();

    // Apply spintax to generate unique copy
    let copy = engine.spinText(copyTemplate);
    copy = engine.applyAntiDetection(copy);

    // Store rendered copy
    await prisma.dispatchItem.update({
      where: { id: dispatchItemId },
      data: { copyRendered: copy },
    });

    // Get WA session and send message
    // In production, this would call the WA Manager via IPC or direct import
    // For now, we simulate the send with a delay
    const waManagerAvailable = false; // TODO: integrate with wa-manager

    if (waManagerAvailable) {
      // TODO: Real implementation
      // const waManager = getWaManager();
      // await waManager.simulateTyping(sessionId, waGroupJid, typingDuration(copy.length));
      // if (mediaUrl) {
      //   await waManager.sendImageMessage(sessionId, waGroupJid, mediaUrl, copy);
      // } else {
      //   await waManager.sendTextMessage(sessionId, waGroupJid, copy);
      // }
    } else {
      // Simulate sending (dev mode)
      logger.info({ groupJid: waGroupJid, copyLength: copy.length }, 'Simulating message send');
    }

    const latencyMs = Date.now() - start;

    // Mark as sent
    await prisma.dispatchItem.update({
      where: { id: dispatchItemId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        latencyMs,
      },
    });

    // Update dispatch counters atomically
    await prisma.dispatch.update({
      where: { id: dispatchId },
      data: { sentCount: { increment: 1 } },
    });

    // Update session daily msg count
    await prisma.waSession.update({
      where: { id: sessionId },
      data: { dailyMsgCount: { increment: 1 } },
    });

    // Update group stats
    await prisma.waGroup.update({
      where: { id: groupId },
      data: {
        msgsSent: { increment: 1 },
        lastDispatch: new Date(),
      },
    });

    // Check if dispatch is complete
    await checkDispatchComplete(dispatchId);

    // Publish progress event via Redis pub/sub
    await redis.publish(`dispatch:${dispatchId}`, JSON.stringify({
      type: 'item_sent',
      dispatchItemId,
      groupId,
      latencyMs,
    }));

    logger.info({
      jobId: job.id,
      dispatchId,
      groupId,
      latencyMs,
    }, 'Dispatch job completed');

  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : String(err);

    await prisma.dispatchItem.update({
      where: { id: dispatchItemId },
      data: {
        status: 'FAILED',
        lastError: errorMsg,
        latencyMs,
      },
    });

    // Update dispatch failure counter
    await prisma.dispatch.update({
      where: { id: dispatchId },
      data: { failedCount: { increment: 1 } },
    });

    await checkDispatchComplete(dispatchId);

    logger.error({
      jobId: job.id,
      dispatchId,
      groupId,
      error: errorMsg,
      attempt: job.attemptsMade + 1,
    }, 'Dispatch job failed');

    throw err; // BullMQ will retry based on backoff config
  }
}

/**
 * Check if all items in a dispatch are done (sent or failed).
 * Update dispatch status accordingly.
 */
async function checkDispatchComplete(dispatchId: string): Promise<void> {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    include: {
      _count: {
        select: { items: true },
      },
    },
  });
  if (!dispatch) return;

  const itemCounts = await prisma.dispatchItem.groupBy({
    by: ['status'],
    where: { dispatchId },
    _count: true,
  });

  const statusMap = new Map(itemCounts.map(c => [c.status, c._count]));
  const pending = (statusMap.get('PENDING') ?? 0) + (statusMap.get('QUEUED') ?? 0) + (statusMap.get('SENDING') ?? 0);
  const sent = statusMap.get('SENT') ?? 0;
  const failed = statusMap.get('FAILED') ?? 0;

  if (pending > 0) return; // Still processing

  let status: string;
  if (failed === 0) {
    status = 'COMPLETED';
  } else if (sent === 0) {
    status = 'FAILED';
  } else {
    status = 'PARTIAL';
  }

  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: {
      status: status as any,
      completedAt: new Date(),
      sentCount: sent,
      failedCount: failed,
    },
  });

  logger.info({ dispatchId, status, sent, failed }, 'Dispatch status updated');
}

// ── Create workers ──

const workerOpts = {
  connection: redis,
  concurrency: 5,
  limiter: {
    max: 30,
    duration: 3_600_000, // 30 msgs/hour per group key
    groupKey: 'sessionId',
  },
};

const dispatchWorker = new Worker(
  QUEUES.DISPATCH,
  processDispatchJob,
  workerOpts,
);

const priorityWorker = new Worker(
  QUEUES.DISPATCH_PRIORITY,
  processDispatchJob,
  { ...workerOpts, concurrency: 3 },
);

// ── Worker event handlers ──

for (const worker of [dispatchWorker, priorityWorker]) {
  worker.on('completed', (job) => {
    logger.debug({ jobId: job.id, queue: worker.name }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, queue: worker.name, error: err.message }, 'Job failed');
  });

  worker.on('error', (err) => {
    logger.error({ queue: worker.name, error: err.message }, 'Worker error');
  });
}

logger.info('Dispatch workers started');

// ── Graceful shutdown ──

const signals = ['SIGTERM', 'SIGINT'] as const;
for (const signal of signals) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down workers...`);
    await dispatchWorker.close();
    await priorityWorker.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  });
}
