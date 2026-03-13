import type { FastifyInstance } from 'fastify';
import { OAuthService } from './service.js';
import { shopeeCredentialsSchema, mlCallbackSchema, disconnectParamsSchema } from './schemas.js';

export async function oauthRoutes(app: FastifyInstance): Promise<void> {
  const service = new OAuthService(app.prisma);

  // ── Mercado Livre ──

  app.get('/mercadolivre/connect', async (request, reply) => {
    const url = service.getMlAuthorizeUrl(request.tenantId);
    return reply.send({ url });
  });

  app.get('/mercadolivre/callback', async (request, reply) => {
    const parsed = mlCallbackSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Missing code parameter' },
      });
    }

    const { code, state } = parsed.data;

    try {
      const tenantId = state ? service.verifyMlState(state) : request.tenantId;
      const account = await service.exchangeMlCode(code, tenantId);
      // Redirect to frontend settings with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return reply.redirect(`${frontendUrl}/settings?connected=mercadolivre`);
    } catch (err) {
      request.log.error({ err }, 'ML OAuth callback failed');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      return reply.redirect(`${frontendUrl}/settings?error=mercadolivre`);
    }
  });

  app.post('/mercadolivre/refresh', async (request, reply) => {
    const { accountId } = request.body as { accountId: string };
    try {
      const account = await service.refreshMlToken(accountId);
      return reply.send({ account });
    } catch (err) {
      request.log.error({ err }, 'ML token refresh failed');
      return reply.status(400).send({
        error: { code: 'TOKEN_REFRESH_FAILED', message: (err as Error).message },
      });
    }
  });

  // ── Shopee ──

  app.post('/shopee/connect', async (request, reply) => {
    const parsed = shopeeCredentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid credentials',
          details: parsed.error.flatten().fieldErrors,
        },
      });
    }

    try {
      const account = await service.saveShopeeCredentials(
        request.tenantId,
        parsed.data.appId,
        parsed.data.secret,
      );
      return reply.status(201).send({ account });
    } catch (err) {
      request.log.error({ err }, 'Shopee credential save failed');
      return reply.status(400).send({
        error: { code: 'INVALID_CREDENTIALS', message: (err as Error).message },
      });
    }
  });

  // ── Shared ──

  app.get('/accounts', async (request, reply) => {
    const accounts = await service.listAccounts(request.tenantId);
    return reply.send({ accounts });
  });

  app.delete('/accounts/:id', async (request, reply) => {
    const parsed = disconnectParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid account ID' },
      });
    }

    try {
      await service.disconnect(parsed.data.id, request.tenantId);
      return reply.status(204).send();
    } catch (err) {
      request.log.error({ err }, 'Disconnect failed');
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Account not found' },
      });
    }
  });
}
