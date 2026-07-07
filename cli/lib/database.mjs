// The `database` axis: the base ships Drizzle; `prisma` strips it and vendors the
// Prisma fragment, `none` strips it outright. Idiomatic, not port-abstracted — the
// `~/server/db` `db` export is a naming convention so trpc's context survives a swap.

import { TEMPLATES } from './paths.mjs'
import { copy, editFile, exists, join, read, readJSON, remove, write, writeJSON } from './util.mjs'

export const DATABASES = ['drizzle', 'prisma', 'convex']
export const DEFAULT_DATABASE = 'drizzle'

/** Resolve a flag/prompt value to a database choice, or throw. */
export function resolveDatabase(value) {
  if (value === 'none') return 'none'
  if (value === true || value == null || value === '') return DEFAULT_DATABASE
  if (!DATABASES.includes(value)) {
    throw new Error(`Unknown database: ${value} (have ${DATABASES.join(', ')}, none)`)
  }
  return value
}

const PRISMA_VERSION = '^7.4.0'

// Deps the Drizzle base ships that Prisma doesn't need (pg/dotenv/tsx/@types/pg/
// faker are reused by the adapter + seed, so they stay).
const DRIZZLE_ONLY_DEPS = ['drizzle-orm', 'drizzle-kit']
// Every dep the Drizzle base contributes — dropped wholesale for `none`.
const DRIZZLE_ALL_DEPS = [
  'drizzle-orm',
  'pg',
  'drizzle-kit',
  'dotenv',
  'tsx',
  '@types/pg',
  '@faker-js/faker',
]
const DB_SCRIPTS = ['db:generate', 'db:migrate', 'db:push', 'db:studio', 'db:seed']

const PRISMA_DEPS = {
  '@prisma/client': PRISMA_VERSION,
  '@prisma/adapter-pg': PRISMA_VERSION,
}
const PRISMA_DEV_DEPS = { prisma: PRISMA_VERSION }
const PRISMA_SCRIPTS = {
  'db:generate': 'prisma generate',
  'db:migrate': 'prisma migrate dev',
  'db:push': 'prisma db push',
  'db:studio': 'prisma studio',
  'db:seed': 'tsx src/server/db/seed.ts',
  postinstall: 'prisma generate',
}

// Files copied from the Prisma fragment (auth.prisma is conditional on auth).
const PRISMA_FILES = [
  'src/server/db/index.ts',
  'src/server/db/seed.ts',
  'src/server/db/keyset.ts',
  'prisma/schema/schema.prisma',
  'prisma.config.ts',
]

const CONVEX_VERSION = '^1.42.1'

const empty = () => ({
  removeDeps: [],
  addDeps: {},
  addDevDeps: {},
  removeScripts: [],
  setScripts: {},
  envLines: [],
})

/**
 * Bring the db layer to the chosen ORM. Runs after auth so `authKept`/`auth` are
 * final (better-auth models tracked, the Clerk provider already in the shell).
 * @returns {{ removeDeps: string[], addDeps: object, addDevDeps: object, removeScripts: string[], setScripts: object, envLines: string[] }}
 */
export function applyDatabase({ projectDir, database, framework, auth, authKept }) {
  if (database === 'drizzle') return applyDrizzle(projectDir, authKept)
  if (database === 'none') return stripDatabase(projectDir)
  if (database === 'prisma') return vendorPrisma(projectDir, authKept)
  if (database === 'convex') return vendorConvex(projectDir, framework, auth)
  throw new Error(`Unknown database: ${database}`)
}

const src = (projectDir, p) => join(projectDir, 'src', p)

/** Drizzle stays wired; only drop the auth models when auth isn't kept. */
function applyDrizzle(projectDir, authKept) {
  if (!authKept) dropDrizzleAuthSchema(projectDir)
  return empty()
}

/** No ORM: remove the whole db layer + its deps/scripts. */
function stripDatabase(projectDir) {
  remove(src(projectDir, 'server/db'))
  remove(join(projectDir, 'drizzle.config.ts'))
  return { ...empty(), removeDeps: [...DRIZZLE_ALL_DEPS], removeScripts: [...DB_SCRIPTS] }
}

/** Swap the Drizzle db layer for the Prisma fragment. */
function vendorPrisma(projectDir, authKept) {
  remove(src(projectDir, 'server/db'))
  remove(join(projectDir, 'drizzle.config.ts'))

  const frag = join(TEMPLATES, 'database/prisma')
  for (const f of PRISMA_FILES) copy(join(frag, f), join(projectDir, f))
  if (authKept) {
    copy(join(frag, 'prisma/schema/auth.prisma'), join(projectDir, 'prisma/schema/auth.prisma'))
    rewriteBetterAuthAdapter(projectDir)
  }
  gitignoreGenerated(projectDir)
  allowPrismaBuilds(projectDir)

  return {
    removeDeps: [...DRIZZLE_ONLY_DEPS],
    addDeps: { ...PRISMA_DEPS },
    addDevDeps: { ...PRISMA_DEV_DEPS },
    removeScripts: [],
    setScripts: { ...PRISMA_SCRIPTS },
    envLines: [],
  }
}

/** Drop the Drizzle auth schema + its barrel line, keeping the barrel a module. */
function dropDrizzleAuthSchema(projectDir) {
  remove(src(projectDir, 'server/db/schemas/auth.schema.ts'))
  editFile(src(projectDir, 'server/db/schemas/index.ts'), (c) => {
    const out = c
      .split('\n')
      .filter((l) => !l.includes("'./auth.schema'"))
      .join('\n')
    return /^export /m.test(out) ? out : `${out.trimEnd()}\nexport {}\n`
  })
}

/** drizzleAdapter → prismaAdapter in the better-auth config (both frameworks). */
function rewriteBetterAuthAdapter(projectDir) {
  editFile(join(projectDir, 'src/server/better-auth/config.ts'), (c) =>
    c
      .replaceAll('better-auth/adapters/drizzle', 'better-auth/adapters/prisma')
      .replaceAll('drizzleAdapter', 'prismaAdapter')
      .replace("provider: 'pg',", "provider: 'postgresql',"),
  )
}

/** The generated Prisma client is a build artifact — never commit it. */
function gitignoreGenerated(projectDir) {
  const path = join(projectDir, '.gitignore')
  if (!exists(path)) return
  const cur = read(path)
  if (cur.includes('/src/generated')) return
  write(path, `${cur.replace(/\n*$/, '')}\n\n# prisma generated client\n/src/generated\n`)
}

// pnpm/bun block dependency build scripts by default; Prisma's engine setup (needed
// for migrate/studio) must be allowlisted or `install` errors out for the user.
const PRISMA_BUILD_DEPS = ['prisma', '@prisma/engines', '@prisma/client']

function allowPrismaBuilds(projectDir) {
  const wsPath = join(projectDir, 'pnpm-workspace.yaml')
  if (exists(wsPath)) {
    const cur = read(wsPath)
    const add = PRISMA_BUILD_DEPS.filter((d) => !cur.includes(d))
    if (add.length) {
      const lines = add.map((d) => `  ${d.includes('/') ? `'${d}'` : d}: true`).join('\n')
      write(wsPath, `${cur.replace(/\n*$/, '')}\n${lines}\n`)
    }
  }

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  if (Array.isArray(pkg.trustedDependencies)) {
    for (const d of PRISMA_BUILD_DEPS) {
      if (!pkg.trustedDependencies.includes(d)) pkg.trustedDependencies.push(d)
    }
    writeJSON(pkgPath, pkg)
  }
}

// Convex is not an ORM — it collapses db + API + realtime client. It ships a
// committed `convex/` backend (schema + example + _generated) and a client provider
// wired into the shell; trpc + react-query are already stripped (normalize forces them off).
const CONVEX_URL_ENV = { tanstack: 'VITE_CONVEX_URL', next: 'NEXT_PUBLIC_CONVEX_URL' }

/** Swap the SQL data layer for Convex: strip Drizzle, vendor the backend + provider. */
function vendorConvex(projectDir, framework, auth) {
  remove(src(projectDir, 'server/db'))
  remove(join(projectDir, 'drizzle.config.ts'))

  const frag = join(TEMPLATES, 'database/convex')
  copy(join(frag, 'backend/convex'), join(projectDir, 'convex'))
  if (framework === 'next') vendorConvexNext(projectDir, frag, auth)
  else vendorConvexTanstack(projectDir, frag, auth)

  const urlKey = CONVEX_URL_ENV[framework]
  return {
    removeDeps: [...DRIZZLE_ALL_DEPS],
    addDeps: { convex: CONVEX_VERSION },
    addDevDeps: {},
    removeScripts: [...DB_SCRIPTS],
    setScripts: { convex: 'convex dev' },
    envLines: ['CONVEX_DEPLOYMENT=', `${urlKey}=https://example.convex.cloud`],
  }
}

function vendorConvexTanstack(projectDir, frag, auth) {
  copy(join(frag, 'tanstack/src/convex-env.d.ts'), src(projectDir, 'convex-env.d.ts'))
  copy(join(frag, 'tanstack/src/routes/convex-demo.tsx'), src(projectDir, 'routes/convex-demo.tsx'))
  injectConvexProviderTanstack(projectDir, auth)
}

function vendorConvexNext(projectDir, frag, auth) {
  copy(join(frag, 'next/src/app/convex-demo'), src(projectDir, 'app/convex-demo'))
  const variant = auth === 'clerk' ? 'clerk' : 'plain'
  copy(
    join(frag, `next/src/app/convex-provider.${variant}.tsx`),
    src(projectDir, 'app/convex-provider.tsx'),
  )
  injectConvexProviderNext(projectDir)
}

const CONVEX_TANSTACK_PLAIN = `import { ConvexProvider, ConvexReactClient } from 'convex/react'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)
`
const CONVEX_TANSTACK_CLERK = `import { useAuth } from '@clerk/tanstack-react-start'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)
`

/** Wrap the shell's children in a Convex provider (ConvexProviderWithClerk when Clerk is on). */
function injectConvexProviderTanstack(projectDir, auth) {
  const clerk = auth === 'clerk'
  const header = clerk ? CONVEX_TANSTACK_CLERK : CONVEX_TANSTACK_PLAIN
  const open = clerk
    ? '<ConvexProviderWithClerk client={convex} useAuth={useAuth}>'
    : '<ConvexProvider client={convex}>'
  const close = clerk ? '</ConvexProviderWithClerk>' : '</ConvexProvider>'
  editFile(src(projectDir, 'routes/__root.tsx'), (c) =>
    `${header}${c}`.replace('{children}', `${open}{children}${close}`),
  )
}

const CONVEX_NEXT_IMPORT = "import { ConvexClientProvider } from '~/app/convex-provider'\n"

function injectConvexProviderNext(projectDir) {
  editFile(src(projectDir, 'app/layout.tsx'), (c) =>
    `${CONVEX_NEXT_IMPORT}${c}`.replace(
      '{children}',
      '<ConvexClientProvider>{children}</ConvexClientProvider>',
    ),
  )
}
