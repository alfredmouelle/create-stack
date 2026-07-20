import { describe, expect, it } from 'vitest'
import { sentryOptions } from '../src/options.js'

describe('sentryOptions', () => {
  it('stays disabled when no DSN is configured', () => {
    const options = sentryOptions({ dsn: undefined })
    expect(options.enabled).toBe(false)
    expect(options.dsn).toBeUndefined()
  })

  it('enables itself as soon as a DSN is present', () => {
    expect(sentryOptions({ dsn: 'https://x@o1.ingest.sentry.io/1' }).enabled).toBe(true)
  })

  it('treats an empty DSN as absent', () => {
    expect(sentryOptions({ dsn: '' }).enabled).toBe(false)
  })

  it('samples every trace in development', () => {
    expect(sentryOptions({ dsn: 'dsn', nodeEnv: 'development' }).tracesSampleRate).toBe(1)
  })

  it('samples a tenth of traces outside development', () => {
    expect(sentryOptions({ dsn: 'dsn', nodeEnv: 'production' }).tracesSampleRate).toBe(0.1)
    expect(sentryOptions({ dsn: 'dsn' }).tracesSampleRate).toBe(0.1)
  })

  it('lets an explicit sample rate win, including zero', () => {
    expect(
      sentryOptions({ dsn: 'dsn', nodeEnv: 'development', tracesSampleRate: 0 }).tracesSampleRate,
    ).toBe(0)
    expect(sentryOptions({ dsn: 'dsn', tracesSampleRate: 0.5 }).tracesSampleRate).toBe(0.5)
  })

  it('falls back to nodeEnv for the environment', () => {
    expect(sentryOptions({ dsn: 'dsn', nodeEnv: 'staging' }).environment).toBe('staging')
    expect(
      sentryOptions({ dsn: 'dsn', nodeEnv: 'staging', environment: 'eu-prod' }).environment,
    ).toBe('eu-prod')
  })

  it('enables logs unless turned off', () => {
    expect(sentryOptions({ dsn: 'dsn' }).enableLogs).toBe(true)
    expect(sentryOptions({ dsn: 'dsn', enableLogs: false }).enableLogs).toBe(false)
  })

  it('produces the same options for every runtime', () => {
    const input = { dsn: 'dsn', nodeEnv: 'production' }
    expect(sentryOptions(input)).toEqual(sentryOptions(input))
  })
})
