export interface CachePort {
  readonly name: string
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
  delete(key: string): Promise<void>
  has(key: string): Promise<boolean>
  wrap<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>
}

export class CacheError extends Error {
  readonly adapter: string

  constructor(message: string, options: { adapter: string; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'CacheError'
    this.adapter = options.adapter
  }
}
