# @alfredmouelle/error-tracking

Error tracking on [Sentry](https://sentry.io), wired the way Sentry documents it.
This is not a port: there is no `ErrorTrackingPort`, no adapter. App code calls
`Sentry.captureException` directly.

## Why there is no port here

The port used to expose `captureException`, `captureMessage`, `setUser`,
`addBreadcrumb` and `flush`, with a `console` adapter as the alternative
provider. That framing had the abstraction backwards: almost none of Sentry's
value flows through those five methods.

What a `captureException` wrapper structurally cannot give you:

- **Server Component, middleware and proxy errors** (`onRequestError`). Next.js
  swallows these and renders the error boundary. No application `try/catch` sees
  them.
- **React root render errors** (`app/global-error.tsx`).
- **TanStack server errors** (`wrapFetchWithSentry`, the request and function
  middlewares), which fire outside your code.
- **Auto-instrumentation and tracing.** Requires Sentry to initialise *before*
  the app loads (`--import ./instrument.server.mjs`, or Next's
  `instrumentation.ts`). A helper imported partway through your module graph is
  structurally too late.
- **Source maps.** Build-time upload via `withSentryConfig` /
  `sentryTanstackStart`. Without them, production stack traces are minified noise.
- **Per-request scope isolation.** Without the real setup, user and tag context
  leaks between concurrent requests.
- **Uncaught exceptions and unhandled rejections**, caught by the default
  integrations. A port only ever sees what you hand it.

And the `console` adapter was never a provider you would switch to in production,
so the swap the port existed to enable was not a real one.

## What this module is

One thing: `sentryOptions`, which builds the `Sentry.init` options shared by
every runtime (Node, edge, browser) so they cannot drift apart.

```ts
import { sentryOptions } from '~/server/error-tracking'
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  ...sentryOptions({ dsn: process.env.SENTRY_DSN, nodeEnv: process.env.NODE_ENV }),
  // runtime-specific options stay here
  integrations: [Sentry.replayIntegration()],
})
```

It resolves the environment, defaults the trace sample rate (everything in
development, 10% elsewhere), enables structured logs, and, importantly, sets
`enabled: false` when there is no DSN, so a checkout without `SENTRY_DSN` runs
fine instead of failing.

Everything else is the SDK, called directly:

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
