import type { CachePort } from '../../core/port.js'
import { wrapValue } from '../../core/wrap.js'

interface Entry {
  value: unknown
  /** Epoch ms after which the entry is expired, or `undefined` for no expiry. */
  expiresAt?: number
}

export interface MemoryAdapterOptions {
  /** Seed the cache with an existing store (mostly for tests). */
  store?: Map<string, Entry>
}

/**
 * In-process cache backed by a `Map`, with lazy per-key expiry. No external
 * deps — good for dev and tests.
 */
export function memoryAdapter(options: MemoryAdapterOptions = {}): CachePort {
  const store = options.store ?? new Map<string, Entry>()

  function read(key: string): Entry | null {
    const entry = store.get(key)
    if (entry === undefined) return null
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      store.delete(key)
      return null
    }
    return entry
  }

  const port: CachePort = {
    name: 'memory',
    async get<T>(key: string) {
      const entry = read(key)
      return entry === null ? null : (entry.value as T)
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      const expiresAt = ttlSeconds === undefined ? undefined : Date.now() + ttlSeconds * 1000
      store.set(key, { value, expiresAt })
    },
    async delete(key: string) {
      store.delete(key)
    },
    async has(key: string) {
      return read(key) !== null
    },
    wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number) {
      return wrapValue(port, key, factory, ttlSeconds)
    },
  }

  return port
}
