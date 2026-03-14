import { z } from 'zod';

export const updateAgentConfigSchema = z.object({
  systemPrompt: z.string().min(10).max(2000).optional(),
  isActive: z.boolean().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(100).max(4096).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const agentInteractionsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  intent: z.enum(['busca_produto', 'gerar_copy', 'disparar', 'status', 'ajuda', 'off_topic']).optional(),
  groupId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const agentStatsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('week'),
});

export const interactSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    selectedProductId: z.string().optional(),
    imageUrl: z.string().url().optional(),
  }).optional(),
});

export type InteractInput = z.infer<typeof interactSchema>;
export type UpdateAgentConfigInput = z.infer<typeof updateAgentConfigSchema>;
export type AgentInteractionsQuery = z.infer<typeof agentInteractionsQuerySchema>;
export type AgentStatsQuery = z.infer<typeof agentStatsQuerySchema>;
