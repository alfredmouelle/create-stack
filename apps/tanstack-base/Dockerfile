# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
ENV SKIP_ENV_VALIDATION=1
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S tanstack
COPY --from=build --chown=tanstack:nodejs /app/.output ./.output
USER tanstack
EXPOSE 3000
ENV PORT=3000 HOST=0.0.0.0
CMD ["node", ".output/server/index.mjs"]
