/**
 * Dispatch window enforcement.
 * Allowed windows: 09-12h + 14-18h BRT (UTC-3).
 */

import { DISPATCH_WINDOWS } from '@dispara/shared';

/** BRT offset from UTC in hours */
const BRT_OFFSET = -3;

/**
 * Get the current hour in BRT timezone.
 */
function getBrtHour(date: Date): number {
  return (date.getUTCHours() + BRT_OFFSET + 24) % 24;
}

/**
 * Get the current minute in BRT timezone.
 */
function getBrtMinute(date: Date): number {
  return date.getUTCMinutes();
}

/**
 * Check if current time allows dispatching.
 */
export function isDispatchAllowed(now?: Date): boolean {
  const date = now ?? new Date();
  const brtHour = getBrtHour(date);
  return DISPATCH_WINDOWS.some((w) => brtHour >= w.start && brtHour < w.end);
}

/**
 * Get next available dispatch window.
 * Returns the Date when dispatching can resume.
 * If currently in a window, returns `now`.
 */
export function getNextDispatchWindow(now?: Date): Date {
  const date = now ?? new Date();

  if (isDispatchAllowed(date)) {
    return date;
  }

  const brtHour = getBrtHour(date);
  const brtMinute = getBrtMinute(date);
  const currentBrtMinutes = brtHour * 60 + brtMinute;

  // Find the next window that starts after the current BRT time
  for (const window of DISPATCH_WINDOWS) {
    const windowStartMinutes = window.start * 60;
    if (currentBrtMinutes < windowStartMinutes) {
      // This window starts later today
      const diffMinutes = windowStartMinutes - currentBrtMinutes;
      return new Date(date.getTime() + diffMinutes * 60_000);
    }
  }

  // All windows for today have passed, next window is tomorrow's first
  const firstWindow = DISPATCH_WINDOWS[0]!;
  const firstWindowStartMinutes = firstWindow.start * 60;
  const minutesUntilMidnight = 24 * 60 - currentBrtMinutes;
  const diffMinutes = minutesUntilMidnight + firstWindowStartMinutes;
  return new Date(date.getTime() + diffMinutes * 60_000);
}

/**
 * Calculate delay needed until next window opens.
 * Returns 0 if currently in a window.
 */
export function delayUntilNextWindow(now?: Date): number {
  const date = now ?? new Date();

  if (isDispatchAllowed(date)) {
    return 0;
  }

  const nextWindow = getNextDispatchWindow(date);
  return nextWindow.getTime() - date.getTime();
}
