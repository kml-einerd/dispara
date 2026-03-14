# API — Padroes e Convencoes

## Estrutura
- `src/modules/<dominio>/` — cada dominio tem suas rotas, schemas e servicos
- `src/middleware/` — tenant isolation, usage gate, error handler
- `src/plugins/` — plugins Fastify (auth, websocket, etc.)
- `src/lib/` — utilitarios internos
- `prisma/schema.prisma` — schema unico do banco

## Como Adicionar uma Nova Rota
1. Criar ou editar modulo em `src/modules/<dominio>/`
2. Exportar function plugin: `export async function xxxRoutes(app: FastifyInstance)`
3. Definir schemas Zod no mesmo modulo para request/response validation
4. Parsear schema no handler (nunca confiar no input sem validacao)
5. SEMPRE usar `req.tenantId` para scoping — nunca aceitar tenant_id do body/params

## Autenticacao
- Supabase Auth via Bearer token no header `Authorization`
- `tenantMiddleware` extrai token → valida → busca User → seta `req.tenantId`
- Dev mode: header `x-tenant-id` como fallback (sem validacao de token)
- Auto-provisioning: primeiro login cria Tenant + User automaticamente

## WebSocket
- Subscribe via JSON: `{type: "subscribe", channel: "wa:qr:xxx"}`
- Canais seguem padrao: `<dominio>:<evento>:<id>`

## Filas (BullMQ)
- `dispatch-queue` — envio normal (respeitando janela + warmup)
- `dispatch-priority-queue` — envio imediato
- `dispatch-dlq` — dead letter para falhas permanentes

## Banco de Dados
- Prisma 6 com PostgreSQL (Supabase)
- Columns: `snake_case` no DB, mapeados via `@@map` para `camelCase` no TS
- Migrations: `npm run db:migrate` na raiz
- Generate: `npm run db:generate` na raiz

## Logging
- Pino (via Fastify built-in) — nunca `console.log`
- Structured JSON em producao

## Testes
- `src/__tests__/` — Vitest
- Rodar: `npx turbo run test --filter=@dispara/api`
