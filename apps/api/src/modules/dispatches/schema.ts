import { z } from 'zod';

export const createDispatchSchema = z.object({
  promoId: z.string().uuid().optional(),
  copyTemplate: z.string().min(1).max(5000),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['image', 'video', 'document']).optional(),
  groupIds: z.array(z.string().uuid()).min(1).max(500),
  priority: z.number().int().min(0).max(1).default(0),
  scheduledAt: z.string().datetime().optional(),
});

export const listDispatchesQuery = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED']).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateDispatchBody = z.infer<typeof createDispatchSchema>;
export type ListDispatchesQuery = z.infer<typeof listDispatchesQuery>;
