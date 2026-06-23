# @alfredmouelle/cache

Key/value cache behind a tiny port. Values are serialized as JSON, so the same
call sites work against Redis in production and an in-memory map in dev/tests.

## Usage

```ts
import { redisAdapter } from '@alfredmouelle/cache'

// composition root — pick the backend here, once
export const cache = redisAdapter({ url: process.env.REDIS_URL! })

// anywhere in the app — depends only on the CachePort
await cache.set('user:1', { name: 'Alfred' }, 60)
const user = await cache.get<{ name: string }>('user:1')

// read-through: compute once, cache for 5 min
const stats = await cache.wrap('stats', () => computeStats(), 300)
```

## Swapping backend

Change one line in the composition root:

```ts
import { memoryAdapter } from '@alfredmouelle/cache'

export const cache = memoryAdapter()
```

No call site changes — they all depend on `CachePort`, never on a backend.

For edge/serverless runtimes where TCP (and `ioredis`) is unavailable, use the
HTTP/REST `upstashAdapter` instead — same port, JSON handled by the client:

```ts
import { upstashAdapter } from '@alfredmouelle/cache'

// uses UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, or pass { url, token }
export const cache = upstashAdapter()
```

## Adding a backend

Implement `CachePort` (`src/core/port.ts`): `name`, `get`, `set`, `delete`,
`has`, and `wrap`. Reuse `wrapValue` (`src/core/wrap.ts`) for the read-through
`wrap` so the logic stays in one place. Look at `src/adapters/redis` (SDK-based)
or `src/adapters/memory` (in-process) as templates.
