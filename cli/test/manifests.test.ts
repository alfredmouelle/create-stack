import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { isJsonObject, type JsonObject } from '../src/javascript/json.ts'
import { readField, readJson } from './json.ts'

const PACKAGES = resolve(dirname(fileURLToPath(import.meta.url)), '../../packages')
const REPO_ROOT = resolve(PACKAGES, '..')
const names = readdirSync(PACKAGES).filter((n) => existsSync(join(PACKAGES, n, 'capability.json')))
const manifest = (n: string): JsonObject => readJson(join(PACKAGES, n, 'capability.json'))

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
const objects = (value: unknown): JsonObject[] =>
  isJsonObject(value) ? Object.values(value).filter(isJsonObject) : []
const keys = (value: unknown): string[] => (isJsonObject(value) ? Object.keys(value) : [])

const paths = (m: JsonObject): string[] => [
  ...strings(m.sharedFiles),
  ...strings(m.files),
  ...objects(m.adapters).flatMap((a) => strings(a.files)),
  ...(typeof m.port === 'string' && m.port ? [m.port] : []),
  ...(typeof m.factory === 'string' && m.factory ? [m.factory] : []),
]

test('every package ships a manifest', () => {
  expect(names.sort()).toEqual([
    'analytics',
    'cache',
    'email-ui',
    'error-tracking',
    'http',
    'jobs',
    'logger',
    'mailer',
    'storage',
  ])
})

test('Email UI keeps its package, manifest, export, and bundling identity aligned', () => {
  const pkg = readJson(join(PACKAGES, 'email-ui/package.json'))
  const emailUiManifest = manifest('email-ui')
  const bundleScript = readFileSync(join(REPO_ROOT, 'cli/scripts/bundle.ts'), 'utf8')

  expect(pkg.name).toBe('@alfredmouelle/email-ui')
  expect(pkg.private).not.toBe(true)
  expect(pkg.publishConfig).toEqual({ access: 'public' })
  expect(pkg.exports).toEqual({ '.': './src/index.ts' })
  expect(emailUiManifest.name).toBe('email-ui')
  expect(bundleScript).toContain("['http', 'email-ui']")
})

test('the former package name appears only in migration history', () => {
  const listed = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
  expect(listed.status).toBe(0)

  const historical = (path: string): boolean =>
    path === 'cli/CHANGELOG.md' ||
    path === 'cli/test/acceptance.test.ts' ||
    path.startsWith('docs/adr/')
  const retiredName = new RegExp(['email', 'kit'].join('[- _]'), 'i')
  const activeHits = listed.stdout
    .trim()
    .split('\n')
    .filter((path) => path && !historical(path))
    .filter((path) => {
      const full = join(REPO_ROOT, path)
      return existsSync(full) && statSync(full).isFile()
    })
    .filter(
      (path) =>
        retiredName.test(path) || retiredName.test(readFileSync(join(REPO_ROOT, path), 'utf8')),
    )

  expect(activeHits).toEqual([])
})

describe.each(names)('%s', (name) => {
  const m = manifest(name)

  test('declares a known kind', () => {
    expect(m.kind ?? 'port').toMatch(/^(port|module)$/)
    expect(m.name).toBe(name)
  })

  test('every declared path exists', () => {
    for (const p of paths(m)) {
      expect(existsSync(join(PACKAGES, name, p)), `${name}: ${p} is missing`).toBe(true)
    }
  })

  test('declared paths are files, not directories', () => {
    for (const p of paths(m)) {
      expect(statSync(join(PACKAGES, name, p)).isFile(), `${name}: ${p} is a directory`).toBe(true)
    }
  })

  test('no source file is left out of the manifest', () => {
    const declared = new Set(paths(m))
    const onDisk = readdirSync(join(PACKAGES, name, 'src'), { recursive: true })
      .map((f) => `src/${f}`)
      .filter((f) => /\.tsx?$/.test(f) && statSync(join(PACKAGES, name, f)).isFile())
    for (const f of onDisk) {
      expect(declared.has(f), `${name}: ${f} exists but no manifest entry ships it`).toBe(true)
    }
  })

  test('every declared dep is a real dependency of the package', () => {
    const packagePath = join(PACKAGES, name, 'package.json')
    const known = {
      ...readField(packagePath, 'dependencies'),
      ...readField(packagePath, 'peerDependencies'),
      ...(isJsonObject(m.versions) ? m.versions : {}),
    }
    const deps = [
      ...strings(m.deps),
      ...strings(m.sharedDeps),
      ...objects(m.adapters).flatMap((a) => strings(a.deps)),
      ...objects(m.frameworks).flatMap((f) => strings(f.deps)),
    ].filter((d) => !d.startsWith('@alfredmouelle/'))
    for (const d of deps) {
      expect(d in known, `${name}: ${d} is declared but has no pinned range`).toBe(true)
    }
  })

  test('no declared dep resolves to a floating range', () => {
    const packagePath = join(PACKAGES, name, 'package.json')
    const known = {
      ...readField(packagePath, 'dependencies'),
      ...readField(packagePath, 'peerDependencies'),
      ...(isJsonObject(m.versions) ? m.versions : {}),
    }
    for (const [d, range] of Object.entries(known)) {
      expect(range, `${name}: ${d}`).not.toBe('latest')
    }
  })

  test('a port has adapters, a module does not', () => {
    if ((m.kind ?? 'port') === 'module') {
      expect(m.adapters).toBeUndefined()
      expect(Array.isArray(m.files) ? m.files.length : undefined).toBeGreaterThan(0)
    } else {
      expect(keys(m.adapters)).toContain(m.defaultAdapter)
      if (m.creationRecommendedProvider) {
        expect(keys(m.adapters)).toContain(m.creationRecommendedProvider)
      }
    }
  })
})

test('no manifest still points at the old core/ layout', () => {
  for (const name of names) {
    for (const p of paths(manifest(name))) {
      expect(p.startsWith('src/core'), `${name}: ${p}`).toBe(false)
    }
  }
})
