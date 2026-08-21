# @alfredmouelle/error-tracking

Error tracking on [Sentry](https://sentry.io), using Sentry's framework setup.
The package exports shared initialization options. Application code calls the
Sentry SDK directly.

## Why Sentry stays visible

The old port exposed `captureException`, `captureMessage`, `setUser`,
`addBreadcrumb`, and `flush`, with a `console` adapter as the alternative
provider. That abstraction covered only a small part of Sentry's value.

The setup also needs to cover errors and work that a `captureException` wrapper
cannot see:

- **Server Component, middleware, and proxy errors** (`onRequestError`). Next.js
  handles these outside application `try/catch` blocks.
- **React root render errors** (`app/global-error.tsx`).
- **TanStack server errors** (`wrapFetchWithSentry`, request middleware, and
  function middleware), which fire outside application code.
- **Auto-instrumentation and tracing.** Sentry must initialize *before* the app
  loads, through `--import ./instrument.server.mjs` or Next's `instrumentation.ts`.
  A helper imported later in the module graph is too late.
- **Source maps.** Build-time upload via `withSentryConfig` /
  `sentryTanstackStart`. Without them, production stack traces are minified noise.
- **Per-request scope isolation.** The framework setup keeps user and tag context
  separate across concurrent requests.
- **Uncaught exceptions and unhandled rejections**, which Sentry's default
  integrations capture. A port sees only the errors application code hands it.

The `console` adapter also was not a production provider. Swapping it for Sentry
did not represent a real deployment choice.

## What this package exports

`sentryOptions` builds the `Sentry.init` options shared by Node, edge, and browser
runtimes, so those configurations stay aligned.

```ts
import { sentryOptions } from '~/server/error-tracking'
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  ...sentryOptions({ dsn: process.env.SENTRY_DSN, nodeEnv: process.env.NODE_ENV }),
  // runtime-specific options stay here
  integrations: [Sentry.replayIntegration()],
})
```

It reads the environment, samples every trace in development and 10% elsewhere,
enables structured logs, and sets `enabled: false` when `SENTRY_DSN` is absent.
That lets a checkout without Sentry credentials run normally.

Use the SDK directly for the rest:

```ts
import * as Sentry from '@sentry/nextjs'

Sentry.captureException(error, { tags: { area: 'billing' } })
Sentry.setUser({ id: user.id })
```

## Wiring

The generator writes the framework files for you. They follow Sentry's current
manual-setup guides:

- **Next.js**: `instrumentation.ts` (with `onRequestError`),
  `sentry.server.config.ts`, `sentry.edge.config.ts`,
  `instrumentation-client.ts` (with `onRouterTransitionStart`),
  `app/global-error.tsx`, and `withSentryConfig` in `next.config.ts`.
- **TanStack Start**: `sentryTanstackStart` in `vite.config.ts` (last plugin),
  `src/instrument.client.tsx`, `instrument.server.mjs`, `wrapFetchWithSentry` in
  `src/server.ts`, and the Sentry middlewares in `src/start.ts`.

## Env

| Variable | Purpose |
| --- | --- |
| `SENTRY_DSN` | Where events go. Absent means Sentry stays off. |
| `SENTRY_ENVIRONMENT` | Environment tag. Falls back to `NODE_ENV`. |
| `SENTRY_AUTH_TOKEN` | Build-time only, for source-map upload. |
