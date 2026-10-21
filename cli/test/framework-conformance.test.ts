import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { FRAMEWORK_SUPPORT, resolveStackConfiguration } from '@alfredmouelle/stack-config'
import { afterAll, describe, expect, test } from 'vitest'
import { frameworkModules } from '../src/framework-registry.ts'
import { createProject, detectFrameworkModule } from '../src/index.ts'
import {
  type ApplicationPart,
  assembleReference,
  type StackSelection,
} from '../src/reference-application.ts'

const roots: string[] = []
const packageManager = {
  name: 'pnpm',
  exec: 'pnpm',
  installArgs: ['install'],
  runArgs: (script: string) => ['run', script],
  devCmd: 'pnpm dev',
}

function directory(): string {
  const root = mkdtempSync(join(tmpdir(), 'create-stack-conformance-'))
  roots.push(root)
  return root
}

function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(root, entry.name)).map((path) => join(entry.name, path))
      : [entry.name],
  )
}

function imports(path: string): string[] {
  const source = readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, '')
  return [
    ...source.matchAll(
      /\b(?:import|export)\s+(?:type\s+)?(?:[\w$*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g,
    ),
    ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].flatMap((match) => (match[1] ? [match[1]] : []))
}

function dependencyMap(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Invalid dependency map')
  return Object.fromEntries(Object.entries(value))
}

function assertSelectedImports(root: string, generated: ReadonlySet<string>): void {
  const manifest: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  expect(manifest).toEqual(
    expect.objectContaining({
      dependencies: expect.any(Object),
      devDependencies: expect.any(Object),
    }),
  )
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('dependencies' in manifest) ||
    !('devDependencies' in manifest)
  )
    throw new Error('Missing application dependencies')
  const declared = new Set([
    ...Object.keys(dependencyMap(manifest.dependencies)),
    ...Object.keys(dependencyMap(manifest.devDependencies)),
  ])
  for (const path of files(root).filter((file) => /\.[cm]?[jt]sx?$/.test(file))) {
    imports(join(root, path)).forEach((specifier) => {
      if (specifier.startsWith('node:')) return
      if (!specifier.startsWith('.') && !specifier.startsWith('~/')) {
        const name = specifier
          .split('/')
          .slice(0, specifier.startsWith('@') ? 2 : 1)
          .join('/')
        expect(declared.has(name), `${path} imports undeclared ${specifier}`).toBe(true)
        return
      }
      const target = specifier.startsWith('~/')
        ? resolve(root, 'src', specifier.slice(2))
        : resolve(root, dirname(path), specifier)
      const normalized = target.replace(/\?[^?]*$/, '')
      const modulePath = normalized.replace(/\.[cm]?js$/, '')
      expect(
        ['', '.ts', '.tsx', '.js', '.d.ts', '/index.ts', '/index.tsx'].some(
          (extension) =>
            generated.has(`${modulePath}${extension}`) ||
            (existsSync(`${modulePath}${extension}`) &&
              statSync(`${modulePath}${extension}`).isFile()),
        ),
        `${path} imports missing ${specifier}`,
      ).toBe(true)
    })
  }
}

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

for (const module of frameworkModules) {
  const reference = module.referenceApplication
  if (!reference) continue
  const support = FRAMEWORK_SUPPORT[module.id].supports
  const combinations: StackSelection[] = []
  for (const database of support.database) {
    for (const auth of support.auth) {
      for (const trpc of support.trpc) {
        for (const mailer of support.mailer) {
          const selection = { database, auth, trpc, mailer }
          if (
            resolveStackConfiguration({ framework: module.id, ...selection }).conflicts.length === 0
          )
            combinations.push(selection)
        }
      }
    }
  }

  describe(`${module.id} reference conformance`, () => {
    test('assembles a minimal application without deleting files in unselected parts', async () => {
      const projectDir = directory()
      const notes = join(projectDir, 'src/server/db/notes.json')
      mkdirSync(join(projectDir, 'src/server/db'), { recursive: true })
      writeFileSync(notes, '{"name":"Customer directory"}\n')

      await module.assemble({
        projectDir,
        database: 'none',
        auth: 'none',
        trpc: false,
        mailer: 'none',
        capabilities: {},
        alias: '~',
        monorepo: false,
        packageManager,
      })

      expect(readFileSync(notes, 'utf8')).toBe('{"name":"Customer directory"}\n')
    })

    test('every reference application file has exactly one owning part', () => {
      const tracked = execFileSync('git', ['ls-files', '-z', '--', '.'], {
        cwd: reference.root,
        encoding: 'utf8',
      })
        .split('\0')
        .filter(Boolean)
        .sort()
      const owned = reference.parts
        .flatMap((part) =>
          part.files.flatMap((file) => (file.referencePath ? [file.referencePath] : [])),
        )
        .sort()
      expect(owned).toEqual(tracked)
    })

    test('the recommended configuration renders the reference application multi-part files', () => {
      const selection = resolveStackConfiguration({ framework: module.id }).configuration
      const destination = directory()
      assembleReference(reference, selection, destination)

      const selected = reference.parts.filter((part) => part.selected(selection))
      const renderedPaths = selected.flatMap((part) =>
        part.files.flatMap((file) =>
          file.referencePath &&
          typeof file.source === 'function' &&
          file.source(selection, selected) !== null
            ? [file.referencePath]
            : [],
        ),
      )
      expect(renderedPaths).toEqual(expect.arrayContaining(['src/env.ts', 'package.json']))
      for (const path of renderedPaths) {
        expect(readFileSync(join(destination, path), 'utf8'), path).toBe(
          readFileSync(join(reference.root, path), 'utf8'),
        )
      }
    })

    test.each(combinations)(
      'generates only selected parts: $database, $auth, trpc=$trpc, $mailer',
      async (selection) => {
        const { projectDir } = await createProject({
          cwd: directory(),
          target: 'storefront',
          name: 'storefront',
          framework: module.id,
          ...selection,
          formatter: 'biome',
          linter: 'biome',
          selectionReasons: {},
          capabilities: {},
          alias: '~',
          monorepo: false,
          packageManager,
          install: false,
          git: false,
        })

        expect(detectFrameworkModule(projectDir)?.id).toBe(module.id)

        const generated = new Set(
          reference.parts
            .filter((part) => part.selected(selection))
            .flatMap((part) =>
              part.files
                .filter((file) => file.source === null)
                .map((file) => join(projectDir, file.path)),
            ),
        )
        assertSelectedImports(projectDir, generated)
        expect(readFileSync(join(projectDir, 'src/env.ts'), 'utf8')).toContain(
          'runtimeEnv: {\n    NODE_ENV: process.env.NODE_ENV,',
        )
        const selected = reference.parts.filter((part) => part.selected(selection))
        const writtenPaths = (parts: readonly ApplicationPart[]) =>
          parts.flatMap((part) =>
            part.files.flatMap((file) =>
              file.source === null ||
              (typeof file.source === 'function' && file.source(selection, selected) === null)
                ? []
                : [file.path],
            ),
          )
        const selectedPaths = new Set(
          selected.flatMap((part) => part.files.map((file) => file.path)),
        )
        for (const path of writtenPaths(selected)) {
          expect(existsSync(join(projectDir, path)), path).toBe(true)
        }
        for (const path of writtenPaths(
          reference.parts.filter((part) => !selected.includes(part)),
        )) {
          if (!selectedPaths.has(path)) expect(existsSync(join(projectDir, path)), path).toBe(false)
        }
      },
    )
  })
}
