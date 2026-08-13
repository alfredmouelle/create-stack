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
      '--foundations',
      'none',
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

test('bare capability selectors generate recommended providers and a canonical plan', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: [
      'project',
      '--no-install',
      '--storage',
      '--cache',
      '--jobs',
      '--logger',
      '--analytics',
      '--errors',
    ],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.requestedInput).toBe(false)
  expect(result.stdout).toContain('storage (r2)')
  expect(result.stdout).toContain('cache (upstash)')
  expect(result.stdout).toContain('jobs (inngest)')
  expect(result.stdout).toContain('logger (pino)')
  expect(result.stdout).toMatch(/analytics\s+│?\n?│?\s*\(posthog\)/)
  expect(result.stdout).toContain('errors (sentry)')
  expect(result.stdout).not.toContain('error-tracking (sentry)')

  const dependencies = JSON.parse(
    readFileSync(`${fixture.project}/package.json`, 'utf8'),
  ).dependencies
  expect(dependencies).toMatchObject({
    '@aws-sdk/client-s3': expect.any(String),
    '@sentry/tanstackstart-react': expect.any(String),
    '@upstash/redis': expect.any(String),
    inngest: expect.any(String),
    pino: expect.any(String),
    'posthog-node': expect.any(String),
  })
  expect(existsSync(`${fixture.project}/src/server/storage/adapters/r2.ts`)).toBe(true)
  expect(existsSync(`${fixture.project}/src/server/cache/adapters/upstash.ts`)).toBe(true)
  expect(existsSync(`${fixture.project}/src/server/jobs/index.ts`)).toBe(true)
  expect(existsSync(`${fixture.project}/src/server/error-tracking/index.ts`)).toBe(true)
})

test.each([
  ['storage', 's3', 'src/server/storage/adapters/s3.ts', '@aws-sdk/client-s3'],
  ['storage', 'r2', 'src/server/storage/adapters/r2.ts', '@aws-sdk/client-s3'],
  ['storage', 'gcs', 'src/server/storage/adapters/gcs.ts', '@google-cloud/storage'],
  ['storage', 'local', 'src/server/storage/adapters/local.ts', null],
  ['cache', 'redis', 'src/server/cache/adapters/redis.ts', 'ioredis'],
  ['cache', 'upstash', 'src/server/cache/adapters/upstash.ts', '@upstash/redis'],
  ['cache', 'memory', 'src/server/cache/adapters/memory.ts', null],
  ['logger', 'pino', 'src/server/logger/adapters/pino.ts', 'pino'],
  ['logger', 'console', 'src/server/logger/adapters/console.ts', null],
  ['analytics', 'posthog', 'src/server/analytics/adapters/posthog.ts', 'posthog-node'],
  ['analytics', 'plausible', 'src/server/analytics/adapters/plausible.ts', null],
  ['analytics', 'noop', 'src/server/analytics/adapters/noop.ts', null],
  ['jobs', 'inngest', 'src/server/jobs/index.ts', 'inngest'],
  ['errors', 'sentry', 'src/server/error-tracking/index.ts', '@sentry/tanstackstart-react'],
])(
  'creates %s with the explicit %s provider',
  (capability, provider, generatedFile, dependency) => {
    const fixture = createAcceptanceFixture('standalone')

    const result = runCli({
      cwd: fixture.root,
      target: fixture.project,
      args: ['project', '--no-install', `--${capability}=${provider}`],
    })

    expect(result.exitStatus).toBe(0)
    expect(result.requestedInput).toBe(false)
    expect(result.stdout).toContain(`${capability} (${provider})`)
    expect(existsSync(`${fixture.project}/${generatedFile}`)).toBe(true)
    const dependencies = JSON.parse(
      readFileSync(`${fixture.project}/package.json`, 'utf8'),
    ).dependencies
    if (dependency) expect(dependencies[dependency]).toEqual(expect.any(String))
  },
)

test('accepts the readable error-tracking creation alias and summarizes it canonically', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--no-install', '--error-tracking=sentry'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('errors (sentry)')
  expect(result.stdout).not.toContain('error-tracking (sentry)')
  expect(existsSync(`${fixture.project}/src/server/error-tracking/index.ts`)).toBe(true)
})

test.each([
  [['project', '--db=postgres'], 'Unknown database'],
  [['project', '--db=drizzle', '--database=drizzle'], 'Database was specified more than once'],
  [['project', '--auth=none', '--auth=clerk'], 'Auth was specified more than once'],
  [['project', '--storage=r2', '--storage=s3'], 'Storage was specified more than once'],
  [
    ['project', '--errors=sentry', '--error-tracking=sentry'],
    'Errors was specified more than once',
  ],
  [['project', '--storage=azure'], 'Unknown storage adapter'],
  [['project', '--jobs=trigger'], 'Unknown jobs provider'],
  [['project', '--errors=bugsnag'], 'Unknown errors provider'],
  [['project', '--alias=@', '--alias=#'], 'Import alias was specified more than once'],
  [['project', '-y', '--yes'], 'Recommended stack acceptance was specified more than once'],
  [['project', '-yv'], 'Grouped short options are not supported'],
  [['one', 'two', '--no-install'], 'Unexpected positional argument: two'],
  [['project', '-y', '--db=drizzle'], '--yes cannot be combined with stack options'],
  [['project', '-y', '--mono'], '--yes cannot be combined with stack options'],
  [['project', '--yes', '--minimal'], '--yes cannot be combined with --minimal'],
  [['project', '--yes=false'], '--yes does not accept a value'],
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

test('adds Email UI to a standalone application through the executable CLI', () => {
  const fixture = createAcceptanceFixture('standalone')
  const created = createProject(fixture, { framework: 'next' })

  expect(created.exitStatus).toBe(0)

  const added = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'email-ui', '--no-install'],
  })

  expect(added.exitStatus).toBe(0)
  expect(added.stdout).toContain('Added email-ui')
  expect(added.stderr).toBe('')
  expect(added.requestedInput).toBe(false)
  expect(added.targetMutated).toBe(true)
  expect(existsSync(`${fixture.app}/src/emails/components/index.ts`)).toBe(true)
})

test('guides users from the former Email UI name without mutating the project', () => {
  const fixture = createAcceptanceFixture('standalone')
  const formerName = ['email', 'kit'].join('-')
  const created = createProject(fixture, { framework: 'next' })

  expect(created.exitStatus).toBe(0)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', formerName, '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain(`'${formerName}' was renamed to 'email-ui'`)
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(false)
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
