import { accessSync, constants } from 'node:fs'
import type { Auth, Database, Framework } from '@alfredmouelle/stack-config'
import { afterAll, describe, expect, test } from 'vitest'
import type { CapabilitySelection } from '../src/framework-module.ts'
import {
  type BuildConfig,
  build,
  cleanup,
  exists,
  filesImporting,
  REPO_ROOT,
  read,
} from './helpers.ts'
import { readField, readJson } from './json.ts'

afterAll(cleanup)

const TRPC_DIR = 'src/trpc'
const TRPC_DEP = '@trpc/server'
const TRPC_IMPORTS = ['~/trpc', '~/server/api']

type Config = Omit<BuildConfig, 'framework' | 'name'> & { readonly name: string }
type Deps = Record<string, unknown>
type BuildResult = Awaited<ReturnType<typeof build>>['result']

const AUTH_PATHS = {
  remix: { shell: 'src/server/clerk/routes.tsx', signIn: 'src/client/clerk.tsx' },
  tanstack: { shell: 'src/routes/__root.tsx', signIn: 'src/routes/sign-in.$.tsx' },
  rasengan: { shell: 'src/main.tsx', signIn: 'src/app/_routes/sign-in.page.tsx' },
  next: { shell: 'src/app/layout.tsx', signIn: 'src/app/sign-in/[[...sign-in]]/page.tsx' },
} satisfies Record<Framework, { shell: string; signIn: string }>

const OPTIONAL_COMPONENT_FILES = [
  'src/components/data-table.tsx',
  'src/components/infinite-data-table.tsx',
  'src/components/sortable-header.tsx',
  'src/hooks/use-data-table.tsx',
  'src/components/ui/date-picker.tsx',
  'src/components/ui/date-range-picker.tsx',
  'src/components/ui/calendar.tsx',
  'src/components/ui/popover.tsx',
  'src/lib/date.ts',
  'src/components/ui/confirm.tsx',
  'src/components/ui/alert.tsx',
  'src/components/ui/prompt.tsx',
  'src/components/ui/choice.tsx',
  'src/components/ui/confirm-passphrase.tsx',
  'src/components/ui/confirm-otp.tsx',
  'src/components/ui/dialog.tsx',
  'src/components/ui/input-otp.tsx',
  'src/components/ui/alert-dialog.tsx',
]
const OPTIONAL_COMPONENT_DEPS = [
  '@tanstack/react-table',
  'react-day-picker',
  'date-fns',
  'react-call',
  'input-otp',
]

function assertOptionalComponentsAbsent(dir: string, deps: Deps) {
  for (const f of OPTIONAL_COMPONENT_FILES)
    expect(exists(`${dir}/${f}`), `${f} absent from base`).toBe(false)
  for (const d of OPTIONAL_COMPONENT_DEPS) expect(d in deps, `${d} absent from base`).toBe(false)
}

const allDeps = (dir: string): Deps => ({
  ...readField(`${dir}/package.json`, 'dependencies'),
  ...readField(`${dir}/package.json`, 'devDependencies'),
})

function assertCreationMetadata(pkg: Record<string, unknown>, readme: string) {
  expect(pkg.createStackMetadata).toEqual({
    initVersion: readJson(`${REPO_ROOT}/cli/package.json`).version,
  })

  for (const heading of [
    "## What's next? How do I make an app with this?",
    '## Learn more',
    '## How do I deploy this?',
  ]) {
    expect(readme, `${heading} in README`).toContain(heading)
  }
}

function assertTrpc(dir: string, trpc: boolean, deps: Deps, framework: Framework) {
  expect(
    exists(`${dir}/${framework === 'remix' ? 'src/server/api' : TRPC_DIR}`),
    `trpc dir present=${trpc}`,
  ).toBe(trpc)
  expect(TRPC_DEP in deps, `trpc dep present=${trpc}`).toBe(trpc)
  if (framework === 'tanstack') {
    expect(deps['@tanstack/query-core'], 'query-core pinned with react-query').toBe(
      deps['@tanstack/react-query'],
    )
  }
  if (!trpc) expect(filesImporting(dir, TRPC_IMPORTS), 'dangling trpc imports').toEqual([])
}

function assertAuth(dir: string, auth: Auth, deps: Deps, framework: Framework) {
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
    const clerkPkg = {
      remix: '@clerk/clerk-js',
      next: '@clerk/nextjs',
      tanstack: '@clerk/tanstack-react-start',
      rasengan: '@clerk/react',
    }[framework]
    expect(clerkPkg in deps, 'clerk dep').toBe(true)
    expect(read(`${dir}/${paths.shell}`), 'ClerkProvider in shell').toContain(
      framework === 'remix' ? 'ClerkForm' : 'ClerkProvider',
    )
    expect(exists(`${dir}/${paths.signIn}`), 'clerk sign-in route').toBe(true)
  } else {
    expect(
      '@clerk/nextjs' in deps || '@clerk/tanstack-react-start' in deps || '@clerk/react' in deps,
      'no clerk dep',
    ).toBe(false)
  }
}

function assertTesting(dir: string, result: BuildResult, framework: Framework) {
  const sqlDb = result.database === 'drizzle' || result.database === 'prisma'
  const betterAuthTests = sqlDb && result.auth === 'better-auth'
  const authTests = betterAuthTests && result.trpc && framework !== 'remix'
  expect(readField(`${dir}/package.json`, 'scripts').test, 'test script').toBe('vitest run')
  expect(exists(`${dir}/vitest.config.mts`), 'vitest config').toBe(true)
  expect(exists(`${dir}/src/test/global-setup.ts`), `test database setup=${sqlDb}`).toBe(sqlDb)
  expect(exists(`${dir}/src/test/app.ts`), `auth test helpers=${authTests}`).toBe(authTests)
  expect(exists(`${dir}/src/server/api/trpc.test.ts`), `trpc test=${authTests}`).toBe(authTests)
  expect(exists(`${dir}/src/test/fakes.ts`), `test fakes=${betterAuthTests}`).toBe(betterAuthTests)
  expect(
    exists(
      `${dir}/src/server/better-auth/${framework === 'remix' ? 'routes.test.ts' : 'config.test.ts'}`,
    ),
    `better-auth test=${betterAuthTests}`,
  ).toBe(betterAuthTests)
  expect(exists(`${dir}/.env.test`), `test env=${sqlDb}`).toBe(sqlDb)
  if (sqlDb) {
    expect(read(`${dir}/.env.test`)).toMatch(/^DATABASE_URL=postgres:\/\/.+:5433\/.+_test$/m)
    expect(read(`${dir}/src/test/global-setup.ts`)).toContain(
      result.database === 'prisma' ? "'migrate', 'diff'" : 'pushSchema',
    )
  }
}

function assertDatabase(
  dir: string,
  database: Database,
  deps: Deps,
  authKept: boolean,
  framework: Framework,
) {
  const hasSqlDb = database === 'drizzle' || database === 'prisma'
  expect(exists(`${dir}/src/server/db`), `db layer present=${hasSqlDb}`).toBe(hasSqlDb)
  expect(exists(`${dir}/start-database.sh`), `local database script present=${hasSqlDb}`).toBe(
    hasSqlDb,
  )

  if (hasSqlDb) {
    const script = read(`${dir}/start-database.sh`)
    expect(script).toContain(`ENV_FILE="\${1:-\${SCRIPT_DIR}/.env}"`)
    expect(script).toContain('docker.io/postgres:18-alpine')
    expect(() => accessSync(`${dir}/start-database.sh`, constants.X_OK)).not.toThrow()
  }

  if (database === 'convex') {
    expect('convex' in deps, 'convex dep').toBe(true)
    expect('drizzle-orm' in deps, 'drizzle-orm removed').toBe(false)
    expect(exists(`${dir}/drizzle.config.ts`), 'no drizzle.config').toBe(false)
    expect(exists(`${dir}/convex/schema.ts`), 'convex schema').toBe(true)
    expect(exists(`${dir}/convex/_generated/api.d.ts`), 'convex generated').toBe(true)
    const shell = {
      remix: 'src/router.tsx',
      next: 'src/app/layout.tsx',
      tanstack: 'src/routes/__root.tsx',
      rasengan: 'src/main.tsx',
    }[framework]
    expect(read(`${dir}/${shell}`), 'convex provider in shell').toContain('Convex')
    const demo = {
      remix: 'src/server/convex.tsx',
      next: 'src/app/convex-demo/page.tsx',
      tanstack: 'src/routes/convex-demo.tsx',
      rasengan: 'src/app/_routes/convex-demo.page.tsx',
    }[framework]
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

function assertLocalDatabaseEnv(dir: string, projectName: string, database: Database) {
  if (!['drizzle', 'prisma'].includes(database)) return
  expect(read(`${dir}/.env`)).toContain(
    `DATABASE_URL=postgres://postgres:postgres@localhost:5432/${projectName}`,
  )
}

function assertMailer(dir: string, result: BuildResult, deps: Deps) {
  expect('resend' in deps, 'resend dep').toBe(result.mailerProvider === 'resend')
  if (!result.keptMailer) {
    expect(exists(`${dir}/src/server/email`), 'email dir').toBe(false)
    expect(filesImporting(dir, ['~/server/email']), 'dangling email imports').toEqual([])
    return
  }
  const root = read(`${dir}/src/server/email/index.ts`)
  expect(root, 'no required() guard in email root').not.toContain('function required')
  expect(root).toContain('export const mailer: Mailer')
  expect(root).not.toContain('sendEmail')
  const adapter = read(`${dir}/src/server/email/adapters/${result.mailerProvider}.ts`)
  expect(adapter, 'extensionless relative imports').not.toMatch(/from '\.\.?\/.*\.js'/)
  if (result.mailerProvider !== 'ses') expect(root).toContain('apiKey: env.')
}

function assertTrpcContext(dir: string, database: Database, auth: Auth, framework: Framework) {
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
  } else if (auth === 'clerk' && framework === 'remix') {
    expect(context).toContain("import { authenticate } from '~/server/clerk/auth'")
    expect(context).toContain('const identity = await authenticate(request)')
    expect(context).toContain('identity,')
  } else if (auth === 'clerk') {
    expect(context).toContain(
      framework === 'rasengan'
        ? "import { auth } from '~/server/clerk'"
        : "import { auth } from '@clerk/",
    )
    expect(context).toContain(
      framework === 'rasengan' ? 'auth: await auth(opts.headers)' : 'auth: await auth()',
    )
    expect(context).not.toContain('session,')
  } else {
    expect(context).not.toContain('import { auth }')
    expect(context).not.toContain('session,')
    expect(context).not.toContain('auth: await auth()')
  }
}

function assertCapabilities(dir: string, env: string, capabilities: CapabilitySelection = {}) {
  for (const cap of Object.keys(capabilities)) {
    expect(exists(`${dir}/src/server/${cap}`), `${cap} vendored`).toBe(true)
    expect(read(`${dir}/src/server/${cap}/index.ts`)).not.toContain('function required')
  }
  if (capabilities.storage === 's3') expect(env).toContain('S3_BUCKET')
  if (capabilities.cache === 'redis') expect(env).toContain('REDIS_URL')
}

const CONFIGS: readonly Config[] = [
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

for (const framework of ['tanstack', 'next', 'rasengan', 'remix'] as const) {
  describe(framework, () => {
    for (const cfg of CONFIGS) {
      test(cfg.name, async () => {
        const { dir, result } = await build({ ...cfg, framework })
        const pkg = readJson(`${dir}/package.json`)
        const deps = allDeps(dir)
        const env = exists(`${dir}/.env.example`) ? read(`${dir}/.env.example`) : ''

        expect(pkg.name).toBe(cfg.name)
        expect(pkg.private).toBe(true)
        expect(exists(`${dir}/src/env.ts`)).toBe(true)

        const readme = read(`${dir}/README.md`)
        assertCreationMetadata(pkg, readme)

        assertTrpc(dir, result.trpc, deps, framework)
        assertAuth(dir, result.auth, deps, framework)
        assertDatabase(dir, result.database, deps, result.auth === 'better-auth', framework)
        assertOptionalComponentsAbsent(dir, deps)
        assertMailer(dir, result, deps)
        if (result.trpc) assertTrpcContext(dir, result.database, result.auth, framework)
        assertTesting(dir, result, framework)

        const sqlDb = result.database === 'drizzle' || result.database === 'prisma'
        expect(env.includes('DATABASE_URL')).toBe(sqlDb)
        expect(env.includes('BETTER_AUTH_SECRET')).toBe(result.auth === 'better-auth')
        expect(env.includes('CLERK_SECRET_KEY')).toBe(result.auth === 'clerk')
        const convexUrlKey = {
          next: 'NEXT_PUBLIC_CONVEX_URL',
          tanstack: 'VITE_CONVEX_URL',
          rasengan: 'RASENGAN_CONVEX_URL',
          remix: 'CONVEX_URL',
        }[framework]
        expect(env.includes(convexUrlKey)).toBe(result.database === 'convex')
        expect(env.includes('CONVEX_DEPLOYMENT')).toBe(result.database === 'convex')

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

        assertLocalDatabaseEnv(dir, cfg.name, result.database)

        assertCapabilities(dir, env, cfg.capabilities)

        const ci = read(`${dir}/.github/workflows/ci.yml`)
        expect(ci).toContain('pnpm install --frozen-lockfile')
        expect(ci).toContain('pnpm run typecheck')
        expect(ci).toContain('pnpm run check')
        expect(ci).toContain('pnpm run test')
        expect(ci).toContain('node-version-file: .nvmrc')
        expect(ci).toContain('version: 11.1.3')
        expect(ci).not.toContain('push:')
      })
    }
  })
}
