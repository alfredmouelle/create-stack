/**
 * App-facing port; swap adapters at the composition root, never this interface.
 * Values are JSON-serialized for remote stores, so stored values must be JSON-serializable.
 */
export interface CachePort {
  /** Backing adapter name (`redis`, `memory`, …). */
  readonly name: string
  /** Read a value, or `null` if absent/expired. */
  get<T>(key: string): Promise<T | null>
  /** Store a value, optionally expiring after `ttlSeconds`. */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  /** Remove a key (no-op if absent). */
  delete(key: string): Promise<void>
  /** Whether a non-expired value exists. */
  has(key: string): Promise<boolean>
  /** Read-through: cached value, else `factory()` stored with `ttlSeconds`. */
  wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>
}

/** Normalized adapter error; callers never catch backend types. */
export class CacheError extends Error {
  readonly adapter: string

  constructor(message: string, options: { adapter: string; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'CacheError'
    this.adapter = options.adapter
  }
}
