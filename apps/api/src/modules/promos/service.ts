import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  scrapeProduct,
  searchProduct,
  generateCopyVariations,
} from '../../lib/promo-engine-mock.js';
import type {
  CreatePromoInput,
  ListPromosInput,
  UpdatePromoInput,
} from './schemas.js';

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

    const copies = generateCopyVariations(product, count);

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
}

// ── Custom error for not-found ──

export class NotFoundError extends Error {
  public readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
