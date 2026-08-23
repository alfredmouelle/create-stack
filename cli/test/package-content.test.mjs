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
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, expect, test } from 'vitest'

const CLI_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const REPO_ROOT = resolve(CLI_ROOT, '..')
const tempRoots = []

afterAll(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true })
})

test('published package includes the local registry and its executable shadcn runtime', () => {
  const packageRoot = mkdtempSync(join(tmpdir(), 'create-stack-package-'))
  const destination = mkdtempSync(join(tmpdir(), 'create-stack-pack-'))
  const consumerRoot = mkdtempSync(join(tmpdir(), 'create-stack-consumer-'))
  tempRoots.push(packageRoot, destination, consumerRoot)

  writeFileSync(join(packageRoot, 'package.json'), readFileSync(join(CLI_ROOT, 'package.json')))
  writeFileSync(join(consumerRoot, 'package.json'), '{"private":true}\n')
  copyFileSync(join(CLI_ROOT, 'index.mjs'), join(packageRoot, 'index.mjs'))
  cpSync(join(CLI_ROOT, 'lib'), join(packageRoot, 'lib'), { recursive: true })
  cpSync(join(CLI_ROOT, 'templates'), join(packageRoot, 'templates'), { recursive: true })
  cpSync(join(CLI_ROOT, 'docs'), join(packageRoot, 'docs'), { recursive: true })
  mkdirSync(join(packageRoot, 'scripts'))
  copyFileSync(join(CLI_ROOT, 'scripts/bundle.mjs'), join(packageRoot, 'scripts/bundle.mjs'))
  symlinkSync(join(CLI_ROOT, 'node_modules'), join(packageRoot, 'node_modules'), 'dir')

  const packed = spawnSync('pnpm', ['pack', '--pack-destination', destination], {
    cwd: packageRoot,
    env: { ...process.env, CREATE_STACK_BUNDLE_ROOT: REPO_ROOT },
    encoding: 'utf8',
  })
  expect(packed.status, packed.stderr).toBe(0)

  const archiveName = readdirSync(destination).find((file) => file.endsWith('.tgz'))
  expect(archiveName).toBeDefined()
  const archive = join(destination, archiveName)
  const contents = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' })
  expect(contents.status, contents.stderr).toBe(0)
  expect(contents.stdout).toContain('package/_stack/registry/date-picker.json')
  expect(contents.stdout).toContain('package/_stack/stack-config/index.mjs')
  expect(contents.stdout).not.toContain('package/_stack/stack-config/index.ts')
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
  for (const framework of ['next-base', 'tanstack-base']) {
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
      expect(contents.stdout).not.toContain(`package/_stack/apps/${framework}/${file}`)
    }
  }

  const packageJson = JSON.parse(
    spawnSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }).stdout,
  )
  expect(packageJson.dependencies.shadcn).toBe('4.17.0')
  expect({
    ...packageJson.dependencies,
    ...packageJson.optionalDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.devDependencies,
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
  const runtimePackage = JSON.parse(readFileSync(runtimePackagePath, 'utf8'))
  expect(runtimePackage.version).toBe('4.17.0')
  expect(runtimePackage.bin).toBe('./dist/index.js')
  const runtimePath = join(runtimePackageRoot, runtimePackage.bin)
  accessSync(runtimePath, constants.X_OK)
  const runtime = spawnSync(runtimePath, ['--help'], { encoding: 'utf8' })
  expect(runtime.status, runtime.stderr).toBe(0)

  const installedCli = join(consumerRoot, 'node_modules/@alfredmouelle/create-stack')
  const smoke = spawnSync(
    process.execPath,
    [join(installedCli, 'index.mjs'), 'packed-project', '--minimal', '--no-install', '--no-git'],
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
  expect(smoke.status, smoke.stderr).toBe(0)
  expect(smoke.stderr).toBe('')
  expect(smoke.stdout).toContain('Database: (none) — minimal exclusion')
  expect(readFileSync(join(consumerRoot, 'packed-project/package.json'), 'utf8')).toContain(
    '"name": "packed-project"',
  )
}, 30_000)
