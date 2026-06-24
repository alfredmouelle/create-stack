// Fast, install-free matrix: kept foundations present, dropped ones gone (files, deps,
// env) with no dangling imports. The typecheck/biome proof lives in smoke.test.mjs.

import { afterAll, describe, expect, test } from 'vitest'
import { build, cleanup, exists, filesImporting, read, readJSON } from './helpers.mjs'

afterAll(cleanup)

// Foundation → marker dir/file, npm dep, and the import specifiers that must vanish
// once it's stripped.
const FOUND_DIR = {
  drizzle: 'src/server/db',
  trpc: 'src/trpc',
  'better-auth': 'src/server/better-auth',
}
const FOUND_DEP = {
  drizzle: 'drizzle-orm',
  trpc: '@trpc/server',
  'better-auth': 'better-auth',
}
const DANGLING = {
  trpc: ['~/trpc', '~/server/api'],
  'better-auth': ['~/server/better-auth'],
  drizzle: ['~/server/db'],
}
const ALL = Object.keys(FOUND_DIR)

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

// name, foundations (omit = all), mailer (omit = resend), capabilities
const CONFIGS = [
  { name: 'full' },
  { name: 'full-caps', capabilities: { storage: 's3', cache: 'redis' } },
  { name: 'drizzle-trpc', foundations: ['drizzle', 'trpc'], mailer: 'ses' },
  { name: 'auth-no-trpc', foundations: ['better-auth'] },
  { name: 'drizzle-only', foundations: ['drizzle'], mailer: 'none' },
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
        assertComponentsStripped(dir, deps)
        assertMailer(dir, result, deps)

        // env keys track the selection
        expect(env.includes('DATABASE_URL')).toBe(kept.has('drizzle'))
        expect(env.includes('BETTER_AUTH_SECRET')).toBe(kept.has('better-auth'))

        assertCapabilities(dir, env, cfg.capabilities)
      })
    }
  })
}
