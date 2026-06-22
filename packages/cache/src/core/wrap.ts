/** Minimal read/write pair `wrap` needs; adapters pass their own `get`/`set`. */
export interface WrapStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>
}

/** Read-through: return cached value, else call `factory()`, store with `ttlSeconds`, return. */
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
