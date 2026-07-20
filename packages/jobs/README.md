# @alfredmouelle/jobs

Background jobs on [Inngest](https://www.inngest.com), used **directly**. This is
not a port: there is no `JobsPort`, no adapter, no swappable provider. The only
thing vendored is the HTTP wiring, because that is the only part that is actually
reusable.

## Why there is no port here

There used to be one. It modelled events (`trigger`) and single-event handlers
(`defineJob`), and it deliberately excluded everything that makes a job runner
worth using: durable multi-step functions (`step.run`, `step.waitForEvent`),
concurrency limits, retries, cron triggers, fan-out, typed event schemas.

That made the port a lowest common denominator. Real code reached past it for
`adapter.client` on day one, so the seam cost a layer and bought nothing. Worse,
it froze a v3-era `createFunction(config, trigger, handler)` call behind a
structural mock, so the unit tests stayed green while the vendored code threw
against Inngest v4.

Jobs are now written against the SDK. You lose the ability to swap to Trigger.dev
by changing one line, which was never real anyway: the two products have
different execution models, and porting means rewriting the handlers regardless.

## Usage

Declare typed events once, then trigger and handle them.

```ts
// src/server/jobs/events.ts
import { eventType, staticSchema } from 'inngest'

export const userSignedUp = eventType('user/signed-up', {
  schema: staticSchema<{ userId: string }>(),
})
```

```ts
// src/server/jobs/index.ts, the composition root, generated for you
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

Trigger from anywhere. `create()` is what carries the types through `send`:

```ts
import { userSignedUp } from '~/server/jobs/events'
import { jobs } from '~/server/jobs'

await jobs.send(userSignedUp.create({ userId: '123' }))
```

## Serving

Inngest invokes your functions over HTTP. `jobsHandler` wraps Inngest's
framework-agnostic `edge` handler, so one handler mounts under either framework:

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

`PUT` is what Inngest calls to sync your function list, so do not drop it.

## Signing key

`jobsHandler` takes no `signingKey`, because `serve()` has no such option in
Inngest v4. It belongs on the client or, more usually, in `INNGEST_SIGNING_KEY`,
which the SDK reads on its own.

## Env

| Variable | Purpose |
| --- | --- |
| `INNGEST_EVENT_KEY` | Sending events in production. |
| `INNGEST_SIGNING_KEY` | Authenticating Inngest's calls to your serve endpoint. |

## Testing jobs

There is no `memory` adapter to swap in. Test the handler as the plain function
it is, which is both simpler and closer to what runs in production:

```ts
const result = await sendWelcome.fn({ event: userSignedUp.create({ userId: '1' }), step })
```

For an end-to-end run, the Inngest dev server executes your real functions
against the real runtime: `npx inngest-cli@latest dev`.
