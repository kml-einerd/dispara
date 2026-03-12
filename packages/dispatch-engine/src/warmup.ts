/**
 * Warm-up progressive limits for new WhatsApp numbers.
 * Uses the schedule defined in @dispara/shared.
 */

import { getWarmupLimits } from '@dispara/shared';

/**
 * Get current limits for a session based on its warm-up day.
 */
export function getSessionLimits(warmupDay: number): {
  maxMsgsPerDay: number;
  maxGroups: number;
  minDelayMs: number;
  maxDelayMs: number;
} {
  const limits = getWarmupLimits(warmupDay);
  return {
    maxMsgsPerDay: limits.maxMsgs,
    maxGroups: limits.maxGroups,
    minDelayMs: limits.delayMinMs,
    maxDelayMs: limits.delayMaxMs,
  };
}

/**
 * Check if a session can send more messages today.
 */
export function canSendMessage(warmupDay: number, dailyMsgCount: number): boolean {
  const limits = getWarmupLimits(warmupDay);
  return dailyMsgCount < limits.maxMsgs;
}

/**
 * Check if a session can target a specific number of groups.
 */
export function canTargetGroups(warmupDay: number, groupCount: number): boolean {
  const limits = getWarmupLimits(warmupDay);
  return groupCount <= limits.maxGroups;
}
