import { describe, expect, test } from 'vitest'
import {
  adapterChoices,
  CAPABILITIES,
  capabilityChoices,
  creationProviderChoices,
  hasAdapters,
  resolveAdapter,
  resolveCreationProvider,
} from '../lib/capabilities.mjs'

describe('resolveAdapter', () => {
  test('bare / empty → default adapter', () => {
    expect(resolveAdapter('storage', true)).toBe('s3')
    expect(resolveAdapter('storage', undefined)).toBe('s3')
    expect(resolveAdapter('storage', '')).toBe('s3')
  })
  test('a valid adapter passes through', () => {
    expect(resolveAdapter('cache', 'upstash')).toBe('upstash')
  })
  test('unknown adapter / capability throws', () => {
    expect(() => resolveAdapter('storage', 'bogus')).toThrow(/Unknown storage adapter/)
    expect(() => resolveAdapter('bogus', 's3')).toThrow(/Unknown capability/)
  })
})

describe('ports vs modules', () => {
  test('a module has no adapter to pick', () => {
    expect(hasAdapters('jobs')).toBe(false)
    expect(hasAdapters('error-tracking')).toBe(false)
    expect(adapterChoices('jobs')).toBeNull()
  })

  test('a port does', () => {
    for (const cap of ['storage', 'cache', 'logger', 'analytics']) {
      expect(hasAdapters(cap), cap).toBe(true)
    }
  })

  test('creation resolves a bare or explicit module selector to its single provider', () => {
    expect(resolveCreationProvider('jobs', true)).toBe('inngest')
    expect(resolveCreationProvider('error-tracking', true)).toBe('sentry')
    expect(resolveCreationProvider('jobs', 'inngest')).toBe('inngest')
    expect(resolveCreationProvider('error-tracking', 'sentry')).toBe('sentry')
  })

  test('creation uses its provider recommendation without changing addition defaults', () => {
    expect(resolveCreationProvider('storage', true)).toBe('r2')
    expect(resolveCreationProvider('cache', true)).toBe('upstash')
    expect(resolveAdapter('storage', true)).toBe('s3')
    expect(resolveAdapter('cache', true)).toBe('redis')
  })

  test('creation rejects unsupported module providers', () => {
    expect(() => resolveCreationProvider('jobs', 'trigger')).toThrow(/Unknown jobs provider/)
    expect(() => resolveCreationProvider('error-tracking', 'console')).toThrow(
      /Unknown errors provider/,
    )
  })
})

describe('choices', () => {
  test('CAPABILITIES covers ports and modules', () => {
    expect(CAPABILITIES).toEqual(
      expect.arrayContaining(['storage', 'cache', 'jobs', 'logger', 'analytics', 'error-tracking']),
    )
  })
  test('capabilityChoices: one entry per capability, with hints', () => {
    const choices = capabilityChoices()
    expect(choices).toHaveLength(CAPABILITIES.length)
    for (const c of choices) {
      expect(c).toMatchObject({ value: expect.any(String), label: expect.any(String) })
      expect(c.hint.length).toBeGreaterThan(0)
    }
  })
  test('adapterChoices exposes default + every adapter', () => {
    const { defaultAdapter, options } = adapterChoices('cache')
    expect(defaultAdapter).toBe('redis')
    expect(options.map((o) => o.value).sort()).toEqual(['memory', 'redis', 'upstash'])
    expect(creationProviderChoices('cache').defaultAdapter).toBe('upstash')
  })
})
