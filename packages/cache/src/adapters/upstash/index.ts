import { Redis } from '@upstash/redis'
import * as v from 'valibot'
import { CacheError, type CachePort } from '../../core/port.js'
import { wrapValue } from '../../core/wrap.js'
import { UpstashConfigSchema } from './config.js'

/** Minimal structural view of the Upstash REST client (eases testing). */
export interface UpstashLike {
  /** Returns the (auto-deserialized) value, or `null` if absent. */
  get(key: string): Promise<unknown>
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>
  del(...keys: string[]): Promise<number>
  exists(...keys: string[]): Promise<number>
}

export interface UpstashAdapterOptions {
  /** Inject a custom/mock client; defaults to a real `Redis`. */
  client?: UpstashLike
  /** REST URL when no `client` is injected; falls back to `Redis.fromEnv()`. */
  url?: string
  /** REST token when no `client` is injected. */
  token?: string
  /** Prepended to every key. */
  keyPrefix?: string
}

/** HTTP/REST Redis adapter (Upstash); edge/serverless-friendly. JSON handled by the client. */
export function upstashAdapter(options: UpstashAdapterOptions = {}): CachePort {
  // Validate early: bad option fails at construction, not at use.
  const config = v.parse(UpstashConfigSchema, {
    url: options.url,
    token: options.token,
    keyPrefix: options.keyPrefix,
  })
  const defaultClient = () =>
    (config.url && config.token
      ? new Redis({ url: config.url, token: config.token })
      : Redis.fromEnv()) as unknown as UpstashLike
  const client: UpstashLike = options.client ?? defaultClient()
  const prefix = config.keyPrefix ?? ''
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
