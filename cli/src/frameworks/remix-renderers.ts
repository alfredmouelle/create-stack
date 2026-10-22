import { fillTemplate } from '../javascript/reference-parts.ts'
import type { StackSelection } from '../reference-application.ts'

const authWiring = {
  'better-auth': {
    imports:
      "import { auth } from './server/better-auth/config.ts'\nimport type { Authentication } from './server/better-auth/routes.tsx'\nimport { installAuthRoutes } from './server/better-auth/routes.tsx'\n",
    parameters: 'authentication: Authentication = auth',
    install: '  installAuthRoutes(router, authentication)\n',
  },
  clerk: {
    imports: "import { installClerkRoutes } from './server/clerk/routes.tsx'\n",
    parameters: '',
    install: '',
  },
  none: { imports: '', parameters: '', install: '' },
} as const

export function renderRemixRouter(selection: StackSelection): string {
  const auth = authWiring[selection.auth]
  const convex = selection.database === 'convex'
  const installAuth =
    selection.auth === 'clerk' ? `  installClerkRoutes(router, ${convex})\n` : auth.install
  return fillTemplate('remix/assembly/router.txt', {
    PUBLIC_API_IMPORT: selection.trpc ? "import { ApiDemo } from './client/api-demo.tsx'\n" : '',
    SERVER_API_IMPORT: selection.trpc
      ? "import { installApiRoutes } from './server/api/routes.ts'\n"
      : '',
    AUTH_IMPORTS: `${auth.imports}${convex ? "import { renderConvexDemo } from './server/convex.tsx'\n" : ''}`,
    PARAMETERS: auth.parameters,
    INTEGRATIONS: `${installAuth}${selection.trpc ? "  installApiRoutes(router)\n  router.get('/api-demo', ({ request }) => renderPage(request, 'API connection', <ApiDemo />))\n" : ''}${convex ? "  router.get('/convex-demo', ({ request }) => renderConvexDemo(request))\n" : ''}`,
  })
}

export function renderRemixAssets(selection: StackSelection): string {
  return fillTemplate('remix/assembly/assets.txt', {
    PACKAGES: [
      ...(selection.trpc ? ['@trpc/client', '@trpc/server', 'superjson'] : []),
      ...(selection.auth === 'clerk' ? ['@clerk/clerk-js'] : []),
      ...(selection.database === 'convex' ? ['convex'] : []),
    ]
      .map((name) => `    '${name}',\n`)
      .join(''),
  })
}

const contextWiring = {
  'better-auth': {
    import: "import { auth } from '~/server/better-auth'\n",
    value: 'session',
    type: 'Awaited<ReturnType<typeof auth.api.getSession>>',
    initialize: '  const session = await auth.api.getSession({ headers: request.headers })\n',
    guard: 'ctx.session?.user',
    protected: 'session: { ...ctx.session, user: ctx.session.user }',
  },
  clerk: {
    import: "import { authenticate } from '~/server/clerk/auth'\n",
    value: 'identity',
    type: 'Awaited<ReturnType<typeof authenticate>>',
    initialize: '  const identity = await authenticate(request)\n',
    guard: 'ctx.identity.userId',
    protected: 'identity: { ...ctx.identity, userId: ctx.identity.userId }',
  },
  none: { import: '', value: '', type: '', initialize: '', guard: '', protected: '' },
} as const

export function renderRemixTrpc(selection: StackSelection): string {
  const sql = selection.database === 'drizzle' || selection.database === 'prisma'
  const auth = contextWiring[selection.auth]
  const fields = [
    ...(sql ? ['db'] : []),
    ...(auth.value ? [auth.value] : []),
    'headers: request.headers',
  ]
  return fillTemplate('remix/assembly/trpc.txt', {
    IMPORTS: `${auth.import}${sql ? "import { db } from '~/server/db'\n" : ''}`,
    CONTEXT_FIELDS: [
      ...(sql ? ['  readonly db: typeof db\n'] : []),
      ...(auth.value ? [`  readonly ${auth.value}: ${auth.type}\n`] : []),
      '  readonly headers: Headers\n',
    ].join(''),
    CONTEXT: `${auth.initialize}  return { ${fields.join(', ')} }`,
    PROTECTED: auth.guard
      ? `export const protectedProcedure = t.procedure.use(({ ctx, next }) => {\n  if (!${auth.guard}) throw new TRPCError({ code: 'UNAUTHORIZED' })\n  return next({ ctx: { ${auth.protected} } })\n})\n`
      : '',
  }).replace(
    'import { initTRPC, TRPCError }',
    `import { ${auth.guard ? 'initTRPC, TRPCError' : 'initTRPC'} }`,
  )
}
