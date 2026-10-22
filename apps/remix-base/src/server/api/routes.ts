import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { Router } from 'remix/router'
import { appRouter } from './root.ts'
import { createTRPCContext } from './trpc.ts'

export function installApiRoutes(router: Router): void {
  router.route('ANY', '/api/trpc/*path', ({ request }) =>
    fetchRequestHandler({
      endpoint: '/api/trpc',
      req: request,
      router: appRouter,
      createContext: () => createTRPCContext({ request }),
    }),
  )
}
