// ============================================
// Constants
// ============================================

/** Janela de horário permitida para envio (BRT = UTC-3) */
export const DISPATCH_WINDOWS = [
  { start: 9, end: 12 },  // 09-12h
  { start: 14, end: 18 }, // 14-18h
] as const;

/** Warm-up schedule: dia → limites */
export const WARMUP_SCHEDULE: Record<number, { maxMsgs: number; maxGroups: number; delayMinMs: number; delayMaxMs: number }> = {
  0: { maxMsgs: 0, maxGroups: 0, delayMinMs: 0, delayMaxMs: 0 },
  1: { maxMsgs: 10, maxGroups: 3, delayMinMs: 300_000, delayMaxMs: 600_000 },
  2: { maxMsgs: 10, maxGroups: 3, delayMinMs: 300_000, delayMaxMs: 600_000 },
  3: { maxMsgs: 30, maxGroups: 10, delayMinMs: 180_000, delayMaxMs: 300_000 },
  4: { maxMsgs: 30, maxGroups: 10, delayMinMs: 180_000, delayMaxMs: 300_000 },
  5: { maxMsgs: 60, maxGroups: 20, delayMinMs: 120_000, delayMaxMs: 180_000 },
  6: { maxMsgs: 60, maxGroups: 20, delayMinMs: 120_000, delayMaxMs: 180_000 },
};

/** Dia 7+ usa estes limites */
export const WARMUP_GRADUATED = {
  maxMsgs: 120,
  maxGroups: Infinity,
  delayMinMs: 60_000,
  delayMaxMs: 120_000,
} as const;

/** Circuit breaker config */
export const CIRCUIT_BREAKER = {
  failureThreshold: 3,
  windowMs: 5 * 60 * 1000,    // 5 min
  cooldownMs: 60 * 60 * 1000, // 1 hour
} as const;

/** Gaussian delay defaults */
export const GAUSSIAN_DELAY = {
  meanMs: 15_000,   // 15s
  stdDevMs: 5_000,  // 5s
  minMs: 5_000,     // 5s floor
  maxMs: 45_000,    // 45s ceiling
} as const;

/** BullMQ queue names */
export const QUEUES = {
  DISPATCH: 'dispatch-queue',
  DISPATCH_PRIORITY: 'dispatch-priority-queue',
  DISPATCH_DLQ: 'dispatch-dlq',
} as const;

// ============================================
// Types
// ============================================

export interface DispatchJobData {
  dispatchId: string;
  dispatchItemId: string;
  groupId: string;
  waGroupJid: string;
  sessionId: string;
  tenantId: string;
  copyTemplate: string;
  mediaUrl?: string;
  mediaType?: string;
}

export interface WaSessionHealth {
  sessionId: string;
  phoneNumber: string;
  status: string;
  healthScore: number;
  warmupDay: number;
  dailyMsgCount: number;
  maxDailyMsgs: number;
  circuitBreakerState: string;
}

// ============================================
// Helpers
// ============================================

/** Check if current time is within dispatch window (BRT) */
export function isWithinDispatchWindow(now: Date = new Date()): boolean {
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  return DISPATCH_WINDOWS.some(w => brtHour >= w.start && brtHour < w.end);
}

/** Get warm-up limits for a given day */
export function getWarmupLimits(day: number) {
  if (day <= 0) return WARMUP_SCHEDULE[0]!;
  if (day >= 7) return WARMUP_GRADUATED;
  return WARMUP_SCHEDULE[day] ?? WARMUP_GRADUATED;
}
