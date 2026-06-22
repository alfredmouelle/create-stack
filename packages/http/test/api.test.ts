import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiFetchError, apiFetch, isApiFetchError } from '../src/api.js'

const mockFetch = (response: Response | Promise<Response>) => {
  const fn = vi.fn().mockReturnValue(Promise.resolve(response))
  vi.stubGlobal('fetch', fn)
  return fn
}

const lastCall = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0] as [string, RequestInit]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch — request building', () => {
  it('serializes query params, dropping null/undefined and expanding arrays', async () => {
    const fn = mockFetch(new Response('{}', { status: 200 }))
    await apiFetch('https://api.test/items', {
      query: { a: 1, b: ['x', 'y'], c: null, d: undefined },
    })
    const [url] = lastCall(fn)
    expect(url).toContain('a=1')
    expect(url).toContain('b=x&b=y')
    expect(url).not.toContain('c=')
    expect(url).not.toContain('d=')
  })

  it('JSON-encodes an object body and sets Content-Type', async () => {
    const fn = mockFetch(new Response('{}', { status: 200 }))
    await apiFetch('https://api.test/items', { method: 'POST', body: { name: 'x' } })
    const [, init] = lastCall(fn)
    expect(init.body).toBe(JSON.stringify({ name: 'x' }))
    expect((init.headers as Headers).get('content-type')).toBe('application/json')
  })

  it('never sends a body on GET', async () => {
    const fn = mockFetch(new Response('{}', { status: 200 }))
    await apiFetch('https://api.test/items', { body: { ignored: true } })
    const [, init] = lastCall(fn)
    expect(init.body).toBeUndefined()
  })

  it('uses an injected fetchImpl instead of the global fetch', async () => {
    const injected = vi.fn(async () => new Response('{}', { status: 200 }))
    const globalFn = mockFetch(new Response('{}', { status: 200 }))
    await apiFetch('https://api.test/x', { fetchImpl: injected })
    expect(injected).toHaveBeenCalledOnce()
    expect(globalFn).not.toHaveBeenCalled()
  })
})

describe('apiFetch — response handling', () => {
  it('parses a JSON response', async () => {
    mockFetch(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    await expect(apiFetch('https://api.test/x')).resolves.toEqual({ ok: true })
  })

  it('returns undefined for a 204 No Content', async () => {
    mockFetch(new Response(null, { status: 204 }))
    await expect(apiFetch('https://api.test/x')).resolves.toBeUndefined()
  })

  it('throws an ApiFetchError carrying status and server message', async () => {
    mockFetch(
      new Response(JSON.stringify({ error: 'nope' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const err = await apiFetch('https://api.test/x').catch((e) => e)
    expect(isApiFetchError(err)).toBe(true)
    expect((err as ApiFetchError).status).toBe(403)
    expect((err as ApiFetchError).serverMessage).toBe('nope')
  })

  it('maps a fetch rejection to a network ApiFetchError (status 0)', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('boom'))
    vi.stubGlobal('fetch', fn)
    const err = await apiFetch('https://api.test/x').catch((e) => e)
    expect(isApiFetchError(err)).toBe(true)
    expect((err as ApiFetchError).status).toBe(0)
    expect((err as ApiFetchError).isNetworkError).toBe(true)
  })
})

describe('ApiFetchError helpers', () => {
  it('flags timeouts by status', () => {
    const make = (status: number) =>
      new ApiFetchError('x', { status, statusText: '', url: 'u', method: 'GET' })
    expect(make(408).isTimeout).toBe(true)
    expect(make(504).isTimeout).toBe(true)
    expect(make(500).isTimeout).toBe(false)
  })
})
