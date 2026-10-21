import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import type { NextRequest } from 'next/server'
import { env } from '~/env'
import { appRouter } from '~/server/api/root'
import { createTRPCContext } from '~/server/api/trpc'

const createContext = (req: NextRequest): ReturnType<typeof createTRPCContext> =>
  createTRPCContext({ headers: req.headers })

const handler = (req: NextRequest): Promise<Response> =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError: ({ path, error }) => {
      if (env.NODE_ENV !== 'development') return
      console.error(`❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`)
    },
  })

export { handler as GET, handler as POST }
