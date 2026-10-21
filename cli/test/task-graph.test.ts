import { execFileSync } from 'node:child_process'
import { join, relative, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { frameworkModules } from '../src/framework-registry.ts'
import { isJsonObject, type JsonObject } from '../src/javascript/json.ts'

const repositoryRoot = resolve(import.meta.dirname, '../..')

type DryTask = {
  readonly taskId: string
  readonly directory: string
  readonly dependencies: readonly string[]
  readonly inputs: readonly string[]
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
  const plan: unknown = JSON.parse(output)
  if (!isJsonObject(plan) || !Array.isArray(plan.tasks)) throw new Error('Invalid turbo dry run')
  return plan.tasks.map(dryTask)
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string')

const stringField = (source: JsonObject, field: string): string => {
  const value = source[field]
  if (typeof value !== 'string') throw new Error(`Invalid turbo task ${field}`)
  return value
}

const stringArrayField = (source: JsonObject, field: string): string[] => {
  const value = source[field]
  if (!isStringArray(value)) throw new Error(`Invalid turbo task ${field}`)
  return value
}

function dryTask(value: unknown): DryTask {
  if (!isJsonObject(value)) throw new Error('Invalid turbo task')
  const { inputs, resolvedTaskDefinition } = value
  if (!isJsonObject(inputs) || !isJsonObject(resolvedTaskDefinition)) {
    throw new Error('Invalid turbo task definition')
  }
  return {
    taskId: stringField(value, 'taskId'),
    directory: stringField(value, 'directory'),
    dependencies: stringArrayField(value, 'dependencies'),
    inputs: Object.keys(inputs),
    resolvedTaskDefinition: { outputs: stringArrayField(resolvedTaskDefinition, 'outputs') },
  }
}

function task(tasks: readonly DryTask[], taskId: string): DryTask {
  const found = tasks.find((candidate) => candidate.taskId === taskId)
  if (!found) throw new Error(`Missing task: ${taskId}`)
  return found
}

const repositoryInputs = ({ directory, inputs }: DryTask): string[] =>
  inputs.map((path) => relative(repositoryRoot, join(repositoryRoot, directory, path)))

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
    'README.md',
    'docs/adding-a-framework.md',
    'marketing/package.json',
  ]) {
    expect(inputs).toContain(path)
  }
  expect(inputs.some((path) => /(?:^|\/)(?:node_modules|\.turbo)\//.test(path))).toBe(false)
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
  expect(inputs.some((path) => /(?:^|\/)(?:node_modules|\.turbo)\//.test(path))).toBe(false)
})
