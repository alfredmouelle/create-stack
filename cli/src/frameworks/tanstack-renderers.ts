import { fillTemplate } from '../javascript/reference-parts.ts'
import type { StackSelection } from '../reference-application.ts'

const template = (name: string, fields: Readonly<Record<string, string>>): string =>
  fillTemplate(`tanstack/assembly/${name}.txt`, fields)

export function renderRouter({ trpc }: StackSelection): string {
  return template('router', {
    SSR_IMPORT: trpc
      ? "import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'\n"
      : '',
    TRPC_IMPORTS: trpc
      ? "import { createQueryClient } from './trpc/query-client'\nimport { createServerHelpers, TRPCReactProvider } from './trpc/react'\n"
      : '',
    QUERY_CONTEXT: trpc
      ? '  const queryClient = createQueryClient()\n  const trpc = createServerHelpers(queryClient)\n\n'
      : '',
    ROUTER_CONTEXT: trpc ? '    context: { queryClient, trpc },\n' : '',
    PRELOAD_STALE_TIME: trpc ? '    defaultPreloadStaleTime: 0,\n' : '',
    WRAP: trpc
      ? '      <ThemeProvider defaultTheme="system">\n        <TRPCReactProvider queryClient={queryClient}>{props.children}</TRPCReactProvider>\n      </ThemeProvider>'
      : '      <ThemeProvider defaultTheme="system">{props.children}</ThemeProvider>',
    SSR_INTEGRATION: trpc
      ? '  setupRouterSsrQueryIntegration({\n    router,\n    queryClient,\n    wrapQueryClient: false,\n  })\n\n'
      : '',
  })
}

export function renderDevtools({ trpc }: StackSelection): string {
  return template('devtools', {
    QUERY_IMPORT: trpc ? "import TanStackQueryDevtools from '~/trpc/devtools'\n" : '',
    QUERY_PLUGIN: trpc ? '        TanStackQueryDevtools,\n' : '',
  })
}

export function renderRoot(selection: StackSelection): string {
  const clerk = selection.auth === 'clerk'
  const convex = selection.database === 'convex'
  const providerImports = [
    ...(clerk ? ["import { ClerkProvider } from '@clerk/tanstack-react-start'\n"] : []),
    ...(convex
      ? [
          clerk
            ? "import { useAuth } from '@clerk/tanstack-react-start'\nimport { ConvexReactClient } from 'convex/react'\nimport { ConvexProviderWithClerk } from 'convex/react-clerk'\n\n"
            : "import { ConvexProvider, ConvexReactClient } from 'convex/react'\n\n",
          'const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)\n',
        ]
      : []),
  ].join('')
  return template('root', {
    PROVIDER_IMPORTS: providerImports,
    QUERY_IMPORT: selection.trpc
      ? "import type { QueryClient } from '@tanstack/react-query'\n"
      : '',
    ROOT_FACTORY: selection.trpc ? 'createRootRouteWithContext' : 'createRootRoute',
    TRPC_IMPORT: selection.trpc
      ? "import type { TRPCOptionsProxy } from '@trpc/tanstack-react-query'\n"
      : '',
    APP_ROUTER_IMPORT: selection.trpc ? "import type { AppRouter } from '~/server/api/root'\n" : '',
    ROUTER_CONTEXT: selection.trpc
      ? 'interface RouterContext {\n  queryClient: QueryClient\n  trpc: TRPCOptionsProxy<AppRouter>\n}\n\n'
      : '',
    CREATE_ROOT: selection.trpc ? 'createRootRouteWithContext<RouterContext>()' : 'createRootRoute',
    CLERK_OPEN: clerk ? '    <ClerkProvider>\n' : '',
    CLERK_CLOSE: clerk ? '\n    </ClerkProvider>' : '',
    CHILDREN: convex
      ? clerk
        ? '<ConvexProviderWithClerk client={convex} useAuth={useAuth}>{children}</ConvexProviderWithClerk>'
        : '<ConvexProvider client={convex}>{children}</ConvexProvider>'
      : '{children}',
  })
}
