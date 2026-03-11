/**
 * Weighted rotation for WhatsApp number selection.
 * Selects the best available number based on health, warmup, and circuit breaker state.
 */

import type { CircuitState } from './circuit-breaker.js';
import { getSessionLimits } from './warmup.js';

export interface NumberInfo {
  sessionId: string;
  healthScore: number; // 0-100
  warmupDay: number;
  dailyMsgCount: number;
  circuitBreakerState: CircuitState;
}

export class NumberPool {
  private numbers: Map<string, NumberInfo> = new Map();

  addNumber(info: NumberInfo): void {
    this.numbers.set(info.sessionId, info);
  }

  removeNumber(sessionId: string): void {
    this.numbers.delete(sessionId);
  }

  updateHealth(sessionId: string, healthScore: number): void {
    const info = this.numbers.get(sessionId);
    if (info) {
      info.healthScore = healthScore;
    }
  }

  /**
   * Select next number using weighted rotation.
   * Weight = (healthScore / 100) * warmupCapacity
   * Excludes: circuit breaker OPEN, health < 20, daily limit reached.
   */
  getNextNumber(): NumberInfo | null {
    const eligible = this.getEligibleNumbers();
    if (eligible.length === 0) return null;

    // Calculate weights
    const weights: number[] = eligible.map((info) => {
      const limits = getSessionLimits(info.warmupDay);
      const remaining = Math.max(0, limits.maxMsgsPerDay - info.dailyMsgCount);
      const healthFactor = info.healthScore / 100;
      return healthFactor * remaining;
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) return null;

    // Weighted random selection
    let random = Math.random() * totalWeight;
    for (let i = 0; i < eligible.length; i++) {
      random -= weights[i]!;
      if (random <= 0) {
        return eligible[i]!;
      }
    }

    // Fallback (should not reach here, but safety)
    return eligible[eligible.length - 1]!;
  }

  /**
   * Get all numbers sorted by health (descending).
   */
  getNumbers(): NumberInfo[] {
    return [...this.numbers.values()].sort((a, b) => b.healthScore - a.healthScore);
  }

  /**
   * Filter to eligible numbers only.
   */
  private getEligibleNumbers(): NumberInfo[] {
    return [...this.numbers.values()].filter((info) => {
      // Exclude circuit breaker OPEN
      if (info.circuitBreakerState === 'OPEN') return false;

      // Exclude unhealthy numbers
      if (info.healthScore < 20) return false;

      // Exclude numbers that reached daily limit
      const limits = getSessionLimits(info.warmupDay);
      if (info.dailyMsgCount >= limits.maxMsgsPerDay) return false;

      return true;
    });
  }
}
