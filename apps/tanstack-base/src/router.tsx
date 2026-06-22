import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import type { ReactNode } from 'react'
import { routeTree } from './routeTree.gen'
import { createQueryClient } from './trpc/query-client'
import { createServerHelpers, TRPCReactProvider } from './trpc/react'

export function getRouter() {
  const queryClient = createQueryClient()
  const trpc = createServerHelpers(queryClient)

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient, trpc },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,

    Wrap: (props: { children: ReactNode }) => (
      <TRPCReactProvider queryClient={queryClient}>{props.children}</TRPCReactProvider>
    ),
  })

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
    wrapQueryClient: false,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
