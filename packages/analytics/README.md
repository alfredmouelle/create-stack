# @alfredmouelle/analytics

Product analytics through one port. Capture events and identify users through an
adapter while application code depends only on `AnalyticsPort`.

## Usage

```ts
import { posthogAdapter } from '@alfredmouelle/analytics'

// Choose the provider in the composition root.
export const analytics = posthogAdapter({
  apiKey: process.env.POSTHOG_API_KEY!,
  host: process.env.POSTHOG_HOST,
})

// Application code depends only on AnalyticsPort.
analytics.capture({
  event: 'user_signed_up',
  distinctId: 'user_123',
  properties: { plan: 'pro' },
})

analytics.identify({ distinctId: 'user_123', properties: { email: 'a@acme.com' } })

// before the process exits
await analytics.shutdown()
```

`capture` and `identify` enqueue work and return immediately, matching the
PostHog SDK. Call `flush()` to drain pending events. Call `shutdown()` to flush
and release resources.

## Swapping provider: Plausible

Use the Plausible adapter with its server-side Events API. Set the site domain.
The page `url`, `referrer`, and client `ip` come from each event's `properties`:

```ts
import { plausibleAdapter } from '@alfredmouelle/analytics'

export const analytics = plausibleAdapter({ domain: process.env.PLAUSIBLE_DOMAIN! })

analytics.capture({
  event: 'user_signed_up',
  distinctId: 'user_123',
  properties: { plan: 'pro', url: 'https://acme.com/signup', ip: req.ip },
})
```

Plausible uses no cookies and stores no person profiles. `identify` is therefore
a no-op, and `distinctId` is forwarded only as a `distinct_id` custom property.

## Disabling analytics

Use the `noop` adapter in development, tests, or when analytics is off:

```ts
import { noopAdapter } from '@alfredmouelle/analytics'

export const analytics = noopAdapter()
```

Call sites stay on `AnalyticsPort`.

## Adding a provider

Implement `AnalyticsPort` in `src/port.ts` with `name`, `capture`, `identify`,
`flush`, and `shutdown`. Use `src/adapters/posthog` as the SDK-based reference.
