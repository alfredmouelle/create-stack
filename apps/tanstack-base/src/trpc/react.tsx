import { type QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createTRPCClient, httpBatchStreamLink, loggerLink } from '@trpc/client'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
import { createTRPCContext, createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import type { ReactNode } from 'react'
import superjson from 'superjson'
import type { AppRouter } from '~/server/api/root'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()

export type RouterInputs = inferRouterInputs<AppRouter>

export type RouterOutputs = inferRouterOutputs<AppRouter>

function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  return `http://localhost:${process.env.PORT ?? 3000}`
}

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (op) => op.direction === 'down' && op.result instanceof Error,
    }),
    httpBatchStreamLink({
      transformer: superjson,
      url: `${getBaseUrl()}/api/trpc`,
    }),
  ],
})

export function createServerHelpers(queryClient: QueryClient) {
  return createTRPCOptionsProxy<AppRouter>({
    client: trpcClient,
    queryClient,
  })
}

export function TRPCReactProvider(props: { children: ReactNode; queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={props.queryClient}>
      <TRPCProvider queryClient={props.queryClient} trpcClient={trpcClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}
