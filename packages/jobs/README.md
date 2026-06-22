# @alfredmouelle/jobs

Background jobs / events behind a tiny, event-driven port. Define jobs against
named events and `trigger` them; the adapter handles delivery and execution.
Swap providers without touching call sites.

## Usage

```ts
import { inngestAdapter } from '@alfredmouelle/jobs'

// composition root — pick the provider here, once
export const jobs = inngestAdapter({
  id: 'my-app',
  eventKey: process.env.INNGEST_EVENT_KEY,
})

// register jobs (collected on the adapter for serving)
jobs.defineJob<{ userId: string }>({
  id: 'send-welcome',
  event: 'user/created',
  handler: async ({ data }) => {
    await sendWelcomeEmail(data.userId)
  },
})

// anywhere in the app — depends only on the JobsPort
await jobs.trigger({ name: 'user/created', data: { userId: '123' } })
```

### Serving (Inngest)

Inngest invokes your functions over HTTP. Wire the collected `functions` into a
Web-standard `FetchHandler` and mount it in your framework:

```ts
import { serve } from 'inngest/edge'
import { inngestServeHandler } from '@alfredmouelle/jobs'

// FetchHandler: Request -> Response, mountable in Next.js or TanStack Start
export const handler = inngestServeHandler(jobs, serve, {
  signingKey: process.env.INNGEST_SIGNING_KEY,
})
```

The same `FetchHandler` mounts unchanged in either framework — only the route
shim differs. This is the canonical wiring (no demo app needed):

```ts
// Next.js — src/app/api/inngest/route.ts
import { handler } from '~/server/jobs/serve'
export const GET = handler
export const POST = handler
export const PUT = handler
```

```ts
// TanStack Start — src/routes/api/inngest.ts
import { createFileRoute } from '@tanstack/react-router'
import { handler } from '~/server/jobs/serve'

export const Route = createFileRoute('/api/inngest')({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
      PUT: ({ request }) => handler(request),
    },
  },
})
```

### Trigger.dev

Swap the composition root to the `trigger` adapter. Each `defineJob` becomes a
Trigger.dev task; `trigger` fans an event out to every task subscribed to it.

```ts
import { triggerDevAdapter } from '@alfredmouelle/jobs'

export const jobs = triggerDevAdapter({
  secretKey: process.env.TRIGGER_SECRET_KEY,
})

jobs.defineJob<{ userId: string }>({
  id: 'send-welcome',
  event: 'user/created',
  handler: async ({ data }) => sendWelcomeEmail(data.userId),
})

await jobs.trigger({ name: 'user/created', data: { userId: '123' } })
```

Trigger.dev discovers tasks by scanning the `dirs` in `trigger.config.ts`.
Re-export the collected tasks from a file inside one of those dirs so the CLI
picks them up:

```ts
// src/trigger/index.ts
import { jobs } from '../server/jobs'
export const tasks = jobs.tasks
```

## Dev & tests

Use the in-process `memoryAdapter` to run job logic synchronously, no network:

```ts
import { memoryAdapter } from '@alfredmouelle/jobs'

const jobs = memoryAdapter()
jobs.defineJob({ id: 'x', event: 'user/created', handler })
await jobs.trigger({ name: 'user/created', data: { userId: '1' } }) // runs handler inline
```

## The abstraction leak

This is the leakiest capability in the stack, and the port is deliberately
minimal about it. `JobsPort` models only **events** (`trigger`) and
**single-event handlers** (`defineJob`). Inngest's real model is far richer:
multi-step durable functions (`step.run`, `step.waitForEvent`), concurrency
limits, retries, cron triggers, fan-out, and typed event schemas.

None of that is in the port — by design. Keeping the port tiny is what makes it
swappable (the `memory` adapter is ~30 lines). When you need real Inngest
features, **reach for the SDK directly** via `adapter.client` rather than
widening the port. Treat `@alfredmouelle/jobs` as the seam for the simple 80% case; drop
to Inngest for the powerful 20%.

## Adding a provider

Implement `JobsPort` (`src/core/port.ts`): a `name`, `defineJob`, and `trigger`.
Look at `src/adapters/inngest` (SDK-based) or `src/adapters/memory` (in-process)
as templates.
