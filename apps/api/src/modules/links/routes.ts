import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { supabaseAdmin } from '../../lib/supabase.js';
import crypto from 'node:crypto';

function generateShortCode(): string {
  return crypto.randomBytes(4).toString('base64url'); // 6 chars, URL-safe
}

export async function linkRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /v1/links — Create short link (auth required) ──
  app.post(
    '/',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.tenantId) {
        reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        });
        return;
      }

      const { target_url, affiliate_url, promo_id } = request.body as {
        target_url: string;
        affiliate_url: string;
        promo_id?: string;
      };

      if (!target_url || !affiliate_url) {
        reply.status(400).send({
          error: {
            code: 'VALIDATION',
            message: 'target_url and affiliate_url are required',
          },
        });
        return;
      }

      // Generate unique short code with collision retry
      let short_code: string;
      let attempts = 0;
      while (true) {
        short_code = generateShortCode();
        const { data: existing } = await supabaseAdmin
          .from('link_spots')
          .select('id')
          .eq('short_code', short_code)
          .single();

        if (!existing) break;
        attempts++;
        if (attempts > 5) {
          reply.status(500).send({
            error: { code: 'INTERNAL', message: 'Failed to generate unique short code' },
          });
          return;
        }
      }

      const { data: link, error } = await supabaseAdmin
        .from('link_spots')
        .insert({
          tenant_id: request.tenantId,
          short_code,
          target_url,
          affiliate_url,
          promo_id: promo_id ?? null,
          click_count: 0,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        request.log.error({ error }, 'Failed to create link');
        reply.status(500).send({
          error: { code: 'INTERNAL', message: 'Failed to create link' },
        });
        return;
      }

      reply.status(201).send({ link });
    },
  );

  // ── GET /v1/links/:code — Get link details + redirect target ──
  app.get(
    '/:code',
    async (
      request: FastifyRequest<{ Params: { code: string } }>,
      reply: FastifyReply,
    ) => {
      const { code } = request.params;

      const { data: link, error } = await supabaseAdmin
        .from('link_spots')
        .select('id, short_code, target_url, affiliate_url, click_count, is_active, created_at')
        .eq('short_code', code)
        .single();

      if (error || !link) {
        reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Link "${code}" not found` },
        });
        return;
      }

      reply.status(200).send({ link });
    },
  );

  // ── POST /v1/links/:code/click — Log a click event ──
  app.post(
    '/:code/click',
    async (
      request: FastifyRequest<{ Params: { code: string } }>,
      reply: FastifyReply,
    ) => {
      const { code } = request.params;
      const { ip, user_agent, referer, country, city } = request.body as {
        ip?: string;
        user_agent?: string;
        referer?: string;
        country?: string;
        city?: string;
      };

      // Find the link
      const { data: link } = await supabaseAdmin
        .from('link_spots')
        .select('id, affiliate_url, is_active')
        .eq('short_code', code)
        .single();

      if (!link) {
        reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Link "${code}" not found` },
        });
        return;
      }

      if (!link.is_active) {
        reply.status(410).send({
          error: { code: 'GONE', message: 'This link is no longer active' },
        });
        return;
      }

      // Insert click record
      const { error: clickErr } = await supabaseAdmin
        .from('link_clicks')
        .insert({
          link_spot_id: link.id,
          ip: ip ?? request.ip,
          user_agent: user_agent ?? (request.headers['user-agent'] || null),
          referer: referer ?? (request.headers['referer'] || null),
          country: country ?? null,
          city: city ?? null,
        });

      if (clickErr) {
        request.log.error({ error: clickErr }, 'Failed to log click');
      }

      // Increment click count
      await supabaseAdmin.rpc('increment_click_count', {
        link_id: link.id,
      }).then(({ error: rpcErr }) => {
        // Fallback: if RPC doesn't exist, do manual increment
        if (rpcErr) {
          return supabaseAdmin
            .from('link_spots')
            .update({ click_count: (link as any).click_count + 1 })
            .eq('id', link.id);
        }
      });

      reply.status(200).send({
        redirect_url: link.affiliate_url,
      });
    },
  );

  // ── GET /v1/links/:code/stats — Click stats ──
  app.get(
    '/:code/stats',
    async (
      request: FastifyRequest<{ Params: { code: string } }>,
      reply: FastifyReply,
    ) => {
      const { code } = request.params;

      const { data: link } = await supabaseAdmin
        .from('link_spots')
        .select('id, short_code, click_count, created_at')
        .eq('short_code', code)
        .single();

      if (!link) {
        reply.status(404).send({
          error: { code: 'NOT_FOUND', message: `Link "${code}" not found` },
        });
        return;
      }

      // Get recent clicks with aggregation
      const { data: clicks, error: clicksErr } = await supabaseAdmin
        .from('link_clicks')
        .select('ip, user_agent, referer, country, city, created_at')
        .eq('link_spot_id', link.id)
        .order('created_at', { ascending: false })
        .limit(100);

      // Aggregate by country
      const byCountry: Record<string, number> = {};
      for (const c of clicks ?? []) {
        const key = c.country || 'unknown';
        byCountry[key] = (byCountry[key] || 0) + 1;
      }

      // Aggregate by referer
      const byReferer: Record<string, number> = {};
      for (const c of clicks ?? []) {
        const key = c.referer || 'direct';
        byReferer[key] = (byReferer[key] || 0) + 1;
      }

      // Unique IPs (approximate unique visitors)
      const uniqueIps = new Set((clicks ?? []).map((c) => c.ip).filter(Boolean)).size;

      reply.status(200).send({
        short_code: link.short_code,
        total_clicks: link.click_count,
        unique_visitors: uniqueIps,
        by_country: byCountry,
        by_referer: byReferer,
        recent_clicks: (clicks ?? []).slice(0, 20),
        created_at: link.created_at,
      });
    },
  );
}
