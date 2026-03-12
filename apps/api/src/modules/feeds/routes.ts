import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../lib/supabase.js';

export async function feedRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /v1/feeds/:slug — Public: get feed with promos ──
  app.get(
    '/:slug',
    async (
      request: FastifyRequest<{ Params: { slug: string } }>,
      reply: FastifyReply,
    ) => {
      const { slug } = request.params;

      const { data: feed, error: feedErr } = await supabaseAdmin
        .from('promo_feeds')
        .select('id, tenant_id, name, slug, is_active, created_at')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (feedErr || !feed) {
        reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Feed "${slug}" not found` },
        });
        return;
      }

      // Get feed items with their promos, ordered by position
      const { data: items, error: itemsErr } = await supabaseAdmin
        .from('promo_feed_items')
        .select(`
          id,
          position,
          promo_id,
          promos (
            id,
            product_name,
            image_url,
            original_price,
            promo_price,
            discount,
            marketplace,
            affiliate_url,
            source_url,
            status
          )
        `)
        .eq('feed_id', feed.id)
        .order('position', { ascending: true });

      if (itemsErr) {
        request.log.error({ error: itemsErr }, 'Failed to fetch feed items');
        reply.status(500).send({
          error: { code: 'INTERNAL', message: 'Failed to load feed items' },
        });
        return;
      }

      // For each promo, attach its link_spot short_code if one exists
      const promoIds = (items ?? [])
        .map((i: any) => i.promos?.id)
        .filter(Boolean);

      let linkSpotMap: Record<string, string> = {};
      if (promoIds.length > 0) {
        const { data: links } = await supabaseAdmin
          .from('link_spots')
          .select('short_code, target_url')
          .eq('tenant_id', feed.tenant_id)
          .eq('is_active', true)
          .in('target_url', promoIds);

        // Also try matching by promo_id column if it exists
        const { data: linksByPromo } = await supabaseAdmin
          .from('link_spots')
          .select('short_code, promo_id')
          .eq('tenant_id', feed.tenant_id)
          .eq('is_active', true)
          .in('promo_id', promoIds);

        for (const l of links ?? []) {
          linkSpotMap[l.target_url] = l.short_code;
        }
        for (const l of linksByPromo ?? []) {
          if (l.promo_id) linkSpotMap[l.promo_id] = l.short_code;
        }
      }

      const promos = (items ?? []).map((item: any) => ({
        ...item.promos,
        position: item.position,
        short_code: item.promos ? linkSpotMap[item.promos.id] ?? null : null,
      }));

      reply.status(200).send({
        feed: {
          id: feed.id,
          name: feed.name,
          slug: feed.slug,
        },
        promos,
      });
    },
  );

  // ── POST /v1/feeds — Create feed (auth required) ──
  app.post(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.tenantId) {
        reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { name, slug } = request.body as { name: string; slug: string };

      if (!name || !slug) {
        reply.status(400).send({
          error: { code: 'VALIDATION', message: 'name and slug are required' },
        });
        return;
      }

      // Validate slug format
      if (!/^[a-z0-9-]+$/.test(slug)) {
        reply.status(400).send({
          error: {
            code: 'VALIDATION',
            message: 'slug must contain only lowercase letters, numbers, and hyphens',
          },
        });
        return;
      }

      const { data: feed, error } = await supabaseAdmin
        .from('promo_feeds')
        .insert({
          tenant_id: request.tenantId,
          name,
          slug,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          reply.status(409).send({
            error: { code: 'CONFLICT', message: 'A feed with this slug already exists' },
          });
          return;
        }
        request.log.error({ error }, 'Failed to create feed');
        reply.status(500).send({
          error: { code: 'INTERNAL', message: 'Failed to create feed' },
        });
        return;
      }

      reply.status(201).send({ feed });
    },
  );

  // ── POST /v1/feeds/:id/items — Add promo to feed (auth required) ──
  app.post(
    '/:id/items',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      if (!request.tenantId) {
        reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { id: feedId } = request.params;
      const { promo_id, position } = request.body as {
        promo_id: string;
        position?: number;
      };

      if (!promo_id) {
        reply.status(400).send({
          error: { code: 'VALIDATION', message: 'promo_id is required' },
        });
        return;
      }

      // Verify feed belongs to tenant
      const { data: feed } = await supabaseAdmin
        .from('promo_feeds')
        .select('id')
        .eq('id', feedId)
        .eq('tenant_id', request.tenantId)
        .single();

      if (!feed) {
        reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'Feed not found' },
        });
        return;
      }

      // If no position given, append at end
      let pos = position;
      if (pos == null) {
        const { data: last } = await supabaseAdmin
          .from('promo_feed_items')
          .select('position')
          .eq('feed_id', feedId)
          .order('position', { ascending: false })
          .limit(1)
          .single();

        pos = (last?.position ?? 0) + 1;
      }

      const { data: item, error } = await supabaseAdmin
        .from('promo_feed_items')
        .insert({
          feed_id: feedId,
          promo_id,
          position: pos,
        })
        .select()
        .single();

      if (error) {
        request.log.error({ error }, 'Failed to add item to feed');
        reply.status(500).send({
          error: { code: 'INTERNAL', message: 'Failed to add item' },
        });
        return;
      }

      reply.status(201).send({ item });
    },
  );
}
