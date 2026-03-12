FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY workers/dispatch-worker/package.json ./workers/dispatch-worker/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/dispatch-engine/package.json ./packages/dispatch-engine/
COPY packages/agent-engine/package.json ./packages/agent-engine/
COPY packages/promo-engine/package.json ./packages/promo-engine/
COPY packages/marketplace/package.json ./packages/marketplace/
COPY packages/telegram/package.json ./packages/telegram/
COPY packages/wa-manager/package.json ./packages/wa-manager/
RUN npm ci

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npx turbo run build --filter=@dispara/api... --filter=@dispara/dispatch-worker...

# Prune dev deps for production
RUN npm prune --omit=dev

# Production
FROM base AS runner
# NODE_ENV is set via env_file in docker-compose, not hardcoded here
# Default to production but allow override via environment
RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=app:app /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=app:app /app/workers/dispatch-worker/dist ./workers/dispatch-worker/dist
COPY --from=builder --chown=app:app /app/workers/dispatch-worker/package.json ./workers/dispatch-worker/
COPY --from=builder --chown=app:app /app/packages ./packages
COPY --from=builder --chown=app:app /app/package.json ./

USER app
EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
