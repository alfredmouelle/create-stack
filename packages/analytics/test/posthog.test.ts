import { describe, expect, it, vi } from 'vitest'
import { type PostHogLike, posthogAdapter } from '../src/adapters/posthog/index.js'

function mockClient(): PostHogLike {
  return {
    capture: vi.fn(),
    identify: vi.fn(),
    flush: vi.fn(async () => {}),
    shutdown: vi.fn(async () => {}),
  }
}

describe('posthogAdapter', () => {
  it('throws at construction when the api key is missing', () => {
    expect(() => posthogAdapter({ apiKey: '' })).toThrow()
  })

  it('maps capture to client.capture with distinctId, event, properties', () => {
    const client = mockClient()
    const adapter = posthogAdapter({ apiKey: 'key', client })

    adapter.capture({
      event: 'button_clicked',
      distinctId: 'user_1',
      properties: { button_name: 'subscribe' },
    })

    expect(client.capture).toHaveBeenCalledWith({
      distinctId: 'user_1',
      event: 'button_clicked',
      properties: { button_name: 'subscribe' },
    })
  })

  it('maps identify to client.identify with distinctId and properties', () => {
    const client = mockClient()
    const adapter = posthogAdapter({ apiKey: 'key', client })

    adapter.identify({ distinctId: 'user_1', properties: { email: 'a@test.com' } })

    expect(client.identify).toHaveBeenCalledWith({
      distinctId: 'user_1',
      properties: { email: 'a@test.com' },
    })
  })

  it('delegates flush and shutdown to the client', async () => {
    const client = mockClient()
    const adapter = posthogAdapter({ apiKey: 'key', client })

    await adapter.flush()
    await adapter.shutdown()

    expect(client.flush).toHaveBeenCalledTimes(1)
    expect(client.shutdown).toHaveBeenCalledTimes(1)
  })
})
