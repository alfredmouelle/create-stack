/**
 * The minimal read/write pair `wrap` needs. Adapters pass their own `get`/`set`
 * so the read-through logic lives in one place (DRY).
 */
export interface WrapStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
}

/**
 * Read-through helper shared by every adapter: return the cached value if
 * present, otherwise call `factory()`, store the result with `ttlSeconds`, and
 * return it.
 */
export async function wrapValue<T>(
  store: WrapStore,
  key: string,
  factory: () => Promise<T>,
  ttlSeconds?: number,
): Promise<T> {
  const cached = await store.get<T>(key)
  if (cached !== null) return cached

  const value = await factory()
  await store.set(key, value, ttlSeconds)
  return value
}
