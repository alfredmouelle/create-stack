import { fillTemplate } from '../javascript/reference-parts.ts'
import type { StackSelection } from '../reference-application.ts'

const template = (name: string, fields: Readonly<Record<string, string>>): string =>
  fillTemplate(`tanstack/assembly/${name}.txt`, fields)

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
      ? 'interface RouterContext {\n  readonly queryClient: QueryClient\n  readonly trpc: TRPCOptionsProxy<AppRouter>\n}\n\n'
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
