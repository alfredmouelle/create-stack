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
import type { QualityProfileException } from '../src/quality-profile.ts'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')

process.env.CREATE_STACK_STACK_ROOT = REPO_ROOT

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

type JsonObject = Record<string, unknown>

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function readJson(path: string): JsonObject {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!isJsonObject(value)) throw new Error(`Expected a JSON object in ${path}`)
  return value
}

function readField(path: string, field: string): JsonObject {
  const value = readJson(path)[field]
  return isJsonObject(value) ? value : {}
}

const packageManager = {
  name: 'pnpm',
  exec: 'pnpm',
  installArgs: ['install', '--no-frozen-lockfile'],
  runArgs: (script: string) => ['run', script],
  devCmd: 'pnpm dev',
}

async function generate(frameworkModule: FrameworkModule, monorepo: Monorepo): Promise<string> {
  const cwd = temporaryRoot()
  await createProject({
    cwd,
    target: 'storefront',
    name: 'storefront',
    framework: frameworkModule.id,
    database: 'drizzle',
    auth: 'better-auth',
    trpc: true,
    mailer: 'resend',
    formatter: 'biome',
    linter: 'biome',
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

describe.each(
  frameworkModules.map((frameworkModule) => [frameworkModule.id, frameworkModule] as const),
)('%s quality profile', (_id, frameworkModule) => {
  const excepted = new Set<string>(
    frameworkModule.qualityProfileExceptions.map(({ option }) => option),
  )

  test('ships reference applications that enable the full profile', () => {
    for (const asset of frameworkModule.packagedAssets) {
      const compilerOptions = readField(join(REPO_ROOT, asset, 'tsconfig.json'), 'compilerOptions')
      for (const option of PROFILE_OPTIONS.filter((name) => !excepted.has(name))) {
        expect(compilerOptions[option], `${asset} ${option}`).toBe(true)
      }
    }
  })

  test.each(shapes)(
    'applies every profile option, hook, and editor setting (monorepo: %s)',
    async (monorepo) => {
      const projectDir = await generate(frameworkModule, monorepo)
      const applicationDir = monorepo ? join(projectDir, 'apps', 'web') : projectDir

      const compilerOptions = readField(join(applicationDir, 'tsconfig.json'), 'compilerOptions')
      for (const option of PROFILE_OPTIONS.filter((name) => !excepted.has(name))) {
        expect(compilerOptions[option], option).toBe(true)
      }
      expect(compilerOptions.jsx, 'framework options are kept').toBe('react-jsx')

      for (const hook of ['pre-commit', 'pre-push']) {
        expect(() => accessSync(join(projectDir, '.githooks', hook), constants.X_OK)).not.toThrow()
      }
      expect(readField(join(projectDir, 'package.json'), 'scripts').prepare).toContain(
        'git config core.hooksPath .githooks',
      )
      expect(existsSync(join(projectDir, '.vscode', 'settings.json'))).toBe(true)
      expect(existsSync(join(projectDir, '.zed', 'settings.json'))).toBe(true)

      if (monorepo) {
        expect(existsSync(join(applicationDir, '.githooks')), 'no application hooks').toBe(false)
        expect(readField(join(applicationDir, 'package.json'), 'scripts').prepare).toBeUndefined()
      }
    },
  )

  test('declares every quality profile exception with its reason', () => {
    for (const { option, reason } of frameworkModule.qualityProfileExceptions) {
      expect(PROFILE_OPTIONS).toContain(option)
      expect(reason.trim()).not.toBe('')
    }
  })
})

describe('applyQualityProfile', () => {
  function application(compilerOptions: Record<string, unknown>) {
    const projectDir = temporaryRoot()
    writeFileSync(join(projectDir, 'package.json'), JSON.stringify({ name: 'storefront' }))
    writeFileSync(join(projectDir, 'tsconfig.json'), JSON.stringify({ compilerOptions }))
    return projectDir
  }

  const framework = (exceptions: readonly QualityProfileException[] = []) => ({
    label: 'Storefront Framework',
    qualityProfileExceptions: exceptions,
  })

  test('adds the profile options a framework leaves out and keeps its own options', () => {
    const projectDir = application({ jsx: 'react-jsx', strict: true })

    applyQualityProfile(framework(), { projectDir, applicationDir: projectDir })

    expect(readField(join(projectDir, 'tsconfig.json'), 'compilerOptions')).toEqual({
      jsx: 'react-jsx',
      ...enabledProfile,
    })
  })

  test('rejects a framework that relaxes a profile option without a declared exception', () => {
    const projectDir = application({ exactOptionalPropertyTypes: false })

    expect(() =>
      applyQualityProfile(framework(), { projectDir, applicationDir: projectDir }),
    ).toThrow(
      'Storefront Framework relaxes the quality profile option exactOptionalPropertyTypes without a declared exception',
    )
  })

  test('rejects a framework that relaxes strict through one of its member options', () => {
    const projectDir = application({ strict: true, strictNullChecks: false })

    expect(() =>
      applyQualityProfile(framework(), { projectDir, applicationDir: projectDir }),
    ).toThrow(
      'Storefront Framework relaxes the quality profile option strict through strictNullChecks without a declared exception',
    )
  })

  test('keeps a relaxed option the framework declares as an exception', () => {
    const projectDir = application({ verbatimModuleSyntax: false })

    applyQualityProfile(
      framework([
        { option: 'verbatimModuleSyntax', reason: 'The framework compiler emits CommonJS.' },
      ]),
      { projectDir, applicationDir: projectDir },
    )

    expect(readField(join(projectDir, 'tsconfig.json'), 'compilerOptions')).toEqual({
      ...enabledProfile,
      verbatimModuleSyntax: false,
    })
  })
})
