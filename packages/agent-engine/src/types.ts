export type Intent =
  | 'busca_produto'
  | 'gerar_copy'
  | 'disparar'
  | 'status'
  | 'ajuda'
  | 'off_topic';

export interface ClassificationResult {
  intent: Intent;
  confidence: number;
  entities: {
    productName?: string;
    category?: string;
    maxPrice?: number;
    brand?: string;
  };
}

export interface AgentConfig {
  tenantId: string;
  systemPrompt: string;
  enabled: boolean;
  enabledGroups: string[];
  cooldownMinutes: number;
  maxResponsesPerHour: number;
  responseDelayMinMs: number;
  responseDelayMaxMs: number;
}

export interface AgentInteraction {
  id: string;
  tenantId: string;
  groupId: string;
  groupName: string;
  platform: 'whatsapp' | 'telegram';
  incomingMessage: string;
  intent: Intent;
  confidence: number;
  responseText: string | null;
  responseTimeMs: number;
  productIds: string[];
  createdAt: Date;
}

export interface ProductForRAG {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  originalPrice?: number;
  affiliateUrl: string;
  imageUrl?: string;
  marketplace: string;
  embedding?: number[];
}

export interface RAGResult {
  product: ProductForRAG;
  score: number;
}
