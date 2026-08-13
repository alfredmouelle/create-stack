import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
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
  const fixture = createAcceptanceFixture('monorepo')
  expect(createProject(fixture, { framework: 'next', monorepo: 'turbo' }).exitStatus).toBe(0)
  cpSync(fixture.app, `${fixture.project}/apps/admin`, { recursive: true })

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
  const fixture = createAcceptanceFixture('monorepo')
  expect(createProject(fixture, { framework: 'next', monorepo: 'turbo' }).exitStatus).toBe(0)
  const admin = `${fixture.project}/apps/admin`
  cpSync(fixture.app, admin, { recursive: true })

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
  const fixture = createAcceptanceFixture('monorepo')
  expect(createProject(fixture, { framework: 'next', monorepo: 'turbo' }).exitStatus).toBe(0)
  cpSync(fixture.app, `${fixture.project}/apps/admin`, { recursive: true })

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
