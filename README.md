# Dispara v2

Sistema SaaS para geracao e disparo automatizado de anuncios de afiliados via WhatsApp e Telegram.

## Stack

- **Runtime**: Node.js 22, TypeScript 5.7
- **Backend**: Fastify 5, Prisma 6, PostgreSQL (Supabase)
- **Frontend**: React 19, Vite 6, Tailwind CSS 4, Radix UI
- **Queue**: BullMQ + Redis
- **WhatsApp**: Baileys (whiskeysockets)
- **AI**: OpenRouter (Claude), Gemini (image gen)
- **Monorepo**: Turborepo + npm workspaces

## Estrutura

```
apps/
  api/              — API Fastify (rotas, auth, middleware)
  web/              — Frontend React SPA (Vite)
packages/
  shared/           — Types e utilitarios compartilhados
  db/               — Prisma client
  agent-engine/     — Classificador de intent, RAG, responder
  dispatch-engine/  — Anti-bloqueio: spintax, warmup, circuit breaker
  marketplace/      — Adapters Shopee, Mercado Livre, Amazon, Lomadee
  promo-engine/     — Copy generator (5 tons) + image generator
  wa-manager/       — Baileys wrapper (sessions, QR, envio)
  telegram/         — Grammy bot
workers/
  dispatch-worker/  — BullMQ worker de envio com DLQ
```

## Setup

### Pre-requisitos
- Node.js 22+
- Redis (local ou Docker)
- PostgreSQL (Supabase recomendado)

### Instalacao
```bash
git clone https://github.com/kml-einerd/dispara.git
cd dispara
cp .env.example .env        # Preencher com suas chaves
cp apps/api/.env.example apps/api/.env
npm install
npm run db:generate
npm run db:migrate
```

### Desenvolvimento
```bash
npx turbo run dev          # API + Frontend + Hot reload
# ou individualmente:
npx turbo run dev --filter=@dispara/api
npx turbo run dev --filter=@dispara/web
```

### Build
```bash
npx turbo run build        # Todos os packages
```

### Testes
```bash
npx turbo run test         # Todos os testes
```

## Variaveis de Ambiente

Ver `.env.example` na raiz e `apps/api/.env.example` para a lista completa.

### Raiz (.env.example)
| Variavel | Descricao |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `REDIS_URL` | Redis connection string |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave anonima Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de servico Supabase |
| `OPENROUTER_API_KEY` | AI — copy generation |
| `ML_CLIENT_ID` / `ML_CLIENT_SECRET` | OAuth Mercado Livre |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth |
| `CLOUDFLARE_ACCOUNT_ID` / `R2_BUCKET` | Cloudflare R2 storage |
| `GITHUB_TOKEN` | Deploy automation |
| `WA_SESSION_DIR` | Diretorio de sessoes WhatsApp |
| `API_PORT` | Porta da API (default: 3001) |
| `FRONTEND_URL` | URL do frontend (default: http://localhost:5173) |

### API (apps/api/.env.example)
| Variavel | Descricao |
|---|---|
| `ANTHROPIC_API_KEY` | Chamadas diretas Claude |
| `GEMINI_API_KEY` | Geracao de imagens |
| `R2_PUBLIC_URL` | URL publica do bucket R2 |

## Deploy

- **Backend**: Docker → Hetzner (ver `Dockerfile` e `docker-compose.prod.yml`)
- **Frontend**: Vercel (ver `apps/web/`)
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`, `deploy-api.yml`, `deploy-web.yml`)

## Licenca

Proprietario — NoWork / contato@nowork.com.br
