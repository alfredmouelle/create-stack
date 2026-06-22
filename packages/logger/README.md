# @stack/logger

Structured logging behind a tiny port. Application code logs against the
`Logger` interface; the backend (pino, console) is chosen once at the
composition root and never leaks into call sites.

## Usage

```ts
import { pinoAdapter } from '@stack/logger'

// composition root — pick the backend here, once
export const logger = pinoAdapter({ level: 'info', bindings: { app: 'web' } })

// anywhere in the app — depends only on the Logger port
logger.info('user signed in', { userId: '42' })

// pin context for a request / job
const reqLog = logger.child({ requestId: 'abc' })
reqLog.error('payment failed', { orderId: '7' })
```

## Swapping backend

Change one line in the composition root:

```ts
import { consoleAdapter } from '@stack/logger'

export const logger = consoleAdapter({ level: 'debug' })
```

No call-site changes — they all depend on `Logger`, never on a backend.

## Adding a backend

Implement `Logger` (`src/core/port.ts`): a `name`, the five level methods
`(msg, fields?)`, and `child(bindings)`. Look at `src/adapters/pino`
(SDK-based) or `src/adapters/console` (pure) as templates.
