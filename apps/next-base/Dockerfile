# syntax=docker/dockerfile:1
# Optimized multi-stage build for VPS deployment (Next.js standalone output).
# Build context = this app (fork it out of the monorepo, or build with this dir
# as context). Final image runs the standalone server with no dev deps.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install with a cached store ----
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Env is validated at runtime, not build — skip it so the build needs no secrets.
ENV NEXT_TELEMETRY_DISABLED=1 SKIP_ENV_VALIDATION=1
RUN pnpm build

# ---- runner: minimal standalone image ----
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
