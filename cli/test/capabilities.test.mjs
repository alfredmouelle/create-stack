import { describe, expect, test } from 'vitest'
import {
  adapterChoices,
  CAPABILITIES,
  capabilityChoices,
  resolveAdapter,
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

describe('choices', () => {
  test('CAPABILITIES is the swappable set', () => {
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
  })
})
