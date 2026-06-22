import { describe, expect, it, vi } from 'vitest'
import { type RedisLike, redisAdapter } from '../src/adapters/redis/index.js'

function mockClient(overrides: Partial<RedisLike> = {}) {
  const client: RedisLike = {
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
    exists: vi.fn(async () => 0),
    ...overrides,
  }
  return client
}

describe('redisAdapter', () => {
  it('serializes JSON on set without a ttl', async () => {
    const client = mockClient()
    const cache = redisAdapter({ client })

    await cache.set('user', { id: 1 })

    expect(client.set).toHaveBeenCalledWith('user', '{"id":1}')
  })

  it('serializes JSON and passes EX ttl on set with a ttl', async () => {
    const client = mockClient()
    const cache = redisAdapter({ client })

    await cache.set('user', { id: 1 }, 60)

    expect(client.set).toHaveBeenCalledWith('user', '{"id":1}', 'EX', 60)
  })

  it('deserializes JSON on get', async () => {
    const client = mockClient({ get: vi.fn(async () => '{"id":1,"name":"Alfred"}') })
    const cache = redisAdapter({ client })

    expect(await cache.get('user')).toEqual({ id: 1, name: 'Alfred' })
  })

  it('returns null for a missing key', async () => {
    const client = mockClient({ get: vi.fn(async () => null) })
    const cache = redisAdapter({ client })

    expect(await cache.get('user')).toBeNull()
  })

  it('delete calls del', async () => {
    const client = mockClient()
    const cache = redisAdapter({ client })

    await cache.delete('user')

    expect(client.del).toHaveBeenCalledWith('user')
  })

  it('has maps exists', async () => {
    const present = redisAdapter({ client: mockClient({ exists: vi.fn(async () => 1) }) })
    const absent = redisAdapter({ client: mockClient({ exists: vi.fn(async () => 0) }) })

    expect(await present.has('user')).toBe(true)
    expect(await absent.has('user')).toBe(false)
  })

  it('applies the keyPrefix to every key', async () => {
    const client = mockClient()
    const cache = redisAdapter({ client, keyPrefix: 'app:' })

    await cache.set('user', 1)
    await cache.get('user')
    await cache.delete('user')
    await cache.has('user')

    expect(client.set).toHaveBeenCalledWith('app:user', '1')
    expect(client.get).toHaveBeenCalledWith('app:user')
    expect(client.del).toHaveBeenCalledWith('app:user')
    expect(client.exists).toHaveBeenCalledWith('app:user')
  })

  it('wrap stores the computed value and returns it', async () => {
    let stored: string | null = null
    const client = mockClient({
      get: vi.fn(async () => stored),
      set: vi.fn(async (_key, value: string) => {
        stored = value
        return 'OK'
      }),
    })
    const cache = redisAdapter({ client })
    const factory = vi.fn(async () => ({ id: 1 }))

    expect(await cache.wrap('user', factory)).toEqual({ id: 1 })
    expect(client.set).toHaveBeenCalledWith('user', '{"id":1}')

    expect(await cache.wrap('user', factory)).toEqual({ id: 1 })
    expect(factory).toHaveBeenCalledTimes(1)
  })
})
