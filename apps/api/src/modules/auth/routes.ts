import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { supabaseAdmin } from '../../lib/supabase.js';

const callbackBodySchema = z.object({
  supabaseUserId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(255),
  avatarUrl: z.string().url().nullable().optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /v1/auth/callback
   *
   * Called by the frontend after a successful Google OAuth via Supabase.
   * If the user doesn't exist locally, auto-provisions a Tenant + User (onboarding).
   * If the user already exists, updates lastLoginAt and returns current data.
   */
  app.post('/callback', async (request, reply) => {
    const parsed = callbackBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    const { supabaseUserId, email, name, avatarUrl } = parsed.data;
    const prisma = request.server.prisma;

    try {
      // Check if user already exists
      let user = await prisma.user.findUnique({
        where: { externalAuthId: supabaseUserId },
        include: { tenant: true },
      });

      if (user) {
        // Existing user — update lastLoginAt
        user = await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
          include: { tenant: true },
        });

        request.log.info({ userId: user.id }, 'User logged in');

        return reply.status(200).send({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            role: user.role,
          },
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            plan: user.tenant.plan,
          },
        });
      }

      // New user — auto-provision tenant + user
      const slug = email.split('@')[0]!.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      const tenant = await prisma.tenant.create({
        data: {
          name: `${name}'s Workspace`,
          slug,
          plan: 'STARTER',
        },
      });

      user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          externalAuthId: supabaseUserId,
          email,
          name,
          avatarUrl: avatarUrl ?? null,
          role: 'OWNER',
          lastLoginAt: new Date(),
        },
        include: { tenant: true },
      });

      request.log.info(
        { userId: user.id, tenantId: tenant.id },
        'Provisioned new tenant and user via auth callback',
      );

      return reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
        },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
        },
      });
    } catch (err) {
      request.log.error({ err, supabaseUserId }, 'Auth callback failed');

      // Handle unique constraint violation on slug
      if (
        err instanceof Error &&
        'code' in err &&
        (err as any).code === 'P2002'
      ) {
        return reply.status(409).send({
          error: {
            code: 'CONFLICT',
            message: 'A workspace with this slug already exists. Please contact support.',
          },
        });
      }

      return reply.status(500).send({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to process auth callback' },
      });
    }
  });
}
