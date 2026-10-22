import { createTRPCClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import { expect, test } from 'vitest'
import { router } from '../../router.tsx'
import type { AppRouter } from './root.ts'

const applicationFetch: NonNullable<Parameters<typeof httpBatchLink<AppRouter>>[0]['fetch']> = (
  url,
  init,
) => router.fetch(new Request(url, { ...init, signal: init?.signal ?? null }))

test('serves the native vanilla tRPC client over the application Fetch boundary', async () => {
  const client = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: 'http://localhost:3074/api/trpc',
        transformer: superjson,
        fetch: applicationFetch,
      }),
    ],
  })
  const response = await client.health.ping.query()
  expect(response.ok).toBe(true)
  expect(Number.isNaN(Date.parse(response.time))).toBe(false)
})
