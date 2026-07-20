import { describe, expect, it } from 'vitest'
import { noopAdapter } from '../src/adapters/noop.js'

describe('noopAdapter', () => {
  it('exposes the noop name', () => {
    expect(noopAdapter().name).toBe('noop')
  })

  it('capture and identify do not throw', () => {
    const adapter = noopAdapter()
    expect(() => adapter.capture({ event: 'e', distinctId: 'u' })).not.toThrow()
    expect(() => adapter.identify({ distinctId: 'u' })).not.toThrow()
  })

  it('flush and shutdown resolve', async () => {
    const adapter = noopAdapter()
    await expect(adapter.flush()).resolves.toBeUndefined()
    await expect(adapter.shutdown()).resolves.toBeUndefined()
  })
})
