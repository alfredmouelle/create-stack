# @alfredmouelle/logger

Structured logging through one port. Choose pino or console in the composition
root. Application code uses the `Logger` interface.

## Usage

```ts
import { pinoAdapter } from '@alfredmouelle/logger'

// Choose the backend in the composition root.
export const logger = pinoAdapter({ level: 'info', bindings: { app: 'web' } })

// Application code depends only on the Logger port.
logger.info('user signed in', { userId: '42' })

// pin context for a request / job
const reqLog = logger.child({ requestId: 'abc' })
reqLog.error('payment failed', { orderId: '7' })
```

## Swapping backend

Change one line in the composition root:

```ts
import { consoleAdapter } from '@alfredmouelle/logger'

export const logger = consoleAdapter({ level: 'debug' })
```

Call sites stay on `Logger`.

## Adding a backend

Implement `Logger` in `src/port.ts` with `name`, the five level methods
`(msg, fields?)`, and `child(bindings)`. Use `src/adapters/pino.ts` or
`src/adapters/console.ts` as references.
