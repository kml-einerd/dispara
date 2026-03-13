import { z } from 'zod';

export const shopeeCredentialsSchema = z.object({
  appId: z.string().min(1, 'App ID é obrigatório'),
  secret: z.string().min(1, 'Secret Key é obrigatória'),
});

export const mlCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1).optional(),
});

export const disconnectParamsSchema = z.object({
  id: z.string().uuid(),
});
