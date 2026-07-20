import { Redis } from 'ioredis'
import { CacheError, type CachePort } from '../port.js'
import { wrapValue } from '../wrap.js'

/** Minimal structural view of the Redis client (eases testing). */
export interface RedisLike {
  get(key: string): Promise<string | null>
  set(key: string, value: string, secondsToken?: 'EX', seconds?: number): Promise<unknown>
  del(key: string): Promise<unknown>
  exists(key: string): Promise<number>
}

export interface RedisAdapterOptions {
  /** Inject a custom/mock client; defaults to a real `Redis`. */
  client?: RedisLike
  /** Connection URL when no `client` is injected. */
  url?: string
  /** Prepended to every key. */
  keyPrefix?: string
}

export function redisAdapter(options: RedisAdapterOptions = {}): CachePort {
  // No validation: every field is optional, so parsing would be a no-op.
  const defaultClient = () =>
    (options.url ? new Redis(options.url) : new Redis()) as unknown as RedisLike
  const client: RedisLike = options.client ?? defaultClient()
  const prefix = options.keyPrefix ?? ''
  const k = (key: string) => `${prefix}${key}`

  const port: CachePort = {
    name: 'redis',
    async get<T>(key: string) {
      try {
        const raw = await client.get(k(key))
        if (raw === null) return null
        return JSON.parse(raw) as T
      } catch (cause) {
        throw new CacheError('Failed to read from Redis', { adapter: 'redis', cause })
      }
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      try {
        const json = JSON.stringify(value)
        if (ttlSeconds === undefined) await client.set(k(key), json)
        else await client.set(k(key), json, 'EX', ttlSeconds)
      } catch (cause) {
        throw new CacheError('Failed to write to Redis', { adapter: 'redis', cause })
      }
    },
    async delete(key: string) {
      try {
        await client.del(k(key))
      } catch (cause) {
        throw new CacheError('Failed to delete from Redis', { adapter: 'redis', cause })
      }
    },
    async has(key: string) {
      try {
        return (await client.exists(k(key))) > 0
      } catch (cause) {
        throw new CacheError('Failed to query Redis', { adapter: 'redis', cause })
      }
    },
    wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number) {
      return wrapValue(port, key, factory, ttlSeconds)
    },
  }

  return port
}
