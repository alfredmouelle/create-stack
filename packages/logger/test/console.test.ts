import { afterEach, describe, expect, it, vi } from 'vitest'
import { consoleAdapter } from '../src/adapters/console/index.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('consoleAdapter', () => {
  it('suppresses lower-severity lines below the configured level', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = consoleAdapter({ level: 'info' })

    logger.debug('nope')
    logger.info('yep')

    expect(debug).not.toHaveBeenCalled()
    expect(info).toHaveBeenCalledTimes(1)
  })

  it('always emits errors', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = consoleAdapter({ level: 'error' })

    logger.error('boom')

    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith('[error] boom')
  })

  it('includes fields in the formatted output', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = consoleAdapter({ level: 'info' })

    logger.info('hi', { a: 1 })

    expect(info).toHaveBeenCalledWith('[info] hi {"a":1}')
  })

  it('child() merges bindings into the output', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const logger = consoleAdapter({ level: 'info', bindings: { app: 'web' } })

    logger.child({ requestId: 'abc' }).info('hi', { a: 1 })

    expect(info).toHaveBeenCalledWith('[info] hi {"app":"web","requestId":"abc","a":1}')
  })
})
