import { describe, expect, test } from 'vitest'
import { FOUNDATIONS, foundationDeps, foundationScripts } from '../lib/foundations.mjs'

describe('foundationDeps', () => {
  test('trpc bridges differ per framework', () => {
    expect(foundationDeps('trpc', 'tanstack')).toContain('@trpc/tanstack-react-query')
    expect(foundationDeps('trpc', 'next')).toContain('@trpc/react-query')
  })
  test('drizzle contributes prod + dev deps', () => {
    const deps = foundationDeps('drizzle', 'next')
    expect(deps).toEqual(expect.arrayContaining(['drizzle-orm', 'pg', 'drizzle-kit', '@types/pg']))
  })
  test('unknown foundation → []', () => {
    expect(foundationDeps('nope', 'next')).toEqual([])
  })
})

describe('foundationScripts', () => {
  test('drizzle owns the db:* scripts', () => {
    expect(foundationScripts('drizzle')).toContain('db:seed')
  })
  test('a foundation without scripts → []', () => {
    expect(foundationScripts('better-auth')).toEqual([])
  })
})

test('FOUNDATIONS is the canonical set', () => {
  expect(FOUNDATIONS).toEqual(['drizzle', 'trpc', 'better-auth'])
})
