import { Prisma } from '@prisma/client';
import { fetchWithTimeout } from '@dispara/shared';
import { prisma } from '../../lib/prisma.js';
import {
  scrapeProduct,
  searchProduct,
  generateCopyVariations,
} from '../../lib/promo-engine-mock.js';
import { CopyGenerator, ImageGenerator, SupabaseImageStorage } from '@dispara/promo-engine';
import type { ImageStyle, ImageGeneratorOptions } from '@dispara/promo-engine';
import type {
  CreatePromoInput,
  ListPromosInput,
  UpdatePromoInput,
  GenerateImageInput,
} from './schemas.js';

const copyGenerator = process.env.OPENROUTER_API_KEY
  ? new CopyGenerator(process.env.OPENROUTER_API_KEY)
  : null;

const imageGenerator = process.env.GEMINI_API_KEY
  ? new ImageGenerator(process.env.GEMINI_API_KEY, {
      fallbackKey: process.env.GEMINI_API_KEY_FALLBACK,
    })
  : null;

const imageStorage =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseImageStorage(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      )
    : null;

// ── Types ──

export type PromoWithVariations = Prisma.PromoGetPayload<{
  include: { variations: true };
}>;

// ── Service ──

export class PromoService {
  /**
   * Create a promo from a URL or keyword.
   * Scrapes / searches the product, generates copy variations, and persists everything.
   */
  static async create(
    tenantId: string,
    userId: string,
    input: CreatePromoInput,
  ): Promise<PromoWithVariations> {
    // 1. Fetch product data
    const product = input.url
      ? await scrapeProduct(input.url)
      : await searchProduct(input.keyword!, input.marketplace);

    // Override marketplace if provided explicitly
    const marketplace = (input.marketplace ?? product.marketplace) as Prisma.PromoCreateInput['marketplace'];

    // 2. Generate 3 copy variations
    const copies = generateCopyVariations(product, 3);

    // 3. Persist in a single transaction
    const promo = await prisma.$transaction(async (tx) => {
      const created = await tx.promo.create({
        data: {
          tenantId,
          userId,
          productName: product.productName,
          productUrl: product.productUrl,
          affiliateUrl: product.affiliateUrl,
          marketplace,
          originalPrice: new Prisma.Decimal(product.originalPrice),
          promoPrice: new Prisma.Decimal(product.promoPrice),
          discountPercent: product.discountPercent,
          imageUrl: product.imageUrl,
          category: product.category,
          status: 'DRAFT',
          variations: {
            create: copies.map((c, idx) => ({
              label: c.label,
              copyText: c.copyText,
              isDefault: idx === 0,
            })),
          },
        },
        include: { variations: true },
      });

      return created;
    });

    return promo;
  }

  /**
   * List promos with pagination, filtering, and search.
   */
  static async list(
    tenantId: string,
    input: ListPromosInput,
  ): Promise<{ promos: PromoWithVariations[]; total: number; page: number; limit: number }> {
    const { page, limit, status, marketplace, search } = input;
    const skip = (page - 1) * limit;

    const where: Prisma.PromoWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(marketplace && { marketplace }),
      ...(search && {
        productName: { contains: search, mode: 'insensitive' as const },
      }),
    };

    const [promos, total] = await prisma.$transaction([
      prisma.promo.findMany({
        where,
        include: { variations: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.promo.count({ where }),
    ]);

    return { promos, total, page, limit };
  }

  /**
   * Get a single promo by ID, scoped to the tenant.
   */
  static async getById(
    tenantId: string,
    promoId: string,
  ): Promise<PromoWithVariations | null> {
    return prisma.promo.findFirst({
      where: { id: promoId, tenantId },
      include: { variations: true },
    });
  }

  /**
   * Update a promo (status, productName, selectedVariationId).
   */
  static async update(
    tenantId: string,
    promoId: string,
    input: UpdatePromoInput,
  ): Promise<PromoWithVariations> {
    // Verify ownership first
    const existing = await prisma.promo.findFirst({
      where: { id: promoId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError(`Promo ${promoId} not found`);
    }

    return prisma.$transaction(async (tx) => {
      const data: Prisma.PromoUpdateInput = {};

      if (input.status !== undefined) {
        data.status = input.status;
      }
      if (input.productName !== undefined) {
        data.productName = input.productName;
      }

      // If selecting a variation, mark it as default and unmark others
      if (input.selectedVariationId !== undefined) {
        const variation = await tx.promoVariation.findFirst({
          where: { id: input.selectedVariationId, promoId },
        });
        if (!variation) {
          throw new NotFoundError(
            `Variation ${input.selectedVariationId} not found for promo ${promoId}`,
          );
        }

        // Unmark all current defaults
        await tx.promoVariation.updateMany({
          where: { promoId, isDefault: true },
          data: { isDefault: false },
        });

        // Mark selected as default
        await tx.promoVariation.update({
          where: { id: input.selectedVariationId },
          data: { isDefault: true },
        });
      }

      return tx.promo.update({
        where: { id: promoId },
        data,
        include: { variations: true },
      });
    });
  }

  /**
   * Soft-delete a promo by setting status to ARCHIVED.
   */
  static async archive(
    tenantId: string,
    promoId: string,
  ): Promise<{ id: string; status: string }> {
    const existing = await prisma.promo.findFirst({
      where: { id: promoId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError(`Promo ${promoId} not found`);
    }

    const updated = await prisma.promo.update({
      where: { id: promoId },
      data: { status: 'ARCHIVED' },
      select: { id: true, status: true },
    });

    return updated;
  }

  /**
   * Generate additional copy variations for an existing promo.
   */
  static async generateVariations(
    tenantId: string,
    promoId: string,
    count = 3,
  ) {
    const promo = await prisma.promo.findFirst({
      where: { id: promoId, tenantId },
    });

    if (!promo) {
      throw new NotFoundError(`Promo ${promoId} not found`);
    }

    // Build a ScrapedProduct-compatible object from stored promo data
    const product = {
      productName: promo.productName,
      productUrl: promo.productUrl,
      originalPrice: Number(promo.originalPrice),
      promoPrice: Number(promo.promoPrice),
      discountPercent: promo.discountPercent,
      imageUrl: promo.imageUrl,
      marketplace: promo.marketplace,
      affiliateUrl: promo.affiliateUrl,
      category: promo.category,
    };

    let copies: Array<{ label: string; copyText: string }>;

    if (copyGenerator) {
      const variations = await copyGenerator.generateVariations({
        id: promo.id,
        name: product.productName,
        originalPrice: product.originalPrice,
        promoPrice: product.promoPrice,
        discountPercent: product.discountPercent,
        imageUrl: product.imageUrl ?? '',
        productUrl: product.productUrl,
        marketplace: product.marketplace as any,
        category: product.category ?? undefined,
      }, count);
      copies = variations.map((v) => ({ label: v.label, copyText: v.text }));
    } else {
      copies = generateCopyVariations(product, count);
    }

    const created = await prisma.$transaction(
      copies.map((c) =>
        prisma.promoVariation.create({
          data: {
            promoId,
            label: c.label,
            copyText: c.copyText,
            isDefault: false,
          },
        }),
      ),
    );

    return created;
  }

  /**
   * Generate a promotional image for a promo using AI.
   */
  static async generateImage(
    tenantId: string,
    promoId: string,
    input: GenerateImageInput,
  ): Promise<{ imageUrl: string; style: string; dimensions: { width: number; height: number } }> {
    if (!imageGenerator) {
      throw new ServiceUnavailableError('Image generation not configured (GEMINI_API_KEY missing)');
    }

    const promo = await prisma.promo.findFirst({
      where: { id: promoId, tenantId },
    });

    if (!promo) {
      throw new NotFoundError(`Promo ${promoId} not found`);
    }

    const product = {
      id: promo.id,
      name: promo.productName,
      originalPrice: Number(promo.originalPrice),
      promoPrice: Number(promo.promoPrice),
      discountPercent: promo.discountPercent,
      imageUrl: promo.imageUrl ?? '',
      productUrl: promo.productUrl,
      marketplace: promo.marketplace as any,
      category: promo.category ?? undefined,
    };

    const options: ImageGeneratorOptions = {
      withText: input.withText,
      textOverlay: input.textOverlay
        ? [input.textOverlay.headline, input.textOverlay.subtitle, input.textOverlay.cta]
            .filter(Boolean)
            .join(' — ')
        : undefined,
      aspectRatio: input.aspectRatio,
    };

    const result = await imageGenerator.generatePromoImage(
      product,
      input.style as ImageStyle,
      options,
    );

    // Upload base64 image to Supabase Storage if available
    let finalImageUrl = result.imageUrl;
    if (imageStorage && result.imageUrl.startsWith('data:image/')) {
      const base64Data = result.imageUrl.split(',')[1]!;
      const mimeMatch = result.imageUrl.match(/data:(image\/\w+);/);
      const ext = mimeMatch ? mimeMatch[1]!.split('/')[1] : 'png';
      const storagePath = `${tenantId}/promos/${promoId}/generated-${Date.now()}.${ext}`;

      const buffer = Buffer.from(base64Data, 'base64');
      const uploadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/promo-images/${storagePath}`;

      const uploadResponse = await fetchWithTimeout(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': `image/${ext}`,
          'x-upsert': 'true',
        },
        body: buffer,
      });

      if (uploadResponse.ok) {
        finalImageUrl = imageStorage.getPublicUrl(storagePath);
      }
    }

    // Save to PromoVariation with image
    await prisma.promoVariation.create({
      data: {
        promoId,
        label: `image-${input.style}`,
        copyText: '',
        imageUrl: finalImageUrl,
        isDefault: false,
      },
    });

    // Also update promo imageUrl if it doesn't have one
    if (!promo.imageUrl) {
      await prisma.promo.update({
        where: { id: promoId },
        data: { imageUrl: finalImageUrl },
      });
    }

    const aspectDimensions: Record<string, { width: number; height: number }> = {
      '1:1': { width: 1024, height: 1024 },
      '9:16': { width: 768, height: 1365 },
      '16:9': { width: 1365, height: 768 },
      '4:5': { width: 819, height: 1024 },
    };

    return {
      imageUrl: finalImageUrl,
      style: input.style,
      dimensions: aspectDimensions[input.aspectRatio] ?? { width: 1024, height: 1024 },
    };
  }

  /**
   * Generate copy variations with streaming (SSE).
   * Yields each variation as it's generated by the LLM.
   */
  static async *generateCopyStream(
    tenantId: string,
    promoId: string,
    count = 5,
  ): AsyncGenerator<{ label: string; copyText: string }> {
    const promo = await prisma.promo.findFirst({
      where: { id: promoId, tenantId },
    });

    if (!promo) {
      throw new NotFoundError(`Promo ${promoId} not found`);
    }

    if (!copyGenerator) {
      // Fallback: yield mock copies synchronously
      const product = {
        productName: promo.productName,
        productUrl: promo.productUrl,
        originalPrice: Number(promo.originalPrice),
        promoPrice: Number(promo.promoPrice),
        discountPercent: promo.discountPercent,
        imageUrl: promo.imageUrl,
        marketplace: promo.marketplace,
        affiliateUrl: promo.affiliateUrl,
        category: promo.category,
      };
      const copies = generateCopyVariations(product, count);
      for (const c of copies) {
        yield c;
      }
      return;
    }

    const product = {
      id: promo.id,
      name: promo.productName,
      originalPrice: Number(promo.originalPrice),
      promoPrice: Number(promo.promoPrice),
      discountPercent: promo.discountPercent,
      imageUrl: promo.imageUrl ?? '',
      productUrl: promo.productUrl,
      marketplace: promo.marketplace as any,
      category: promo.category ?? undefined,
    };

    const savedVariations: Array<{ label: string; copyText: string; id: string }> = [];

    for await (const variation of copyGenerator.generateVariationsStream(product, count)) {
      const saved = await prisma.promoVariation.create({
        data: {
          promoId,
          label: variation.label,
          copyText: variation.text,
          isDefault: savedVariations.length === 0,
        },
      });
      const result = { label: variation.label, copyText: variation.text, id: saved.id };
      savedVariations.push(result);
      yield result;
    }
  }
}

// ── Custom errors ──

export class NotFoundError extends Error {
  public readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ServiceUnavailableError extends Error {
  public readonly statusCode = 503;
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}
