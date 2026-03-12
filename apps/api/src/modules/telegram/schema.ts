import { z } from 'zod';

export const registerBotSchema = z.object({
  botToken: z.string().min(10),
  name: z.string().optional(),
});

export const updateChannelSchema = z.object({
  isActive: z.boolean().optional(),
  agentEnabled: z.boolean().optional(),
});

export const dispatchSchema = z.object({
  promoId: z.string().uuid().optional(),
  text: z.string().min(1),
  mediaUrl: z.string().url().optional(),
  mediaType: z.enum(['photo', 'video', 'animation']).optional(),
  channelIds: z.array(z.string().uuid()).min(1),
});

export type RegisterBotInput = z.infer<typeof registerBotSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type DispatchInput = z.infer<typeof dispatchSchema>;
