import {
  accessSync,
  constants,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, test } from 'vitest'
import type { FrameworkModule, Monorepo } from '../src/framework-module.ts'

process.env.CREATE_STACK_STACK_ROOT = resolve(import.meta.dirname, '..', '..')

const { createProject } = await import('../src/engine.ts')
const { applyQualityProfile, QUALITY_PROFILE_OPTIONS } = await import('../src/quality-profile.ts')
const { frameworkModules } = await import('../src/framework-registry.ts')

const roots: string[] = []

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

const temporaryRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'create-stack-quality-'))
  roots.push(root)
  return root
}

const readJson = (path: string): Record<string, Record<string, unknown>> =>
  JSON.parse(readFileSync(path, 'utf8'))

const packageManager = {
  name: 'pnpm',
  exec: 'pnpm',
  installArgs: ['install', '--no-frozen-lockfile'],
  runArgs: (script: string) => ['run', script],
  devCmd: 'pnpm dev',
}

async function generate(module: FrameworkModule, monorepo: Monorepo): Promise<string> {
  const cwd = temporaryRoot()
  await createProject({
    cwd,
    target: 'storefront',
    name: 'storefront',
    framework: module.id,
    database: 'drizzle',
    auth: 'better-auth',
    trpc: true,
    mailer: 'resend',
    selectionReasons: {},
    capabilities: {},
    monorepo,
    alias: '~',
    packageManager,
    install: false,
    git: false,
  })
  return join(cwd, 'storefront')
}

const PROFILE_OPTIONS: readonly string[] = QUALITY_PROFILE_OPTIONS

const enabledProfile = Object.fromEntries(QUALITY_PROFILE_OPTIONS.map((option) => [option, true]))

const shapes: readonly Monorepo[] = [false, 'turborepo', 'nx']

describe.each(frameworkModules.map((module) => [module.id, module] as const))(
  '%s quality profile',
  (_id, module) => {
    const excepted = new Set<string>(module.qualityProfileExceptions.map(({ option }) => option))

    test.each(shapes)(
      'applies every profile option, hook, and editor setting (monorepo: %s)',
      async (monorepo) => {
        const projectDir = await generate(module, monorepo)
        const applicationDir = monorepo ? join(projectDir, 'apps', 'web') : projectDir

        const { compilerOptions } = readJson(join(applicationDir, 'tsconfig.json'))
        for (const option of PROFILE_OPTIONS.filter((name) => !excepted.has(name))) {
          expect(compilerOptions?.[option], option).toBe(true)
        }
        expect(compilerOptions?.jsx, 'framework options are kept').toBe('react-jsx')

        for (const hook of ['pre-commit', 'pre-push']) {
          expect(() =>
            accessSync(join(projectDir, '.githooks', hook), constants.X_OK),
          ).not.toThrow()
        }
        expect(readJson(join(projectDir, 'package.json')).scripts?.prepare).toContain(
          'git config core.hooksPath .githooks',
        )
        expect(existsSync(join(projectDir, '.vscode', 'settings.json'))).toBe(true)
        expect(existsSync(join(projectDir, '.zed', 'settings.json'))).toBe(true)

        if (monorepo) {
          expect(existsSync(join(applicationDir, '.githooks')), 'no application hooks').toBe(false)
          expect(readJson(join(applicationDir, 'package.json')).scripts?.prepare).toBeUndefined()
        }
      },
    )

    test('declares every quality profile exception with its reason', () => {
      for (const { option, reason } of module.qualityProfileExceptions) {
        expect(PROFILE_OPTIONS).toContain(option)
        expect(reason.trim()).not.toBe('')
      }
    })
  },
)

describe('applyQualityProfile', () => {
  function application(compilerOptions: Record<string, unknown>) {
    const projectDir = temporaryRoot()
    writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'storefront' }))
    writeFileSync(join(projectDir, 'tsconfig.json'), JSON.stringify({ compilerOptions }))
    return projectDir
  }

  const module = (exceptions: FrameworkModule['qualityProfileExceptions'] = []) => ({
    label: 'Storefront Framework',
    qualityProfileExceptions: exceptions,
  })

  test('adds the profile options a framework leaves out and keeps its own options', () => {
    const projectDir = application({ jsx: 'react-jsx', strict: true })

    applyQualityProfile(module(), { projectDir, applicationDir: projectDir })

    expect(readJson(join(projectDir, 'tsconfig.json')).compilerOptions).toEqual({
      jsx: 'react-jsx',
      ...enabledProfile,
    })
  })

  test('rejects a framework that relaxes a profile option without a declared exception', () => {
    const projectDir = application({ exactOptionalPropertyTypes: false })

    expect(() => applyQualityProfile(module(), { projectDir, applicationDir: projectDir })).toThrow(
      'Storefront Framework relaxes the quality profile option exactOptionalPropertyTypes without a declared exception',
    )
  })

  test('keeps a relaxed option the framework declares as an exception', () => {
    const projectDir = application({ verbatimModuleSyntax: false })

    applyQualityProfile(
      module([
        { option: 'verbatimModuleSyntax', reason: 'The framework compiler emits CommonJS.' },
      ]),
      { projectDir, applicationDir: projectDir },
    )

    expect(readJson(join(projectDir, 'tsconfig.json')).compilerOptions).toEqual({
      ...enabledProfile,
      verbatimModuleSyntax: false,
    })
  })
})
