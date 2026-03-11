import type { FastifyReply, FastifyRequest } from 'fastify';

/** Routes that do not require authentication */
const PUBLIC_PREFIXES = ['/v1/health', '/v1/auth', '/health'];

function isPublicRoute(url: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => url.startsWith(prefix));
}

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === undefined;

/**
 * Multi-tenant middleware.
 *
 * In production: extracts tenantId and userId from a verified JWT Bearer token.
 * In development: also accepts X-Tenant-ID / X-User-ID headers as a fallback
 *                  so you can test without an auth server.
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Skip auth for public routes
  if (isPublicRoute(request.url)) {
    // Set sensible defaults so downstream code never sees undefined
    request.tenantId = '';
    request.userId = '';
    return;
  }

  const authHeader = request.headers.authorization;

  // ── Try JWT first ──
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = await request.jwtVerify<{
        tenantId: string;
        userId: string;
        sub?: string;
      }>();

      request.tenantId = decoded.tenantId;
      request.userId = decoded.userId || decoded.sub || '';

      if (!request.tenantId) {
        reply.status(401).send({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token does not contain a tenantId claim',
          },
        });
        return;
      }

      return;
    } catch (err) {
      request.log.warn({ err }, 'JWT verification failed');
      // If we're NOT in dev mode, reject immediately
      if (!isDev) {
        reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired token',
          },
        });
        return;
      }
      // In dev mode, fall through to header-based auth
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
