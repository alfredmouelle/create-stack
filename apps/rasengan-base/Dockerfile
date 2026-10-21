FROM node:24.19.0-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
ENV SKIP_ENV_VALIDATION=1
RUN if [ -f pnpm-lock.yaml ]; then corepack pnpm@11.1.3 install --frozen-lockfile && corepack pnpm@11.1.3 run build; \
    elif [ -f package-lock.json ]; then npm ci && npm run build; \
    elif [ -f yarn.lock ]; then corepack yarn@4.18.1 install --immutable && corepack yarn@4.18.1 run build; \
    elif [ -f bun.lock ] || [ -f bun.lockb ]; then npx --yes bun@1.2.0 install --frozen-lockfile && npx --yes bun@1.2.0 run build; \
    else echo "Install dependencies and commit the package manager lockfile before building the image" >&2; exit 1; fi

FROM node:24.19.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/scripts/start.ts ./scripts/start.ts
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "scripts/start.ts"]
