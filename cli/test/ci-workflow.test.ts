import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

const workflow = readFileSync(
  join(import.meta.dirname, '../../.github/workflows/ci.yml'),
  'utf8',
).split('\n')

function block(lines: readonly string[], header: string): string[] {
  const start = lines.findIndex((line) => line.trimEnd() === header)
  if (start === -1) throw new Error(`Missing block: ${header.trim()}`)
  const indent = header.length - header.trimStart().length
  const end = lines.findIndex(
    (line, index) =>
      index > start && line.trim() !== '' && line.length - line.trimStart().length <= indent,
  )
  return lines.slice(start + 1, end === -1 ? undefined : end)
}

const job = (name: string): string => block(workflow, `  ${name}:`).join('\n')

const filterPaths = (name: string): string[] =>
  block(workflow, `            ${name}:`).flatMap((line) => {
    const match = /^\s*- '(.+)'$/.exec(line)
    return match?.[1] ? [match[1]] : []
  })

const WORKSPACE_FILES = ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', '.npmrc']

test('framework detection installs workspace dependencies before reading the registry', () => {
  const changes = job('changes')
  const install = changes.indexOf('run: pnpm install --frozen-lockfile')
  expect(install).toBeGreaterThanOrEqual(0)
  expect(changes.indexOf('node cli/scripts/list-frameworks.ts')).toBeGreaterThan(install)
})

test('linting runs on every pull request', () => {
  expect(job('lint')).not.toContain('needs:')
  expect(job('lint')).toContain('run: pnpm check')
})

test('the CLI job typechecks and tests the CLI', () => {
  const cli = job('build-tests')
  expect(cli).toContain("if: needs.changes.outputs.cli == 'true'")
  expect(cli).toContain('run: pnpm --filter @alfredmouelle/create-stack typecheck')
  expect(cli).toContain('run: pnpm --filter @alfredmouelle/create-stack test')
})

test('the shared package job typechecks and tests every shared package', () => {
  const packages = job('shared-packages')
  expect(packages).toContain("if: needs.changes.outputs.packages == 'true'")
  expect(packages).toContain('run: pnpm --filter "./packages/*" typecheck')
  expect(packages).toContain('run: pnpm --filter "./packages/*" test')
})

test('reference application and marketing checks remain enforced', () => {
  expect(job('base-apps')).toContain('run: pnpm --filter "./apps/*" typecheck')
  expect(job('base-apps')).toContain('run: pnpm --filter "./apps/*" test')
  expect(job('marketing')).toContain('run: pnpm --filter @alfredmouelle/marketing typecheck')
  expect(job('marketing')).toContain('run: pnpm --filter @alfredmouelle/marketing test')
})

test.each([
  ['cli', ['cli/**', 'apps/**', 'packages/**', 'tsconfig.base.json', 'turbo.json']],
  ['packages', ['packages/**', 'cli/**', 'apps/**', 'tsconfig.base.json', 'turbo.json']],
  ['marketing', ['marketing/**', 'cli/package.json', 'packages/*/capability.json']],
])('the %s jobs run when their inputs change', (name, inputs) => {
  expect(filterPaths(name)).toEqual(
    expect.arrayContaining([...inputs, ...WORKSPACE_FILES, '.github/workflows/ci.yml']),
  )
})
