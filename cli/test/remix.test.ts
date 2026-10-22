import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, expect, test } from 'vitest'
import { getFrameworkModule } from '../src/framework-registry.ts'
import { nativeOxlintOverrides } from '../src/frameworks/remix-quality.ts'
import { readField } from './json.ts'

const roots: string[] = []
const cli = resolve(import.meta.dirname, '../index.mjs')

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

test('creates a minimal native Remix application without React application dependencies', () => {
  const root = mkdtempSync(join(tmpdir(), 'create-stack-remix-'))
  roots.push(root)
  const projectDir = join(root, 'storefront')

  const result = spawnSync(
    process.execPath,
    [cli, projectDir, '--framework', 'remix', '--minimal', '--no-install', '--no-git'],
    { encoding: 'utf8', timeout: 30_000 },
  )

  expect(result.status, result.stdout + result.stderr).toBe(0)
  expect(readField(join(projectDir, 'package.json'), 'dependencies')).toHaveProperty(
    'remix',
    '3.0.0',
  )
  expect(readField(join(projectDir, 'package.json'), 'dependencies')).not.toHaveProperty('react')
  expect(readField(join(projectDir, 'tsconfig.json'), 'compilerOptions')).toHaveProperty(
    'jsxImportSource',
    'remix/component',
  )
  expect(existsSync(join(projectDir, 'components.json'))).toBe(false)
  expect(existsSync(join(projectDir, 'src/server/db/index.ts'))).toBe(false)
})

function scaffold(): string {
  const root = mkdtempSync(join(tmpdir(), 'create-stack-remix-addition-'))
  roots.push(root)
  const result = spawnSync(
    process.execPath,
    [cli, 'storefront', '--framework', 'remix', '--minimal', '--no-install', '--no-git'],
    { cwd: root, encoding: 'utf8' },
  )
  expect(result.status, result.stdout + result.stderr).toBe(0)
  return join(root, 'storefront')
}

function signature(root: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const path = join(entry.parentPath, entry.name)
        return [path.slice(root.length), readFileSync(path).toString('base64')]
      }),
  )
}

test('adds native components without shadcn metadata, installation, or registry access', () => {
  const project = scaffold()
  const result = spawnSync(
    process.execPath,
    [cli, 'add', '--with', 'component=prompt', '--with', 'component=date-picker', '--no-install'],
    { cwd: project, encoding: 'utf8', timeout: 30_000 },
  )
  expect(result.status, result.stdout + result.stderr).toBe(0)
  expect(existsSync(join(project, 'components.json'))).toBe(false)
  expect(readFileSync(join(project, 'src/components/document.tsx'), 'utf8')).toContain('<Prompt />')
  expect(readFileSync(join(project, 'src/client/ui/prompt.tsx'), 'utf8')).toContain(
    'remix/component',
  )
})

test('rejects invalid mixed native addition batches before any mutation', () => {
  const project = scaffold()
  const before = signature(project)
  const result = spawnSync(
    process.execPath,
    [
      cli,
      'add',
      '--with',
      'component=prompt',
      '--with',
      'cache=unsupported-provider',
      '--no-install',
    ],
    { cwd: project, encoding: 'utf8' },
  )
  expect(result.status).not.toBe(0)
  expect(signature(project)).toEqual(before)
})

test('keeps native component files and roots unchanged for capability-only additions', () => {
  const project = scaffold()
  const path = join(project, 'src/components/document.tsx')
  const before = readFileSync(path, 'utf8')
  const result = spawnSync(process.execPath, [cli, 'add', 'cache', 'memory', '--no-install'], {
    cwd: project,
    encoding: 'utf8',
  })
  expect(result.status, result.stdout + result.stderr).toBe(0)
  expect(readFileSync(path, 'utf8')).toBe(before)
  expect(existsSync(join(project, 'src/client/ui/dialog.tsx'))).toBe(false)
})

test.each(['pnpm', 'npm', 'yarn', 'bun'])(
  'documents minimal %s setup without SQL instructions',
  (pm) => {
    const root = mkdtempSync(join(tmpdir(), 'create-stack-remix-readme-'))
    roots.push(root)
    const result = spawnSync(
      process.execPath,
      [
        cli,
        'customer-portal',
        '--framework',
        'remix',
        '--minimal',
        '--pm',
        pm,
        '--no-install',
        '--no-git',
      ],
      { cwd: root, encoding: 'utf8' },
    )
    expect(result.status, result.stdout + result.stderr).toBe(0)
    const readme = readFileSync(join(root, 'customer-portal/README.md'), 'utf8')
    expect(readme).toContain(`${pm} run start`)
    expect(readme).not.toContain('start-database.sh')
    expect(readme).not.toContain('db:push')
    if (pm !== 'pnpm') expect(readme).not.toContain('pnpm ')
    expect(readme.match(/## Native Remix/gu)).toHaveLength(1)
  },
)

test('declares and confines native lint compatibility rules while retaining strict TypeScript', () => {
  const projectDir = scaffold()
  const framework = getFrameworkModule('remix')
  framework.applyQualityProfile({
    projectDir,
    applicationDir: projectDir,
    formatter: 'biome',
    linter: 'oxlint',
    alias: '~',
    framework,
  })
  const config = JSON.parse(readFileSync(join(projectDir, '.oxlintrc.json'), 'utf8'))
  expect(config.overrides).toEqual([
    {
      files: [
        'src/client/**',
        'src/components/**',
        'src/pages/**',
        'src/server/better-auth/pages.tsx',
      ],
      rules: { 'react/display-name': 'off', 'react/checked-requires-onchange-or-readonly': 'off' },
    },
  ])
  expect(nativeOxlintOverrides.every(({ reason }) => reason.length > 20)).toBe(true)
  expect(readField(join(projectDir, 'tsconfig.json'), 'compilerOptions')).toMatchObject({
    strict: true,
    jsxImportSource: 'remix/component',
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
  })
  expect(readField(join(projectDir, 'package.json'), 'scripts').check).toContain(
    'oxlint --type-aware',
  )
})
