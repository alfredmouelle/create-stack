// Fast, install-free matrix: selected stack axes are present, excluded ones are gone,
// and no dangling imports remain. The installed proof lives in smoke.test.mjs.

import { afterAll, describe, expect, test } from 'vitest'
import { build, cleanup, exists, filesImporting, read, readJSON } from './helpers.mjs'

afterAll(cleanup)

const TRPC_DIR = 'src/trpc'
const TRPC_DEP = '@trpc/server'
const TRPC_IMPORTS = ['~/trpc', '~/server/api']

// per-framework paths the auth axis touches
const AUTH_PATHS = {
  tanstack: { shell: 'src/routes/__root.tsx', signIn: 'src/routes/sign-in.$.tsx' },
  next: { shell: 'src/app/layout.tsx', signIn: 'src/app/sign-in/[[...sign-in]]/page.tsx' },
}

// opt-in components are stripped from every scaffold (re-added via `create-stack add`).
const STRIPPED_COMPONENT_FILES = [
  'src/components/data-table.tsx',
  'src/components/infinite-data-table.tsx',
  'src/components/sortable-header.tsx',
  'src/hooks/use-data-table.tsx',
  'src/components/ui/date-picker.tsx',
  'src/components/ui/date-range-picker.tsx',
  'src/components/ui/calendar.tsx',
  'src/components/ui/popover.tsx',
  'src/lib/date.ts',
]
const STRIPPED_COMPONENT_DEPS = ['@tanstack/react-table', 'react-day-picker', 'date-fns']

function assertComponentsStripped(dir, deps) {
  for (const f of STRIPPED_COMPONENT_FILES)
    expect(exists(`${dir}/${f}`), `${f} stripped`).toBe(false)
  for (const d of STRIPPED_COMPONENT_DEPS) expect(d in deps, `${d} removed`).toBe(false)
}

const allDeps = (pkg) => ({ ...pkg.dependencies, ...pkg.devDependencies })

function assertTrpc(dir, trpc, deps) {
  expect(exists(`${dir}/${TRPC_DIR}`), `trpc dir present=${trpc}`).toBe(trpc)
  expect(TRPC_DEP in deps, `trpc dep present=${trpc}`).toBe(trpc)
  if (!trpc) expect(filesImporting(dir, TRPC_IMPORTS), 'dangling trpc imports').toEqual([])
}

// the auth axis: the chosen provider is wired, better-auth files gone when swapped
function assertAuth(dir, auth, deps, framework) {
  const paths = AUTH_PATHS[framework]
  const baPresent = auth === 'better-auth'
  expect(exists(`${dir}/src/server/better-auth`), `better-auth dir present=${baPresent}`).toBe(
    baPresent,
  )
  expect('better-auth' in deps, `better-auth dep present=${baPresent}`).toBe(baPresent)
  if (!baPresent) {
    expect(filesImporting(dir, ['~/server/better-auth']), 'dangling auth imports').toEqual([])
  }

  if (auth === 'clerk') {
    const clerkPkg = framework === 'next' ? '@clerk/nextjs' : '@clerk/tanstack-react-start'
    expect(clerkPkg in deps, 'clerk dep').toBe(true)
    expect(read(`${dir}/${paths.shell}`), 'ClerkProvider in shell').toContain('ClerkProvider')
    expect(exists(`${dir}/${paths.signIn}`), 'clerk sign-in route').toBe(true)
  } else {
    expect('@clerk/nextjs' in deps || '@clerk/tanstack-react-start' in deps, 'no clerk dep').toBe(
      false,
    )
  }
}

// the ORM axis: the chosen provider is wired, the others (and Drizzle's config) are gone
function assertDatabase(dir, database, deps, authKept, framework) {
  // Convex replaces the SQL data layer entirely; only drizzle/prisma keep src/server/db.
  const hasSqlDb = database === 'drizzle' || database === 'prisma'
  expect(exists(`${dir}/src/server/db`), `db layer present=${hasSqlDb}`).toBe(hasSqlDb)

  if (database === 'convex') {
    expect('convex' in deps, 'convex dep').toBe(true)
    expect('drizzle-orm' in deps, 'drizzle-orm removed').toBe(false)
    expect(exists(`${dir}/drizzle.config.ts`), 'no drizzle.config').toBe(false)
    expect(exists(`${dir}/convex/schema.ts`), 'convex schema').toBe(true)
    expect(exists(`${dir}/convex/_generated/api.d.ts`), 'convex generated').toBe(true)
    const shell = framework === 'next' ? 'src/app/layout.tsx' : 'src/routes/__root.tsx'
    expect(read(`${dir}/${shell}`), 'convex provider in shell').toContain('Convex')
    const demo =
      framework === 'next' ? 'src/app/convex-demo/page.tsx' : 'src/routes/convex-demo.tsx'
    expect(exists(`${dir}/${demo}`), 'convex demo route').toBe(true)
    expect(filesImporting(dir, ['~/server/db']), 'dangling db imports').toEqual([])
    return
  }

  if (database === 'drizzle') {
    expect('drizzle-orm' in deps, 'drizzle-orm dep').toBe(true)
    expect(exists(`${dir}/drizzle.config.ts`), 'drizzle.config').toBe(true)
    expect('@prisma/client' in deps, 'no prisma dep').toBe(false)
    if (authKept)
      expect(read(`${dir}/src/server/better-auth/config.ts`)).toContain('drizzleAdapter')
  } else if (database === 'prisma') {
    expect('@prisma/client' in deps, 'prisma client dep').toBe(true)
    expect('prisma' in deps, 'prisma cli dep').toBe(true)
    expect('drizzle-orm' in deps, 'drizzle-orm removed').toBe(false)
    expect('drizzle-kit' in deps, 'drizzle-kit removed').toBe(false)
    expect(exists(`${dir}/drizzle.config.ts`), 'no drizzle.config').toBe(false)
    expect(exists(`${dir}/prisma.config.ts`), 'prisma.config').toBe(true)
    expect(exists(`${dir}/prisma/schema/schema.prisma`), 'prisma schema').toBe(true)
    expect(read(`${dir}/package.json`)).toContain('prisma generate')
    const authSchema = exists(`${dir}/prisma/schema/auth.prisma`)
    expect(authSchema, `auth.prisma present=${authKept}`).toBe(authKept)
    if (authKept) {
      const cfg = read(`${dir}/src/server/better-auth/config.ts`)
      expect(cfg).toContain('prismaAdapter')
      expect(cfg).not.toContain('drizzleAdapter')
    }
  } else {
    expect('drizzle-orm' in deps, 'drizzle-orm removed').toBe(false)
    expect('@prisma/client' in deps, 'prisma removed').toBe(false)
    expect(filesImporting(dir, ['~/server/db']), 'dangling db imports').toEqual([])
  }
}

function assertMailer(dir, result, deps) {
  expect('resend' in deps, 'resend dep').toBe(result.mailerProvider === 'resend')
  if (!result.keptMailer) {
    expect(exists(`${dir}/src/server/email`), 'email dir').toBe(false)
    expect(filesImporting(dir, ['~/server/email']), 'dangling email imports').toEqual([])
    return
  }
  // env.ts is the source of truth: the root reads env directly, no redundant guard
  const root = read(`${dir}/src/server/email/index.ts`)
  expect(root, 'no required() guard in email root').not.toContain('function required')
  // resend/brevo read their key straight off env (ses uses the AWS credential chain)
  if (result.mailerProvider !== 'ses') expect(root).toContain('apiKey: env.')
}

function assertTrpcContext(dir, database, auth) {
  const context = read(`${dir}/src/server/api/trpc.ts`)
  const hasDatabaseContext = database === 'drizzle' || database === 'prisma'
  const hasAuth = auth !== 'none'

  expect(context.includes("import { db } from '~/server/db'"), 'database context import').toBe(
    hasDatabaseContext,
  )
  expect(context.includes('db,'), 'database context value').toBe(hasDatabaseContext)
  expect(context.includes('export const protectedProcedure'), 'protected procedure').toBe(hasAuth)

  if (auth === 'better-auth') {
    expect(context).toContain("import { auth } from '~/server/better-auth'")
    expect(context).toContain('session,')
    expect(context).not.toContain('auth: await auth()')
  } else if (auth === 'clerk') {
    expect(context).toContain("import { auth } from '@clerk/")
    expect(context).toContain('auth: await auth()')
    expect(context).not.toContain('session,')
  } else {
    expect(context).not.toContain('import { auth }')
    expect(context).not.toContain('session,')
    expect(context).not.toContain('auth: await auth()')
  }
}

function assertCapabilities(dir, env, capabilities = {}) {
  for (const cap of Object.keys(capabilities)) {
    expect(exists(`${dir}/src/server/${cap}`), `${cap} vendored`).toBe(true)
    // no redundant env re-validation in the composition root
    expect(read(`${dir}/src/server/${cap}/index.ts`)).not.toContain('function required')
  }
  if (capabilities.storage === 's3') expect(env).toContain('S3_BUCKET')
  if (capabilities.cache === 'redis') expect(env).toContain('REDIS_URL')
}

// name, database (omit=drizzle), auth (omit=better-auth), trpc (omit=true), mailer, capabilities
const CONFIGS = [
  { name: 'full' },
  { name: 'full-caps', capabilities: { storage: 's3', cache: 'redis' } },
  { name: 'prisma-full', database: 'prisma' },
  {
    name: 'prisma-no-auth',
    database: 'prisma',
    auth: 'none',
    trpc: true,
    mailer: 'none',
  },
  { name: 'drizzle-trpc', auth: 'none', trpc: true, mailer: 'ses' },
  { name: 'auth-no-trpc', trpc: false },
  { name: 'clerk-full', auth: 'clerk' },
  { name: 'clerk-prisma', database: 'prisma', auth: 'clerk' },
  {
    name: 'clerk-no-database-no-trpc',
    database: 'none',
    auth: 'clerk',
    trpc: false,
    mailer: 'none',
  },
  {
    name: 'trpc-no-data-auth',
    database: 'none',
    auth: 'none',
    trpc: true,
    mailer: 'none',
  },
  {
    name: 'trpc-auth-only',
    database: 'none',
    auth: 'clerk',
    trpc: true,
    mailer: 'none',
  },
  { name: 'convex-none', database: 'convex', auth: 'none', mailer: 'none' },
  { name: 'convex-clerk', database: 'convex', auth: 'clerk', mailer: 'none' },
  { name: 'drizzle-only', auth: 'none', trpc: false, mailer: 'none' },
  { name: 'minimal', database: 'none', auth: 'none', trpc: false, mailer: 'none' },
]

for (const framework of ['tanstack', 'next']) {
  describe(framework, () => {
    for (const cfg of CONFIGS) {
      test(cfg.name, () => {
        const { dir, result } = build({ ...cfg, framework })
        const pkg = readJSON(`${dir}/package.json`)
        const deps = allDeps(pkg)
        const env = exists(`${dir}/.env.example`) ? read(`${dir}/.env.example`) : ''

        expect(pkg.name).toBe(cfg.name)
        expect(pkg.private).toBe(true)
        expect(exists(`${dir}/src/env.ts`)).toBe(true)

        assertTrpc(dir, result.trpc, deps)
        assertAuth(dir, result.auth, deps, framework)
        assertDatabase(dir, result.database, deps, result.auth === 'better-auth', framework)
        assertComponentsStripped(dir, deps)
        assertMailer(dir, result, deps)
        if (result.trpc) assertTrpcContext(dir, result.database, result.auth)

        // env keys track the selection (Convex uses raw CONVEX_* keys, no DATABASE_URL)
        const sqlDb = result.database === 'drizzle' || result.database === 'prisma'
        expect(env.includes('DATABASE_URL')).toBe(sqlDb)
        expect(env.includes('BETTER_AUTH_SECRET')).toBe(result.auth === 'better-auth')
        expect(env.includes('CLERK_SECRET_KEY')).toBe(result.auth === 'clerk')
        const convexUrlKey = framework === 'next' ? 'NEXT_PUBLIC_CONVEX_URL' : 'VITE_CONVEX_URL'
        expect(env.includes(convexUrlKey)).toBe(result.database === 'convex')
        expect(env.includes('CONVEX_DEPLOYMENT')).toBe(result.database === 'convex')

        // better-auth secret is generated into .env (gitignored); .env.example keeps the placeholder
        if (result.auth === 'better-auth') {
          const dotenv = read(`${dir}/.env`)
          expect(dotenv).toMatch(/BETTER_AUTH_SECRET=.+/)
          expect(dotenv, 'real secret in .env').not.toContain(
            'BETTER_AUTH_SECRET=change-me-with-a-long-random-string',
          )
          expect(env, 'placeholder in .env.example').toContain(
            'BETTER_AUTH_SECRET=change-me-with-a-long-random-string',
          )
        }

        assertCapabilities(dir, env, cfg.capabilities)

        // every scaffold ships a CI workflow wired to the chosen pm (pnpm in tests)
        const ci = read(`${dir}/.github/workflows/ci.yml`)
        expect(ci).toContain('pnpm install --frozen-lockfile')
        expect(ci).toContain('pnpm run typecheck')
        expect(ci).toContain('pnpm run check')
      })
    }
  })
}
