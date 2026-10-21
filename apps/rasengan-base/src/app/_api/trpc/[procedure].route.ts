import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '~/server/api/root'
import { createTRPCContext } from '~/server/api/trpc'

export function GET({ request }: { readonly request: Request }): Promise<Response> {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: request.headers }),
  })
}

export const POST = GET
