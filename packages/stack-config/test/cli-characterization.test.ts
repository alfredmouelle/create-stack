import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'
import { resolveStackConfiguration, type StackConfigurationInput } from '../src/index.js'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(testDirectory, '../../..')
const cliEntry = resolve(repositoryRoot, 'cli/index.mjs')
const fixtureRoots: string[] = []

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function runCli(args: readonly string[]) {
  const root = mkdtempSync(join(tmpdir(), 'stack-config-characterization-'))
  fixtureRoots.push(root)
  const cli = spawnSync(
    process.execPath,
    [cliEntry, 'project', ...args, '--no-install', '--no-git'],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        CREATE_STACK_STACK_ROOT: repositoryRoot,
        NO_COLOR: '1',
      },
    },
  )
  return { cli, project: join(root, 'project') }
}

function createProject(input: Parameters<typeof resolveStackConfiguration>[0]) {
  const result = resolveStackConfiguration(input)
  const { cli, project } = runCli(result.cliArgs)
  return { cli, project, result }
}

const characterizationCases: ReadonlyArray<{
  name: string
  input: StackConfigurationInput
  expected: { database: string; auth: string; trpc: string; mailer: string }
  configuration: Pick<
    ReturnType<typeof resolveStackConfiguration>['configuration'],
    'database' | 'auth' | 'trpc' | 'mailer'
  >
}> = [
  {
    name: 'recommended stack',
    input: {},
    expected: { database: 'drizzle', auth: 'better-auth', trpc: 'yes', mailer: 'resend' },
    configuration: { database: 'drizzle', auth: 'better-auth', trpc: true, mailer: 'resend' },
  },
  {
    name: 'minimal project',
    input: { minimal: true },
    expected: { database: '(none)', auth: '(none)', trpc: 'no', mailer: '(none)' },
    configuration: { database: 'none', auth: 'none', trpc: false, mailer: 'none' },
  },
  {
    name: 'Better Auth dependency completion',
    input: { auth: 'better-auth' },
    expected: { database: 'drizzle', auth: 'better-auth', trpc: 'yes', mailer: 'resend' },
    configuration: { database: 'drizzle', auth: 'better-auth', trpc: true, mailer: 'resend' },
  },
  {
    name: 'minimal Better Auth dependency completion',
    input: { minimal: true, auth: 'better-auth' },
    expected: { database: 'drizzle', auth: 'better-auth', trpc: 'no', mailer: 'resend' },
    configuration: { database: 'drizzle', auth: 'better-auth', trpc: false, mailer: 'resend' },
  },
  {
    name: 'explicit exclusions',
    input: { database: 'none', auth: 'none', trpc: false, mailer: 'none' },
    expected: { database: '(none)', auth: '(none)', trpc: 'no', mailer: '(none)' },
    configuration: { database: 'none', auth: 'none', trpc: false, mailer: 'none' },
  },
  {
    name: 'Convex recommendation set',
    input: { database: 'convex' },
    expected: { database: 'convex', auth: 'clerk', trpc: 'no', mailer: '(none)' },
    configuration: { database: 'convex', auth: 'clerk', trpc: false, mailer: 'none' },
  },
  {
    name: 'fully explicit stack',
    input: {
      framework: 'next',
      database: 'prisma',
      auth: 'clerk',
      trpc: false,
      mailer: 'ses',
    },
    expected: { database: 'prisma', auth: 'clerk', trpc: 'no', mailer: 'ses' },
    configuration: { database: 'prisma', auth: 'clerk', trpc: false, mailer: 'ses' },
  },
]

describe('CLI creation characterization', () => {
  test.each(characterizationCases)('$name matches the current creation plan', (scenario) => {
    const { cli, result } = createProject(scenario.input)

    expect(cli.status).toBe(0)
    expect(cli.stderr).toBe('')
    expect(cli.stdout).toContain(`Database: ${scenario.expected.database}`)
    expect(cli.stdout).toContain(`Auth: ${scenario.expected.auth}`)
    expect(cli.stdout).toContain(`tRPC: ${scenario.expected.trpc}`)
    expect(cli.stdout).toContain(`Mailer: ${scenario.expected.mailer}`)
    expect(cli.stdout).toContain(
      `Framework: ${scenario.input.framework === 'next' ? 'Next.js' : 'TanStack Start'}`,
    )
    expect(result.configuration).toMatchObject(scenario.configuration)
  })

  test('current CLI rejects a conflicting explicit stack before mutation', () => {
    const result = resolveStackConfiguration({ database: 'convex', auth: 'better-auth' })
    const { cli, project } = runCli(['--database', 'convex', '--auth', 'better-auth'])

    expect(result.conflicts).toEqual([
      { axes: ['database', 'auth'], message: 'Better Auth cannot be used with Convex' },
    ])
    expect(cli.status).toBe(1)
    expect(cli.stdout).toContain('Better Auth cannot be used with Convex')
    expect(existsSync(project)).toBe(false)
  })
})
