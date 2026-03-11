import { z } from 'zod';

// ============================================
// Request schemas
// ============================================

export const createSessionBodySchema = z.object({
  name: z.string().min(1).max(100),
});

export const sessionParamsSchema = z.object({
  id: z.string().uuid(),
});

// ============================================
// Response schemas
// ============================================

export const sessionResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  phoneNumber: z.string(),
  status: z.enum(['CONNECTING', 'CONNECTED', 'DISCONNECTED', 'BANNED', 'QUARANTINE']),
  healthScore: z.number().int().min(0).max(100),
  warmupDay: z.number().int(),
  dailyMsgCount: z.number().int(),
  createdAt: z.string().datetime(),
});

export const sessionListResponseSchema = z.object({
  sessions: z.array(sessionResponseSchema),
  total: z.number().int(),
});

export const sessionHealthResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  healthScore: z.number().int(),
  warmupDay: z.number().int(),
  dailyMsgCount: z.number().int(),
  lastActivity: z.string().datetime().nullable(),
  runtimeStatus: z.string(),
});

export const qrResponseSchema = z.object({
  sessionId: z.string().uuid(),
  qr: z.string().nullable(),
  status: z.string(),
});

export const createSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.literal('CONNECTING'),
});

// ============================================
// Types
// ============================================

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;
export type SessionParams = z.infer<typeof sessionParamsSchema>;
export type SessionResponse = z.infer<typeof sessionResponseSchema>;
export type SessionListResponse = z.infer<typeof sessionListResponseSchema>;
export type SessionHealthResponse = z.infer<typeof sessionHealthResponseSchema>;
export type QrResponse = z.infer<typeof qrResponseSchema>;
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;
