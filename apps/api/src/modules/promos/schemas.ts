import { z } from 'zod';

export const createPromoSchema = z
  .object({
    url: z.string().url().optional(),
    keyword: z.string().min(2).max(200).optional(),
    marketplace: z
      .enum(['SHOPEE', 'AMAZON', 'MERCADOLIVRE', 'MAGALU'])
      .optional(),
  })
  .refine((data) => data.url || data.keyword, {
    message: 'Either url or keyword is required',
  });

export const listPromosSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  marketplace: z
    .enum(['SHOPEE', 'AMAZON', 'MERCADOLIVRE', 'MAGALU'])
    .optional(),
  search: z.string().max(200).optional(),
});

export const updatePromoSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  productName: z.string().max(500).optional(),
  selectedVariationId: z.string().uuid().optional(),
});

export const generateVariationsSchema = z.object({
  count: z.coerce.number().int().min(1).max(10).default(3),
});

export type CreatePromoInput = z.infer<typeof createPromoSchema>;
export type ListPromosInput = z.infer<typeof listPromosSchema>;
export type UpdatePromoInput = z.infer<typeof updatePromoSchema>;
export const generateCopySchema = z.object({
  count: z.coerce.number().int().min(1).max(5).default(5),
  tones: z
    .array(z.enum(['urgente', 'casual', 'formal', 'divertido', 'escassez']))
    .optional(),
});

export const generateImageSchema = z.object({
  style: z
    .enum(['clean', 'bold', 'minimal', 'social', 'story'])
    .default('clean'),
  withText: z.boolean().default(true),
  textOverlay: z
    .object({
      headline: z.string().max(100).optional(),
      subtitle: z.string().max(200).optional(),
      cta: z.string().max(50).optional(),
    })
    .optional(),
  aspectRatio: z.enum(['1:1', '9:16', '16:9', '4:5']).default('1:1'),
});

export type GenerateVariationsInput = z.infer<typeof generateVariationsSchema>;
export type GenerateCopyInput = z.infer<typeof generateCopySchema>;
export type GenerateImageInput = z.infer<typeof generateImageSchema>;
