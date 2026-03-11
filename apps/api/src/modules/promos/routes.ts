import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PromoService, NotFoundError } from './service.js';
import {
  createPromoSchema,
  listPromosSchema,
  updatePromoSchema,
  generateVariationsSchema,
} from './schemas.js';

export async function promoRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /v1/promos — Create promo from URL or keyword ──
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = createPromoSchema.parse(request.body);

    const promo = await PromoService.create(
      request.tenantId,
      request.userId,
      input,
    );

    reply.status(201).send({ promo });
  });

  // ── GET /v1/promos — List promos with pagination ──
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const input = listPromosSchema.parse(request.query);

    const result = await PromoService.list(request.tenantId, input);

    reply.status(200).send(result);
  });

  // ── GET /v1/promos/:id — Get promo with variations ──
  app.get(
    '/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const promo = await PromoService.getById(
        request.tenantId,
        request.params.id,
      );

      if (!promo) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Promo ${request.params.id} not found`,
          },
        });
        return;
      }

      reply.status(200).send({ promo });
    },
  );

  // ── PATCH /v1/promos/:id — Update promo ──
  app.patch(
    '/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const input = updatePromoSchema.parse(request.body);

      try {
        const promo = await PromoService.update(
          request.tenantId,
          request.params.id,
          input,
        );

        reply.status(200).send({ promo });
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.status(404).send({
            error: { code: 'NOT_FOUND', message: err.message },
          });
          return;
        }
        throw err;
      }
    },
  );

  // ── DELETE /v1/promos/:id — Soft delete (archive) ──
  app.delete(
    '/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const promo = await PromoService.archive(
          request.tenantId,
          request.params.id,
        );

        reply.status(200).send({ promo });
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.status(404).send({
            error: { code: 'NOT_FOUND', message: err.message },
          });
          return;
        }
        throw err;
      }
    },
  );

  // ── POST /v1/promos/:id/variations — Generate additional variations ──
  app.post(
    '/:id/variations',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const { count } = generateVariationsSchema.parse(request.body ?? {});

      try {
        const variations = await PromoService.generateVariations(
          request.tenantId,
          request.params.id,
          count,
        );

        reply.status(201).send({ variations });
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.status(404).send({
            error: { code: 'NOT_FOUND', message: err.message },
          });
          return;
        }
        throw err;
      }
    },
  );
}
