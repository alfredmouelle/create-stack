import { spawnSync } from 'node:child_process'
import {
  accessSync,
  constants,
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
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, expect, test } from 'vitest'
import { frameworkModules } from '../src/framework-registry.ts'
import { isJsonObject, type JsonObject } from '../src/javascript/json.ts'

const CLI_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const REPO_ROOT = resolve(CLI_ROOT, '..')
const tempRoots: string[] = []

function packedArchive(destination: string): string {
  const archiveName = readdirSync(destination).find((file) => file.endsWith('.tgz'))
  expect(archiveName).toBeDefined()
  if (archiveName === undefined) throw new Error('Expected a packed archive')
  return join(destination, archiveName)
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected a string')
  return value
}

function parseObject(text: string): JsonObject {
  const value: unknown = JSON.parse(text)
  if (!isJsonObject(value)) throw new Error('Expected a JSON object')
  return value
}

const objectField = (source: JsonObject, field: string): JsonObject => {
  const value = source[field]
  return isJsonObject(value) ? value : {}
}

afterAll(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true })
})

function createBundleFixture() {
  const bundleRoot = mkdtempSync(join(tmpdir(), 'create-stack-bundle-'))
  tempRoots.push(bundleRoot)
  for (const path of [
    'package.json',
    'pnpm-workspace.yaml',
    'tsconfig.base.json',
    'cli',
    'packages',
    'apps',
  ]) {
    cpSync(join(REPO_ROOT, path), join(bundleRoot, path), {
      recursive: true,
      filter: (source) =>
        ![
          'node_modules',
          'dist',
          '_stack',
          '.turbo',
          '.gitignore',
          '.next',
          '.output',
          '.nitro',
          '.tanstack',
          '.rasengan',
          '.data',
        ].includes(basename(source)) && !basename(source).startsWith('.env'),
    })
  }
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(bundleRoot, 'node_modules'), 'dir')
  symlinkSync(join(CLI_ROOT, 'node_modules'), join(bundleRoot, 'cli/node_modules'), 'dir')
  for (const module of frameworkModules) {
    for (const asset of module.packagedAssets) {
      for (const path of [
        '.env',
        '.env.local',
        '.env.test',
        'app.tsbuildinfo',
        'dist/index.js',
        '.turbo/turbo-test.log',
        ...(GENERATED_FILES[module.id] ?? []),
      ]) {
        const destination = join(bundleRoot, asset, path)
        mkdirSync(dirname(destination), { recursive: true })
        writeFileSync(
          destination,
          path.startsWith('.env') ? 'APPLICATION_NAME=Storefront\n' : 'export {}\n',
        )
      }
    }
  }

  return bundleRoot
}

const GENERATED_FILES = {
  remix: ['.remix/runtime.js', '.cache/styles.css', '.data/messages.json'],
  rasengan: ['.rasengan/cache/config.js', '.data/messages.json', 'dist/server/private.js'],
  next: ['next-env.d.ts', '.next/server/chunk.js'],
  tanstack: [
    'src/routeTree.gen.ts',
    '.tanstack/cache/router.js',
    '.output/server/index.js',
    '.nitro/server/index.js',
  ],
}

test('published package includes the local registry and its executable shadcn runtime', () => {
  const bundleRoot = createBundleFixture()
  const packageRoot = mkdtempSync(join(tmpdir(), 'create-stack-package-'))
  const destination = mkdtempSync(join(tmpdir(), 'create-stack-pack-'))
  const consumerRoot = mkdtempSync(join(tmpdir(), 'create-stack-consumer-'))
  tempRoots.push(packageRoot, destination, consumerRoot)

  writeFileSync(join(packageRoot, 'package.json'), readFileSync(join(CLI_ROOT, 'package.json')))
  writeFileSync(join(consumerRoot, 'package.json'), '{"private":true}\n')
  copyFileSync(join(CLI_ROOT, 'index.mjs'), join(packageRoot, 'index.mjs'))
  copyFileSync(join(CLI_ROOT, 'engine.mjs'), join(packageRoot, 'engine.mjs'))
  cpSync(join(CLI_ROOT, 'templates'), join(packageRoot, 'templates'), { recursive: true })
  cpSync(join(CLI_ROOT, 'docs'), join(packageRoot, 'docs'), { recursive: true })
  mkdirSync(join(packageRoot, 'scripts'))
  copyFileSync(join(CLI_ROOT, 'scripts/bundle.ts'), join(packageRoot, 'scripts/bundle.ts'))
  symlinkSync(join(CLI_ROOT, 'node_modules'), join(packageRoot, 'node_modules'), 'dir')

  const packed = spawnSync('pnpm', ['pack', '--pack-destination', destination], {
    cwd: packageRoot,
    env: { ...process.env, CREATE_STACK_BUNDLE_ROOT: bundleRoot },
    encoding: 'utf8',
  })
  expect(packed.status, packed.stderr).toBe(0)

  const archive = packedArchive(destination)
  const contents = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' })
  expect(contents.status, contents.stderr).toBe(0)
  expect(contents.stdout).toContain('package/_stack/registry/date-picker.json')
  expect(contents.stdout).toContain('package/_stack/engine/index.mjs')
  expect(contents.stdout).toContain('package/engine.mjs')
  expect(contents.stdout).not.toContain('package/src/')
  expect(contents.stdout).not.toContain('package/_stack/stack-config/')
  for (const name of [
    'prompt',
    'choice',
    'confirm-passphrase',
    'confirm-otp',
    'confirm',
    'alert',
    'data-table',
  ]) {
    expect(contents.stdout).toContain(`package/_stack/registry/${name}.json`)
  }
  expect(contents.stdout).toContain('package/_stack/registry/index.json')
  expect(contents.stdout).toContain('package/templates/start-database.sh')
  const entries = contents.stdout.trim().split('\n')
  expect(entries.some((entry) => /\/(?:next-env\.d\.ts|routeTree\.gen\.ts)$/.test(entry))).toBe(
    false,
  )
  expect(entries.some((entry) => /(?:^|\/)\.env(?:\.|\/|$)/.test(entry))).toBe(false)
  expect(entries.some((entry) => /(?:^|\/)node_modules(?:\/|$)|\.tsbuildinfo$/.test(entry))).toBe(
    false,
  )
  for (const module of frameworkModules) {
    for (const asset of module.packagedAssets) {
      expect(contents.stdout).toContain(`package/_stack/${asset}/package.json`)
      expect(contents.stdout).toContain(`package/_stack/${asset}/src/lib/site-config.ts`)
      expect(contents.stdout).not.toContain(`package/_stack/${asset}/turbo.json`)
      for (const generated of [
        'dist/index.js',
        '.turbo/turbo-test.log',
        ...(GENERATED_FILES[module.id] ?? []),
      ]) {
        expect(contents.stdout).not.toContain(`package/_stack/${asset}/${generated}`)
      }
      for (const file of [
        'src/components/data-table.tsx',
        'src/components/infinite-data-table.tsx',
        'src/components/sortable-header.tsx',
        'src/hooks/use-data-table.tsx',
        'src/components/ui/date-picker.tsx',
        'src/components/ui/date-range-picker.tsx',
        'src/components/ui/calendar.tsx',
        'src/components/ui/popover.tsx',
        'src/components/ui/confirm.tsx',
        'src/components/ui/alert.tsx',
        'src/components/ui/alert-dialog.tsx',
        'src/lib/date.ts',
      ]) {
        expect(contents.stdout).not.toContain(`package/_stack/${asset}/${file}`)
      }
    }
  }

  const packageJson = parseObject(
    spawnSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }).stdout,
  )
  expect(objectField(packageJson, 'dependencies').shadcn).toBe('4.21.4')
  expect({
    ...objectField(packageJson, 'dependencies'),
    ...objectField(packageJson, 'optionalDependencies'),
    ...objectField(packageJson, 'peerDependencies'),
  }).not.toHaveProperty('@alfredmouelle/stack-config')

  const installed = spawnSync('pnpm', ['add', '--ignore-scripts', archive], {
    cwd: consumerRoot,
    encoding: 'utf8',
  })
  expect(installed.status, installed.stderr || installed.stdout).toBe(0)

  const virtualStore = join(consumerRoot, 'node_modules/.pnpm')
  const runtimePackagePath = readdirSync(virtualStore)
    .map((entry) => join(virtualStore, entry, 'node_modules/shadcn/package.json'))
    .find((path) => {
      try {
        accessSync(path)
        return true
      } catch {
        return false
      }
    })
  expect(runtimePackagePath).toBeDefined()
  if (!runtimePackagePath) return
  const runtimePackageRoot = dirname(runtimePackagePath)
  const runtimePackage = parseObject(readFileSync(runtimePackagePath, 'utf8'))
  expect(runtimePackage.version).toBe('4.21.4')
  expect(runtimePackage.bin).toBe('./dist/index.js')
  const runtimePath = join(runtimePackageRoot, requireString(runtimePackage.bin))
  accessSync(runtimePath, constants.X_OK)
  const runtime = spawnSync(runtimePath, ['--help'], { encoding: 'utf8' })
  expect(runtime.status, runtime.stderr).toBe(0)

  const installedCli = join(consumerRoot, 'node_modules/@alfredmouelle/create-stack')
  for (const { id } of frameworkModules) {
    const projectName = `packed-${id}`
    const generated = spawnSync(
      process.execPath,
      [
        join(installedCli, 'index.mjs'),
        projectName,
        '--framework',
        id,
        '--minimal',
        '--no-install',
        '--no-git',
      ],
      {
        cwd: consumerRoot,
        env: {
          ...process.env,
          CREATE_STACK_STACK_ROOT: undefined,
          CREATE_STACK_BUNDLE_ROOT: undefined,
          NO_COLOR: '1',
        },
        encoding: 'utf8',
      },
    )
    expect(generated.status, generated.stderr).toBe(0)
    expect(generated.stderr).toBe('')
    expect(generated.stdout).toContain('Database: (none), minimal exclusion')
    expect(readFileSync(join(consumerRoot, projectName, 'package.json'), 'utf8')).toContain(
      `"name": "${projectName}"`,
    )
  }
}, 30_000)
