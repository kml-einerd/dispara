import { describe, it, expect } from 'vitest';
import { gaussianRandom, humanDelay, typingDuration } from '../gaussian-delay.js';

describe('gaussianRandom', () => {
  it('produces values around the mean over many samples', () => {
    const N = 1000;
    const mean = 100;
    const stdDev = 10;
    let sum = 0;

    for (let i = 0; i < N; i++) {
      sum += gaussianRandom(mean, stdDev);
    }

    const sampleMean = sum / N;
    // Within 4 standard errors of the mean (generous tolerance for CI stability)
    const standardError = stdDev / Math.sqrt(N);
    expect(sampleMean).toBeGreaterThan(mean - 4 * standardError);
    expect(sampleMean).toBeLessThan(mean + 4 * standardError);
  });
});

describe('humanDelay', () => {
  it('returns values within [5000, 45000] range', () => {
    for (let i = 0; i < 200; i++) {
      const delay = humanDelay();
      expect(delay).toBeGreaterThanOrEqual(5000);
      expect(delay).toBeLessThanOrEqual(45000);
    }
  });

  it('distribution roughly matches expected mean over 1000 samples', () => {
    const N = 1000;
    let sum = 0;

    for (let i = 0; i < N; i++) {
      sum += humanDelay();
    }

    const sampleMean = sum / N;
    // Expected mean is 15000ms. Allow generous tolerance due to clamping.
    // Within 2000ms of the expected mean should be very safe.
    expect(sampleMean).toBeGreaterThan(10_000);
    expect(sampleMean).toBeLessThan(20_000);
  });

  it('respects custom config parameters', () => {
    for (let i = 0; i < 100; i++) {
      const delay = humanDelay({ minMs: 1000, maxMs: 2000, meanMs: 1500, stdDevMs: 100 });
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(2000);
    }
  });
});

describe('typingDuration', () => {
  it('scales with message length', () => {
    const short = typingDuration(10);
    const long = typingDuration(500);
    expect(long).toBeGreaterThan(short);
  });

  it('returns 0 for zero-length message', () => {
    expect(typingDuration(0)).toBe(0);
  });

  it('returns 0 for negative-length message', () => {
    expect(typingDuration(-5)).toBe(0);
  });

  it('returns reasonable values (not 0 for positive input, not infinity)', () => {
    const duration = typingDuration(100);
    expect(duration).toBeGreaterThan(0);
    expect(Number.isFinite(duration)).toBe(true);
  });

  it('is capped at 30 seconds for very long messages', () => {
    const duration = typingDuration(100_000);
    expect(duration).toBeLessThanOrEqual(30_000);
  });

  it('has a floor of 500ms for short messages', () => {
    const duration = typingDuration(1);
    expect(duration).toBeGreaterThanOrEqual(500);
  });
});
