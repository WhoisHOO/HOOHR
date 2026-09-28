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

USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
