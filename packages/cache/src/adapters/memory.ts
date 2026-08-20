import type { CachePort } from '../port.js'
import { wrapValue } from '../wrap.js'

interface Entry {
  value: unknown
  expiresAt?: number
}

export interface MemoryAdapterOptions {
  store?: Map<string, Entry>
}

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
