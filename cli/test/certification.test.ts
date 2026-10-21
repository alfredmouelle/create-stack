import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Framework } from '@alfredmouelle/stack-config'
import { afterAll, describe, expect, test } from 'vitest'
import type { FrameworkModule } from '../src/framework-module.ts'
import { frameworkAssetExcludes, frameworkModules } from '../src/framework-registry.ts'
import { assertBrandedSurface, customizeTheme } from './branded-surface.ts'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const cliRoot = resolve(testDirectory, '..')
const repoRoot = resolve(cliRoot, '..')
const cliEntry = resolve(cliRoot, 'index.mjs')
const roots: string[] = []
const TIMEOUT = 15 * 60 * 1000

const CREATION_ARGS = (framework: Framework): string[] => [
  'project',
  '--framework',
  framework,
  '--database',
  'none',
  '--auth',
  'none',
  '--no-trpc',
  '--mailer',
  'none',
  '--no-install',
  '--no-git',
]

afterAll(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

type CliOptions = { repository?: boolean; args?: readonly string[] }

function runCli(
  entry: string,
  cwd: string,
  args: readonly string[],
  { repository = false }: CliOptions = {},
) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NO_COLOR: '1',
    npm_config_user_agent: 'pnpm/11.1.3',
  }
  if (repository) env.CREATE_STACK_STACK_ROOT = repoRoot
  else {
    delete env.CREATE_STACK_STACK_ROOT
    delete env.CREATE_STACK_BUNDLE_ROOT
  }

  return spawnSync(process.execPath, [entry, ...args], {
    cwd,
    encoding: 'utf8',
    env,
  })
}

function runCommand(command: string, args: readonly string[], cwd: string) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', npm_config_user_agent: 'pnpm/11.1.3' },
  })
}

function scaffold(
  entry: string,
  root: string,
  framework: Framework,
  options: CliOptions = {},
): string {
  const result = runCli(
    entry,
    root,
    [...CREATION_ARGS(framework), ...(options.args ?? [])],
    options,
  )
  expect(result.status, result.stderr).toBe(0)
  return join(root, 'project')
}

function copyPackageSource(packageRoot: string): void {
  const packageJson = readFileSync(join(cliRoot, 'package.json'))
  writeFileSync(join(packageRoot, 'package.json'), packageJson)
  copyFileSync(join(cliRoot, 'index.mjs'), join(packageRoot, 'index.mjs'))
  copyFileSync(join(cliRoot, 'engine.mjs'), join(packageRoot, 'engine.mjs'))
  cpSync(join(cliRoot, 'templates'), join(packageRoot, 'templates'), { recursive: true })
  cpSync(join(cliRoot, 'docs'), join(packageRoot, 'docs'), { recursive: true })
  mkdirSync(join(packageRoot, 'scripts'))
  copyFileSync(join(cliRoot, 'scripts/bundle.ts'), join(packageRoot, 'scripts/bundle.ts'))
  symlinkSync(join(cliRoot, 'node_modules'), join(packageRoot, 'node_modules'), 'dir')
}

function packCli(): string {
  const packageRoot = mkdtempSync(join(tmpdir(), 'create-stack-cert-package-'))
  const destination = mkdtempSync(join(tmpdir(), 'create-stack-cert-pack-'))
  const extracted = mkdtempSync(join(tmpdir(), 'create-stack-cert-extract-'))
  roots.push(packageRoot, destination, extracted)
  copyPackageSource(packageRoot)

  const packed = spawnSync('pnpm', ['pack', '--pack-destination', destination], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: { ...process.env, CREATE_STACK_BUNDLE_ROOT: repoRoot },
  })
  expect(packed.status, packed.stderr).toBe(0)

  const archiveName = readdirSync(destination).find((file) => file.endsWith('.tgz'))
  expect(archiveName).toBeDefined()
  if (archiveName === undefined) throw new Error('Expected a packed archive')
  const archive = join(destination, archiveName)
  const unpacked = spawnSync('tar', ['-xzf', archive, '-C', extracted], { encoding: 'utf8' })
  expect(unpacked.status, unpacked.stderr).toBe(0)
  symlinkSync(join(cliRoot, 'node_modules'), join(extracted, 'node_modules'), 'dir')

  return join(extracted, 'package')
}

function projectSignature(projectDir: string): Record<string, string> {
  const files: string[] = []

  function visit(root: string, relativeRoot = ''): void {
    for (const entry of readdirSync(join(projectDir, root), { withFileTypes: true })) {
      const relativePath = join(relativeRoot, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue
        visit(join(root, entry.name), relativePath)
      } else {
        files.push(relativePath)
      }
    }
  }

  visit('.')
  return Object.fromEntries(
    files
      .sort()
      .map((relativePath) => [
        relativePath,
        readFileSync(join(projectDir, relativePath)).toString('base64'),
      ]),
  )
}

function assetSignature(root: string, module: FrameworkModule): Record<string, string> {
  const files: string[] = []
  const excludedDirectories = new Set([
    'dist',
    '.turbo',
    'node_modules',
    ...frameworkAssetExcludes(module),
  ])

  function visit(current: string, relativeRoot = ''): void {
    for (const entry of readdirSync(join(root, current), { withFileTypes: true })) {
      const relativePath = join(relativeRoot, entry.name)
      if (entry.isDirectory()) {
        if (excludedDirectories.has(entry.name)) continue
        visit(join(current, entry.name), relativePath)
      } else if (
        entry.name !== '.gitignore' &&
        !excludedDirectories.has(entry.name) &&
        !entry.name.endsWith('.tsbuildinfo') &&
        entry.name !== 'start-database.sh' &&
        !entry.name.startsWith('.env')
      ) {
        files.push(relativePath)
      }
    }
  }

  visit('.')
  return Object.fromEntries(
    files
      .sort()
      .map((relativePath) => [
        relativePath,
        readFileSync(join(root, relativePath)).toString('base64'),
      ]),
  )
}

function verifyProject(projectDir: string): void {
  for (const script of ['typecheck', 'check', 'build']) {
    const result = runCommand('pnpm', ['run', script], projectDir)
    expect(
      result.status,
      `${script}: ${[result.stdout, result.stderr].filter(Boolean).join('\n')}`,
    ).toBe(0)
  }
}

describe.skipIf(process.env.RUN_CERTIFICATION !== '1')('branded CLI certification', () => {
  test.each(frameworkModules)(
    'keeps the $id generated branded surface equivalent after packing',
    (module) => {
      const framework = module.id
      const repositoryRoot = mkdtempSync(
        join(tmpdir(), `create-stack-cert-repository-${framework}-`),
      )
      const packedRoot = mkdtempSync(join(tmpdir(), `create-stack-cert-packed-${framework}-`))
      roots.push(repositoryRoot, packedRoot)

      const repositoryProject = scaffold(cliEntry, repositoryRoot, framework, { repository: true })
      const packedCli = packCli()
      const packedProject = scaffold(join(packedCli, 'index.mjs'), packedRoot, framework)
      for (const asset of module.packagedAssets) {
        expect(assetSignature(join(packedCli, '_stack', asset), module)).toEqual(
          assetSignature(join(repoRoot, asset), module),
        )
      }
      expect(projectSignature(packedProject)).toEqual(projectSignature(repositoryProject))
      assertBrandedSurface(repositoryProject, framework, expect)
      assertBrandedSurface(packedProject, framework, expect)

      const installed = runCommand('pnpm', ['install'], packedProject)
      expect(installed.status, installed.stderr || installed.stdout).toBe(0)
      const buttonPath = join(packedProject, 'src/components/ui/button.tsx')
      const buttonBeforeThemeChange = readFileSync(buttonPath, 'utf8')
      customizeTheme(packedProject, framework, expect)
      const addition = runCli(join(packedCli, 'index.mjs'), packedProject, [
        'add',
        '--with',
        'component=date-picker',
      ])
      expect(addition.status, addition.stderr).toBe(0)
      expect(readFileSync(buttonPath, 'utf8')).toBe(buttonBeforeThemeChange)
      expect(readFileSync(buttonPath, 'utf8')).toContain('bg-primary')
      expect(readFileSync(buttonPath, 'utf8')).toContain('rounded-4xl')
      expect(
        readFileSync(join(packedProject, 'src/components/ui/date-picker.tsx'), 'utf8'),
      ).toContain('text-muted-foreground')
      verifyProject(packedProject)
    },
    TIMEOUT,
  )
})
