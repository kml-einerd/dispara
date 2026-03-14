// ============================================
// Canonical types — synced with Prisma schema + API Zod responses
// Last sync: 2026-03-13
// ============================================

export type Marketplace = 'SHOPEE' | 'AMAZON' | 'MERCADOLIVRE' | 'MAGALU' | 'ALIEXPRESS';

export type WaSessionStatus = 'CONNECTED' | 'DISCONNECTED' | 'BANNED' | 'WARMING_UP';

// Virtual status used by frontend only (derived from metadata.connecting)
export type WaSessionDisplayStatus = WaSessionStatus | 'CONNECTING';

export interface WaSession {
  id: string;
  tenantId: string;
  name: string;
  phoneNumber: string;
  status: WaSessionStatus;
  healthScore: number;
  warmupDay: number;
  dailyMsgCount: number;
  createdAt: string;
  // Fields available on full model but not always returned by list endpoint
  dailyMsgReset?: string | null;
  firstConnAt?: string | null;
  lastConnAt?: string | null;
  metadata?: Record<string, unknown> | null;
  updatedAt?: string;
}

export interface Group {
  id: string;
  tenantId: string;
  sessionId: string;
  channel: 'WHATSAPP' | 'TELEGRAM' | 'INSTAGRAM';
  externalId: string;
  name: string;
  description: string | null;
  memberCount: number;
  maxMembers: number;
  inviteLink: string | null;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Included via API relations (list endpoint)
  session?: { phoneNumber: string; status: string };
  // Detail endpoint also includes healthScore
  _count?: { dispatchItems: number };
}

export interface PromoVariation {
  id: string;
  promoId: string;
  label: string;
  copyText: string;
  imageUrl: string | null;
  isDefault: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** @deprecated Use PromoVariation instead */
export type CopyVariation = PromoVariation;

export type PromoStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface Promo {
  id: string;
  tenantId: string;
  userId: string;
  marketplace: Marketplace;
  productUrl: string;
  affiliateUrl: string;
  productName: string;
  originalPrice: string; // Decimal serialized as string
  promoPrice: string;    // Decimal serialized as string
  discountPercent: number;
  imageUrl: string | null;
  category: string | null;
  status: PromoStatus;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  variations: PromoVariation[];
}

export type DispatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface DispatchItem {
  id: string;
  dispatchId: string;
  groupId: string;
  sessionId: string | null;
  copyRendered: string | null;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RATE_LIMITED';
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  latencyMs: number | null;
  waMsgId: string | null;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
  // Included via API relations
  group?: { name: string; externalId: string };
  session?: { phoneNumber: string };
}

export interface Dispatch {
  id: string;
  tenantId: string;
  userId: string;
  promoId: string | null;
  channel: 'WHATSAPP' | 'TELEGRAM' | 'INSTAGRAM';
  copyTemplate: string;
  mediaUrl: string | null;
  mediaType: string | null;
  status: DispatchStatus;
  priority: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalGroups: number;
  sentCount: number;
  failedCount: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  // Included via API relations
  items?: DispatchItem[];
  _count?: { items: number };
}

export type AccountStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface AffiliateAccount {
  id: string;
  tenantId: string;
  marketplace: Marketplace;
  label: string;
  credentials: Record<string, unknown>;
  status: AccountStatus;
  lastSyncAt: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Product — used by copilot components for search/display
// Different from Prisma Product model (which is for catalog)
// ============================================

export interface Product {
  id: string;
  name: string;
  originalPrice: number;
  promoPrice: number;
  discountPercent: number;
  imageUrl: string;
  productUrl: string;
  affiliateUrl: string;
  marketplace: Marketplace;
  category?: string;
}

// ============================================
// API response wrappers
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
}

export interface PagedResponse<T> {
  promos: T[];
  total: number;
  page: number;
  limit: number;
}
