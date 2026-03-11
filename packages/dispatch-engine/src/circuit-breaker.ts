/**
 * Circuit breaker pattern for session health management.
 * Per-session instantiation — each WhatsApp number gets its own circuit breaker.
 */

import { CIRCUIT_BREAKER } from '@promospot/shared';

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit. Default: 3 */
  failureThreshold: number;
  /** Time window for counting failures (ms). Default: 5 min */
  windowMs: number;
  /** How long the circuit stays open before moving to HALF_OPEN (ms). Default: 1 hour */
  cooldownMs: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number[] = []; // timestamps of failures
  private openUntil: number | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? CIRCUIT_BREAKER.failureThreshold,
      windowMs: config?.windowMs ?? CIRCUIT_BREAKER.windowMs,
      cooldownMs: config?.cooldownMs ?? CIRCUIT_BREAKER.cooldownMs,
    };
  }

  /**
   * Record a failure. Returns true if the circuit just opened.
   */
  recordFailure(): boolean {
    const now = Date.now();

    if (this.state === 'OPEN') {
      // Already open, nothing to do
      return false;
    }

    this.failures.push(now);
    this.pruneOldFailures(now);

    if (this.failures.length >= this.config.failureThreshold) {
      this.state = 'OPEN';
      this.openUntil = now + this.config.cooldownMs;
      return true;
    }

    return false;
  }

  /**
   * Record a success. If HALF_OPEN, transitions back to CLOSED.
   */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      this.failures = [];
      this.openUntil = null;
    }
  }

  /**
   * Check if requests are allowed.
   * CLOSED/HALF_OPEN → true, OPEN → check cooldown expiry.
   */
  canExecute(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'HALF_OPEN') return true;

    // OPEN — check if cooldown has expired
    const now = Date.now();
    if (this.openUntil !== null && now >= this.openUntil) {
      this.state = 'HALF_OPEN';
      this.openUntil = null;
      return true;
    }

    return false;
  }

  /**
   * Get current state snapshot.
   */
  getState(): {
    state: CircuitState;
    failures: number;
    openUntil: Date | null;
  } {
    // Refresh state in case cooldown expired
    if (this.state === 'OPEN') {
      this.canExecute(); // side effect: may transition to HALF_OPEN
    }

    return {
      state: this.state,
      failures: this.failures.length,
      openUntil: this.openUntil !== null ? new Date(this.openUntil) : null,
    };
  }

  /**
   * Reset the circuit breaker to initial state.
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failures = [];
    this.openUntil = null;
  }

  /**
   * Remove failures outside the current time window.
   */
  private pruneOldFailures(now: number): void {
    const cutoff = now - this.config.windowMs;
    this.failures = this.failures.filter((ts) => ts > cutoff);
  }
}
