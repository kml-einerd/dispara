import { describe, it, expect } from 'vitest';
import { NumberPool, type NumberInfo } from '../number-pool.js';

function makeNumber(overrides: Partial<NumberInfo> = {}): NumberInfo {
  return {
    sessionId: overrides.sessionId ?? 'sess-1',
    healthScore: overrides.healthScore ?? 80,
    warmupDay: overrides.warmupDay ?? 7,
    dailyMsgCount: overrides.dailyMsgCount ?? 0,
    circuitBreakerState: overrides.circuitBreakerState ?? 'CLOSED',
  };
}

describe('NumberPool', () => {
  describe('addNumber / removeNumber', () => {
    it('addNumber adds and removeNumber removes', () => {
      const pool = new NumberPool();
      pool.addNumber(makeNumber({ sessionId: 'a' }));
      pool.addNumber(makeNumber({ sessionId: 'b' }));
      expect(pool.getNumbers()).toHaveLength(2);

      pool.removeNumber('a');
      expect(pool.getNumbers()).toHaveLength(1);
      expect(pool.getNumbers()[0]!.sessionId).toBe('b');
    });
  });

  describe('getNextNumber', () => {
    it('returns null when pool is empty', () => {
      const pool = new NumberPool();
      expect(pool.getNextNumber()).toBeNull();
    });

    it('excludes OPEN circuit breakers', () => {
      const pool = new NumberPool();
      pool.addNumber(makeNumber({ sessionId: 'open', circuitBreakerState: 'OPEN' }));
      expect(pool.getNextNumber()).toBeNull();
    });

    it('excludes numbers with health < 20', () => {
      const pool = new NumberPool();
      pool.addNumber(makeNumber({ sessionId: 'unhealthy', healthScore: 10 }));
      expect(pool.getNextNumber()).toBeNull();
    });

    it('excludes numbers at daily limit', () => {
      const pool = new NumberPool();
      // warmupDay 7 has maxMsgs = 120
      pool.addNumber(makeNumber({ sessionId: 'maxed', warmupDay: 7, dailyMsgCount: 120 }));
      expect(pool.getNextNumber()).toBeNull();
    });

    it('returns eligible number when available', () => {
      const pool = new NumberPool();
      pool.addNumber(makeNumber({ sessionId: 'good', healthScore: 90, warmupDay: 7, dailyMsgCount: 0 }));
      const result = pool.getNextNumber();
      expect(result).not.toBeNull();
      expect(result!.sessionId).toBe('good');
    });

    it('allows HALF_OPEN circuit breaker', () => {
      const pool = new NumberPool();
      pool.addNumber(makeNumber({ sessionId: 'half', circuitBreakerState: 'HALF_OPEN', healthScore: 50 }));
      const result = pool.getNextNumber();
      expect(result).not.toBeNull();
    });
  });

  describe('weighted rotation', () => {
    it('healthier numbers are selected more often over N iterations', () => {
      const pool = new NumberPool();
      pool.addNumber(makeNumber({ sessionId: 'healthy', healthScore: 90, warmupDay: 7, dailyMsgCount: 0 }));
      pool.addNumber(makeNumber({ sessionId: 'weak', healthScore: 25, warmupDay: 7, dailyMsgCount: 0 }));

      const counts: Record<string, number> = { healthy: 0, weak: 0 };
      const N = 1000;

      for (let i = 0; i < N; i++) {
        const result = pool.getNextNumber();
        if (result) {
          counts[result.sessionId]!++;
        }
      }

      // healthy (90 health * 120 remaining = 10800 weight) should be chosen
      // much more often than weak (25 health * 120 remaining = 3000 weight)
      // Expected ratio ~3.6:1
      expect(counts['healthy']).toBeGreaterThan(counts['weak']! * 2);
    });
  });
});
