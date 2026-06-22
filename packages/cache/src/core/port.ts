/**
 * The port the application depends on. Swapping cache backends means swapping
 * the adapter passed to the composition root; this interface never changes.
 *
 * Values are serialized as JSON for remote stores, so anything stored must be
 * JSON-serializable.
 */
export interface CachePort {
  /** Identifies the backing adapter (`redis`, `memory`, …). */
  readonly name: string
  /** Read a value, or `null` when the key is absent or expired. */
  get<T>(key: string): Promise<T | null>
  /** Store a value, optionally expiring it after `ttlSeconds`. */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  /** Remove a key. No-op when the key is absent. */
  delete(key: string): Promise<void>
  /** Whether a (non-expired) value exists for the key. */
  has(key: string): Promise<boolean>
  /**
   * Return the cached value for `key` if present, otherwise call `factory()`,
   * store its result with `ttlSeconds`, and return it.
   */
  wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>
}

/** Normalized error thrown by adapters so callers never catch backend types. */
export class CacheError extends Error {
  readonly adapter: string

  constructor(message: string, options: { adapter: string; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'CacheError'
    this.adapter = options.adapter
  }
}
