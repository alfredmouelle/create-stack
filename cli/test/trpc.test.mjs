import { describe, expect, test } from 'vitest'
import { trpcDeps } from '../lib/trpc.mjs'

describe('trpcDeps', () => {
  test('includes the framework-specific React Query bridge', () => {
    expect(trpcDeps('tanstack')).toContain('@trpc/tanstack-react-query')
    expect(trpcDeps('next')).toContain('@trpc/react-query')
  })

  test('includes the shared client and server runtime', () => {
    expect(trpcDeps('next')).toEqual(
      expect.arrayContaining(['@trpc/server', '@trpc/client', '@tanstack/react-query']),
    )
  })
})
