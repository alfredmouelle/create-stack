import { TEMPLATES } from './paths.mjs'
import { copy, editFile, join, remove } from './util.mjs'

export const AUTHS = ['better-auth', 'clerk']
export const DEFAULT_AUTH = 'better-auth'

export function resolveAuth(value) {
  if (value === 'none') return 'none'
  if (value === true || value == null || value === '') return DEFAULT_AUTH
  if (!AUTHS.includes(value)) {
    throw new Error(`Unknown auth: ${value} (have ${AUTHS.join(', ')}, none)`)
  }
  return value
}

const CLERK = {
  tanstack: {
    pkg: '@clerk/tanstack-react-start',
    range: '^1.4.0',
    publishableKey: 'VITE_CLERK_PUBLISHABLE_KEY',
  },
  next: {
    pkg: '@clerk/nextjs',
    range: '^7.5.0',
    publishableKey: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  },
}

const src = (projectDir, p) => join(projectDir, 'src', p)

const empty = () => ({ removeDeps: [], addDeps: {}, envLines: [] })

export function applyAuth({ projectDir, framework, auth, trpcKept }) {
  if (auth === 'better-auth') return empty()

  stripBetterAuth(projectDir, framework)

  if (auth === 'none') {
    if (trpcKept) editFile(src(projectDir, 'server/api/trpc.ts'), stripAuthFromTrpc)
    return { ...empty(), removeDeps: ['better-auth'] }
  }

  const spec = CLERK[framework]
  vendorClerk(projectDir, framework)
  if (trpcKept) editFile(src(projectDir, 'server/api/trpc.ts'), (c) => clerkifyTrpc(c, framework))
  return {
    removeDeps: ['better-auth'],
    addDeps: { [spec.pkg]: spec.range },
    envLines: [`${spec.publishableKey}=pk_test_change_me`, 'CLERK_SECRET_KEY=sk_test_change_me'],
  }
}

function stripBetterAuth(projectDir, framework) {
  const s = (p) => src(projectDir, p)
  remove(s('server/better-auth'))
  remove(s('features/auth'))
  const dirs =
    framework === 'next'
      ? ['app/auth', 'app/api/auth', 'app/dashboard', 'server/auth']
      : [
          'routes/auth.tsx',
          'routes/auth',
          'routes/_authed.tsx',
          'routes/_authed',
          'routes/api/auth',
        ]
  for (const d of dirs) remove(s(d))
}

function vendorClerk(projectDir, framework) {
  copy(join(TEMPLATES, `auth/clerk/${framework}`), projectDir)
  if (framework === 'next') injectClerkProviderNext(projectDir)
  else injectClerkProviderTanstack(projectDir)
}

const CLERK_TANSTACK_IMPORT = "import { ClerkProvider } from '@clerk/tanstack-react-start'\n"

function injectClerkProviderTanstack(projectDir) {
  editFile(src(projectDir, 'routes/__root.tsx'), (c) =>
    wrapHtmlWithClerk(`${CLERK_TANSTACK_IMPORT}${c}`),
  )
}

const CLERK_NEXT_IMPORT = "import { ClerkProvider } from '@clerk/nextjs'\n"

function injectClerkProviderNext(projectDir) {
  editFile(src(projectDir, 'app/layout.tsx'), (c) => wrapHtmlWithClerk(`${CLERK_NEXT_IMPORT}${c}`))
}

function wrapHtmlWithClerk(content) {
  return content.replace(/( {4}<html[\s\S]*? {4}<\/html>)/, (html) => {
    const nestedHtml = html
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')
    return `    <ClerkProvider>\n${nestedHtml}\n    </ClerkProvider>`
  })
}

const CLERK_SERVER = {
  tanstack: '@clerk/tanstack-react-start/server',
  next: '@clerk/nextjs/server',
}

const CLERK_PROTECTED = `export const protectedProcedure = t.procedure.use(timingMiddleware).use(({ ctx, next }) => {
  if (!ctx.auth.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' })
  }

  return next({ ctx: { userId: ctx.auth.userId } })
})`

function clerkifyTrpc(c, framework) {
  const clerkImport = `import { auth } from '${CLERK_SERVER[framework]}'\n`
  return `${clerkImport}${c.replace("import { auth } from '~/server/better-auth'\n", '')}`
    .replace(
      '  const session = await auth.api.getSession({ headers: opts.headers })\n  return { db, session, ...opts }',
      '  return { db, auth: await auth(), ...opts }',
    )
    .replace(/export const protectedProcedure = t\.procedure[\s\S]*$/, `${CLERK_PROTECTED}\n`)
}

function stripAuthFromTrpc(c) {
  return c
    .replace(
      "import { initTRPC, TRPCError } from '@trpc/server'",
      "import { initTRPC } from '@trpc/server'",
    )
    .replace("import { auth } from '~/server/better-auth'\n", '')
    .replace('  const session = await auth.api.getSession({ headers: opts.headers })\n', '')
    .replace('return { db, session, ...opts }', 'return { db, ...opts }')
    .replace(/\n+export const protectedProcedure = t\.procedure[\s\S]*$/, '\n')
}
