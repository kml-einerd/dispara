import { z } from 'zod';

export const importGroupsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const updateGroupSchema = z.object({
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listGroupsQuery = z.object({
  sessionId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type ImportGroupsBody = z.infer<typeof importGroupsSchema>;
export type UpdateGroupBody = z.infer<typeof updateGroupSchema>;
export type ListGroupsQuery = z.infer<typeof listGroupsQuery>;
