import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, test } from 'vitest'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const cliRoot = resolve(testDirectory, '..')
const repoRoot = resolve(cliRoot, '..')
const cliEntry = resolve(cliRoot, 'index.mjs')
const roots = []

afterAll(
  () => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
  },
  2 * 60 * 1000,
)

const FRAMEWORKS = process.env.SMOKE_FRAMEWORK
  ? [process.env.SMOKE_FRAMEWORK]
  : ['tanstack', 'next']
const TIMEOUT = 15 * 60 * 1000

function run(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    timeout: TIMEOUT,
    env: {
      ...process.env,
      CREATE_STACK_STACK_ROOT: repoRoot,
      NO_COLOR: '1',
      npm_config_user_agent: 'pnpm/11.1.3',
    },
  }).status
}

function runCli(args, cwd) {
  expect(run(process.execPath, [cliEntry, ...args], cwd), `create-stack ${args.join(' ')}`).toBe(0)
}

function verify(projectDir) {
  expect(run('pnpm', ['run', 'typecheck'], projectDir), 'installed project typecheck').toBe(0)
  expect(run('pnpm', ['run', 'check'], projectDir), 'installed project format check').toBe(0)
}

function scaffold(framework, workflow, options) {
  const root = mkdtempSync(join(tmpdir(), `create-stack-smoke-${framework}-${workflow}-`))
  roots.push(root)
  runCli(['app', '--framework', framework, '--no-git', ...options], root)
  return { root, projectDir: join(root, 'app') }
}

const CREATION_WORKFLOWS = [
  { name: 'recommended', options: [] },
  { name: 'minimal', options: ['--minimal'] },
  {
    name: 'independent-trpc',
    options: ['--minimal', '--trpc'],
  },
  {
    name: 'convex',
    options: ['--database', 'convex', '--auth', 'clerk'],
  },
]

describe.skipIf(!process.env.RUN_SMOKE)('installed CLI smoke matrix', () => {
  for (const framework of FRAMEWORKS) {
    for (const workflow of CREATION_WORKFLOWS) {
      test(
        `${framework}/${workflow.name}`,
        () => verify(scaffold(framework, workflow.name, workflow.options).projectDir),
        TIMEOUT,
      )
    }

    test(
      `${framework}/provider-change`,
      () => {
        const { projectDir } = scaffold(framework, 'provider-change', [
          '--minimal',
          '--cache',
          'redis',
        ])
        runCli(['add', 'cache', 'upstash'], projectDir)
        verify(projectDir)
      },
      TIMEOUT,
    )

    test(
      `${framework}/mixed-addition`,
      () => {
        const { projectDir } = scaffold(framework, 'mixed-addition', ['--minimal'])
        runCli(['add', '--with', 'jobs', '--with', 'component=alert'], projectDir)
        verify(projectDir)
      },
      TIMEOUT,
    )

    test(
      `${framework}/date-picker`,
      () => {
        const { projectDir } = scaffold(framework, 'date-picker', ['--minimal'])
        runCli(['add', 'component', 'date-picker'], projectDir)
        verify(projectDir)
      },
      TIMEOUT,
    )

    test(
      `${framework}/data-table`,
      () => {
        const { projectDir } = scaffold(framework, 'data-table', ['--minimal'])
        runCli(['add', 'component', 'data-table'], projectDir)
        verify(projectDir)
      },
      TIMEOUT,
    )
  }
})
