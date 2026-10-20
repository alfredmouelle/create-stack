import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { TEMPLATES } from '#lib/paths.mjs'
import type { FrameworkModule } from './framework-module.ts'

export const QUALITY_PROFILE_OPTIONS = [
  'strict',
  'noUncheckedIndexedAccess',
  'exactOptionalPropertyTypes',
  'noImplicitOverride',
  'noUnusedLocals',
  'noUnusedParameters',
  'noFallthroughCasesInSwitch',
  'verbatimModuleSyntax',
  'isolatedModules',
  'noUncheckedSideEffectImports',
] as const

export type QualityProfileOption = (typeof QUALITY_PROFILE_OPTIONS)[number]

export type QualityProfileTarget = {
  readonly projectDir: string
  readonly applicationDir: string
}

const HOOK_PREPARATION =
  '[ "$(git rev-parse --show-toplevel 2>/dev/null)" = "$(pwd -P)" ] && git config core.hooksPath .githooks || true'

const PROFILE_FILES = ['.githooks', '.vscode', '.zed']

type JsonObject = Record<string, unknown>

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function readJsonObject(path: string): JsonObject {
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!isJsonObject(value)) throw new Error(`Expected a JSON object in ${path}`)
  return value
}

const writeJsonObject = (path: string, value: JsonObject): void =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)

function applyCompilerOptions(
  module: Pick<FrameworkModule, 'label' | 'qualityProfileExceptions'>,
  applicationDir: string,
): void {
  const path = join(applicationDir, 'tsconfig.json')
  const tsconfig = readJsonObject(path)
  const compilerOptions = isJsonObject(tsconfig.compilerOptions) ? tsconfig.compilerOptions : {}
  const excepted = new Set(module.qualityProfileExceptions.map(({ option }) => option))
  let changed = false
  for (const option of QUALITY_PROFILE_OPTIONS) {
    if (excepted.has(option) || compilerOptions[option] === true) continue
    if (compilerOptions[option] !== undefined) {
      throw new Error(
        `${module.label} relaxes the quality profile option ${option} without a declared exception`,
      )
    }
    compilerOptions[option] = true
    changed = true
  }
  if (changed) writeJsonObject(path, { ...tsconfig, compilerOptions })
}

function prepareHooks(projectDir: string): void {
  const path = join(projectDir, 'package.json')
  const manifest = readJsonObject(path)
  const scripts = isJsonObject(manifest.scripts) ? manifest.scripts : {}
  writeJsonObject(path, { ...manifest, scripts: { ...scripts, prepare: HOOK_PREPARATION } })
}

export function applyQualityProfile(
  module: Pick<FrameworkModule, 'label' | 'qualityProfileExceptions'>,
  { projectDir, applicationDir }: QualityProfileTarget,
): void {
  applyCompilerOptions(module, applicationDir)
  for (const file of PROFILE_FILES) {
    cpSync(join(TEMPLATES, 'quality-profile', file), join(projectDir, file), { recursive: true })
  }
  prepareHooks(projectDir)
}
