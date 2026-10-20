import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { frameworkModules } from '../src/framework-registry.ts'

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('the legacy generation entry and replacement templates are absent', () => {
  for (const path of [
    'lib/build.mjs',
    'lib/build.d.mts',
    'lib/strip.mjs',
    'lib/testing.mjs',
    'lib/trpc.mjs',
    'templates/next/layout.no-trpc.tsx',
    'templates/tanstack/router.no-trpc.tsx',
    'templates/tanstack/devtools.no-trpc.tsx',
  ])
    expect(existsSync(join(cliRoot, path)), path).toBe(false)
})

function sharedFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return sharedFiles(path)
    return /\.[cm]?[jt]s$/.test(entry.name) ? [path] : []
  })
}

function frameworkReferences(files: readonly string[]): string[] {
  return files.flatMap((file) => {
    const source = readFileSync(file, 'utf8')
    const found: string[] = []
    for (const match of source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\r\n])*)\1/g)) {
      const value = match[2]
      if (value === undefined) continue
      for (const { id } of frameworkModules) {
        const pattern = new RegExp(`(?:^|[/@])\\.?${id}(?:$|[./-])`)
        if (pattern.test(value)) found.push(`${file}: ${value}`)
      }
    }
    return found
  })
}

test('shared CLI code keeps framework identifiers inside framework modules and registries', () => {
  const files = [
    join(cliRoot, 'index.mjs'),
    ...['src', 'lib', 'scripts'].flatMap((directory) => sharedFiles(join(cliRoot, directory))),
  ].filter((file) => {
    const path = relative(cliRoot, file)
    return (
      !path.startsWith('src/frameworks/') &&
      path !== 'src/framework-registry.ts' &&
      path !== 'lib/registry.mjs'
    )
  })
  expect(frameworkReferences(files)).toEqual([])
})

test.each(frameworkModules)(
  'the guard rejects $id identifiers introduced in shared code',
  ({ id }) => {
    const root = mkdtempSync(join(tmpdir(), 'create-stack-boundaries-'))
    try {
      const directory = join(root, 'lib')
      mkdirSync(directory)
      const path = join(directory, 'scaffold.mjs')
      for (const value of [
        id,
        `.${id}`,
        `src/${id}/entry.ts`,
        `${id}.config.ts`,
        `@${id}/runtime`,
      ]) {
        writeFileSync(path, `export const framework = '${value}'\n`)
        expect(frameworkReferences(sharedFiles(root))).toEqual([`${path}: ${value}`])
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  },
)
