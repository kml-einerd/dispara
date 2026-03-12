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

// ============================================
// WhatsApp Session Types
// ============================================

export type WaSessionStatus = 'CONNECTED' | 'DISCONNECTED' | 'BANNED' | 'WARMING_UP' | 'CONNECTING';

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
}

export interface WaSessionListResponse {
  sessions: WaSession[];
  total: number;
}

export interface WaSessionHealthResponse {
  id: string;
  status: string;
  healthScore: number;
  warmupDay: number;
  dailyMsgCount: number;
  lastActivity: string | null;
  runtimeStatus: string;
}

export interface QrResponse {
  sessionId: string;
  qr: string | null;
  status: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  status: 'CONNECTING';
}

export const SESSION_STATUS_LABELS: Record<WaSessionStatus, string> = {
  CONNECTED: 'Conectado',
  DISCONNECTED: 'Desconectado',
  BANNED: 'Banido',
  WARMING_UP: 'Aquecendo',
  CONNECTING: 'Conectando',
};

export const SESSION_STATUS_VARIANTS: Record<WaSessionStatus, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  CONNECTED: 'success',
  DISCONNECTED: 'default',
  BANNED: 'danger',
  WARMING_UP: 'warning',
  CONNECTING: 'info',
};

// ============================================
// Group Types
// ============================================

export interface WaGroup {
  id: string;
  tenantId: string;
  sessionId: string;
  waGroupId: string;
  name: string;
  description: string;
  memberCount: number;
  isActive: boolean;
  inviteCode: string | null;
  createdAt: string;
  updatedAt: string;
  session: {
    phoneNumber: string;
    status: string;
  };
  _count: {
    dispatchItems: number;
  };
}

export interface GroupListResponse {
  data: WaGroup[];
  cursor: string | null;
}

export interface ImportGroupsResponse {
  imported: number;
  groups: WaGroup[];
}

// ============================================
// Dispatch Types
// ============================================

export type DispatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
export type DispatchItemStatus = 'PENDING' | 'QUEUED' | 'SENT' | 'FAILED' | 'CANCELLED';

export interface Dispatch {
  id: string;
  tenantId: string;
  promoId: string | null;
  copyTemplate: string;
  mediaUrl: string | null;
  mediaType: string | null;
  priority: number;
  status: DispatchStatus;
  totalGroups: number;
  sentCount: number;
  failedCount: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    items: number;
  };
}

export interface DispatchItem {
  id: string;
  dispatchId: string;
  groupId: string;
  sessionId: string | null;
  status: DispatchItemStatus;
  jobId: string | null;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  group: {
    name: string;
    waGroupId: string;
  };
  session: {
    phoneNumber: string;
  } | null;
}

export interface DispatchDetail extends Dispatch {
  items: DispatchItem[];
}

export interface DispatchListResponse {
  data: Dispatch[];
  cursor: string | null;
}

export interface CreateDispatchPayload {
  promoId?: string;
  copyTemplate: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document';
  groupIds: string[];
  priority?: number;
  scheduledAt?: string;
}

export interface CreateDispatchResponse {
  id: string;
  status: string;
  totalGroups: number;
  scheduledAt: string | null;
}

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  COMPLETED: 'Concluído',
  PARTIAL: 'Parcial',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
};

export const DISPATCH_STATUS_VARIANTS: Record<DispatchStatus, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  PENDING: 'default',
  PROCESSING: 'info',
  COMPLETED: 'success',
  PARTIAL: 'warning',
  FAILED: 'danger',
  CANCELLED: 'default',
};

export const DISPATCH_ITEM_STATUS_VARIANTS: Record<DispatchItemStatus, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  PENDING: 'default',
  QUEUED: 'info',
  SENT: 'success',
  FAILED: 'danger',
  CANCELLED: 'default',
};

// ============================================
// AI Agent Types
// ============================================

export type AgentIntent =
  | 'product_query'
  | 'price_check'
  | 'recommendation'
  | 'off_topic'
  | 'greeting'
  | 'complaint'
  | 'unknown';

export interface AgentConfig {
  enabled: boolean;
  systemPrompt: string;
  maxResponseTokens: number;
  enabledGroupIds: string[];
  updatedAt: string;
}

export interface AgentStats {
  totalInteractions: number;
  avgResponseTimeMs: number;
  topIntent: AgentIntent | null;
  activeGroups: number;
  intentBreakdown: Record<AgentIntent, number>;
  period: 'day' | 'week' | 'month';
}

export interface AgentInteraction {
  id: string;
  groupId: string;
  groupName: string;
  platform: 'whatsapp' | 'telegram';
  userMessage: string;
  agentResponse: string;
  intent: AgentIntent;
  responseTimeMs: number;
  createdAt: string;
}

export interface AgentInteractionListResponse {
  data: AgentInteraction[];
  cursor: string | null;
}

export interface AgentGroupChannel {
  id: string;
  name: string;
  platform: 'whatsapp' | 'telegram';
  memberCount: number;
  agentEnabled: boolean;
}

export const AGENT_INTENT_LABELS: Record<AgentIntent, string> = {
  product_query: 'Consulta de Produto',
  price_check: 'Verificação de Preço',
  recommendation: 'Recomendação',
  off_topic: 'Fora do Tópico',
  greeting: 'Saudação',
  complaint: 'Reclamação',
  unknown: 'Desconhecido',
};

export const AGENT_INTENT_VARIANTS: Record<AgentIntent, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  product_query: 'success',
  price_check: 'info',
  recommendation: 'info',
  off_topic: 'default',
  greeting: 'default',
  complaint: 'warning',
  unknown: 'default',
};
