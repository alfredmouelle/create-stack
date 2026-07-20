import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryAdapter } from '../src/adapters/memory.js'

describe('memoryAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('round-trips objects through set/get', async () => {
    const cache = memoryAdapter()
    await cache.set('user', { id: 1, name: 'Alfred' })

    expect(await cache.get('user')).toEqual({ id: 1, name: 'Alfred' })
  })

  it('returns null for a missing key', async () => {
    const cache = memoryAdapter()

    expect(await cache.get('nope')).toBeNull()
  })

  it('reports presence with has', async () => {
    const cache = memoryAdapter()
    await cache.set('k', 'v')

    expect(await cache.has('k')).toBe(true)
    expect(await cache.has('missing')).toBe(false)
  })

  it('deletes keys', async () => {
    const cache = memoryAdapter()
    await cache.set('k', 'v')

    await cache.delete('k')

    expect(await cache.get('k')).toBeNull()
    expect(await cache.has('k')).toBe(false)
  })

  it('expires entries after the ttl (lazy eviction)', async () => {
    const cache = memoryAdapter()
    await cache.set('k', 'v', 10)

    expect(await cache.get('k')).toBe('v')

    vi.advanceTimersByTime(9_000)
    expect(await cache.get('k')).toBe('v')
    expect(await cache.has('k')).toBe(true)

    vi.advanceTimersByTime(2_000)
    expect(await cache.get('k')).toBeNull()
    expect(await cache.has('k')).toBe(false)
  })

  it('wrap calls the factory once then serves the cached value', async () => {
    const cache = memoryAdapter()
    const factory = vi.fn(async () => 'computed')

    expect(await cache.wrap('k', factory)).toBe('computed')
    expect(await cache.wrap('k', factory)).toBe('computed')
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('wrap recomputes after the ttl expires', async () => {
    const cache = memoryAdapter()
    let n = 0
    const factory = vi.fn(async () => ++n)

    expect(await cache.wrap('k', factory, 10)).toBe(1)
    expect(await cache.wrap('k', factory, 10)).toBe(1)

    vi.advanceTimersByTime(11_000)

    expect(await cache.wrap('k', factory, 10)).toBe(2)
    expect(factory).toHaveBeenCalledTimes(2)
  })
})
