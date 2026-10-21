import { execFileSync } from 'node:child_process'
import { join, relative, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { frameworkModules } from '../src/framework-registry.ts'

const repositoryRoot = resolve(import.meta.dirname, '../..')

type DryTask = {
  readonly taskId: string
  readonly directory: string
  readonly dependencies: readonly string[]
  readonly inputs: Readonly<Record<string, string>>
  readonly resolvedTaskDefinition: { readonly outputs: readonly string[] }
}

function dryRun(tasks: readonly string[], filters: readonly string[]): readonly DryTask[] {
  const output = execFileSync(
    join(repositoryRoot, 'node_modules/.bin/turbo'),
    ['run', ...tasks, ...filters.map((filter) => `--filter=${filter}`), '--dry=json'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { ...process.env, TURBO_TELEMETRY_DISABLED: '1' },
    },
  )
  const plan: { tasks: DryTask[] } = JSON.parse(output)
  return plan.tasks
}

function task(tasks: readonly DryTask[], taskId: string): DryTask {
  const found = tasks.find((candidate) => candidate.taskId === taskId)
  if (!found) throw new Error(`Missing task: ${taskId}`)
  return found
}

const repositoryInputs = ({ directory, inputs }: DryTask): string[] =>
  Object.keys(inputs).map((path) => relative(repositoryRoot, join(repositoryRoot, directory, path)))

const cliTasks = dryRun(['test', 'typecheck'], ['@alfredmouelle/create-stack'])

test.each(['test', 'typecheck'])('CLI %s depends on the shared stack configuration', (name) => {
  expect(task(cliTasks, `@alfredmouelle/create-stack#${name}`).dependencies).toContain(
    '@alfredmouelle/stack-config#build',
  )
})

test('CLI tests hash the reference applications and capability sources they read', () => {
  const inputs = repositoryInputs(task(cliTasks, '@alfredmouelle/create-stack#test'))
  for (const asset of frameworkModules.flatMap(({ packagedAssets }) => packagedAssets)) {
    expect(inputs).toContain(`${asset}/package.json`)
  }
  for (const path of [
    'packages/mailer/capability.json',
    'packages/mailer/src/adapters/resend.ts',
    'packages/http/src/index.ts',
    'tsconfig.base.json',
    'pnpm-workspace.yaml',
    '.github/workflows/publish.yml',
  ]) {
    expect(inputs).toContain(path)
  }
  expect(inputs.some((path) => path.includes('node_modules/'))).toBe(false)
})

test('CLI typecheck hashes the shared TypeScript configuration', () => {
  expect(repositoryInputs(task(cliTasks, '@alfredmouelle/create-stack#typecheck'))).toContain(
    'tsconfig.base.json',
  )
})

test('build outputs match each workspace application', () => {
  const builds = dryRun(['build'], ['./apps/*', '@alfredmouelle/mailer'])
  for (const module of frameworkModules) {
    for (const asset of module.packagedAssets) {
      const build = builds.find(({ directory }) => directory === asset)
      expect(build?.resolvedTaskDefinition.outputs, asset).toEqual(
        [...module.monorepoOutputs].sort(),
      )
    }
  }
  expect(task(builds, '@alfredmouelle/mailer#build').resolvedTaskDefinition.outputs).toEqual([
    'dist/**',
  ])
})

const stackConfigTasks = dryRun(['build', 'test'], ['@alfredmouelle/stack-config'])

test('the shared stack configuration hashes the CLI and capability facts it imports', () => {
  const inputs = repositoryInputs(task(stackConfigTasks, '@alfredmouelle/stack-config#build'))
  expect(inputs).toEqual(
    expect.arrayContaining([
      'cli/package.json',
      'packages/mailer/capability.json',
      'tsconfig.base.json',
    ]),
  )
})

test('the shared stack configuration tests hash the CLI they characterize', () => {
  const inputs = repositoryInputs(task(stackConfigTasks, '@alfredmouelle/stack-config#test'))
  expect(inputs).toEqual(
    expect.arrayContaining([
      'cli/index.mjs',
      'cli/src/engine.ts',
      ...frameworkModules.flatMap(({ packagedAssets }) =>
        packagedAssets.map((asset) => `${asset}/package.json`),
      ),
    ]),
  )
  expect(inputs.some((path) => path.includes('node_modules/'))).toBe(false)
})
