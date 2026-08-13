import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

function createAmbiguousMonorepoFixture() {
  const fixture = createAcceptanceFixture('monorepo')
  expect(createProject(fixture, { framework: 'next', monorepo: 'turbo' }).exitStatus).toBe(0)
  cpSync(fixture.app, `${fixture.project}/apps/admin`, { recursive: true })
  return fixture
}

function fakePackageManager(fixture) {
  const bin = `${fixture.root}/bin`
  const log = `${fixture.root}/package-manager.log`
  mkdirSync(bin)
  writeFileSync(
    `${bin}/npm`,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$CREATE_STACK_COMMAND_LOG"
if [ "$*" = "$CREATE_STACK_FAIL_COMMAND" ]; then exit 1; fi
exit 0
`,
  )
  chmodSync(`${bin}/npm`, 0o755)
  return {
    env: {
      CREATE_STACK_COMMAND_LOG: log,
      PATH: `${bin}:${process.env.PATH}`,
    },
    log,
  }
}

function expectNoCommit(projectDir) {
  expect(spawnSync('git', ['-C', projectDir, 'rev-parse', '--verify', 'HEAD']).status).not.toBe(0)
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

test('non-interactive creation requires an explicit project target', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain('Project name is required')
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(false)
})

test('minimal creation without a project target fails without prompting', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({ cwd: fixture.root, target: fixture.project, args: ['--minimal'] })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain('Project name is required')
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(false)
})

test('creates into the current directory only when it is empty', () => {
  const fixture = createAcceptanceFixture('standalone')

  const created = runCli({
    cwd: fixture.root,
    target: fixture.root,
    args: ['.', '--minimal', '--no-install', '--no-git'],
  })

  expect(created.exitStatus).toBe(0)
  expect(JSON.parse(readFileSync(`${fixture.root}/package.json`, 'utf8')).name).toBe(
    fixture.root.split('/').at(-1).toLowerCase(),
  )

  const protectedFixture = createAcceptanceFixture('standalone')
  writeFileSync(`${protectedFixture.root}/keep.txt`, 'keep')
  const protectedResult = runCli({
    cwd: protectedFixture.root,
    target: protectedFixture.root,
    args: ['.', '--minimal', '--no-install', '--no-git'],
  })

  expect(protectedResult.exitStatus).toBe(1)
  expect(protectedResult.stdout).toContain('Target directory is not empty')
  expect(readFileSync(`${protectedFixture.root}/keep.txt`, 'utf8')).toBe('keep')
})

test('protects an explicitly named non-empty target', () => {
  const fixture = createAcceptanceFixture('standalone')
  mkdirSync(fixture.project)
  writeFileSync(`${fixture.project}/keep.txt`, 'keep')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--minimal', '--no-install', '--no-git'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain('Target directory is not empty')
  expect(readFileSync(`${fixture.project}/keep.txt`, 'utf8')).toBe('keep')
})

test('no-install explains skipped verification and never creates an automatic commit', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--minimal', '--no-install'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('Installation and verification skipped')
  expect(existsSync(`${fixture.project}/.git`)).toBe(true)
  expectNoCommit(fixture.project)
})

test('git is not initialized inside an existing repository or with --no-git', () => {
  const repositoryFixture = createAcceptanceFixture('standalone')
  const fake = fakePackageManager(repositoryFixture)
  expect(spawnSync('git', ['init', '-q'], { cwd: repositoryFixture.root }).status).toBe(0)
  mkdirSync(repositoryFixture.project)

  const insideRepository = runCli({
    cwd: repositoryFixture.root,
    target: repositoryFixture.project,
    args: ['project', '--minimal', '--pm', 'npm'],
    env: fake.env,
  })

  expect(insideRepository.exitStatus).toBe(0)
  expect(existsSync(`${repositoryFixture.project}/.git`)).toBe(false)
  expect(
    spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: repositoryFixture.root }).status,
  ).toBe(0)
  expectNoCommit(repositoryFixture.root)

  const noGitFixture = createAcceptanceFixture('standalone')
  const noGitPackageManager = fakePackageManager(noGitFixture)
  const noGit = runCli({
    cwd: noGitFixture.root,
    target: noGitFixture.project,
    args: ['project', '--minimal', '--pm', 'npm', '--no-git'],
    env: noGitPackageManager.env,
  })

  expect(noGit.exitStatus).toBe(0)
  expect(existsSync(`${noGitFixture.project}/.git`)).toBe(false)
  expect(readFileSync(noGitPackageManager.log, 'utf8')).toBe(
    ['install', 'run check:write', 'run typecheck', 'run check', ''].join('\n'),
  )
})

test('a verified installation creates the generated baseline commit', () => {
  const fixture = createAcceptanceFixture('standalone')
  const fake = fakePackageManager(fixture)

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--minimal', '--pm', 'npm'],
    env: fake.env,
  })

  expect(result.exitStatus).toBe(0)
  expect(readFileSync(fake.log, 'utf8')).toBe(
    ['install', 'run check:write', 'run typecheck', 'run check', ''].join('\n'),
  )
  expect(
    spawnSync('git', ['-C', fixture.project, 'log', '-1', '--pretty=%s'], { encoding: 'utf8' })
      .stdout,
  ).toBe('chore: initial commit from create-stack\n')
})

test.each([
  ['installation', 'install'],
  ['verification', 'run check:write'],
  ['verification', 'run typecheck'],
  ['verification', 'run check'],
])('a failed %s leaves the generated project without a baseline commit', (_step, command) => {
  const fixture = createAcceptanceFixture('standalone')
  const fake = fakePackageManager(fixture)

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--minimal', '--pm', 'npm'],
    env: { ...fake.env, CREATE_STACK_FAIL_COMMAND: command },
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain(command === 'install' ? 'install failed' : 'Verification failed')
  expect(existsSync(`${fixture.project}/.git`)).toBe(true)
  expectNoCommit(fixture.project)
})

test('missing Git identity leaves a verified project without a baseline commit', () => {
  const fixture = createAcceptanceFixture('standalone')
  const fake = fakePackageManager(fixture)

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['project', '--minimal', '--pm', 'npm'],
    env: {
      ...fake.env,
      GIT_AUTHOR_EMAIL: '',
      GIT_AUTHOR_NAME: '',
      GIT_COMMITTER_EMAIL: '',
      GIT_COMMITTER_NAME: '',
    },
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('set git user.name/email')
  expectNoCommit(fixture.project)
})

test('bare --mono before the target selects Turborepo', () => {
  const fixture = createAcceptanceFixture('monorepo')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['--mono', 'project', '--minimal', '--no-install', '--no-git'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('Monorepo: Turborepo')
  expect(existsSync(`${fixture.app}/package.json`)).toBe(true)
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
  [['project', '--minimal', '--minimal'], 'Minimal project was specified more than once'],
  [['project', '--no-install=false'], '--no-install does not accept a value'],
  [['project', '--no-git=false'], '--no-git does not accept a value'],
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
    cwd: fixture.project,
    target: fixture.project,
    args: ['add', 'storage', 'r2', '--no-install'],
  })

  expect(added.exitStatus).toBe(0)
  expect(added.stdout).toContain('Added storage')
  expect(added.stdout).toContain('Application: apps/web')
  expect(added.stderr).toBe('')
  expect(added.requestedInput).toBe(false)
  expect(added.targetMutated).toBe(true)
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/r2.ts`)).toBe(true)
  expect(existsSync(`${fixture.project}/node_modules`)).toBe(false)
  expect(existsSync(`${fixture.app}/node_modules`)).toBe(false)
})

test('an explicit addition rejects an ambiguous monorepo before mutation', () => {
  const fixture = createAmbiguousMonorepoFixture()

  const added = runCli({
    cwd: fixture.project,
    target: fixture.project,
    args: ['add', 'storage', 'r2', '--no-install'],
  })

  expect(added.exitStatus).toBe(1)
  expect(added.stdout).toContain('Multiple compatible applications')
  expect(added.stdout).toContain('--app')
  expect(added.requestedInput).toBe(false)
  expect(added.targetMutated).toBe(false)
})

test('--app selects one relative application and confines the addition to it', () => {
  const fixture = createAmbiguousMonorepoFixture()
  const admin = `${fixture.project}/apps/admin`

  const added = runCli({
    cwd: fixture.project,
    target: fixture.project,
    args: ['add', 'storage', 'r2', '--app', 'apps/web', '--no-install'],
  })

  expect(added.exitStatus).toBe(0)
  expect(added.stdout).toContain('Application: apps/web')
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/r2.ts`)).toBe(true)
  expect(existsSync(`${admin}/src/server/storage`)).toBe(false)
})

test('add detects the project package manager from its lockfile', () => {
  const fixture = createAcceptanceFixture('monorepo')
  expect(createProject(fixture, { framework: 'tanstack', monorepo: 'turbo' }).exitStatus).toBe(0)
  writeFileSync(`${fixture.project}/yarn.lock`, '')

  const added = runCli({
    cwd: fixture.project,
    target: fixture.project,
    args: ['add', 'http', '--no-install'],
  })

  expect(added.exitStatus).toBe(0)
  expect(added.stdout).toContain('Package manager: yarn')
})

test.each(['--pm', '--package-manager'])(
  '%s overrides lockfile package-manager detection',
  (flag) => {
    const fixture = createAcceptanceFixture('standalone')
    expect(createProject(fixture, { framework: 'tanstack' }).exitStatus).toBe(0)
    writeFileSync(`${fixture.project}/yarn.lock`, '')
    writeFileSync(`${fixture.project}/bun.lock`, '')

    const added = runCli({
      cwd: fixture.project,
      target: fixture.project,
      args: ['add', 'http', flag, 'npm', '--no-install'],
    })

    expect(added.exitStatus).toBe(0)
    expect(added.stdout).toContain('Package manager: npm')
  },
)

test.each([
  ['conflicting aliases', ['--pm', 'npm', '--package-manager', 'yarn']],
  ['a repeated override', ['--pm', 'npm', '--pm', 'npm']],
])('%s fail before project mutation', (_case, overrides) => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)

  const added = runCli({
    cwd: fixture.project,
    target: fixture.project,
    args: ['add', 'http', ...overrides, '--no-install'],
  })

  expect(added.exitStatus).toBe(1)
  expect(added.stdout).toContain('Ambiguous package manager overrides')
  expect(added.targetMutated).toBe(false)
})

test.each([
  {
    name: 'an invalid override',
    files: [],
    args: ['--pm', 'deno'],
    error: 'Invalid package manager',
  },
  {
    name: 'ambiguous lockfiles',
    files: ['yarn.lock', 'package-lock.json'],
    args: [],
    error: 'Ambiguous project package manager',
  },
])('$name fails before project mutation', ({ files, args, error }) => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)
  for (const file of files) writeFileSync(`${fixture.project}/${file}`, '')

  const added = runCli({
    cwd: fixture.project,
    target: fixture.project,
    args: ['add', 'storage', 'r2', ...args, '--no-install'],
  })

  expect(added.exitStatus).toBe(1)
  expect(added.stdout).toContain(error)
  expect(added.targetMutated).toBe(false)
})

test('interactive add asks which compatible application to target', () => {
  const fixture = createAmbiguousMonorepoFixture()

  const added = runCli({
    cwd: fixture.project,
    input: '\u0003',
    target: fixture.project,
    args: ['add', '--no-install'],
  })

  expect(added.exitStatus).toBe(0)
  expect(added.stdout).toContain('Application to enrich')
  expect(added.stdout).toContain('apps/admin')
  expect(added.stdout).toContain('apps/web')
  expect(added.requestedInput).toBe(true)
  expect(added.targetMutated).toBe(false)
})

test.each([
  ['an absolute path', '/tmp'],
  ['a path outside the project', '../outside'],
  ['a missing path', 'apps/missing'],
  ['a non-application path', 'apps'],
])('invalid --app target: %s', (_case, app) => {
  const fixture = createAcceptanceFixture('monorepo')
  expect(createProject(fixture, { framework: 'next', monorepo: 'turbo' }).exitStatus).toBe(0)

  const added = runCli({
    cwd: fixture.project,
    target: fixture.project,
    args: ['add', 'http', '--app', app, '--no-install'],
  })

  expect(added.exitStatus).toBe(1)
  expect(added.stdout).toMatch(/--app|application target|compatible application/)
  expect(added.targetMutated).toBe(false)
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

test.each([
  ['storage', undefined, 'storage (r2)', 'src/server/storage/adapters/r2.ts'],
  ['cache', undefined, 'cache (upstash)', 'src/server/cache/adapters/upstash.ts'],
  ['mail', 'brevo', 'mail (brevo)', 'src/server/email/adapters/brevo.ts'],
  ['errors', 'sentry', 'errors (sentry)', 'src/server/error-tracking/index.ts'],
  ['jobs', 'inngest', 'jobs (inngest)', 'src/server/jobs/index.ts'],
])(
  'adds %s through its simple positional form and prints the canonical plan',
  (kind, provider, planned, expectedFile) => {
    const fixture = createAcceptanceFixture('standalone')
    expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)

    const added = runCli({
      cwd: fixture.app,
      target: fixture.app,
      args: ['add', kind, ...(provider ? [provider] : []), '--no-install'],
    })

    expect(added.exitStatus).toBe(0)
    expect(added.stdout).toContain('Addition plan')
    expect(added.stdout).toContain(`Addition: ${planned}`)
    expect(added.stdout.indexOf('Addition plan')).toBeLessThan(added.stdout.indexOf('Added'))
    expect(added.requestedInput).toBe(false)
    expect(existsSync(`${fixture.app}/${expectedFile}`)).toBe(true)
  },
)

test.each([
  ['mailer', 'resend', 'mail (resend)'],
  ['error-tracking', 'sentry', 'errors (sentry)'],
])('normalizes the %s alias in the addition plan', (alias, provider, planned) => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)

  const added = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', alias, provider, '--no-install'],
  })

  expect(added.exitStatus).toBe(0)
  expect(added.stdout).toContain(`Addition: ${planned}`)
})

test('provider changes remove old files by default and --keep-files retains them', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)
  expect(
    runCli({
      cwd: fixture.app,
      target: fixture.app,
      args: ['add', 'storage', 'gcs', '--no-install'],
    }).exitStatus,
  ).toBe(0)

  const swapped = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'storage', 'r2', '--no-install'],
  })

  expect(swapped.exitStatus).toBe(0)
  expect(swapped.stdout).toContain('Provider change: storage (gcs → r2)')
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/gcs.ts`)).toBe(false)
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/r2.ts`)).toBe(true)
  let pkg = JSON.parse(readFileSync(`${fixture.app}/package.json`, 'utf8'))
  expect(pkg.dependencies['@google-cloud/storage']).toBeUndefined()

  const kept = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'storage', 'gcs', '--keep-files', '--no-install'],
  })

  expect(kept.exitStatus).toBe(0)
  expect(kept.stdout).toContain('Provider change: storage (r2 → gcs, keeping files)')
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/r2.ts`)).toBe(true)
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/gcs.ts`)).toBe(true)
  pkg = JSON.parse(readFileSync(`${fixture.app}/package.json`, 'utf8'))
  expect(pkg.dependencies['@aws-sdk/client-s3']).toBeDefined()
  expect(pkg.dependencies['@google-cloud/storage']).toBeDefined()

  const cleaned = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'storage', 'local', '--no-install'],
  })

  expect(cleaned.exitStatus).toBe(0)
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/r2.ts`)).toBe(false)
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/gcs.ts`)).toBe(false)
  pkg = JSON.parse(readFileSync(`${fixture.app}/package.json`, 'utf8'))
  expect(pkg.dependencies['@aws-sdk/client-s3']).toBeUndefined()
  expect(pkg.dependencies['@google-cloud/storage']).toBeUndefined()
})

test.each([
  [['add', 'http', '--force', '--no-install'], '--force only applies to components'],
  [
    ['add', 'component', 'date-picker', '--keep-files', '--no-install'],
    '--keep-files only applies to provider changes',
  ],
  [['add', 'email-ui', 'resend', '--no-install'], 'email-ui has no provider to choose'],
  [['add', 'component', 'date-picker', '--force=false', '--no-install'], '--force does not accept'],
  [['add', 'http', '--wat', '--no-install'], 'Unknown option for add: --wat'],
])('rejects an inapplicable addition option before mutation', (args, diagnostic) => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'tanstack' }).exitStatus).toBe(0)

  const result = runCli({ cwd: fixture.app, target: fixture.app, args })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain(diagnostic)
  expect(result.targetMutated).toBe(false)
})

test('adds a component through add and protects local files unless forced', () => {
  const fixture = createAcceptanceFixture('standalone')
  const created = createProject(fixture, { framework: 'tanstack' })

  expect(created.exitStatus).toBe(0)

  const installed = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'component', 'data-table', '--no-install'],
  })

  expect(installed.exitStatus).toBe(0)
  expect(installed.stdout).toContain('Addition plan')
  expect(installed.stdout).toContain('Addition: component data-table')
  expect(installed.stdout).toContain('Added component data-table')
  expect(installed.stderr).toBe('')
  expect(installed.requestedInput).toBe(false)
  expect(installed.targetMutated).toBe(true)
  const componentFile = `${fixture.app}/src/components/data-table.tsx`
  expect(existsSync(componentFile)).toBe(true)
  expect(existsSync(`${fixture.app}/node_modules`)).toBe(false)

  writeFileSync(componentFile, '// local edit\n')
  const preserved = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'component', 'data-table', '--no-install'],
  })
  expect(preserved.exitStatus).toBe(0)
  expect(readFileSync(componentFile, 'utf8')).toBe('// local edit\n')

  const forced = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'component', 'data-table', '--force', '--no-install'],
  })
  expect(forced.exitStatus).toBe(0)
  expect(readFileSync(componentFile, 'utf8')).not.toBe('// local edit\n')
})
