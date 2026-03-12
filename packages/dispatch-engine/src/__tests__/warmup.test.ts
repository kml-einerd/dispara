import { describe, it, expect } from 'vitest';
import { getSessionLimits, canSendMessage, canTargetGroups } from '../warmup.js';

describe('getSessionLimits', () => {
  it('Day 0: maxMsgs = 0', () => {
    const limits = getSessionLimits(0);
    expect(limits.maxMsgsPerDay).toBe(0);
    expect(limits.maxGroups).toBe(0);
  });

  it('Day 1: maxMsgs = 10, maxGroups = 3', () => {
    const limits = getSessionLimits(1);
    expect(limits.maxMsgsPerDay).toBe(10);
    expect(limits.maxGroups).toBe(3);
  });

  it('Day 3: maxMsgs = 30, maxGroups = 10', () => {
    const limits = getSessionLimits(3);
    expect(limits.maxMsgsPerDay).toBe(30);
    expect(limits.maxGroups).toBe(10);
  });

  it('Day 7+: maxMsgs = 120, unlimited groups', () => {
    const limits7 = getSessionLimits(7);
    expect(limits7.maxMsgsPerDay).toBe(120);
    expect(limits7.maxGroups).toBe(Infinity);

    const limits30 = getSessionLimits(30);
    expect(limits30.maxMsgsPerDay).toBe(120);
    expect(limits30.maxGroups).toBe(Infinity);
  });

  it('Day 5: maxMsgs = 60, maxGroups = 20', () => {
    const limits = getSessionLimits(5);
    expect(limits.maxMsgsPerDay).toBe(60);
    expect(limits.maxGroups).toBe(20);
  });
});

describe('canSendMessage', () => {
  it('returns true when dailyMsgCount < limit', () => {
    expect(canSendMessage(1, 5)).toBe(true);  // limit is 10
  });

  it('returns false when dailyMsgCount >= limit', () => {
    expect(canSendMessage(1, 10)).toBe(false); // limit is 10
    expect(canSendMessage(1, 15)).toBe(false);
  });

  it('returns false on day 0 (limit is 0)', () => {
    expect(canSendMessage(0, 0)).toBe(false);
  });
});

describe('canTargetGroups', () => {
  it('returns true when groupCount <= limit', () => {
    expect(canTargetGroups(1, 3)).toBe(true);  // limit is 3
    expect(canTargetGroups(1, 2)).toBe(true);
  });

  it('returns false when groupCount > limit', () => {
    expect(canTargetGroups(1, 4)).toBe(false); // limit is 3
  });

  it('returns false on day 0 (limit is 0)', () => {
    expect(canTargetGroups(0, 1)).toBe(false);
  });

  it('day 7+ allows any number of groups (Infinity)', () => {
    expect(canTargetGroups(7, 1000)).toBe(true);
  });
});
