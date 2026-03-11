// ============================================
// Enums
// ============================================

export type PromoStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type Marketplace =
  | 'SHOPEE'
  | 'AMAZON'
  | 'MERCADOLIVRE'
  | 'MAGALU'
  | 'ALIEXPRESS';

// ============================================
// Domain Models
// ============================================

export interface CopyVariation {
  id: string;
  promoId: string;
  tone: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Promo {
  id: string;
  tenantId: string;
  productName: string;
  productUrl: string | null;
  keyword: string | null;
  marketplace: Marketplace | null;
  originalPrice: number | null;
  promoPrice: number | null;
  discount: number | null;
  imageUrl: string | null;
  affiliateUrl: string | null;
  selectedCopy: string | null;
  selectedVariationId: string | null;
  status: PromoStatus;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromoWithVariations extends Promo {
  variations: CopyVariation[];
}

// ============================================
// API Types
// ============================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PromoFilters {
  page?: number;
  limit?: number;
  status?: PromoStatus | '';
  marketplace?: Marketplace | '';
  search?: string;
}

export interface CreatePromoPayload {
  url?: string;
  keyword?: string;
  marketplace?: Marketplace;
}

export interface UpdatePromoPayload {
  productName?: string;
  status?: PromoStatus;
  selectedVariationId?: string;
  selectedCopy?: string;
}

// ============================================
// UI Helpers
// ============================================

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  SHOPEE: 'Shopee',
  AMAZON: 'Amazon',
  MERCADOLIVRE: 'Mercado Livre',
  MAGALU: 'Magazine Luiza',
  ALIEXPRESS: 'AliExpress',
};

export const MARKETPLACE_COLORS: Record<Marketplace, string> = {
  SHOPEE: 'bg-orange-100 text-orange-700',
  AMAZON: 'bg-yellow-100 text-yellow-700',
  MERCADOLIVRE: 'bg-yellow-100 text-yellow-800',
  MAGALU: 'bg-blue-100 text-blue-700',
  ALIEXPRESS: 'bg-red-100 text-red-700',
};

export const STATUS_LABELS: Record<PromoStatus, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativa',
  ARCHIVED: 'Arquivada',
};

export const STATUS_COLORS: Record<PromoStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  ARCHIVED: 'bg-amber-100 text-amber-700',
};

export const TONE_LABELS: Record<string, string> = {
  urgente: 'Urgente',
  casual: 'Casual',
  formal: 'Formal',
  default: 'Padrão',
  divertido: 'Divertido',
  informativo: 'Informativo',
};
