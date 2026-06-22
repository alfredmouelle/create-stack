# syntax=docker/dockerfile:1
# Optimized multi-stage build for VPS deployment (TanStack Start + Nitro).
# `vite build` emits a self-contained Nitro server under .output/ (deps bundled),
# so the runner image carries only that — no node_modules, no dev deps.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- build (needs dev deps for vite/nitro) ----
FROM base AS build
COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
# Env is validated at runtime, not build — skip it so the build needs no secrets.
ENV SKIP_ENV_VALIDATION=1
RUN pnpm build

# ---- runner: just the Nitro output ----
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S tanstack
COPY --from=build --chown=tanstack:nodejs /app/.output ./.output
USER tanstack
EXPOSE 3000
ENV PORT=3000 HOST=0.0.0.0
CMD ["node", ".output/server/index.mjs"]
