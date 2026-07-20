import { describe, expect, it, vi } from 'vitest'
import { type PinoLike, pinoAdapter } from '../src/adapters/pino.js'

function mockPino(): PinoLike {
  const self: PinoLike = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => mockPino()),
  }
  return self
}

describe('pinoAdapter', () => {
  it('maps (msg, fields) to pino (fields, msg) argument order', () => {
    const client = mockPino()
    const logger = pinoAdapter({ client })

    logger.info('hi', { a: 1 })

    expect(client.info).toHaveBeenCalledWith({ a: 1 }, 'hi')
  })

  it('defaults fields to an empty object', () => {
    const client = mockPino()
    const logger = pinoAdapter({ client })

    logger.error('boom')

    expect(client.error).toHaveBeenCalledWith({}, 'boom')
  })

  it('child() delegates to the pino child logger', () => {
    const client = mockPino()
    const logger = pinoAdapter({ client })

    const child = logger.child({ requestId: 'abc' })
    child.info('hi', { a: 1 })

    expect(client.child).toHaveBeenCalledWith({ requestId: 'abc' })
    // top-level client must not receive the child's line
    expect(client.info).not.toHaveBeenCalled()
    const childClient = vi.mocked(client.child).mock.results[0]?.value as PinoLike
    expect(childClient.info).toHaveBeenCalledWith({ a: 1 }, 'hi')
  })

  it('applies constructor bindings via a pino child', () => {
    const client = mockPino()
    pinoAdapter({ client, bindings: { app: 'web' } })

    expect(client.child).toHaveBeenCalledWith({ app: 'web' })
  })
})
