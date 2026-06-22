import { describe, expect, it, type Mock, vi } from 'vitest'
import { type InngestLike, inngestAdapter } from '../src/adapters/inngest/index.js'

function mockClient() {
  const fakeFn = { id: 'fake-fn' }
  const send: Mock<InngestLike['send']> = vi.fn(async () => ({ ids: ['evt_1'] }))
  const createFunction: Mock<InngestLike['createFunction']> = vi.fn(() => fakeFn)
  const client: InngestLike = { send, createFunction }
  return { client, send, createFunction, fakeFn }
}

describe('inngestAdapter', () => {
  it('throws at construction when the id is missing', () => {
    expect(() => inngestAdapter({ id: '' })).toThrow()
  })

  it('sends { name, data } via client.send on trigger', async () => {
    const { client, send } = mockClient()
    const adapter = inngestAdapter({ id: 'app', client })

    await adapter.trigger({ name: 'user/created', data: { id: 1 } })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({ name: 'user/created', data: { id: 1 } })
  })

  it('registers a function via createFunction and collects it', () => {
    const { client, createFunction, fakeFn } = mockClient()
    const adapter = inngestAdapter({ id: 'app', client })

    adapter.defineJob({ id: 'job-1', event: 'user/created', handler: vi.fn() })

    expect(createFunction).toHaveBeenCalledTimes(1)
    expect(createFunction).toHaveBeenCalledWith(
      { id: 'job-1' },
      { event: 'user/created' },
      expect.any(Function),
    )
    expect(adapter.functions).toEqual([fakeFn])
  })

  it('the registered function invokes the job handler with the event', () => {
    const { client, createFunction } = mockClient()
    const adapter = inngestAdapter({ id: 'app', client })
    const handler = vi.fn()
    adapter.defineJob({ id: 'job-1', event: 'user/created', handler })

    const registered = createFunction.mock.calls[0]?.[2]
    registered?.({ event: { name: 'user/created', data: { id: 9 } } })

    expect(handler).toHaveBeenCalledWith({ name: 'user/created', data: { id: 9 } })
  })

  it('wraps a send failure into a JobsError', async () => {
    const send = vi.fn(async () => {
      throw new Error('network down')
    })
    const adapter = inngestAdapter({ id: 'app', client: { send, createFunction: vi.fn() } })

    await expect(adapter.trigger({ name: 'x', data: {} })).rejects.toMatchObject({
      name: 'JobsError',
      adapter: 'inngest',
    })
  })
})
