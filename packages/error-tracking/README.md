# @alfredmouelle/error-tracking

Error reporting behind a tiny port. Capture exceptions, messages, breadcrumbs
and user context, then ship them to a provider; application code depends only
on the `ErrorTrackingPort`, never on the provider SDK.

## Usage

```ts
import { sentryAdapter } from '@alfredmouelle/error-tracking'

// composition root: pick the provider here, once
export const errors = sentryAdapter({
  dsn: process.env.SENTRY_DSN!,
  environment: process.env.SENTRY_ENVIRONMENT,
})

// anywhere in the app: depends only on the ErrorTrackingPort
try {
  await risky()
} catch (err) {
  errors.captureException(err, { tags: { feature: 'checkout' } })
}

errors.setUser({ id: 'user-123', email: 'user@example.com' })
errors.addBreadcrumb({ message: 'cart opened', category: 'ui' })
```

## Swapping provider

Use the console adapter in dev/tests (no SDK, no network):

```ts
import { consoleAdapter } from '@alfredmouelle/error-tracking'

export const errors = consoleAdapter()
```

No call site changes: they all depend on `ErrorTrackingPort`.

## Adding a provider

Implement `ErrorTrackingPort` (`src/core/port.ts`): a `name` plus
`captureException`, `captureMessage`, `setUser`, `addBreadcrumb` and `flush`.
Look at `src/adapters/sentry` (SDK-based) as a template.
