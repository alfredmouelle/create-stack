import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '~/server/api/root'
import { createTRPCContext } from '~/server/api/trpc'

function handler({ request }: { request: Request }) {
  return fetchRequestHandler({
    req: request,
    router: appRouter,
    endpoint: '/api/trpc',
    createContext: () => createTRPCContext({ headers: request.headers }),
    onError: ({ path, error }) => {
      if (!import.meta.env.DEV) return
      console.error(`❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`)
    },
  })
}

export const Route = createFileRoute('/api/trpc/$')({
  server: {
    handlers: {
      GET: handler,
      POST: handler,
    },
  },
})
