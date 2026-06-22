import { describe, expect, it, vi } from 'vitest'
import { consoleAdapter } from '../src/adapters/console/index.js'

describe('consoleAdapter', () => {
  it('logs captured exceptions to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const adapter = consoleAdapter()

    adapter.captureException(new Error('boom'), { tags: { feature: 'checkout' } })

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('logs captured messages to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const adapter = consoleAdapter()

    adapter.captureMessage('something happened', 'warning')

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('keeps user and breadcrumb state without throwing', () => {
    const adapter = consoleAdapter()

    expect(() => adapter.setUser({ id: 'u1' })).not.toThrow()
    expect(() => adapter.addBreadcrumb({ message: 'clicked' })).not.toThrow()
    expect(() => adapter.setUser(null)).not.toThrow()
  })

  it('flush resolves true', async () => {
    const adapter = consoleAdapter()
    await expect(adapter.flush()).resolves.toBe(true)
  })
})
