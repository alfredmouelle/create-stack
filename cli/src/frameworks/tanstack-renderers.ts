import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TEMPLATES } from '#lib/paths.mjs'
import type { StackSelection } from '../reference-application.ts'

function template(name: string, fields: Readonly<Record<string, string>>): string {
  let content = readFileSync(join(TEMPLATES, 'tanstack/assembly', `${name}.txt`), 'utf8')
  for (const [key, value] of Object.entries(fields))
    content = content.replaceAll(`__${key}__`, value)
  if (/__[A-Z_]+__/.test(content)) throw new Error(`Unfilled TanStack template: ${name}`)
  return content
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

export function renderTrpc(selection: StackSelection): string {
  const hasDatabase = selection.database === 'drizzle' || selection.database === 'prisma'
  const context = [
    ...(hasDatabase ? ['db'] : []),
    ...(selection.auth === 'better-auth' ? ['session'] : []),
    ...(selection.auth === 'clerk' ? ['auth: await auth()'] : []),
    '...opts',
  ]
  const betterAuthProcedure = readFileSync(
    join(TEMPLATES, 'tanstack/assembly/protected-better-auth.txt'),
    'utf8',
  )
  return template('trpc', {
    TRPC_EXPORTS: selection.auth === 'none' ? 'initTRPC' : 'initTRPC, TRPCError',
    AUTH_IMPORT:
      selection.auth === 'better-auth'
        ? "import { auth } from '~/server/better-auth'\n"
        : selection.auth === 'clerk'
          ? "import { auth } from '@clerk/tanstack-react-start/server'\n"
          : '',
    DATABASE_IMPORT: hasDatabase ? "import { db } from '~/server/db'\n" : '',
    CONTEXT: `${selection.auth === 'better-auth' ? '  const session = await auth.api.getSession({ headers: opts.headers })\n' : ''}  return { ${context.join(', ')} }`,
    PROTECTED_PROCEDURE:
      selection.auth === 'better-auth'
        ? betterAuthProcedure
        : selection.auth === 'clerk'
          ? `export const protectedProcedure = t.procedure.use(timingMiddleware).use(({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  return next({ ctx: { userId: ctx.auth.userId } })
})
`
          : '',
  })
}

export function renderMailer(selection: StackSelection): string {
  const adapter = `${selection.mailer}Adapter`
  return template('mailer', {
    ADAPTER_IMPORT: `import { ${adapter} } from './adapters/${selection.mailer}'`,
    ADAPTER:
      selection.mailer === 'ses'
        ? `${adapter}()`
        : `${adapter}({ apiKey: env.${selection.mailer === 'resend' ? 'RESEND' : 'BREVO'}_API_KEY })`,
  })
}
