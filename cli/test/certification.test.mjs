import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  existsSync,
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
import { afterAll, describe, expect, test } from 'vitest'
import { assertBrandedSurface, customizeTheme } from './branded-surface.mjs'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const cliRoot = resolve(testDirectory, '..')
const repoRoot = resolve(cliRoot, '..')
const cliEntry = resolve(cliRoot, 'index.mjs')
const roots = []
const TIMEOUT = 15 * 60 * 1000

const SURFACE_FILES = {
  next: [
    'src/app/globals.css',
    'src/app/layout.tsx',
    'src/app/page.tsx',
    'src/components/theme-provider.tsx',
    'src/components/theme-toggle.tsx',
    'src/lib/site-config.ts',
    'public/favicon.svg',
    'public/favicon.ico',
    'public/logo192.png',
    'public/logo512.png',
    'public/manifest.json',
  ],
  tanstack: [
    'src/styles.css',
    'src/routes/__root.tsx',
    'src/routes/index.tsx',
    'src/components/theme-provider.tsx',
    'src/components/theme-toggle.tsx',
    'src/lib/site-config.ts',
    'public/favicon.svg',
    'public/favicon.ico',
    'public/logo192.png',
    'public/logo512.png',
    'public/manifest.json',
  ],
}

const CREATION_ARGS = (framework) => [
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

function runCli(entry, cwd, args, { repository = false } = {}) {
  const env = {
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

function runCommand(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', npm_config_user_agent: 'pnpm/11.1.3' },
  })
}

function scaffold(entry, root, framework, options = {}) {
  const result = runCli(
    entry,
    root,
    [...CREATION_ARGS(framework), ...(options.args ?? [])],
    options,
  )
  expect(result.status, result.stderr).toBe(0)
  return join(root, 'project')
}

function copyPackageSource(packageRoot) {
  const packageJson = readFileSync(join(cliRoot, 'package.json'))
  writeFileSync(join(packageRoot, 'package.json'), packageJson)
  copyFileSync(join(cliRoot, 'index.mjs'), join(packageRoot, 'index.mjs'))
  cpSync(join(cliRoot, 'lib'), join(packageRoot, 'lib'), { recursive: true })
  cpSync(join(cliRoot, 'templates'), join(packageRoot, 'templates'), { recursive: true })
  cpSync(join(cliRoot, 'docs'), join(packageRoot, 'docs'), { recursive: true })
  mkdirSync(join(packageRoot, 'scripts'))
  copyFileSync(join(cliRoot, 'scripts/bundle.mjs'), join(packageRoot, 'scripts/bundle.mjs'))
  symlinkSync(join(cliRoot, 'node_modules'), join(packageRoot, 'node_modules'), 'dir')
}

function packCli() {
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
  const archive = join(destination, archiveName)
  const unpacked = spawnSync('tar', ['-xzf', archive, '-C', extracted], { encoding: 'utf8' })
  expect(unpacked.status, unpacked.stderr).toBe(0)
  symlinkSync(join(cliRoot, 'node_modules'), join(extracted, 'node_modules'), 'dir')

  return join(extracted, 'package')
}

function fileSignature(projectDir, framework) {
  return Object.fromEntries(
    SURFACE_FILES[framework].map((relativePath) => {
      const path = join(projectDir, relativePath)
      expect(existsSync(path), relativePath).toBe(true)
      return [relativePath, readFileSync(path).toString('base64')]
    }),
  )
}

function projectSignature(projectDir) {
  const files = []

  function visit(root, relativeRoot = '') {
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

function assetSignature(root) {
  const files = []
  const excludedDirectories = new Set([
    '.next',
    '.nitro',
    '.output',
    '.tanstack',
    'dist',
    'node_modules',
  ])

  function visit(current, relativeRoot = '') {
    for (const entry of readdirSync(join(root, current), { withFileTypes: true })) {
      const relativePath = join(relativeRoot, entry.name)
      if (entry.isDirectory()) {
        if (excludedDirectories.has(entry.name)) continue
        visit(join(current, entry.name), relativePath)
      } else if (
        entry.name !== '.gitignore' &&
        entry.name !== 'routeTree.gen.ts' &&
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

function verifyProject(projectDir) {
  for (const script of ['typecheck', 'check', 'build']) {
    const result = runCommand('pnpm', ['run', script], projectDir)
    expect(result.status, `${script}: ${result.stderr || result.stdout}`).toBe(0)
  }
}

describe('branded CLI certification', () => {
  test.each(['next', 'tanstack'])(
    'keeps the %s generated branded surface equivalent after packing',
    (framework) => {
      const repositoryRoot = mkdtempSync(
        join(tmpdir(), `create-stack-cert-repository-${framework}-`),
      )
      const packedRoot = mkdtempSync(join(tmpdir(), `create-stack-cert-packed-${framework}-`))
      roots.push(repositoryRoot, packedRoot)

      const repositoryProject = scaffold(cliEntry, repositoryRoot, framework, { repository: true })
      const packedCli = packCli()
      const packedProject = scaffold(join(packedCli, 'index.mjs'), packedRoot, framework)
      const baseName = framework === 'next' ? 'next-base' : 'tanstack-base'

      expect(assetSignature(join(packedCli, '_stack/apps', baseName))).toEqual(
        assetSignature(join(repoRoot, 'apps', baseName)),
      )
      expect(projectSignature(packedProject)).toEqual(projectSignature(repositoryProject))
      expect(fileSignature(packedProject, framework)).toEqual(
        fileSignature(repositoryProject, framework),
      )
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
