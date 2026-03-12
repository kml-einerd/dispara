import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { Redis as IORedis } from 'ioredis';
import pino from 'pino';
import { QUEUES, type DispatchJobData, isWithinDispatchWindow } from '@dispara/shared';
import { spinText, applyAntiDetection, humanDelay, typingDuration, CircuitBreaker, canSendMessage } from '@dispara/dispatch-engine';
import { getWaSessionManager } from '@dispara/wa-manager';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const prisma = new PrismaClient();
const redisClient = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});
const redis = redisClient as unknown as import('bullmq').ConnectionOptions;
const waManager = getWaSessionManager();

/** Per-session circuit breakers */
const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(sessionId: string): CircuitBreaker {
  let cb = circuitBreakers.get(sessionId);
  if (!cb) {
    cb = new CircuitBreaker();
    circuitBreakers.set(sessionId, cb);
  }
  return cb;
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
    data: { status: 'PENDING', jobId: job.id, attempts: { increment: 1 } },
  });

  try {
    // Enforce dispatch window (09-12h + 14-18h BRT)
    if (!isWithinDispatchWindow()) {
      throw new Error('Outside dispatch window (09-12h, 14-18h BRT). Job will be retried.');
    }

    // Check circuit breaker for this session
    const cb = getCircuitBreaker(sessionId);
    if (!cb.canExecute()) {
      throw new Error(`Circuit breaker OPEN for session ${sessionId}. Retry after cooldown.`);
    }

    // Check warm-up limits
    const session = await prisma.waSession.findUnique({ where: { id: sessionId } });
    if (session && !canSendMessage(session.warmupDay, session.dailyMsgCount)) {
      throw new Error(`Daily warm-up limit reached for session ${sessionId} (day ${session.warmupDay}, sent ${session.dailyMsgCount})`);
    }

    // Apply spintax + anti-detection for unique copy
    let copy = spinText(copyTemplate);
    copy = applyAntiDetection(copy);

    // Store rendered copy
    await prisma.dispatchItem.update({
      where: { id: dispatchItemId },
      data: { copyRendered: copy },
    });

    // Simulate typing then send via WA Manager
    const sock = waManager.getSession(sessionId);
    if (sock) {
      // Real send path: typing simulation → send
      const typeDuration = typingDuration(copy.length);
      await waManager.simulateTyping(sessionId, waGroupJid, typeDuration);

      if (mediaUrl && mediaType === 'image') {
        await waManager.sendImageMessage(sessionId, waGroupJid, mediaUrl, copy);
      } else {
        await waManager.sendTextMessage(sessionId, waGroupJid, copy);
      }

      cb.recordSuccess();
    } else {
      // Dev/mock mode: simulate with gaussian delay
      const delay = humanDelay();
      logger.info({ groupJid: waGroupJid, copyLength: copy.length, delay }, 'Simulating message send (no active session)');
      await new Promise(resolve => setTimeout(resolve, Math.min(delay, 5000)));
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
    await prisma.group.update({
      where: { id: groupId },
      data: {
        updatedAt: new Date(),
      },
    });

    // Check if dispatch is complete
    await checkDispatchComplete(dispatchId);

    // Publish progress event via Redis pub/sub
    await redisClient.publish(`dispatch:${dispatchId}`, JSON.stringify({
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

    // Record failure in circuit breaker
    const cb = getCircuitBreaker(sessionId);
    const circuitOpened = cb.recordFailure();
    if (circuitOpened) {
      logger.warn({ sessionId }, 'Circuit breaker OPENED — session paused for 1 hour');
      // Update session health in DB
      await prisma.waSession.update({
        where: { id: sessionId },
        data: { healthScore: { decrement: 20 } },
      }).catch(() => {});
    }

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

    // Publish failure event
    await redisClient.publish(`dispatch:${dispatchId}`, JSON.stringify({
      type: 'item_failed',
      dispatchItemId,
      groupId,
      error: errorMsg,
    })).catch(() => {});

    logger.error({
      jobId: job.id,
      dispatchId,
      groupId,
      error: errorMsg,
      attempt: job.attemptsMade + 1,
      circuitState: cb.getState().state,
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
  const pending = statusMap.get('PENDING') ?? 0;
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
    redisClient.disconnect();
    process.exit(0);
  });
}
