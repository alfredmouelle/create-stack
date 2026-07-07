// Fast, install-free matrix: kept foundations present, dropped ones gone (files, deps,
// env) with no dangling imports. The typecheck/biome proof lives in smoke.test.mjs.

import { afterAll, describe, expect, test } from 'vitest'
import { build, cleanup, exists, filesImporting, read, readJSON } from './helpers.mjs'

afterAll(cleanup)

// Foundation → marker dir/file, npm dep, and the import specifiers that must vanish
// once it's stripped. (ORM = database axis, auth = auth axis — asserted separately.)
const FOUND_DIR = { trpc: 'src/trpc' }
const FOUND_DEP = { trpc: '@trpc/server' }
const DANGLING = { trpc: ['~/trpc', '~/server/api'] }
const ALL = Object.keys(FOUND_DIR)

// per-framework paths the auth axis touches
const AUTH_PATHS = {
  tanstack: { shell: 'src/routes/__root.tsx', signIn: 'src/routes/sign-in.$.tsx' },
  next: { shell: 'src/app/layout.tsx', signIn: 'src/app/sign-in/[[...sign-in]]/page.tsx' },
}

// opt-in components are stripped from every scaffold (re-added via `create-stack component`).
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

// each foundation: present iff kept (files + deps), and no dangling imports if dropped
function assertFoundations(dir, kept, deps) {
  for (const f of ALL) {
    const on = kept.has(f)
    expect(exists(`${dir}/${FOUND_DIR[f]}`), `${f} dir present=${on}`).toBe(on)
    expect(FOUND_DEP[f] in deps, `${f} dep present=${on}`).toBe(on)
    if (!on) expect(filesImporting(dir, DANGLING[f]), `dangling ${f} imports`).toEqual([])
  }
}

// the auth axis: the chosen provider is wired, better-auth files gone when swapped
function assertAuth(dir, auth, deps, framework) {
  const paths = AUTH_PATHS[framework]
  const baPresent = auth === 'better-auth'
  expect(exists(`${dir}/src/server/better-auth`), `better-auth dir present=${baPresent}`).toBe(baPresent)
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
    expect('@clerk/nextjs' in deps || '@clerk/tanstack-react-start' in deps, 'no clerk dep').toBe(false)
  }
}

// the ORM axis: the chosen provider is wired, the others (and Drizzle's config) are gone
function assertDatabase(dir, database, deps, authKept) {
  const hasDb = database !== 'none'
  expect(exists(`${dir}/src/server/db`), `db layer present=${hasDb}`).toBe(hasDb)

  if (database === 'drizzle') {
    expect('drizzle-orm' in deps, 'drizzle-orm dep').toBe(true)
    expect(exists(`${dir}/drizzle.config.ts`), 'drizzle.config').toBe(true)
    expect('@prisma/client' in deps, 'no prisma dep').toBe(false)
    if (authKept) expect(read(`${dir}/src/server/better-auth/config.ts`)).toContain('drizzleAdapter')
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

function assertCapabilities(dir, env, capabilities = {}) {
  for (const cap of Object.keys(capabilities)) {
    expect(exists(`${dir}/src/server/${cap}`), `${cap} vendored`).toBe(true)
    // no redundant env re-validation in the composition root
    expect(read(`${dir}/src/server/${cap}/index.ts`)).not.toContain('function required')
  }
  if (capabilities.storage === 's3') expect(env).toContain('S3_BUCKET')
  if (capabilities.cache === 'redis') expect(env).toContain('REDIS_URL')
}

// name, database (omit=drizzle), auth (omit=better-auth), foundations (omit=[trpc]), mailer, capabilities
const CONFIGS = [
  { name: 'full' },
  { name: 'full-caps', capabilities: { storage: 's3', cache: 'redis' } },
  { name: 'prisma-full', database: 'prisma' },
  { name: 'prisma-no-auth', database: 'prisma', auth: 'none', foundations: ['trpc'], mailer: 'none' },
  { name: 'drizzle-trpc', auth: 'none', foundations: ['trpc'], mailer: 'ses' },
  { name: 'auth-no-trpc', foundations: [] },
  { name: 'clerk-full', auth: 'clerk' },
  { name: 'clerk-prisma', database: 'prisma', auth: 'clerk' },
  { name: 'clerk-vitrine', database: 'none', auth: 'clerk', foundations: [], mailer: 'none' },
  { name: 'drizzle-only', auth: 'none', foundations: [], mailer: 'none' },
  { name: 'vitrine', database: 'none', auth: 'none', foundations: [], mailer: 'none' },
]

for (const framework of ['tanstack', 'next']) {
  describe(framework, () => {
    for (const cfg of CONFIGS) {
      test(cfg.name, () => {
        const { dir, result } = build({ ...cfg, framework })
        const kept = new Set(result.kept)
        const pkg = readJSON(`${dir}/package.json`)
        const deps = allDeps(pkg)
        const env = exists(`${dir}/.env.example`) ? read(`${dir}/.env.example`) : ''

        expect(pkg.name).toBe(cfg.name)
        expect(pkg.private).toBe(true)
        expect(exists(`${dir}/src/env.ts`)).toBe(true)

        assertFoundations(dir, kept, deps)
        assertAuth(dir, result.auth, deps, framework)
        assertDatabase(dir, result.database, deps, result.auth === 'better-auth')
        assertComponentsStripped(dir, deps)
        assertMailer(dir, result, deps)

        // env keys track the selection
        expect(env.includes('DATABASE_URL')).toBe(result.database !== 'none')
        expect(env.includes('BETTER_AUTH_SECRET')).toBe(result.auth === 'better-auth')
        expect(env.includes('CLERK_SECRET_KEY')).toBe(result.auth === 'clerk')

        assertCapabilities(dir, env, cfg.capabilities)
      })
    }
  })
}
