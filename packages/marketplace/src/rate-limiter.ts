/**
 * Token bucket rate limiter for controlling API request rates.
 * Uses a simple token bucket algorithm with automatic refilling.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefillTime: number;
  private readonly maxTokens: number;
  private readonly refillRatePerSecond: number;
  private waitQueue: Array<() => void> = [];

  /**
   * @param maxTokens - Maximum number of tokens in the bucket (burst capacity)
   * @param refillRatePerSecond - Number of tokens added per second
   */
  constructor(maxTokens: number, refillRatePerSecond: number) {
    this.maxTokens = maxTokens;
    this.refillRatePerSecond = refillRatePerSecond;
    this.tokens = maxTokens;
    this.lastRefillTime = Date.now();
  }

  /**
   * Refills tokens based on elapsed time since last refill.
   */
  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTime;
    const tokensToAdd = (elapsedMs / 1000) * this.refillRatePerSecond;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  /**
   * Drains the wait queue, granting tokens to waiters that can proceed.
   */
  private drainQueue(): void {
    while (this.waitQueue.length > 0) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        const resolve = this.waitQueue.shift()!;
        resolve();
      } else {
        break;
      }
    }
  }

  /**
   * Acquires a token, waiting if none are available.
   * Will block (via promise) until a token becomes available.
   */
  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate how long to wait for next token
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);

      const waitMs = Math.ceil((1 / this.refillRatePerSecond) * 1000);

      setTimeout(() => {
        this.drainQueue();
      }, waitMs);
    });
  }

  /**
   * Attempts to acquire a token without waiting.
   * @returns true if a token was acquired, false if none available
   */
  tryAcquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Returns the current number of available tokens (for monitoring).
   */
  get availableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
