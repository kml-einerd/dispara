/**
 * Dispatch Engine — Anti-Bloqueio (Anti-Block) Engine
 * Barrel export for all modules.
 */

// Spintax engine
export {
  spinText,
  generateVariations,
  countVariations,
  applyAntiDetection,
} from './spintax.js';

// Gaussian delay calculator
export {
  gaussianRandom,
  humanDelay,
  typingDuration,
} from './gaussian-delay.js';

// Circuit breaker
export {
  CircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitState,
} from './circuit-breaker.js';

// Warm-up limits
export {
  getSessionLimits,
  canSendMessage,
  canTargetGroups,
} from './warmup.js';

// Number pool
export {
  NumberPool,
  type NumberInfo,
} from './number-pool.js';

// Time window
export {
  isDispatchAllowed,
  getNextDispatchWindow,
  delayUntilNextWindow,
} from './time-window.js';
