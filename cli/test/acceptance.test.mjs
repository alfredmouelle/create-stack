import { existsSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { cleanupAcceptanceFixtures, createAcceptanceFixture, runCli } from './acceptance.mjs'

test.afterAll(cleanupAcceptanceFixtures)

function createProject(fixture, { framework, monorepo }) {
  return runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: [
      'project',
      '--framework',
      framework,
      ...(monorepo ? ['--monorepo', monorepo] : []),
      '--database',
      'none',
      '--auth',
      'none',
      '--no-trpc',
      '--mailer',
      'none',
      '--no-install',
    ],
  })
}

test('the executable CLI reports prompts without mutating its target', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({ cwd: fixture.root, input: '\u0003', target: fixture.app })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('Project name')
  expect(result.stderr).toBe('')
  expect(result.requestedInput).toBe(true)
  expect(result.targetMutated).toBe(false)
})

test('a project name without options enters interactive creation', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    input: '\u0003',
    target: fixture.project,
    args: ['project'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('Project name')
  expect(result.requestedInput).toBe(true)
  expect(result.targetMutated).toBe(false)
})

test('an operational option before the project starts non-interactive creation', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['--no-install', 'project'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(true)
})

test('creates a standalone project through the executable CLI', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = createProject(fixture, { framework: 'tanstack' })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('Created project')
  expect(result.stderr).toBe('')
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(true)
  expect(JSON.parse(readFileSync(`${fixture.project}/package.json`, 'utf8')).name).toBe('project')
  expect(existsSync(`${fixture.project}/node_modules`)).toBe(false)
})

test('accepts the recommended stack with -y and prints its plan before mutation', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '-y', '--no-install', '--alias', '@'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stderr).toBe('')
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(true)
  expect(result.stdout).toContain('Creation plan')
  expect(result.stdout.indexOf('Creation plan')).toBeLessThan(
    result.stdout.indexOf('Project scaffolded'),
  )
  expect(result.stdout).toContain('Framework: TanStack Start')
  expect(result.stdout).toContain('Database: drizzle')
  expect(result.stdout).toContain('Auth: better-auth')
  expect(result.stdout).toContain('Mailer: resend')
  expect(result.stdout).toContain('Import alias: @/')
})

test('accepts concise creation options with separated values', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: [
      'project',
      '-f',
      'next',
      '--db',
      'prisma',
      '--auth',
      'clerk',
      '--mail',
      'ses',
      '--pm',
      'pnpm',
      '--alias',
      '#',
      '--no-install',
    ],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stderr).toBe('')
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(true)
  expect(result.stdout).toContain('Framework: Next.js')
  expect(result.stdout).toContain('Database: prisma')
  expect(result.stdout).toContain('Auth: clerk')
  expect(result.stdout).toContain('Mailer: ses')
  expect(result.stdout).toContain('Import alias: #/')
})

test('accepts readable creation aliases with equals values', () => {
  const fixture = createAcceptanceFixture('monorepo')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: [
      'project',
      '--framework=next',
      '--database=prisma',
      '--auth=clerk',
      '--mailer=ses',
      '--monorepo=nx',
      '--package-manager=pnpm',
      '--alias=@',
      '--no-install',
    ],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(true)
  expect(result.stdout).toContain('Framework: Next.js')
  expect(result.stdout).toContain('Monorepo: Nx')
  expect(result.stdout).toContain('Database: prisma')
  expect(result.stdout).toContain('Auth: clerk')
  expect(result.stdout).toContain('Mailer: ses')
})

test('rejects an unknown creation option with a suggestion before mutation', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--framwork=next'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(false)
  expect(result.stdout).toContain('Unknown option: --framwork')
  expect(result.stdout).toContain('Did you mean --framework?')
})

test('bare selectors choose their recommended creation values', () => {
  const fixture = createAcceptanceFixture('monorepo')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--framework', '--db', '--auth', '--mail', '--mono', '--no-install'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(true)
  expect(result.stdout).toContain('Framework: TanStack Start')
  expect(result.stdout).toContain('Database: drizzle')
  expect(result.stdout).toContain('Auth: better-auth')
  expect(result.stdout).toContain('Mailer: resend')
  expect(result.stdout).toContain('Monorepo: Turborepo')
})

test.each([
  [['project', '--db=postgres'], 'Unknown database'],
  [['project', '--db=drizzle', '--database=drizzle'], 'Database was specified more than once'],
  [['project', '--auth=none', '--auth=clerk'], 'Auth was specified more than once'],
  [['project', '--storage=r2', '--storage=s3'], 'Storage was specified more than once'],
  [['project', '--alias=@', '--alias=#'], 'Import alias was specified more than once'],
  [['project', '-y', '--yes'], 'Recommended stack acceptance was specified more than once'],
  [['project', '-yv'], 'Grouped short options are not supported'],
  [['one', 'two', '--no-install'], 'Unexpected positional argument: two'],
  [['project', '-y', '--db=drizzle'], '--yes cannot be combined with stack options'],
  [['project', '-y', '--mono'], '--yes cannot be combined with stack options'],
  [['project', '--yes', '--minimal'], '--yes cannot be combined with --minimal'],
  [['project', '--yes=false'], '--yes does not accept a value'],
  [['project', '--minimal', '--minimal'], 'Minimal project was specified more than once'],
  [['project', '--no-install=false'], '--no-install does not accept a value'],
  [['project', '--mono=turborepo'], 'expected turbo or nx'],
  [['project', '--alias'], '--alias requires a value'],
  [['project', '--pm'], '--pm requires a value'],
])('rejects ambiguous creation form %j before mutation', (args, diagnostic) => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: [...args, '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(false)
  expect(result.stdout).toContain(diagnostic)
})

test('minimal creation produces a frontend-only project and explains its exclusions', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--minimal', '--no-install'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(true)
  expect(result.stdout).toContain('Database: (none) — minimal exclusion')
  expect(result.stdout).toContain('Auth: (none) — minimal exclusion')
  expect(result.stdout).toContain('tRPC: no — minimal exclusion')
  expect(result.stdout).toContain('Mailer: (none) — minimal exclusion')
  expect(existsSync(`${fixture.project}/src/server/db`)).toBe(false)
  expect(existsSync(`${fixture.project}/src/server/better-auth`)).toBe(false)
  expect(existsSync(`${fixture.project}/src/server/api`)).toBe(false)
  expect(existsSync(`${fixture.project}/src/server/email`)).toBe(false)
})

test('--minimal alone starts non-interactive creation and requires a target', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({ cwd: fixture.root, target: fixture.project, args: ['--minimal'] })

  expect(result.exitStatus).toBe(1)
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(false)
  expect(result.stdout).toContain('Project name is required')
})

test('stack options enrich minimal creation and redundant exclusions remain valid', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: [
      'project',
      '--minimal',
      '--db=prisma',
      '--trpc',
      '--no-auth',
      '--no-mail',
      '--no-install',
    ],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('Database: prisma — requested')
  expect(result.stdout).toContain('Auth: (none) — requested exclusion')
  expect(result.stdout).toContain('tRPC: yes — requested')
  expect(result.stdout).toContain('Mailer: (none) — requested exclusion')
  expect(existsSync(`${fixture.project}/prisma/schema/schema.prisma`)).toBe(true)
  expect(existsSync(`${fixture.project}/src/server/api/trpc.ts`)).toBe(true)
  expect(existsSync(`${fixture.project}/src/server/better-auth`)).toBe(false)
  expect(existsSync(`${fixture.project}/src/server/email`)).toBe(false)
})

test('tRPC remains independent of data and authentication through the executable CLI', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--minimal', '--trpc', '--no-install'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('Database: (none) — minimal exclusion')
  expect(result.stdout).toContain('Auth: (none) — minimal exclusion')
  expect(result.stdout).toContain('tRPC: yes — requested')
  expect(existsSync(`${fixture.project}/src/server/api/trpc.ts`)).toBe(true)
  expect(existsSync(`${fixture.project}/src/server/db`)).toBe(false)
  expect(existsSync(`${fixture.project}/src/server/better-auth`)).toBe(false)
})

test('removed foundations syntax reports its replacement before mutation', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--foundations=trpc', '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.targetMutated).toBe(false)
  expect(result.stdout).toContain('--foundations was removed; use --trpc or --no-trpc')
})

test.each([
  {
    option: '--no-db',
    plan: ['Database: (none) — requested exclusion', 'Auth: clerk', 'tRPC: yes', 'Mailer: (none)'],
    present: ['src/server/api/trpc.ts', 'src/routes/sign-in.$.tsx'],
    absent: ['src/server/db', 'src/server/email'],
  },
  {
    option: '--no-auth',
    plan: [
      'Database: drizzle',
      'Auth: (none) — requested exclusion',
      'tRPC: yes',
      'Mailer: (none)',
    ],
    present: ['src/server/db', 'src/server/api/trpc.ts'],
    absent: ['src/server/better-auth', 'src/server/email'],
  },
  {
    option: '--no-mail',
    plan: ['Database: drizzle', 'Auth: clerk', 'tRPC: yes', 'Mailer: (none) — requested exclusion'],
    present: ['src/server/db', 'src/server/api/trpc.ts', 'src/routes/sign-in.$.tsx'],
    absent: ['src/server/better-auth', 'src/server/email'],
  },
  {
    option: '--auth=clerk',
    plan: ['Database: drizzle', 'Auth: clerk — requested', 'tRPC: yes', 'Mailer: (none)'],
    present: ['src/server/db', 'src/server/api/trpc.ts', 'src/routes/sign-in.$.tsx'],
    absent: ['src/server/better-auth', 'src/server/email'],
  },
  {
    option: '--no-trpc',
    plan: [
      'Database: drizzle',
      'Auth: better-auth',
      'tRPC: no — requested exclusion',
      'Mailer: resend',
    ],
    present: ['src/server/db', 'src/server/better-auth', 'src/server/email'],
    absent: ['src/server/api', 'src/trpc'],
  },
])('resolves applicable recommendations for $option', ({ option, plan, present, absent }) => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', option, '--no-install'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('applicable recommendation')
  for (const line of plan) expect(result.stdout).toContain(line)
  for (const path of present) expect(existsSync(`${fixture.project}/${path}`), path).toBe(true)
  for (const path of absent) expect(existsSync(`${fixture.project}/${path}`), path).toBe(false)
})

test('Better Auth completes omitted dependencies from a minimal project', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--minimal', '--auth=better-auth', '--no-install'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('Auth: better-auth — requested')
  expect(result.stdout).toContain('Database: drizzle — dependency completion for Better Auth')
  expect(result.stdout).toContain('Mailer: resend — dependency completion for Better Auth')
  expect(result.stdout).toContain('tRPC: no — minimal exclusion')
  expect(existsSync(`${fixture.project}/src/server/db`)).toBe(true)
  expect(existsSync(`${fixture.project}/src/server/better-auth`)).toBe(true)
  expect(existsSync(`${fixture.project}/src/server/email`)).toBe(true)
  expect(existsSync(`${fixture.project}/src/server/api`)).toBe(false)
})

test.each([
  {
    args: ['--db=convex'],
    mailer: 'Mailer: (none) — applicable recommendation',
    hasMailer: false,
  },
  {
    args: ['--db=convex', '--mail=ses'],
    mailer: 'Mailer: ses — requested',
    hasMailer: true,
  },
])(
  'Convex uses applicable recommendations and preserves explicit mail: $args',
  ({ args, mailer, hasMailer }) => {
    const fixture = createAcceptanceFixture('standalone')

    const result = runCli({
      cwd: fixture.root,
      target: fixture.project,
      args: ['project', ...args, '--no-install'],
    })

    expect(result.exitStatus).toBe(0)
    expect(result.stdout).toContain('Database: convex — requested')
    expect(result.stdout).toContain('Auth: clerk — applicable recommendation')
    expect(result.stdout).toContain('tRPC: no — applicable recommendation')
    expect(result.stdout).toContain(mailer)
    expect(existsSync(`${fixture.project}/convex/schema.ts`)).toBe(true)
    expect(existsSync(`${fixture.project}/src/routes/sign-in.$.tsx`)).toBe(true)
    expect(existsSync(`${fixture.project}/src/server/api`)).toBe(false)
    expect(existsSync(`${fixture.project}/src/server/email`)).toBe(hasMailer)
  },
)

test.each([
  [['project', '--auth=better-auth', '--no-db'], 'Better Auth requires a database'],
  [['project', '--auth=better-auth', '--no-mail'], 'Better Auth requires mail'],
  [['project', '--minimal', '--auth=better-auth', '--no-db'], 'Better Auth requires a database'],
  [['project', '--db=convex', '--auth=better-auth'], 'Better Auth cannot be used with Convex'],
  [['project', '--db=convex', '--trpc'], 'Convex cannot be combined with tRPC'],
])('rejects dependency conflict %j before mutation', (args, diagnostic) => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: [...args, '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(false)
  expect(result.stdout).toContain(diagnostic)
})

test('adds a capability to a monorepo application through the executable CLI', () => {
  const fixture = createAcceptanceFixture('monorepo')
  const created = createProject(fixture, {
    framework: 'next',
    monorepo: 'turbo',
  })

  expect(created.exitStatus).toBe(0)
  expect(created.targetMutated).toBe(true)
  expect(existsSync(`${fixture.app}/package.json`)).toBe(true)

  const added = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'storage', 'r2', '--no-install'],
  })

  expect(added.exitStatus).toBe(0)
  expect(added.stdout).toContain('Added storage')
  expect(added.stderr).toBe('')
  expect(added.requestedInput).toBe(false)
  expect(added.targetMutated).toBe(true)
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/r2.ts`)).toBe(true)
  expect(existsSync(`${fixture.project}/node_modules`)).toBe(false)
  expect(existsSync(`${fixture.app}/node_modules`)).toBe(false)
})

test('adds a component to a standalone application through the executable CLI', () => {
  const fixture = createAcceptanceFixture('standalone')
  const created = createProject(fixture, { framework: 'tanstack' })

  expect(created.exitStatus).toBe(0)

  const installed = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['component', 'date-picker', '--no-install'],
  })

  expect(installed.exitStatus).toBe(0)
  expect(installed.stdout).toContain('Installed date-picker')
  expect(installed.stderr).toBe('')
  expect(installed.requestedInput).toBe(false)
  expect(installed.targetMutated).toBe(true)
  expect(existsSync(`${fixture.app}/src/components/ui/date-picker.tsx`)).toBe(true)
  expect(existsSync(`${fixture.app}/node_modules`)).toBe(false)
})
