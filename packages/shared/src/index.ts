// ============================================
// Crypto
// ============================================
export { encryptJSON, decryptJSON } from './crypto.js';

// ============================================
// Types
// ============================================

/** Supported marketplace identifiers */
export type MarketplaceType = 'SHOPEE' | 'AMAZON' | 'MERCADOLIVRE' | 'MAGALU';

/** Promo lifecycle status */
export type PromoStatusType = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

/** Product data from a marketplace */
export interface Product {
  id: string;
  name: string;
  originalPrice: number;
  promoPrice: number;
  discountPercent: number;
  imageUrl: string;
  productUrl: string;
  marketplace: MarketplaceType;
  category?: string;
  rating?: number;
  soldCount?: number;
  metadata?: Record<string, unknown>;
}

/** Input data for promo creation */
export interface PromoData {
  product: Product;
  affiliateUrl: string;
  copyVariations: CopyVariation[];
  imageUrl: string;
  marketplace: MarketplaceType;
  generatedAt: Date;
}

/** AI-generated copy variation */
export interface CopyVariation {
  label: string;
  text: string;
  tone: 'urgente' | 'casual' | 'formal' | 'divertido' | 'escassez';
  charCount: number;
}

/** Result from marketplace search */
export interface MarketplaceSearchResult {
  products: Product[];
  total: number;
  marketplace: MarketplaceType;
  query: string;
  fetchedAt: Date;
}

// ============================================
// Constants
// ============================================

/** Configuration per marketplace: rate limits, base URLs, affiliate patterns */
export const MARKETPLACE_CONFIGS: Record<MarketplaceType, {
  name: string;
  baseUrl: string;
  affiliateBaseUrl: string;
  rateLimit: { maxRequests: number; windowMs: number };
  urlPatterns: RegExp[];
}> = {
  SHOPEE: {
    name: 'Shopee',
    baseUrl: 'https://shopee.com.br',
    affiliateBaseUrl: 'https://affiliate.shopee.com.br',
    rateLimit: { maxRequests: 100, windowMs: 60_000 },
    urlPatterns: [
      /shopee\.com\.br/i,
      /shp\.ee/i,
    ],
  },
  AMAZON: {
    name: 'Amazon',
    baseUrl: 'https://www.amazon.com.br',
    affiliateBaseUrl: 'https://associados.amazon.com.br',
    rateLimit: { maxRequests: 1, windowMs: 1_000 },
    urlPatterns: [
      /amazon\.com\.br/i,
      /amzn\.to/i,
      /^https?:\/\/a\.co\//i,
    ],
  },
  MERCADOLIVRE: {
    name: 'Mercado Livre',
    baseUrl: 'https://www.mercadolivre.com.br',
    affiliateBaseUrl: 'https://www.mercadolivre.com.br/afiliados',
    rateLimit: { maxRequests: 10, windowMs: 1_000 },
    urlPatterns: [
      /mercadolivre\.com\.br/i,
      /mercadolibre\.com/i,
      /produto\.mercadolivre/i,
    ],
  },
  MAGALU: {
    name: 'Magazine Luiza',
    baseUrl: 'https://www.magazineluiza.com.br',
    affiliateBaseUrl: 'https://www.lomadee.com',
    rateLimit: { maxRequests: 1, windowMs: 1_000 },
    urlPatterns: [
      /magazineluiza\.com\.br/i,
      /magalu\.com/i,
    ],
  },
};

/** Janela de horario permitida para envio (BRT = UTC-3) */
export const DISPATCH_WINDOWS = [
  { start: 9, end: 12 },  // 09-12h
  { start: 14, end: 18 }, // 14-18h
] as const;

/** Warm-up schedule: dia -> limites */
export const WARMUP_SCHEDULE: Record<number, { maxMsgs: number; maxGroups: number; delayMinMs: number; delayMaxMs: number }> = {
  0: { maxMsgs: 0, maxGroups: 0, delayMinMs: 0, delayMaxMs: 0 },
  1: { maxMsgs: 10, maxGroups: 3, delayMinMs: 300_000, delayMaxMs: 600_000 },
  2: { maxMsgs: 10, maxGroups: 3, delayMinMs: 300_000, delayMaxMs: 600_000 },
  3: { maxMsgs: 30, maxGroups: 10, delayMinMs: 180_000, delayMaxMs: 300_000 },
  4: { maxMsgs: 30, maxGroups: 10, delayMinMs: 180_000, delayMaxMs: 300_000 },
  5: { maxMsgs: 60, maxGroups: 20, delayMinMs: 120_000, delayMaxMs: 180_000 },
  6: { maxMsgs: 60, maxGroups: 20, delayMinMs: 120_000, delayMaxMs: 180_000 },
};

/** Dia 7+ usa estes limites */
export const WARMUP_GRADUATED = {
  maxMsgs: 120,
  maxGroups: Infinity,
  delayMinMs: 60_000,
  delayMaxMs: 120_000,
} as const;

/** Circuit breaker config */
export const CIRCUIT_BREAKER = {
  failureThreshold: 3,
  windowMs: 5 * 60 * 1000,    // 5 min
  cooldownMs: 60 * 60 * 1000, // 1 hour
} as const;

/** Gaussian delay defaults */
export const GAUSSIAN_DELAY = {
  meanMs: 15_000,   // 15s
  stdDevMs: 5_000,  // 5s
  minMs: 5_000,     // 5s floor
  maxMs: 45_000,    // 45s ceiling
} as const;

/** BullMQ queue names */
export const QUEUES = {
  DISPATCH: 'dispatch-queue',
  DISPATCH_PRIORITY: 'dispatch-priority-queue',
  DISPATCH_DLQ: 'dispatch-dlq',
  TELEGRAM_DISPATCH: 'telegram-dispatch-queue',
  AGENT_RESPONSE: 'agent-response-queue',
} as const;

/** Supported dispatch channels */
export type ChannelType = 'whatsapp' | 'telegram' | 'instagram';

// ============================================
// Dispatch Types
// ============================================

export interface DispatchJobData {
  dispatchId: string;
  dispatchItemId: string;
  groupId: string;
  waGroupJid: string;
  sessionId: string;
  tenantId: string;
  copyTemplate: string;
  mediaUrl?: string;
  mediaType?: string;
}

export interface WaSessionHealth {
  sessionId: string;
  phoneNumber: string;
  status: string;
  healthScore: number;
  warmupDay: number;
  dailyMsgCount: number;
  maxDailyMsgs: number;
  circuitBreakerState: string;
}

// ============================================
// Utils
// ============================================

/**
 * Detects the marketplace from a product URL.
 * @param url - The product URL to analyze
 * @returns The detected marketplace or null if no match
 */
export function detectMarketplace(url: string): MarketplaceType | null {
  for (const [marketplace, config] of Object.entries(MARKETPLACE_CONFIGS)) {
    for (const pattern of config.urlPatterns) {
      if (pattern.test(url)) {
        return marketplace as MarketplaceType;
      }
    }
  }
  return null;
}

/**
 * Formats a numeric value as BRL currency string.
 * @param value - The price value in BRL
 * @returns Formatted string like "R$ 29,90"
 */
export function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

/**
 * Generates a URL-safe slug from a name string.
 * @param name - The name to slugify
 * @returns Lowercase slug with hyphens (e.g. "fone-bluetooth-jbl")
 */
export function generateSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')    // remove special chars
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '');          // trim leading/trailing hyphens
}

/**
 * Fetch with timeout — wraps native fetch with an AbortController.
 * @param url - Request URL
 * @param options - Standard RequestInit options
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Response object
 * @throws Error with message 'Request timeout' if exceeded
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ============================================
// Monitoring
// ============================================

export { initMonitoring, sendAlert } from './monitoring.js';

/** Check if current time is within dispatch window (BRT) */
export function isWithinDispatchWindow(now: Date = new Date()): boolean {
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  return DISPATCH_WINDOWS.some(w => brtHour >= w.start && brtHour < w.end);
}

/** Get warm-up limits for a given day */
export function getWarmupLimits(day: number) {
  if (day <= 0) return WARMUP_SCHEDULE[0]!;
  if (day >= 7) return WARMUP_GRADUATED;
  return WARMUP_SCHEDULE[day] ?? WARMUP_GRADUATED;
}
