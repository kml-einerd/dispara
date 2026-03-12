import type { FastifyReply, FastifyRequest } from 'fastify';
import { supabaseAdmin } from '../lib/supabase.js';

/** Routes that do not require authentication */
const PUBLIC_PREFIXES = ['/v1/health', '/v1/auth', '/health', '/v1/telegram/webhook'];

function isPublicRoute(url: string, method?: string): boolean {
  if (PUBLIC_PREFIXES.some((prefix) => url.startsWith(prefix))) return true;

  // Public GET on feeds (slug lookup) and links (code lookup, click, stats)
  const m = (method || 'GET').toUpperCase();
  if (m === 'GET' && url.match(/^\/v1\/feeds\/[^/]+$/)) return true;
  if (m === 'GET' && url.match(/^\/v1\/links\/[^/]+/)) return true;
  if (m === 'POST' && url.match(/^\/v1\/links\/[^/]+\/click$/)) return true;

  return false;
}

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;

/**
 * Multi-tenant middleware powered by Supabase Auth.
 *
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. Validate token against Supabase Auth (getUser)
 * 3. Look up the local User record by externalAuthId (Supabase user.id)
 * 4. If no local User exists, return 403 — user must complete onboarding via /v1/auth/callback
 * 5. Set request.tenantId and request.userId for downstream handlers
 *
 * In dev mode: also accepts X-Tenant-ID / X-User-ID headers as fallback.
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (isPublicRoute(request.url, request.method)) {
    request.tenantId = '';
    request.userId = '';
    return;
  }

  const authHeader = request.headers.authorization;

  // ── Try Supabase Auth ──
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    try {
      const {
        data: { user: supabaseUser },
        error,
      } = await supabaseAdmin.auth.getUser(token);

      if (error || !supabaseUser) {
        request.log.warn({ error }, 'Supabase token verification failed');
        if (!isDev) {
          reply.status(401).send({
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
          });
          return;
        }
        // In dev mode, fall through to header-based auth
      } else {
        // Token is valid — look up local user by externalAuthId
        const prisma = request.server.prisma;

        const localUser = await prisma.user.findUnique({
          where: { externalAuthId: supabaseUser.id },
          select: { id: true, tenantId: true },
        });

        if (!localUser) {
          reply.status(403).send({
            error: {
              code: 'USER_NOT_PROVISIONED',
              message: 'User not provisioned. Complete onboarding first.',
            },
          });
          return;
        }

        request.tenantId = localUser.tenantId;
        request.userId = localUser.id;
        return;
      }
    } catch (err) {
      request.log.error({ err }, 'Error during Supabase auth');
      if (!isDev) {
        reply.status(500).send({
          error: { code: 'AUTH_ERROR', message: 'Authentication service error' },
        });
        return;
      }
    }
  }

  // ── Dev-mode fallback: X-Tenant-ID / X-User-ID headers ──
  if (isDev) {
    const headerTenantId = request.headers['x-tenant-id'] as string | undefined;
    const headerUserId = request.headers['x-user-id'] as string | undefined;

    if (headerTenantId) {
      request.tenantId = headerTenantId;
      request.userId = headerUserId || 'dev-user';
      return;
    }
  }

  // ── No valid credentials ──
  reply.status(401).send({
    error: {
      code: 'UNAUTHORIZED',
      message: isDev
        ? 'Provide a Bearer token or X-Tenant-ID header (dev mode)'
        : 'Authorization header with a valid Bearer token is required',
    },
  });
}
