# Dispara v2

## Stack
- Monorepo: Turborepo + npm workspaces
- Backend: Fastify 5 + Prisma 6 + PostgreSQL 17
- Frontend: Next.js 15 + React 19 + Tailwind CSS 4
- Queue: BullMQ 5 + Redis 7
- WhatsApp: Baileys (whiskeysockets/baileys) — protocol nativo, sem browser
- AI: OpenRouter (multi-model, formato OpenAI) — default: anthropic/claude-haiku-4-5-20251001
- Auth: Supabase Auth (Google OAuth) — x-tenant-id header fallback in dev mode

## Conventions
- ESM only (type: "module")
- TypeScript strict mode
- Zod for runtime validation on API boundaries
- Pino for structured logging (never console.log)
- Multi-tenant: every query MUST scope by tenant_id
- Tests: Vitest — 80% coverage minimum on dispatch services
- Naming: camelCase (TS), snake_case (DB columns via @@map)
- Errors: never catch-all retry. Specific error classes for transient vs permanent failures
- Circuit breaker: per-session, 3 failures in 5min = pause 1h
- Anti-bloqueio: every WA message MUST have unique hash (spintax + zero-width chars)
- Dispatch windows: 09-12h + 14-18h BRT only. Never send outside.
- Warm-up: new numbers start at 10 msgs/day, ramp over 30 days

## Package Structure
- apps/api: Fastify REST API + WebSocket gateway
- apps/web: Next.js dashboard (App Router)
- packages/shared: types, constants (queues, warmup schedule, dispatch windows)
- packages/wa-manager: Baileys wrapper (session lifecycle, QR, typing simulation)
- packages/dispatch-engine: anti-bloqueio (spintax, gaussian delay, circuit breaker, warmup, number pool)
- workers/dispatch-worker: BullMQ worker (1 job = 1 message to 1 group)

## API Patterns
- Routes use Fastify plugin pattern (export async function xxxRoutes(app))
- Request validation: Zod schemas in schema.ts, parsed in route handler
- Tenant isolation: tenantMiddleware validates Supabase token → looks up User.externalAuthId → sets tenantId
- Auth: POST /v1/auth/callback auto-provisions tenant+user on first Google login
- WebSocket: subscribe to channels via JSON messages {type: "subscribe", channel: "wa:qr:xxx"}
- Queue: dispatch-queue (normal), dispatch-priority-queue (immediate), dispatch-dlq (dead letter)
- LLM calls: fetch direto para OpenRouter API (https://openrouter.ai/api/v1/chat/completions)

## Key Files
- apps/api/prisma/schema.prisma: all DB models
- packages/shared/src/index.ts: shared constants and types
- packages/dispatch-engine/src/spintax.ts: message variation engine
- packages/wa-manager/src/session-manager.ts: Baileys session lifecycle
