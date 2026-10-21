# Rasengan reference application

RasenganJS preview on Node, pinned to `rasengan@2.0.0-beta.5` and `@rasenganjs/runtime@1.0.0-beta.5`.

Configure `.env.local` with `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and `RESEND_API_KEY`. Optional Google authentication requires both Google credentials.

Run `pnpm dev`, `pnpm typecheck`, `pnpm check`, and `pnpm test`. Production uses `pnpm build` followed by `pnpm start`. Set `PORT` and `HOST` on the host.

The application-owned Node server serves only `dist/client` and `public`. Deploy `dist`, `public`, `scripts/start.ts`, `package.json`, and installed production dependencies together. The unmodified `@rasenganjs/serve@2.0.0-beta.2` exposes compiled server files in SSR mode.

Page loaders use same-origin HTTP for session data. Import private environment, database and authentication modules only from API routes. Rasengan does not enforce a server-only loader boundary.

Better Auth endpoints use one or two segments under `/api/auth`, including `/callback/google`, `/verify-email`, `/reset-password`, and `/get-session`. Additional auth plugins can require other routes.

Mail providers, Clerk, Convex and Sentry require their service credentials. Local checks do not establish delivery or hosted-service behavior without those credentials.
