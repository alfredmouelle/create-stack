import { describe, expect, it, vi } from 'vitest'
import { memoryAdapter } from '../src/adapters/memory/index.js'
import type { JobEvent } from '../src/core/port.js'

describe('memoryAdapter', () => {
  it('runs the handler with the triggered event', async () => {
    const adapter = memoryAdapter()
    const handler = vi.fn()
    adapter.defineJob<{ id: number }>({ id: 'job-1', event: 'user/created', handler })

    await adapter.trigger<{ id: number }>({ name: 'user/created', data: { id: 7 } })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ name: 'user/created', data: { id: 7 } })
  })

  it('runs every handler subscribed to the same event', async () => {
    const adapter = memoryAdapter()
    const a = vi.fn()
    const b = vi.fn()
    adapter.defineJob({ id: 'a', event: 'order/placed', handler: a })
    adapter.defineJob({ id: 'b', event: 'order/placed', handler: b })

    await adapter.trigger({ name: 'order/placed', data: { total: 10 } })

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when no handler is subscribed to the event', async () => {
    const adapter = memoryAdapter()

    await expect(adapter.trigger({ name: 'nobody/listening', data: {} })).resolves.toBeUndefined()
  })

  it('passes the correct { name, data } to the handler', async () => {
    const adapter = memoryAdapter()
    let received: JobEvent<{ msg: string }> | undefined
    adapter.defineJob<{ msg: string }>({
      id: 'capture',
      event: 'demo/event',
      handler: (event) => {
        received = event
      },
    })

    await adapter.trigger<{ msg: string }>({ name: 'demo/event', data: { msg: 'hi' } })

    expect(received).toEqual({ name: 'demo/event', data: { msg: 'hi' } })
  })
})
