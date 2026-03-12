import { describe, it, expect } from 'vitest';
import { isDispatchAllowed, getNextDispatchWindow, delayUntilNextWindow } from '../time-window.js';

/**
 * Helper: create a Date at a specific BRT hour.
 * BRT = UTC-3, so we set UTC hour = brtHour + 3.
 */
function dateBrt(brtHour: number, brtMinute = 0): Date {
  const utcHour = (brtHour + 3) % 24;
  // Use a fixed date to avoid DST issues
  const d = new Date(Date.UTC(2026, 2, 11, utcHour, brtMinute, 0, 0));
  return d;
}

describe('isDispatchAllowed', () => {
  it('10:00 BRT → allowed', () => {
    expect(isDispatchAllowed(dateBrt(10))).toBe(true);
  });

  it('15:00 BRT → allowed', () => {
    expect(isDispatchAllowed(dateBrt(15))).toBe(true);
  });

  it('03:00 BRT → not allowed', () => {
    expect(isDispatchAllowed(dateBrt(3))).toBe(false);
  });

  it('13:00 BRT → not allowed (lunch gap)', () => {
    expect(isDispatchAllowed(dateBrt(13))).toBe(false);
  });

  it('20:00 BRT → not allowed', () => {
    expect(isDispatchAllowed(dateBrt(20))).toBe(false);
  });

  it('09:00 BRT → allowed (boundary start)', () => {
    expect(isDispatchAllowed(dateBrt(9))).toBe(true);
  });

  it('12:00 BRT → not allowed (boundary end, exclusive)', () => {
    expect(isDispatchAllowed(dateBrt(12))).toBe(false);
  });

  it('14:00 BRT → allowed (second window start)', () => {
    expect(isDispatchAllowed(dateBrt(14))).toBe(true);
  });

  it('18:00 BRT → not allowed (second window end, exclusive)', () => {
    expect(isDispatchAllowed(dateBrt(18))).toBe(false);
  });
});

describe('getNextDispatchWindow', () => {
  it('returns same date when currently in a window', () => {
    const now = dateBrt(10, 30);
    const next = getNextDispatchWindow(now);
    expect(next.getTime()).toBe(now.getTime());
  });

  it('returns next window start when in lunch gap (13:00 BRT)', () => {
    const now = dateBrt(13, 0); // 13:00 BRT, next window is 14:00 BRT
    const next = getNextDispatchWindow(now);
    const nextBrtHour = (next.getUTCHours() - 3 + 24) % 24;
    expect(nextBrtHour).toBe(14);
  });

  it('returns tomorrow morning when after all windows (20:00 BRT)', () => {
    const now = dateBrt(20, 0);
    const next = getNextDispatchWindow(now);
    // Next window should be 09:00 BRT tomorrow
    const diffMs = next.getTime() - now.getTime();
    const diffHours = diffMs / (60 * 60 * 1000);
    // From 20:00 to 09:00 next day = 13 hours
    expect(diffHours).toBe(13);
  });

  it('returns correct window when before first window (06:00 BRT)', () => {
    const now = dateBrt(6, 0);
    const next = getNextDispatchWindow(now);
    const nextBrtHour = (next.getUTCHours() - 3 + 24) % 24;
    expect(nextBrtHour).toBe(9);
  });
});

describe('delayUntilNextWindow', () => {
  it('returns 0 when currently in window', () => {
    const now = dateBrt(10, 30);
    expect(delayUntilNextWindow(now)).toBe(0);
  });

  it('returns positive delay when outside window', () => {
    const now = dateBrt(13, 0); // lunch gap
    const delay = delayUntilNextWindow(now);
    expect(delay).toBeGreaterThan(0);
    // Should be 1 hour (13:00 → 14:00)
    expect(delay).toBe(60 * 60 * 1000);
  });

  it('returns correct delay for overnight wait', () => {
    const now = dateBrt(20, 0);
    const delay = delayUntilNextWindow(now);
    // 20:00 → 09:00 next day = 13 hours
    expect(delay).toBe(13 * 60 * 60 * 1000);
  });
});
