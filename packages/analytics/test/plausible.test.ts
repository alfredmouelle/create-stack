import { describe, expect, it, vi } from 'vitest'
import { plausibleAdapter } from '../src/adapters/plausible/index.js'

function mockFetch(status = 202) {
  return vi.fn(async () => new Response(null, { status }))
}

function lastCall(fetch: ReturnType<typeof mockFetch>) {
  const [url, init] = fetch.mock.calls.at(-1) as [string, RequestInit]
  const headers = new Headers(init.headers)
  return { url, init, headers, body: JSON.parse(init.body as string) }
}

describe('plausibleAdapter', () => {
  it('throws at construction when the domain is missing', () => {
    expect(() => plausibleAdapter({ domain: '' })).toThrow()
  })

  it('posts a custom event to /api/event with domain, name and props', async () => {
    const fetchImpl = mockFetch()
    const analytics = plausibleAdapter({ domain: 'acme.com', fetchImpl })

    analytics.capture({
      event: 'user_signed_up',
      distinctId: 'user_1',
      properties: { plan: 'pro' },
    })
    await analytics.flush()

    const { url, headers, body } = lastCall(fetchImpl)
    expect(url).toBe('https://plausible.io/api/event')
    expect(headers.get('User-Agent')).toBeTruthy()
    expect(body).toMatchObject({
      name: 'user_signed_up',
      domain: 'acme.com',
      url: 'https://acme.com/',
      props: { distinct_id: 'user_1', plan: 'pro' },
    })
  })

  it('reads url, referrer and ip from event properties', async () => {
    const fetchImpl = mockFetch()
    const analytics = plausibleAdapter({ domain: 'acme.com', fetchImpl })

    analytics.capture({
      event: 'pageview',
      distinctId: 'user_1',
      properties: {
        url: 'https://acme.com/pricing',
        referrer: 'https://google.com',
        ip: '1.2.3.4',
      },
    })
    await analytics.flush()

    const { headers, body } = lastCall(fetchImpl)
    expect(headers.get('X-Forwarded-For')).toBe('1.2.3.4')
    expect(body).toMatchObject({ url: 'https://acme.com/pricing', referrer: 'https://google.com' })
    expect(body.props).not.toHaveProperty('ip')
    expect(body.props).not.toHaveProperty('url')
  })

  it('identify is a no-op (no request)', async () => {
    const fetchImpl = mockFetch()
    const analytics = plausibleAdapter({ domain: 'acme.com', fetchImpl })

    analytics.identify({ distinctId: 'user_1', properties: { email: 'a@test.com' } })
    await analytics.flush()

    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('routes a failed request to onError instead of throwing', async () => {
    const fetchImpl = mockFetch(400)
    const onError = vi.fn()
    const analytics = plausibleAdapter({ domain: 'acme.com', fetchImpl, onError })

    analytics.capture({ event: 'x', distinctId: 'user_1' })
    await analytics.flush()

    expect(onError).toHaveBeenCalledTimes(1)
  })
})
