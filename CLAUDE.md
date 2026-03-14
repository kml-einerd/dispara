# Dispara v2 — Padroes e Convencoes

## Stack
- Monorepo: Turborepo + npm workspaces
- Backend: Fastify 5 + Prisma 6 + PostgreSQL 17 (Supabase)
- Frontend: Vite 6 + React 19 + Tailwind CSS 4 + Radix UI
- Queue: BullMQ 5 + Redis 7
- WhatsApp: Baileys (whiskeysockets/baileys) — protocolo nativo, sem browser
- AI: OpenRouter (multi-model) — default: claude-haiku
- Auth: Supabase Auth (Google OAuth) — x-tenant-id header fallback in dev mode

## Convencoes Globais
- ESM only (`"type": "module"` em todos os packages)
- TypeScript strict mode
- Zod para validacao runtime nas fronteiras da API
- Pino para logging estruturado (nunca `console.log`)
- Naming: `camelCase` (TS), `snake_case` (colunas DB via `@@map`)
- Erros: classes especificas para transient vs permanent — nunca catch-all retry

## Multi-Tenancy
- Toda query ao banco DEVE ter scope por `tenant_id`
- Middleware `tenant.ts` valida token Supabase → busca `User.externalAuthId` → seta `tenantId`
- POST `/v1/auth/callback` auto-provisiona tenant+user no primeiro login Google
- Em dev mode, header `x-tenant-id` funciona como fallback

## Pipeline de Dispatch
1. Usuario cria promo → `promo-engine` gera copy (5 tons) + imagem
2. Dispatch criado com grupos-alvo → entra na fila `dispatch-queue` (ou `dispatch-priority-queue`)
3. `dispatch-worker` consome job: 1 job = 1 mensagem para 1 grupo
4. `dispatch-engine` aplica anti-bloqueio: spintax, gaussian delay, zero-width chars
5. `wa-manager` envia via Baileys com typing simulation
6. Circuit breaker: 3 falhas em 5min por sessao = pausa 1h
7. Dead letter queue (`dispatch-dlq`) para falhas permanentes

### Regras de Envio
- Janela: 09-12h + 14-18h BRT apenas. Nunca fora.
- Warm-up: numeros novos comecam com 10 msgs/dia, ramp over 30 dias
- Toda mensagem DEVE ter hash unico (spintax + zero-width chars)

## Como Adicionar um Novo Package
1. Criar diretorio em `packages/<nome>/`
2. `package.json` com name `@dispara/<nome>`, `"type": "module"`
3. `tsconfig.json` extendendo `../../tsconfig.base.json`
4. Registrar no `turbo.json` se tiver tasks customizadas
5. Importar de outros packages via `@dispara/<nome>`

## Como Adicionar um Marketplace Adapter
1. Criar arquivo em `packages/marketplace/src/adapters/<nome>.ts`
2. Implementar interface definida em `packages/marketplace/src/types.ts`
3. Registrar no factory em `packages/marketplace/src/factory.ts`
4. Adapters existentes: `shopee`, `mercadolivre`, `amazon`, `lomadee`

## Estrutura de Rotas (API)
- Organizadas por modulo em `apps/api/src/modules/<dominio>/`
- Cada modulo e um Fastify plugin: `export async function xxxRoutes(app)`
- Schemas Zod em arquivo separado dentro do modulo
- Modulos: `auth`, `agent`, `commissions`, `dispatches`, `feeds`, `gate`, `groups`, `health`, `links`, `oauth`, `promos`, `telegram`, `wa-sessions`, `webhooks`

## Middleware
- `tenant.ts` — isolamento multi-tenant (obrigatorio em todas as rotas autenticadas)
- `usage-gate.ts` — controle de limites de uso por plano
- `error-handler.ts` — tratamento centralizado de erros

## Testes
- Framework: Vitest
- 80% coverage minimo em dispatch services
- Testes em `__tests__/` dentro de cada package/app
- `npx turbo run test` para rodar tudo

## Arquivos Chave
- `apps/api/prisma/schema.prisma` — todos os modelos DB
- `packages/shared/src/index.ts` — constantes e types compartilhados
- `packages/dispatch-engine/src/spintax.ts` — motor de variacao de mensagens
- `packages/wa-manager/src/session-manager.ts` — lifecycle de sessoes Baileys
