import { Redis } from '@upstash/redis'
import { CacheError, type CachePort } from '../port.js'
import { wrapValue } from '../wrap.js'

export interface UpstashLike {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>
  del(...keys: string[]): Promise<number>
  exists(...keys: string[]): Promise<number>
}

export interface UpstashAdapterOptions {
  client?: UpstashLike
  url?: string
  token?: string
  keyPrefix?: string
}

export function upstashAdapter(options: UpstashAdapterOptions = {}): CachePort {
  const defaultClient = () =>
    (options.url && options.token
      ? new Redis({ url: options.url, token: options.token })
      : Redis.fromEnv()) as unknown as UpstashLike
  const client: UpstashLike = options.client ?? defaultClient()
  const prefix = options.keyPrefix ?? ''
  const k = (key: string) => `${prefix}${key}`

  const port: CachePort = {
    name: 'upstash',
    async get<T>(key: string) {
      try {
        return (await client.get(k(key))) as T | null
      } catch (cause) {
        throw new CacheError('Failed to read from Upstash', { adapter: 'upstash', cause })
      }
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      try {
        if (ttlSeconds === undefined) await client.set(k(key), value)
        else await client.set(k(key), value, { ex: ttlSeconds })
      } catch (cause) {
        throw new CacheError('Failed to write to Upstash', { adapter: 'upstash', cause })
      }
    },
    async delete(key: string) {
      try {
        await client.del(k(key))
      } catch (cause) {
        throw new CacheError('Failed to delete from Upstash', { adapter: 'upstash', cause })
      }
    },
    async has(key: string) {
      try {
        return (await client.exists(k(key))) > 0
      } catch (cause) {
        throw new CacheError('Failed to query Upstash', { adapter: 'upstash', cause })
      }
    },
    wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number) {
      return wrapValue(port, key, factory, ttlSeconds)
    },
  }

  return port
}
