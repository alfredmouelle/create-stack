# @alfredmouelle/jobs

Background jobs on [Inngest](https://www.inngest.com). Application code uses the
Inngest SDK directly. The package adds the framework-agnostic HTTP wiring that
the generated app mounts.

## Why the SDK stays visible

An earlier port modelled events (`trigger`) and single-event handlers
(`defineJob`). It left out the parts that make a job runner useful: durable
multi-step functions (`step.run`, `step.waitForEvent`), concurrency limits,
retries, cron triggers, fan-out, and typed event schemas.

The port became a lowest common denominator. Real code reached past it for
`adapter.client`, so it added a layer without hiding useful complexity. It also
froze a v3-era `createFunction(config, trigger, handler)` call behind a structural
mock. Unit tests stayed green while the generated code failed against Inngest v4.

Jobs now use the SDK. Moving to Trigger.dev would require rewriting handlers because
the two products have different execution models. A one-line provider swap would
not deliver that migration.

## Usage

Declare typed events once, then send and handle them.

```ts
// src/server/jobs/events.ts
import { eventType, staticSchema } from 'inngest'

export const userSignedUp = eventType('user/signed-up', {
  schema: staticSchema<{ userId: string }>(),
})
```

```ts
// src/server/jobs/index.ts, generated as the composition root
import { Inngest } from 'inngest'
import { env } from '~/env'

export const jobs = new Inngest({
  id: 'my-app',
  eventKey: env.INNGEST_EVENT_KEY,
  isDev: env.NODE_ENV === 'development',
})
```

```ts
// src/server/jobs/functions.ts
import { userSignedUp } from './events'
import { jobs } from './index'

export const sendWelcome = jobs.createFunction(
  { id: 'send-welcome', triggers: [{ event: userSignedUp }] },
  async ({ event, step }) => {
    // event.data is typed from the eventType, and step gives you durability
    await step.run('send', () => sendWelcomeEmail(event.data.userId))
  },
)

export const functions = [sendWelcome]
```

Send the event from anywhere. `create()` carries the event type through `send`:

```ts
import { userSignedUp } from '~/server/jobs/events'
import { jobs } from '~/server/jobs'

await jobs.send(userSignedUp.create({ userId: '123' }))
```

## Serving

Inngest invokes functions over HTTP. `jobsHandler` wraps Inngest's
framework-agnostic `edge` handler so the same handler works in either framework:

```ts
// src/server/jobs/serve.ts
import { jobsHandler } from './serve'
import { functions } from './functions'
import { jobs } from './index'

export const handler = jobsHandler({ client: jobs, functions })
```

```ts
// Next.js: src/app/api/inngest/route.ts
import { handler } from '~/server/jobs/serve'
export { handler as GET, handler as POST, handler as PUT }
```

```ts
// TanStack Start: src/routes/api/inngest.ts
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

Inngest uses `PUT` to sync the function list. Keep that route mounted.

## Signing key

`jobsHandler` takes no `signingKey`. Inngest v4 does not accept that option in
`serve()`. Put the key in `INNGEST_SIGNING_KEY`; the SDK reads it there.

## Env

| Variable | Purpose |
| --- | --- |
| `INNGEST_EVENT_KEY` | Sending events in production. |
| `INNGEST_SIGNING_KEY` | Authenticating Inngest's calls to your serve endpoint. |

## Testing jobs

Test the handler as a plain function. This matches what runs in production:

```ts
const result = await sendWelcome.fn({ event: userSignedUp.create({ userId: '1' }), step })
```

For an end-to-end run, start the Inngest dev server:

```bash
npx inngest-cli@latest dev
```
