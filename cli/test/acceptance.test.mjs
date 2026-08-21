import { spawn, spawnSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { expect, test } from 'vitest'
import { cleanupAcceptanceFixtures, createAcceptanceFixture, runCli } from './acceptance.mjs'

test.afterAll(cleanupAcceptanceFixtures)

function createProject(fixture, { framework, monorepo, pm }) {
  return runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: [
      'project',
      '--framework',
      framework,
      ...(pm ? ['--pm', pm] : []),
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

function fakePackageManager(fixture, name = 'npm') {
  const bin = `${fixture.root}/bin`
  const log = `${fixture.root}/package-manager.log`
  mkdirSync(bin)
  writeFileSync(
    `${bin}/${name}`,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$CREATE_STACK_COMMAND_LOG"
if [ "$*" = "$CREATE_STACK_FAIL_COMMAND" ]; then exit 1; fi
exit 0
`,
  )
  chmodSync(`${bin}/${name}`, 0o755)
  return {
    env: {
      CREATE_STACK_COMMAND_LOG: log,
      PATH: `${bin}:${process.env.PATH}`,
    },
    log,
  }
}

function startRegistry({ status = 200 } = {}) {
  const items = new Map(
    ['calendar', 'popover', 'button', 'table', 'skeleton'].map((name) => [
      name,
      {
        name,
        type: 'registry:ui',
        title: name,
        description: name,
        dependencies: [],
        registryDependencies: name === 'calendar' ? ['button'] : [],
        files: [
          {
            path: `ui/${name}.tsx`,
            type: 'registry:ui',
            content: `export function ${name[0].toUpperCase()}${name.slice(1)}() { return null }\n`,
          },
        ],
      },
    ]),
  )
  items.set('alert-dialog', {
    name: 'alert-dialog',
    type: 'registry:ui',
    title: 'Alert Dialog',
    description: 'Alert dialog primitive',
    dependencies: ['radix-ui', 'class-variance-authority'],
    registryDependencies: [],
    files: [
      {
        path: 'ui/alert-dialog.tsx',
        type: 'registry:ui',
        content: readFileSync(
          new URL('../../apps/next-base/src/components/ui/alert-dialog.tsx', import.meta.url),
          'utf8',
        ),
      },
    ],
  })
  const child = spawn(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
import { createServer } from 'node:http'
const items = new Map(${JSON.stringify([...items])})
const requests = new Map()
const colors = {
  inlineColors: { light: {}, dark: {} },
  cssVars: { light: {}, dark: {} },
  inlineColorsTemplate: '',
  cssVarsTemplate: '',
}
const status = ${status}
const server = createServer((request, response) => {
  const name = request.url?.split('/').at(-1)?.replace(/\\.json$/, '')
  requests.set(name, (requests.get(name) ?? 0) + 1)
  if (name === '__requests__') {
    response.statusCode = 200
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify(Object.fromEntries(requests)))
    return
  }
  const item = items.get(name)
  const payload = request.url?.includes('/colors/') ? colors : item
  response.statusCode = status === 200 && payload ? 200 : status
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify(payload ?? { error: 'not found' }))
})
server.listen(0, '127.0.0.1', () => console.log(server.address().port))
`,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  )
  return new Promise((resolve) => {
    child.stdout.setEncoding('utf8')
    child.stdout.once('data', (output) => {
      const url = `http://127.0.0.1:${Number(output.trim())}/r`
      resolve({
        child,
        url,
        requests: async () => (await fetch(`${url}/__requests__`)).json(),
      })
    })
  })
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

test('applies --keep-files and --force to their additions in a mixed batch', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)
  expect(
    runCli({
      cwd: fixture.app,
      target: fixture.app,
      args: ['add', 'storage', 'gcs', '--no-install'],
    }).exitStatus,
  ).toBe(0)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: [
      'add',
      '--with',
      'storage=r2',
      '--with',
      'component=prompt',
      '--keep-files',
      '--force',
      '--no-install',
    ],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('Provider change: storage (gcs → r2, keeping files)')
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/gcs.ts`)).toBe(true)
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/r2.ts`)).toBe(true)
  expect(existsSync(`${fixture.app}/src/components/ui/prompt.tsx`)).toBe(true)
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
  expect(result.stdout).toContain('Mailer: (none) — minimal exclusion')
  expect(existsSync(`${fixture.project}/src/server/api/trpc.ts`)).toBe(true)
  expect(existsSync(`${fixture.project}/src/server/db`)).toBe(false)
  expect(existsSync(`${fixture.project}/src/server/better-auth`)).toBe(false)
  expect(existsSync(`${fixture.project}/src/server/email`)).toBe(false)
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

test('removed standalone component command reports its add replacement before mutation', () => {
  const fixture = createAcceptanceFixture('standalone')

  const result = runCli({
    cwd: fixture.root,
    target: fixture.project,
    args: ['component', 'date-picker', '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.targetMutated).toBe(false)
  expect(result.stdout).toContain(
    'The component command was removed; run create-stack add component <name>',
  )
})

test('renamed datatable component reports its canonical name before mutation', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'tanstack' }).exitStatus).toBe(0)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'component', 'datatable', '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.targetMutated).toBe(false)
  expect(result.stdout).toContain(
    "'datatable' was renamed to 'data-table'; run create-stack add component data-table",
  )
})

test('renamed email kit reports its canonical addition before mutation', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'email-kit', '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.targetMutated).toBe(false)
  expect(result.stdout).toContain(
    "'email-kit' was renamed to 'email-ui'; run create-stack add email-ui",
  )
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

test('adds a legacy component through add and protects local files unless forced', () => {
  const fixture = createAcceptanceFixture('standalone')
  const created = createProject(fixture, { framework: 'tanstack' })

  expect(created.exitStatus).toBe(0)

  const installed = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'component', 'prompt', '--no-install'],
  })

  expect(installed.exitStatus).toBe(0)
  expect(installed.stdout).toContain('Addition plan')
  expect(installed.stdout).toContain('Addition: component prompt')
  expect(installed.stdout).toContain('Added component prompt')
  expect(installed.stderr).toBe('')
  expect(installed.requestedInput).toBe(false)
  expect(installed.targetMutated).toBe(true)
  const componentFile = `${fixture.app}/src/components/ui/prompt.tsx`
  expect(existsSync(componentFile)).toBe(true)
  expect(existsSync(`${fixture.app}/node_modules`)).toBe(false)

  writeFileSync(componentFile, '// local edit\n')
  const preserved = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'component', 'prompt', '--no-install'],
  })
  expect(preserved.exitStatus).toBe(0)
  expect(readFileSync(componentFile, 'utf8')).toBe('// local edit\n')

  const forced = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'component', 'prompt', '--force', '--no-install'],
  })
  expect(forced.exitStatus).toBe(0)
  expect(readFileSync(componentFile, 'utf8')).not.toBe('// local edit\n')
})

test('routes data-table through shadcn instead of the legacy no-install vendor path', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'component', 'data-table', '--pm', 'npm', '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain('shadcn-backed additions install dependencies immediately')
  expect(result.targetMutated).toBe(false)
  expect(existsSync(`${fixture.app}/src/components/data-table.tsx`)).toBe(false)
})

test('adds data-table through the packaged shadcn runtime and local item', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)
  const registry = await startRegistry()

  try {
    const added = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'data-table', '--pm', 'npm'],
    })

    expect(added.exitStatus).toBe(0)
    expect(added.stdout).toContain('Addition: component data-table')
    expect(added.stdout).toContain('shadcn: table, skeleton, button')
    expect(added.stdout).toContain('Added component data-table')
    for (const file of [
      'src/components/data-table.tsx',
      'src/components/infinite-data-table.tsx',
      'src/components/sortable-header.tsx',
      'src/hooks/use-data-table.tsx',
    ]) {
      expect(existsSync(`${fixture.app}/${file}`), file).toBe(true)
    }
    for (const file of ['table.tsx', 'skeleton.tsx', 'button.tsx']) {
      expect(existsSync(`${fixture.app}/src/components/ui/${file}`), file).toBe(true)
    }
    expect(readFileSync(`${fixture.app}/src/components/data-table.tsx`, 'utf8')).toContain(
      "'~/components/ui/table'",
    )
    expect(readFileSync(fake.log, 'utf8')).toContain('install')
  } finally {
    registry.child.kill()
  }
})

test('writes data-table files through custom component, UI, and hook aliases', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const configPath = `${fixture.app}/components.json`
  const config = JSON.parse(readFileSync(configPath, 'utf8'))
  config.aliases.components = '~/widgets'
  config.aliases.ui = '~/widgets/ui-kit'
  config.aliases.hooks = '~/state'
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
  const fake = fakePackageManager(fixture)
  const registry = await startRegistry()

  try {
    const added = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'data-table', '--pm', 'npm'],
    })

    expect(added.exitStatus).toBe(0)
    expect(existsSync(`${fixture.app}/src/widgets/data-table.tsx`)).toBe(true)
    expect(existsSync(`${fixture.app}/src/widgets/infinite-data-table.tsx`)).toBe(true)
    expect(existsSync(`${fixture.app}/src/widgets/sortable-header.tsx`)).toBe(true)
    expect(existsSync(`${fixture.app}/src/state/use-data-table.tsx`)).toBe(true)
    for (const file of ['table.tsx', 'skeleton.tsx', 'button.tsx']) {
      expect(existsSync(`${fixture.app}/src/widgets/ui-kit/${file}`), file).toBe(true)
    }
    expect(readFileSync(`${fixture.app}/src/widgets/data-table.tsx`, 'utf8')).toContain(
      "'~/widgets/ui-kit/table'",
    )
  } finally {
    registry.child.kill()
  }
})

test('reruns data-table safely and force-replaces only its owned files', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)
  const registry = await startRegistry()
  const localFiles = [
    'src/components/data-table.tsx',
    'src/components/infinite-data-table.tsx',
    'src/components/sortable-header.tsx',
    'src/hooks/use-data-table.tsx',
  ]
  const officialFiles = [
    'src/components/ui/table.tsx',
    'src/components/ui/skeleton.tsx',
    'src/components/ui/button.tsx',
  ]

  try {
    const first = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'data-table', '--pm', 'npm'],
    })
    expect(first.exitStatus).toBe(0)

    const originals = new Map(
      [...localFiles, ...officialFiles].map((file) => [
        file,
        readFileSync(`${fixture.app}/${file}`, 'utf8'),
      ]),
    )
    for (const file of localFiles) writeFileSync(`${fixture.app}/${file}`, `// edited ${file}\n`)
    for (const file of officialFiles)
      writeFileSync(`${fixture.app}/${file}`, `// edited official ${file}\n`)

    const rerun = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'data-table', '--pm', 'npm'],
    })
    expect(rerun.exitStatus).toBe(0)
    for (const file of [...localFiles, ...officialFiles]) {
      expect(readFileSync(`${fixture.app}/${file}`, 'utf8')).toBe(
        `// edited${officialFiles.includes(file) ? ' official' : ''} ${file}\n`,
      )
    }

    const forced = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'data-table', '--pm', 'npm', '--force'],
    })
    expect(forced.exitStatus).toBe(0)
    for (const file of localFiles) {
      expect(readFileSync(`${fixture.app}/${file}`, 'utf8')).toBe(originals.get(file))
    }
    for (const file of officialFiles) {
      expect(readFileSync(`${fixture.app}/${file}`, 'utf8')).toBe(`// edited official ${file}\n`)
    }
  } finally {
    registry.child.kill()
  }
})

test('installs a mixed registry batch once with shared official primitives deduplicated', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)
  const registry = await startRegistry()

  try {
    const added = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: [
        'add',
        '--with',
        'component=date-picker',
        '--with',
        'component=data-table',
        '--pm',
        'npm',
      ],
    })

    expect(added.exitStatus).toBe(0)
    expect(added.stdout).toContain('shadcn: calendar, popover, button, table, skeleton')
    expect(added.stdout.match(/shadcn:.*button/g)).toHaveLength(1)
    expect(readFileSync(fake.log, 'utf8').trim().split('\n')[0]).toBe(
      'install -- @tanstack/react-table@^8.21.3 react-day-picker date-fns',
    )
    expect(existsSync(`${fixture.app}/src/components/data-table.tsx`)).toBe(true)
    expect(existsSync(`${fixture.app}/src/components/ui/date-picker.tsx`)).toBe(true)
  } finally {
    registry.child.kill()
  }
})

test('adds capabilities and a legacy component in one repeated --with batch', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)

  const added = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: [
      'add',
      '--with',
      'storage=r2',
      '--with=jobs',
      '--with',
      'component=prompt',
      '--no-install',
    ],
  })

  expect(added.exitStatus).toBe(0)
  expect(added.requestedInput).toBe(false)
  expect(added.stdout).toContain('Addition: storage (r2)')
  expect(added.stdout).toContain('Addition: jobs (inngest)')
  expect(added.stdout).toContain('Addition: component prompt')
  expect(existsSync(`${fixture.app}/src/server/storage/adapters/r2.ts`)).toBe(true)
  expect(existsSync(`${fixture.app}/src/server/jobs/index.ts`)).toBe(true)
  expect(existsSync(`${fixture.app}/src/components/ui/prompt.tsx`)).toBe(true)
})

test('adds date-picker through the packaged shadcn runtime and local item', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)
  const registry = await startRegistry()

  try {
    const added = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'date-picker', '--pm', 'npm'],
    })

    expect(added.exitStatus).toBe(0)
    expect(added.stdout).toContain('Addition: component date-picker')
    expect(added.stdout).toContain('shadcn: calendar, popover, button')
    expect(added.stdout).toContain('Added component date-picker')
    expect(existsSync(`${fixture.app}/src/components/ui/date-picker.tsx`)).toBe(true)
    expect(existsSync(`${fixture.app}/src/components/ui/date-range-picker.tsx`)).toBe(true)
    expect(existsSync(`${fixture.app}/src/lib/date.ts`)).toBe(true)
    expect(existsSync(`${fixture.app}/src/components/ui/calendar.tsx`)).toBe(true)
    expect(existsSync(`${fixture.app}/src/components/ui/popover.tsx`)).toBe(true)
    expect(readFileSync(`${fixture.app}/src/components/ui/date-picker.tsx`, 'utf8')).toContain(
      "'use client'",
    )
    expect(readFileSync(fake.log, 'utf8')).toContain('install')
  } finally {
    registry.child.kill()
  }
})

test.each(['next', 'tanstack'])(
  'adds confirm and alert registry items for %s',
  async (framework) => {
    const fixture = createAcceptanceFixture('standalone')
    expect(createProject(fixture, { framework, pm: 'npm' }).exitStatus).toBe(0)
    const fake = fakePackageManager(fixture)
    const registry = await startRegistry()
    const rootFile = framework === 'next' ? 'src/app/layout.tsx' : 'src/routes/__root.tsx'

    try {
      const added = runCli({
        cwd: fixture.app,
        target: fixture.app,
        env: { ...fake.env, REGISTRY_URL: registry.url },
        args: ['add', '--with', 'component=confirm', '--with', 'component=alert', '--pm', 'npm'],
      })

      expect(added.exitStatus).toBe(0)
      expect(added.stdout).toContain('Addition: component confirm')
      expect(added.stdout).toContain('Addition: component alert')
      expect(added.stdout).toContain('shadcn: alert-dialog')
      expect((await registry.requests())['alert-dialog']).toBe(1)
      expect(existsSync(`${fixture.app}/src/components/ui/confirm.tsx`)).toBe(true)
      expect(existsSync(`${fixture.app}/src/components/ui/alert.tsx`)).toBe(true)
      expect(existsSync(`${fixture.app}/src/components/ui/alert-dialog.tsx`)).toBe(true)

      const root = readFileSync(`${fixture.app}/${rootFile}`, 'utf8')
      expect(root).toContain(`import { Confirm } from '~/components/ui/confirm'`)
      expect(root).toContain(`import { Alert } from '~/components/ui/alert'`)
      expect(root).toContain('<Confirm />')
      expect(root).toContain('<Alert />')
      expect(readFileSync(fake.log, 'utf8')).toContain('run typecheck')
    } finally {
      registry.child.kill()
    }
  },
)

test('force replaces only the selected callable source', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)
  const registry = await startRegistry()
  const confirm = `${fixture.app}/src/components/ui/confirm.tsx`
  const alert = `${fixture.app}/src/components/ui/alert.tsx`
  const alertDialog = `${fixture.app}/src/components/ui/alert-dialog.tsx`

  try {
    expect(
      runCli({
        cwd: fixture.app,
        target: fixture.app,
        env: { ...fake.env, REGISTRY_URL: registry.url },
        args: ['add', '--with', 'component=confirm', '--with', 'component=alert', '--pm', 'npm'],
      }).exitStatus,
    ).toBe(0)

    const editedAlert = '// keep the other callable\n'
    const editedPrimitive = '// keep the customized official primitive\n'
    writeFileSync(confirm, '// replace this callable\n')
    writeFileSync(alert, editedAlert)
    writeFileSync(alertDialog, editedPrimitive)

    const forced = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'confirm', '--pm', 'npm', '--force'],
    })

    expect(forced.exitStatus).toBe(0)
    expect(readFileSync(confirm, 'utf8')).not.toContain('replace this callable')
    expect(readFileSync(alert, 'utf8')).toBe(editedAlert)
    expect(readFileSync(alertDialog, 'utf8')).toBe(editedPrimitive)
  } finally {
    registry.child.kill()
  }
})

test.each(['next', 'tanstack'])(
  'manual root instructions preserve %s callable installation',
  async (framework) => {
    const fixture = createAcceptanceFixture('standalone')
    expect(createProject(fixture, { framework, pm: 'npm' }).exitStatus).toBe(0)
    const fake = fakePackageManager(fixture)
    const registry = await startRegistry()
    const rootFile = framework === 'next' ? 'src/app/layout.tsx' : 'src/routes/__root.tsx'
    writeFileSync(
      `${fixture.app}/${rootFile}`,
      'export default function CustomRoot() { return <div>customized root</div> }\n',
    )

    try {
      const added = runCli({
        cwd: fixture.app,
        target: fixture.app,
        env: { ...fake.env, REGISTRY_URL: registry.url },
        args: ['add', 'component', 'confirm', '--pm', 'npm'],
      })

      expect(added.exitStatus).toBe(0)
      expect(existsSync(`${fixture.app}/src/components/ui/confirm.tsx`)).toBe(true)
      expect(added.stdout).toContain(`import { Confirm } from '~/components/ui/confirm'`)
      expect(added.stdout).toContain('<Confirm />')
      expect(readFileSync(`${fixture.app}/${rootFile}`, 'utf8')).not.toContain('Confirm')
    } finally {
      registry.child.kill()
    }
  },
)

test('a failed callable registry install restores its staged source without mounting Root', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)
  const registry = await startRegistry({ status: 500 })
  const confirm = `${fixture.app}/src/components/ui/confirm.tsx`
  const root = `${fixture.app}/src/app/layout.tsx`
  const edited = '// restore this callable after failure\n'
  writeFileSync(confirm, edited)

  try {
    const failed = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'confirm', '--pm', 'npm', '--force'],
    })

    expect(failed.exitStatus).toBe(1)
    expect(readFileSync(confirm, 'utf8')).toBe(edited)
    expect(readFileSync(root, 'utf8')).not.toContain('import { Confirm }')
    expect(readFileSync(root, 'utf8')).not.toContain('<Confirm />')
  } finally {
    registry.child.kill()
  }
})

test('does not copy a fallback when the shadcn registry fails', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)
  const registry = await startRegistry({ status: 500 })

  try {
    const result = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'date-picker', '--pm', 'npm'],
    })

    expect(result.exitStatus).toBe(1)
    expect(result.stdout).toContain('no fallback files were copied')
    expect(result.targetMutated).toBe(false)
    expect(existsSync(`${fixture.app}/src/components/ui/date-picker.tsx`)).toBe(false)
    expect(existsSync(`${fixture.app}/src/components/ui/calendar.tsx`)).toBe(false)
    expect(existsSync(`${fixture.app}/src/components/ui/popover.tsx`)).toBe(false)
  } finally {
    registry.child.kill()
  }
})

test.each([
  ['missing', (path) => rmSync(path), 'npx shadcn@4.17.0 init'],
  ['invalid', (path) => writeFileSync(path, '{}\n'), 'npx shadcn@4.17.0 init'],
])('rejects a %s components.json before mutation', (_case, change, command) => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const config = `${fixture.app}/components.json`
  change(config)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'component', 'date-picker', '--pm', 'npm', '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain(command)
  expect(result.targetMutated).toBe(false)
  expect(existsSync(config)).toBe(_case === 'invalid')
})

test.each([[['--no-install'], 'shadcn-backed additions install dependencies immediately']])(
  'rejects unsupported date-picker flags before mutation',
  (flags, diagnostic) => {
    const fixture = createAcceptanceFixture('standalone')
    expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)

    const result = runCli({
      cwd: fixture.app,
      target: fixture.app,
      args: ['add', 'component', 'date-picker', '--pm', 'npm', ...flags],
    })

    expect(result.exitStatus).toBe(1)
    expect(result.stdout).toContain(diagnostic)
    expect(result.targetMutated).toBe(false)
  },
)

test('rerunning date-picker without --force preserves all existing files', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)
  const registry = await startRegistry()
  const files = [
    'src/components/ui/date-picker.tsx',
    'src/components/ui/date-range-picker.tsx',
    'src/lib/date.ts',
    'src/components/ui/calendar.tsx',
    'src/components/ui/popover.tsx',
    'src/components/ui/button.tsx',
  ]

  try {
    const first = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'date-picker', '--pm', 'npm'],
    })
    expect(first.exitStatus).toBe(0)
    const contents = new Map(
      files.map((file) => [file, readFileSync(`${fixture.app}/${file}`, 'utf8')]),
    )

    const second = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'date-picker', '--pm', 'npm'],
    })

    expect(second.exitStatus).toBe(0)
    for (const [file, content] of contents) {
      expect(readFileSync(`${fixture.app}/${file}`, 'utf8')).toBe(content)
    }
  } finally {
    registry.child.kill()
  }
})

test('--force replaces Create Stack files without overwriting shadcn primitives', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)
  const registry = await startRegistry()
  const localFiles = [
    'src/components/ui/date-picker.tsx',
    'src/components/ui/date-range-picker.tsx',
    'src/lib/date.ts',
  ]
  const officialFiles = [
    'src/components/ui/calendar.tsx',
    'src/components/ui/popover.tsx',
    'src/components/ui/button.tsx',
  ]

  try {
    expect(
      runCli({
        cwd: fixture.app,
        target: fixture.app,
        env: { ...fake.env, REGISTRY_URL: registry.url },
        args: ['add', 'component', 'date-picker', '--pm', 'npm'],
      }).exitStatus,
    ).toBe(0)

    const editedOfficial = new Map(officialFiles.map((file) => [file, `// edited ${file}\n`]))
    for (const file of localFiles) writeFileSync(`${fixture.app}/${file}`, `// edited ${file}\n`)
    for (const [file, content] of editedOfficial) writeFileSync(`${fixture.app}/${file}`, content)

    const forced = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'date-picker', '--pm', 'npm', '--force'],
    })

    expect(forced.exitStatus).toBe(0)
    for (const file of localFiles) {
      expect(readFileSync(`${fixture.app}/${file}`, 'utf8')).not.toContain('// edited')
    }
    for (const [file, content] of editedOfficial) {
      expect(readFileSync(`${fixture.app}/${file}`, 'utf8')).toBe(content)
    }
  } finally {
    registry.child.kill()
  }
})

test('--force restores staged Create Stack files when shadcn fails', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)
  let registry = await startRegistry()
  const localFile = `${fixture.app}/src/components/ui/date-picker.tsx`
  const edited = '// keep this edit after a failed replacement\n'

  try {
    expect(
      runCli({
        cwd: fixture.app,
        target: fixture.app,
        env: { ...fake.env, REGISTRY_URL: registry.url },
        args: ['add', 'component', 'date-picker', '--pm', 'npm'],
      }).exitStatus,
    ).toBe(0)
    writeFileSync(localFile, edited)
    registry.child.kill()
    registry = await startRegistry({ status: 500 })

    const failed = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'date-picker', '--pm', 'npm', '--force'],
    })

    expect(failed.exitStatus).toBe(1)
    expect(failed.stdout).toContain('package metadata')
    expect(failed.stdout).toContain('lockfile')
    expect(readFileSync(localFile, 'utf8')).toBe(edited)
  } finally {
    registry.child.kill()
  }
})

test('--force replaces a historical component at its configured destination', async () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)
  const registry = await startRegistry()
  const historical = `${fixture.app}/src/components/ui/date-picker.tsx`

  try {
    writeFileSync(historical, '// historical Create Stack component\n')
    const forced = runCli({
      cwd: fixture.app,
      target: fixture.app,
      env: { ...fake.env, REGISTRY_URL: registry.url },
      args: ['add', 'component', 'date-picker', '--pm', 'npm', '--force'],
    })

    expect(forced.exitStatus).toBe(0)
    expect(readFileSync(historical, 'utf8')).not.toContain('historical')
  } finally {
    registry.child.kill()
  }
})

test('--force refuses to move a historical component to a different configured destination', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next', pm: 'npm' }).exitStatus).toBe(0)
  const historical = `${fixture.app}/src/components/ui/date-picker.tsx`
  const config = `${fixture.app}/components.json`
  const parsed = JSON.parse(readFileSync(config, 'utf8'))
  parsed.aliases.ui = '~/custom-ui'
  writeFileSync(config, `${JSON.stringify(parsed, null, 2)}\n`)
  writeFileSync(historical, '// historical Create Stack component\n')

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'component', 'date-picker', '--pm', 'npm', '--force'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain('src/components/ui/date-picker.tsx')
  expect(result.stdout).toContain('src/custom-ui/date-picker.tsx')
  expect(result.targetMutated).toBe(false)
  expect(readFileSync(historical, 'utf8')).toContain('historical')
  expect(existsSync(`${fixture.app}/src/custom-ui/date-picker.tsx`)).toBe(false)
})

test('rejects a package-manager override that disagrees with shadcn metadata', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)
  const fake = fakePackageManager(fixture)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    env: fake.env,
    args: ['add', 'component', 'date-picker', '--pm', 'npm'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain('Package manager mismatch')
  expect(result.stdout).toContain('pnpm-workspace.yaml')
  expect(result.targetMutated).toBe(false)
})

test('normalizes addition aliases before rejecting batch duplicates', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', '--with', 'mail=resend', '--with', 'mailer=brevo', '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain('Duplicate addition: mail')
  expect(result.targetMutated).toBe(false)
})

test('add without an item presents one grouped capability and component selector', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'tanstack' }).exitStatus).toBe(0)

  const result = runCli({
    cwd: fixture.app,
    input: '\u0003',
    target: fixture.app,
    args: ['add', '--no-install'],
  })

  expect(result.exitStatus).toBe(0)
  expect(result.stdout).toContain('Additions to add')
  expect(result.stdout).toContain('Capabilities')
  expect(result.stdout).toContain('Components')
  expect(result.requestedInput).toBe(true)
  expect(result.targetMutated).toBe(false)
})

test.each([
  ['capability providers', ['storage=r2', 'storage=gcs'], 'storage'],
  ['capability aliases', ['errors=sentry', 'error-tracking=sentry'], 'errors'],
  ['components', ['component=date-picker', 'component=date-picker'], 'date-picker'],
])('rejects duplicate %s across an entire batch', (_case, entries, canonicalName) => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', ...entries.flatMap((entry) => ['--with', entry]), '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain(`Duplicate addition: ${canonicalName}`)
  expect(result.targetMutated).toBe(false)
})

test('rejects mixing a positional addition with an addition batch', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', 'http', '--with', 'jobs', '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain('Positional additions cannot be mixed with --with additions')
  expect(result.targetMutated).toBe(false)
})

test('validates every batch entry before applying the first addition', () => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'next' }).exitStatus).toBe(0)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', '--with', 'storage=r2', '--with', 'jobs=trigger', '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain('jobs only supports inngest')
  expect(result.targetMutated).toBe(false)
  expect(existsSync(`${fixture.app}/src/server/storage`)).toBe(false)
})

test('rejects an ambiguous batch target without prompting or mutation', () => {
  const fixture = createAmbiguousMonorepoFixture()

  const result = runCli({
    cwd: fixture.project,
    target: fixture.project,
    args: ['add', '--with', 'jobs', '--with', 'component=alert', '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain('Multiple compatible applications')
  expect(result.stdout).toContain('--app')
  expect(result.requestedInput).toBe(false)
  expect(result.targetMutated).toBe(false)
})

test.each([
  [['storage=r2', 'jobs'], '--force', '--force only applies to components'],
  [
    ['component=date-picker', 'http'],
    '--keep-files',
    '--keep-files only applies to provider changes',
  ],
])('rejects %s when it affects no addition in the batch', (entries, option, diagnostic) => {
  const fixture = createAcceptanceFixture('standalone')
  expect(createProject(fixture, { framework: 'tanstack' }).exitStatus).toBe(0)

  const result = runCli({
    cwd: fixture.app,
    target: fixture.app,
    args: ['add', ...entries.flatMap((entry) => ['--with', entry]), option, '--no-install'],
  })

  expect(result.exitStatus).toBe(1)
  expect(result.stdout).toContain(diagnostic)
  expect(result.targetMutated).toBe(false)
})
