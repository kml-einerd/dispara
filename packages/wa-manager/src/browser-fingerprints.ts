/**
 * Pre-defined browser tuples for fingerprint consistency.
 * Each session gets a deterministic tuple based on its sessionId hash.
 */

const BROWSER_TUPLES: [string, string, string][] = [
  ['Dispara', 'Chrome', '122.0.6261.112'],
  ['Dispara', 'Chrome', '123.0.6312.86'],
  ['Dispara', 'Chrome', '124.0.6367.91'],
  ['Dispara', 'Chrome', '125.0.6422.60'],
  ['Dispara', 'Chrome', '126.0.6478.114'],
  ['Dispara', 'Firefox', '124.0.2'],
  ['Dispara', 'Firefox', '125.0.1'],
  ['Dispara', 'Firefox', '126.0'],
  ['Dispara', 'Edge', '122.0.2365.80'],
  ['Dispara', 'Edge', '123.0.2420.65'],
  ['Dispara', 'Edge', '124.0.2478.51'],
  ['Dispara', 'Safari', '17.3.1'],
  ['Dispara', 'Safari', '17.4'],
  ['Dispara', 'Opera', '108.0.5067.29'],
  ['Dispara', 'Opera', '109.0.5097.33'],
];

/**
 * Simple hash to produce a stable numeric index from a string.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Assign a deterministic browser tuple based on sessionId hash.
 * The same sessionId always gets the same tuple.
 */
export function getBrowserTuple(sessionId: string): [string, string, string] {
  const index = hashString(sessionId) % BROWSER_TUPLES.length;
  return BROWSER_TUPLES[index]!;
}

export { BROWSER_TUPLES };
