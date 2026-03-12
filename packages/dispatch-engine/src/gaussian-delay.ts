/**
 * Human-like delay calculator using Box-Muller transform.
 */

import { GAUSSIAN_DELAY } from '@dispara/shared';

/**
 * Generate a gaussian random number using Box-Muller transform.
 */
export function gaussianRandom(mean: number, stdDev: number): number {
  let u1: number;
  let u2: number;

  // Ensure u1 is not zero (log(0) is -Infinity)
  do {
    u1 = Math.random();
  } while (u1 === 0);

  u2 = Math.random();

  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Calculate human-like delay between messages.
 * Default: mean=15000ms, stdDev=5000ms, clamped to [5000, 45000]
 */
export function humanDelay(config?: {
  meanMs?: number;
  stdDevMs?: number;
  minMs?: number;
  maxMs?: number;
}): number {
  const meanMs = config?.meanMs ?? GAUSSIAN_DELAY.meanMs;
  const stdDevMs = config?.stdDevMs ?? GAUSSIAN_DELAY.stdDevMs;
  const minMs = config?.minMs ?? GAUSSIAN_DELAY.minMs;
  const maxMs = config?.maxMs ?? GAUSSIAN_DELAY.maxMs;

  const raw = gaussianRandom(meanMs, stdDevMs);
  return Math.round(Math.max(minMs, Math.min(maxMs, raw)));
}

/**
 * Calculate typing duration based on message length.
 * ~50 WPM average (250 CPM), with jitter.
 */
export function typingDuration(messageLength: number): number {
  if (messageLength <= 0) return 0;

  // 250 chars per minute = ~4.17 chars per second = ~240ms per char
  const baseMs = (messageLength / 250) * 60_000;

  // Add ±20% jitter
  const jitter = 1 + (Math.random() * 0.4 - 0.2);

  // Floor at 500ms, cap at 30s
  return Math.round(Math.max(500, Math.min(30_000, baseMs * jitter)));
}
