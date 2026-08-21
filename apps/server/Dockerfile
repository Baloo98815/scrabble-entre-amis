# Build context = racine du monorepo (nécessaire pour accéder à packages/shared).
# docker build -f apps/server/Dockerfile -t scrabble-server .

FROM node:20-alpine AS base
# Prisma a besoin d'OpenSSL pour son moteur de requêtes ; les images Alpine récentes ne
# l'incluent plus par défaut (sinon : "Prisma failed to detect the libssl/openssl version").
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

FROM base AS builder
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @scrabble/shared build
RUN pnpm --filter @scrabble/server build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
# On copie tout l'espace de travail construit (node_modules avec les liens pnpm inclus) :
# plus simple et plus fiable qu'un pruning fin vu la structure en symlinks de pnpm.
COPY --from=builder /repo /repo
WORKDIR /repo/apps/server

EXPOSE 3000
# Appelle directement le binaire (pas de `pnpm exec`) : évite que corepack ne tente de
# retélécharger pnpm au démarrage du conteneur si sa version n'est pas déjà mise en cache.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]
