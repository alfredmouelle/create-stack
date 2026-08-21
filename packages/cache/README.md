# @alfredmouelle/cache

JSON key/value cache through one port. The same call sites work with Redis in
production or an in-memory map in development and tests.

## Usage

```ts
import { redisAdapter } from '@alfredmouelle/cache'

// Choose the backend in the composition root.
export const cache = redisAdapter({ url: process.env.REDIS_URL! })

// Application code depends only on CachePort.
await cache.set('user:1', { name: 'Alfred' }, 60)
const user = await cache.get<{ name: string }>('user:1')

// Read-through: compute once, then cache for 5 minutes.
const stats = await cache.wrap('stats', () => computeStats(), 300)
```

## Swapping backend

Change the adapter in the composition root:

```ts
import { memoryAdapter } from '@alfredmouelle/cache'

export const cache = memoryAdapter()
```

Call sites stay on `CachePort`.

For edge/serverless runtimes where TCP (and `ioredis`) is unavailable, use the
HTTP/REST `upstashAdapter` instead (same port, JSON handled by the client):

```ts
import { upstashAdapter } from '@alfredmouelle/cache'

// uses UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, or pass { url, token }
export const cache = upstashAdapter()
```

## Adding a backend

Implement `CachePort` in `src/port.ts` with `name`, `get`, `set`, `delete`,
`has`, and `wrap`. Reuse `wrapValue` from `src/wrap.ts` for read-through caching.
Use `src/adapters/redis.ts` or `src/adapters/memory.ts` as references.
