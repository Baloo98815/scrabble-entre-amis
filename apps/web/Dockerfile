# Build context = racine du monorepo (nécessaire pour accéder à packages/shared).
# docker build -f apps/web/Dockerfile -t scrabble-web .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

FROM base AS builder
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @scrabble/shared build
RUN pnpm --filter @scrabble/web build

FROM nginx:alpine AS runtime
COPY --from=builder /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
