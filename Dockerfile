# syntax=docker/dockerfile:1
#
# HOOHR - Next.js app image.
# Referenced by the `app` service in docker-compose.yml.
#
# Multi-stage: the builder keeps devDependencies (TypeScript, Prisma CLI) and the
# runner ships only production dependencies, so the final image stays small.

# ---------- deps ----------
FROM node:24-alpine AS deps
WORKDIR /app
# openssl is what Prisma's query engine needs on alpine
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci

# ---------- builder ----------
FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time placeholders only - never real credentials, and not present in the
# runner stage. Two things load them at import time:
#   * prisma.config.ts calls env("DATABASE_URL"), which throws even for
#     `prisma generate` (no connection is made, the value is never used)
#   * src/lib/session.ts throws at module scope when AUTH_SECRET is missing
# Real values are injected into the running container by docker-compose.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder-not-a-real-secret"
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---------- runner ----------
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache openssl

# Receipt images are stored on the uploads volume (see src/lib/storage.ts).
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/prisma ./prisma
# prisma/seed.ts runs inside this image (docker/entrypoint.sh) and imports from
# ../src, so those two trees have to exist at runtime. `src/generated` is the
# Prisma client (1.7MB, already produced by `prisma generate` in the builder).
# `src/lib` is what the seed reads its country table from - without it the seed
# dies with MODULE_NOT_FOUND, and because the entrypoint only warns on seed
# failure, a *fresh* install then comes up with no admin account at all.
COPY --from=builder --chown=node:node /app/src/generated ./src/generated
COPY --from=builder --chown=node:node /app/src/lib ./src/lib
# prisma.config.ts is the CLI's entry point for both `migrate deploy` and
# `db seed`; without it the entrypoint's Prisma commands have no seed command
# and no datasource url. It must ship in the runner, not just the builder.
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=node:node /app/docker ./docker

USER node
EXPOSE 3000
# Migrate + seed on every boot, then serve. Both steps are idempotent.
CMD ["sh", "docker/entrypoint.sh"]
