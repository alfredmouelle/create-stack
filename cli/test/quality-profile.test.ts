import { spawnSync } from 'node:child_process'
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
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
import { readField, readJson } from './json.ts'
import { linkDependencies } from './quality-tools.ts'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')

process.env.CREATE_STACK_STACK_ROOT = REPO_ROOT

const { createProject } = await import('../src/engine.ts')
const { applyQualityProfile, QUALITY_PROFILE_OPTIONS } = await import('../src/quality-profile.ts')
const { applyJavaScriptQualityProfile } = await import('../src/javascript/quality-profile.ts')
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
    applyQualityProfile: applyJavaScriptQualityProfile,
  })

  const target = (projectDir: string) =>
    ({
      projectDir,
      applicationDir: projectDir,
      formatter: 'biome',
      linter: 'biome',
      alias: '~',
    }) as const

  test('adds the profile options a framework leaves out and keeps its own options', () => {
    const projectDir = application({ jsx: 'react-jsx', strict: true })

    applyQualityProfile(framework(), target(projectDir))

    expect(readField(join(projectDir, 'tsconfig.json'), 'compilerOptions')).toEqual({
      jsx: 'react-jsx',
      ...enabledProfile,
    })
  })

  test.each([
    { monorepo: false, stylesheet: 'src/styles/storefront.css' },
    { monorepo: 'turborepo', stylesheet: 'apps/web/src/styles/storefront.css' },
    { monorepo: 'nx', stylesheet: 'apps/web/src/styles/storefront.css' },
  ])(
    'configures a framework stylesheet without components.json (monorepo: $monorepo)',
    ({ monorepo, stylesheet }) => {
      const projectDir = application({ jsx: 'react-jsx', jsxImportSource: 'remix/component' })
      const applicationDir = monorepo ? join(projectDir, 'apps/web') : projectDir
      if (monorepo) {
        mkdirSync(applicationDir, { recursive: true })
        writeFileSync(join(applicationDir, 'package.json'), JSON.stringify({ name: 'storefront' }))
        writeFileSync(
          join(applicationDir, 'tsconfig.json'),
          JSON.stringify({ compilerOptions: { jsxImportSource: 'remix/component' } }),
        )
      }

      applyQualityProfile(
        {
          ...framework(),
          applyQualityProfile: (request) =>
            applyJavaScriptQualityProfile({
              ...request,
              tailwindStylesheet: 'src/styles/storefront.css',
            }),
        },
        { ...target(projectDir), applicationDir, formatter: 'prettier' },
      )

      expect(readJson(join(projectDir, '.prettierrc.json'))).toHaveProperty(
        'tailwindStylesheet',
        stylesheet,
      )
      expect(readField(join(applicationDir, 'tsconfig.json'), 'compilerOptions')).toHaveProperty(
        'jsxImportSource',
        'remix/component',
      )
      expect(existsSync(join(applicationDir, 'components.json'))).toBe(false)

      mkdirSync(join(applicationDir, 'src/styles'), { recursive: true })
      writeFileSync(
        join(applicationDir, 'src/styles/storefront.css'),
        '@import "tailwindcss";\n@theme { --color-storefront: #134e4a; }\n',
      )
      const page = join(applicationDir, 'src/checkout.html')
      writeFileSync(page, '<main class="p-4 bg-storefront flex"></main>\n')
      linkDependencies(join(projectDir, 'node_modules'), join(REPO_ROOT, 'node_modules'))
      linkDependencies(
        join(applicationDir, 'node_modules'),
        join(REPO_ROOT, 'apps/next-base/node_modules'),
      )

      const formatted = spawnSync(
        join(REPO_ROOT, 'node_modules/.bin/prettier'),
        ['--write', page],
        { cwd: projectDir, encoding: 'utf8', timeout: 30_000 },
      )

      expect(formatted.status, formatted.stdout + formatted.stderr).toBe(0)
      expect(readFileSync(page, 'utf8')).toBe('<main class="flex bg-storefront p-4"></main>\n')
    },
  )

  test.each([
    {
      name: 'discovers the stylesheet from components.json for existing callers',
      options: {},
      stylesheet: 'src/styles/catalog.css',
    },
    {
      name: 'prefers the framework stylesheet over components.json',
      options: { tailwindStylesheet: 'src/styles/storefront.css' },
      stylesheet: 'src/styles/storefront.css',
    },
  ])('$name', ({ options, stylesheet }) => {
    const projectDir = application({ jsx: 'react-jsx' })
    writeFileSync(
      join(projectDir, 'components.json'),
      JSON.stringify({ tailwind: { css: 'src/styles/catalog.css' } }),
    )

    applyQualityProfile(
      {
        ...framework(),
        applyQualityProfile: (request) => applyJavaScriptQualityProfile({ ...request, ...options }),
      },
      { ...target(projectDir), formatter: 'prettier' },
    )

    expect(readJson(join(projectDir, '.prettierrc.json'))).toHaveProperty(
      'tailwindStylesheet',
      stylesheet,
    )
  })

  test('rejects a framework that relaxes a profile option without a declared exception', () => {
    const projectDir = application({ exactOptionalPropertyTypes: false })

    expect(() => applyQualityProfile(framework(), target(projectDir))).toThrow(
      'Storefront Framework relaxes the quality profile option exactOptionalPropertyTypes without a declared exception',
    )
  })

  test('rejects a framework that relaxes strict through one of its member options', () => {
    const projectDir = application({ strict: true, strictNullChecks: false })

    expect(() => applyQualityProfile(framework(), target(projectDir))).toThrow(
      'Storefront Framework relaxes the quality profile option strict through strictNullChecks without a declared exception',
    )
  })

  test('keeps a relaxed option the framework declares as an exception', () => {
    const projectDir = application({ verbatimModuleSyntax: false })

    applyQualityProfile(
      framework([
        { option: 'verbatimModuleSyntax', reason: 'The framework compiler emits CommonJS.' },
      ]),
      target(projectDir),
    )

    expect(readField(join(projectDir, 'tsconfig.json'), 'compilerOptions')).toEqual({
      ...enabledProfile,
      verbatimModuleSyntax: false,
    })
  })
})
