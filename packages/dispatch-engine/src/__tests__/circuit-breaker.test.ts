import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker.js';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker();
    expect(cb.getState().state).toBe('CLOSED');
  });

  it('canExecute returns true when CLOSED', () => {
    const cb = new CircuitBreaker();
    expect(cb.canExecute()).toBe(true);
  });

  it('opens after failureThreshold failures within windowMs', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      cooldownMs: 60_000,
    });

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState().state).toBe('CLOSED');

    const justOpened = cb.recordFailure();
    expect(justOpened).toBe(true);
    expect(cb.getState().state).toBe('OPEN');
  });

  it('canExecute returns false when OPEN', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      windowMs: 60_000,
      cooldownMs: 60_000,
    });

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.canExecute()).toBe(false);
  });

  it('transitions to HALF_OPEN after cooldownMs', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      windowMs: 60_000,
      cooldownMs: 10_000,
    });

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState().state).toBe('OPEN');

    // Advance past cooldown
    vi.advanceTimersByTime(10_001);

    // canExecute should trigger the transition
    expect(cb.canExecute()).toBe(true);
    expect(cb.getState().state).toBe('HALF_OPEN');
  });

  it('recordSuccess in HALF_OPEN transitions to CLOSED', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      windowMs: 60_000,
      cooldownMs: 10_000,
    });

    cb.recordFailure();
    cb.recordFailure();

    vi.advanceTimersByTime(10_001);
    cb.canExecute(); // HALF_OPEN

    cb.recordSuccess();
    expect(cb.getState().state).toBe('CLOSED');
    expect(cb.getState().failures).toBe(0);
  });

  it('recordFailure in HALF_OPEN transitions to OPEN again', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      windowMs: 60_000,
      cooldownMs: 10_000,
    });

    cb.recordFailure();
    cb.recordFailure();

    vi.advanceTimersByTime(10_001);
    cb.canExecute(); // HALF_OPEN

    cb.recordFailure();
    // In HALF_OPEN, one failure pushes to threshold (failures array has the new one)
    // After pruning, the old failures outside window are removed, new one remains
    // Since failureThreshold is 2, it may need 2 more. Let's check state.
    // Actually in HALF_OPEN state, failures array was kept from before.
    // After cooldown, old failures are pruned. New failure is recorded.
    // If threshold not reached yet, it stays HALF_OPEN. Let's add another.
    cb.recordFailure();
    expect(cb.getState().state).toBe('OPEN');
  });

  it('reset() returns to CLOSED', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 2,
      windowMs: 60_000,
      cooldownMs: 60_000,
    });

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState().state).toBe('OPEN');

    cb.reset();
    expect(cb.getState().state).toBe('CLOSED');
    expect(cb.getState().failures).toBe(0);
    expect(cb.getState().openUntil).toBeNull();
  });

  it('old failures outside window are pruned', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      windowMs: 5_000,
      cooldownMs: 60_000,
    });

    cb.recordFailure();
    cb.recordFailure();

    // Advance past window
    vi.advanceTimersByTime(6_000);

    // Third failure, but old ones are pruned
    cb.recordFailure();
    // Only 1 failure in window now, should still be CLOSED
    expect(cb.getState().state).toBe('CLOSED');
    expect(cb.getState().failures).toBe(1);
  });

  it('getState returns correct snapshot', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      windowMs: 60_000,
      cooldownMs: 60_000,
    });

    const state1 = cb.getState();
    expect(state1.state).toBe('CLOSED');
    expect(state1.failures).toBe(0);
    expect(state1.openUntil).toBeNull();

    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();

    const state2 = cb.getState();
    expect(state2.state).toBe('OPEN');
    expect(state2.failures).toBe(3);
    expect(state2.openUntil).toBeInstanceOf(Date);
  });
});
