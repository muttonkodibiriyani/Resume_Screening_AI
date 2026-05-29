# syntax=docker/dockerfile:1.7-labs
# Multi-stage build for Alshaya AI Recruit
# - Stage 1: deps      -> install only production dependencies in a cache-friendly layer
# - Stage 2: builder   -> compile Next.js (standalone) + generate Prisma client
# - Stage 3: runner    -> tiny non-root runtime image

ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- deps ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV NODE_ENV=development

# Install build tooling needed for native modules (bcrypt, pdf-parse, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

# ---------- builder ----------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Re-use installed node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Default to Postgres schema for production builds; SQLite for local.
ARG DATABASE_PROVIDER=postgresql
RUN if [ "$DATABASE_PROVIDER" = "postgresql" ]; then \
        cp prisma/schema.postgres.prisma prisma/schema.prisma; \
    fi

# Placeholder env values so `next build`'s server-side module evaluation
# passes the strict Zod validation in `src/lib/env.ts`. Real secrets are
# injected at container runtime via App Service / k8s / docker-compose.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_SECRET="build-time-placeholder-secret-please-rotate-1234567890" \
    AUTH_PROVIDER=local \
    STORAGE_PROVIDER=local \
    QUEUE_PROVIDER=memory

RUN npx prisma generate
RUN npm run build

# ---------- runner ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
        openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd  --system --uid 1001 --gid nodejs nextjs

# Standalone output already contains the trimmed node_modules tree.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/system/status || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
