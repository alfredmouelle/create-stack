// Manifests are the contract between the packages and the vendoring engine. When a
// package is restructured, a stale `files` entry makes the CLI silently vendor an
// incomplete capability, so every path is checked against the real tree.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

// The live sources, never cli/_stack: this checks the contract authors edit.
const PACKAGES = resolve(dirname(fileURLToPath(import.meta.url)), '../../packages')
const REPO_ROOT = resolve(PACKAGES, '..')
const names = readdirSync(PACKAGES).filter((n) => existsSync(join(PACKAGES, n, 'capability.json')))
const manifest = (n) => JSON.parse(readFileSync(join(PACKAGES, n, 'capability.json'), 'utf8'))

const paths = (m) => [
  ...(m.sharedFiles ?? []),
  ...(m.files ?? []),
  ...Object.values(m.adapters ?? {}).flatMap((a) => a.files),
  ...(m.port ? [m.port] : []),
  ...(m.factory ? [m.factory] : []),
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
  const pkg = JSON.parse(readFileSync(join(PACKAGES, 'email-ui/package.json'), 'utf8'))
  const emailUiManifest = manifest('email-ui')
  const bundleScript = readFileSync(join(REPO_ROOT, 'cli/scripts/bundle.mjs'), 'utf8')

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

  const historical = (path) => path === 'cli/CHANGELOG.md' || path.startsWith('docs/adr/')
  const retiredName = new RegExp(['email', 'kit'].join('[- _]'), 'i')
  const activeHits = listed.stdout
    .trim()
    .split('\n')
    .filter((path) => path && !historical(path))
    .filter((path) => existsSync(join(REPO_ROOT, path)))
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
    // Directory entries silently pulled in whatever else lived beside them.
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
    const pkg = JSON.parse(readFileSync(join(PACKAGES, name, 'package.json'), 'utf8'))
    const known = { ...pkg.dependencies, ...pkg.peerDependencies, ...m.versions }
    const deps = [
      ...(m.deps ?? []),
      ...(m.sharedDeps ?? []),
      ...Object.values(m.adapters ?? {}).flatMap((a) => a.deps),
      // per-framework deps are vendored too, so they need a pinned range just the same
      ...Object.values(m.frameworks ?? {}).flatMap((f) => f.deps ?? []),
    ].filter((d) => !d.startsWith('@alfredmouelle/'))
    for (const d of deps) {
      expect(d in known, `${name}: ${d} is declared but has no pinned range`).toBe(true)
    }
  })

  test('no declared dep resolves to a floating range', () => {
    const pkg = JSON.parse(readFileSync(join(PACKAGES, name, 'package.json'), 'utf8'))
    const known = { ...pkg.dependencies, ...pkg.peerDependencies, ...m.versions }
    for (const [d, range] of Object.entries(known)) {
      expect(range, `${name}: ${d}`).not.toBe('latest')
    }
  })

  test('a port has adapters, a module does not', () => {
    if ((m.kind ?? 'port') === 'module') {
      expect(m.adapters).toBeUndefined()
      expect(m.files?.length).toBeGreaterThan(0)
    } else {
      expect(Object.keys(m.adapters)).toContain(m.defaultAdapter)
      if (m.creationRecommendedProvider) {
        expect(Object.keys(m.adapters)).toContain(m.creationRecommendedProvider)
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
