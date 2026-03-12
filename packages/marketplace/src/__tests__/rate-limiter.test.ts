import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter } from '../rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter(3, 1); // 3 max tokens, 1 per second refill
  });

  describe('acquire()', () => {
    it('resolves immediately when tokens are available', async () => {
      const start = Date.now();
      await limiter.acquire();
      const elapsed = Date.now() - start;

      // Should resolve in under 50ms (essentially instant)
      expect(elapsed).toBeLessThan(50);
    });

    it('consumes tokens on each call', async () => {
      // 3 max tokens — all three should resolve immediately
      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();

      expect(limiter.availableTokens).toBe(0);
    });

    it('waits when tokens are exhausted', async () => {
      // Exhaust all 3 tokens
      await limiter.acquire();
      await limiter.acquire();
      await limiter.acquire();

      const start = Date.now();
      await limiter.acquire();
      const elapsed = Date.now() - start;

      // With refill rate of 1/sec, should wait ~1000ms
      expect(elapsed).toBeGreaterThanOrEqual(900);
    });
  });

  describe('tryAcquire()', () => {
    it('returns true when tokens are available', () => {
      const result = limiter.tryAcquire();
      expect(result).toBe(true);
    });

    it('returns false when no tokens available', () => {
      // Exhaust all tokens
      limiter.tryAcquire();
      limiter.tryAcquire();
      limiter.tryAcquire();

      const result = limiter.tryAcquire();
      expect(result).toBe(false);
    });

    it('decrements available tokens on success', () => {
      const before = limiter.availableTokens;
      limiter.tryAcquire();
      const after = limiter.availableTokens;

      expect(after).toBe(before - 1);
    });
  });

  describe('token refill', () => {
    it('refills tokens over time', async () => {
      // Exhaust all tokens
      limiter.tryAcquire();
      limiter.tryAcquire();
      limiter.tryAcquire();
      expect(limiter.availableTokens).toBe(0);

      // Wait 1.1 seconds for at least 1 token to refill (rate = 1/sec)
      await new Promise((r) => setTimeout(r, 1100));

      expect(limiter.availableTokens).toBeGreaterThanOrEqual(1);
    });

    it('does not exceed max tokens on refill', async () => {
      // Start with full bucket, wait a bit — should still be at max
      await new Promise((r) => setTimeout(r, 500));

      expect(limiter.availableTokens).toBeLessThanOrEqual(3);
    });
  });

  describe('availableTokens', () => {
    it('returns max tokens initially', () => {
      expect(limiter.availableTokens).toBe(3);
    });

    it('returns 0 after exhaustion', () => {
      limiter.tryAcquire();
      limiter.tryAcquire();
      limiter.tryAcquire();

      expect(limiter.availableTokens).toBe(0);
    });
  });

  describe('high refill rate', () => {
    it('supports burst capacity with higher max tokens', async () => {
      const burstLimiter = new RateLimiter(10, 5); // 10 max, 5/sec

      // Should be able to acquire 10 immediately
      const results: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(burstLimiter.tryAcquire());
      }

      expect(results.every((r) => r === true)).toBe(true);
      expect(burstLimiter.tryAcquire()).toBe(false);
    });
  });
});
