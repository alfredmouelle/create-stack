# @stack/cache

Key/value cache behind a tiny port. Values are serialized as JSON, so the same
call sites work against Redis in production and an in-memory map in dev/tests.

## Usage

```ts
import { redisAdapter } from '@stack/cache'

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
import { memoryAdapter } from '@stack/cache'

export const cache = memoryAdapter()
```

No call site changes — they all depend on `CachePort`, never on a backend.

## Adding a backend

Implement `CachePort` (`src/core/port.ts`): `name`, `get`, `set`, `delete`,
`has`, and `wrap`. Reuse `wrapValue` (`src/core/wrap.ts`) for the read-through
`wrap` so the logic stays in one place. Look at `src/adapters/redis` (SDK-based)
or `src/adapters/memory` (in-process) as templates.
