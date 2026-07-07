import { describe, expect, test } from 'vitest'
import { FOUNDATIONS, foundationDeps, foundationScripts } from '../lib/foundations.mjs'

describe('foundationDeps', () => {
  test('trpc bridges differ per framework', () => {
    expect(foundationDeps('trpc', 'tanstack')).toContain('@trpc/tanstack-react-query')
    expect(foundationDeps('trpc', 'next')).toContain('@trpc/react-query')
  })
  test('unknown foundation → []', () => {
    expect(foundationDeps('nope', 'next')).toEqual([])
  })
})

describe('foundationScripts', () => {
  test('a foundation without scripts → []', () => {
    expect(foundationScripts('better-auth')).toEqual([])
  })
})

test('FOUNDATIONS is the canonical set (ORM + auth are their own axes)', () => {
  expect(FOUNDATIONS).toEqual(['trpc'])
})
