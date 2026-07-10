# @alfredmouelle/analytics

Product analytics behind a tiny port. Capture events and identify users through
a swappable adapter; application code depends only on `AnalyticsPort`, never on
a provider.

## Usage

```ts
import { posthogAdapter } from '@alfredmouelle/analytics'

// composition root: pick the provider here, once
export const analytics = posthogAdapter({
  apiKey: process.env.POSTHOG_API_KEY!,
  host: process.env.POSTHOG_HOST,
})

// anywhere in the app: depends only on the AnalyticsPort
analytics.capture({
  event: 'user_signed_up',
  distinctId: 'user_123',
  properties: { plan: 'pro' },
})

analytics.identify({ distinctId: 'user_123', properties: { email: 'a@acme.com' } })

// before the process exits
await analytics.shutdown()
```

`capture` and `identify` are fire-and-forget (like the PostHog SDK): they
enqueue work and return immediately. Use `flush()` to drain pending events and
`shutdown()` to flush + release resources.

## Swapping provider: Plausible

Use the privacy-first Plausible adapter (server-side Events API). Set the site
domain; the page `url`, `referrer` and client `ip` are read from each event's
`properties`:

```ts
import { plausibleAdapter } from '@alfredmouelle/analytics'

export const analytics = plausibleAdapter({ domain: process.env.PLAUSIBLE_DOMAIN! })

analytics.capture({
  event: 'user_signed_up',
  distinctId: 'user_123',
  properties: { plan: 'pro', url: 'https://acme.com/signup', ip: req.ip },
})
```

Plausible is cookieless and stores no person profiles, so `identify` is a no-op
and `distinctId` is forwarded only as a `distinct_id` custom property.

## Disabling analytics

Use the `noop` adapter in development, tests, or when analytics is off:

```ts
import { noopAdapter } from '@alfredmouelle/analytics'

export const analytics = noopAdapter()
```

No call site changes: they all depend on `AnalyticsPort`.

## Adding a provider

Implement `AnalyticsPort` (`src/core/port.ts`): a `name`, `capture`, `identify`,
`flush`, and `shutdown`. Look at `src/adapters/posthog` (SDK-based) as a template.
