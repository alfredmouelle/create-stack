import { describe, expect, it, vi } from 'vitest'
import { type SentryLike, sentryAdapter } from '../src/adapters/sentry/index.js'

function mockClient(): SentryLike {
  return {
    init: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    addBreadcrumb: vi.fn(),
    flush: vi.fn(async () => true),
  }
}

describe('sentryAdapter', () => {
  it('throws at construction when the dsn is missing', () => {
    expect(() => sentryAdapter({ dsn: '' })).toThrow()
  })

  it('does not init when a client is injected', () => {
    const client = mockClient()
    sentryAdapter({ dsn: 'https://x@o0.ingest.sentry.io/0', client })

    expect(client.init).not.toHaveBeenCalled()
  })

  it('captureException passes the error and mapped context', () => {
    const client = mockClient()
    const adapter = sentryAdapter({ dsn: 'dsn', client })
    const error = new Error('boom')

    adapter.captureException(error, {
      tags: { feature: 'checkout' },
      extra: { foo: 'bar' },
      level: 'warning',
    })

    expect(client.captureException).toHaveBeenCalledWith(error, {
      tags: { feature: 'checkout' },
      extra: { foo: 'bar' },
      level: 'warning',
    })
  })

  it('captureMessage passes the level', () => {
    const client = mockClient()
    const adapter = sentryAdapter({ dsn: 'dsn', client })

    adapter.captureMessage('hello', 'debug')

    expect(client.captureMessage).toHaveBeenCalledWith('hello', 'debug')
  })

  it('delegates setUser, addBreadcrumb and flush', async () => {
    const client = mockClient()
    const adapter = sentryAdapter({ dsn: 'dsn', client })

    adapter.setUser({ id: 'u1', email: 'u@test.com' })
    adapter.addBreadcrumb({ message: 'logged in', category: 'auth' })
    const flushed = await adapter.flush(2000)

    expect(client.setUser).toHaveBeenCalledWith({ id: 'u1', email: 'u@test.com' })
    expect(client.addBreadcrumb).toHaveBeenCalledWith({ message: 'logged in', category: 'auth' })
    expect(client.flush).toHaveBeenCalledWith(2000)
    expect(flushed).toBe(true)
  })
})
