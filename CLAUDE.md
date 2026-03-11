# PromoSpot v2

## Stack
- Monorepo: Turborepo + npm workspaces
- Backend: Fastify 5 + Prisma 6 + PostgreSQL 17
- Frontend: Next.js 15 + React 19 + Tailwind CSS 4
- Queue: BullMQ 5 + Redis 7
- AI: Claude Haiku (copy gen) via @anthropic-ai/sdk
- Auth: Supabase Auth

## Conventions
- ESM only (type: "module")
- TypeScript strict mode
- Zod for runtime validation
- Pino for structured logging
- Multi-tenant: every query scoped by tenant_id (RLS)
- Tests: Vitest
- Naming: camelCase (TS), snake_case (DB columns via @@map)

## Package Structure
- apps/api: Fastify REST API
- apps/web: Next.js dashboard
- packages/shared: types, utils, constants
- packages/db: Prisma client + tenant context
- packages/marketplace: marketplace adapters (Amazon, Shopee, Lomadee)
- packages/promo-engine: IA pipeline (copy gen + orchestration)
