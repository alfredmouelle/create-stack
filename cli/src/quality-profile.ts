import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { TEMPLATES } from '#lib/paths.mjs'

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

export type QualityProfileException = {
  readonly option: QualityProfileOption
  readonly reason: string
}

export type ProfiledFramework = {
  readonly label: string
  readonly qualityProfileExceptions: readonly QualityProfileException[]
}

const STRICT_MEMBER_OPTIONS = [
  'alwaysStrict',
  'noImplicitAny',
  'noImplicitThis',
  'strictBindCallApply',
  'strictBuiltinIteratorReturn',
  'strictFunctionTypes',
  'strictNullChecks',
  'strictPropertyInitialization',
  'useUnknownInCatchVariables',
] as const

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

function assertStrictMembers(framework: ProfiledFramework, compilerOptions: JsonObject): void {
  const relaxed = STRICT_MEMBER_OPTIONS.find((option) => compilerOptions[option] === false)
  if (relaxed === undefined) return
  throw new Error(
    `${framework.label} relaxes the quality profile option strict through ${relaxed} without a declared exception`,
  )
}

function applyCompilerOptions(framework: ProfiledFramework, applicationDir: string): void {
  const path = join(applicationDir, 'tsconfig.json')
  const tsconfig = readJsonObject(path)
  const compilerOptions = isJsonObject(tsconfig.compilerOptions) ? tsconfig.compilerOptions : {}
  const excepted = new Set(framework.qualityProfileExceptions.map(({ option }) => option))
  if (!excepted.has('strict')) assertStrictMembers(framework, compilerOptions)
  let changed = false
  for (const option of QUALITY_PROFILE_OPTIONS) {
    if (excepted.has(option) || compilerOptions[option] === true) continue
    if (compilerOptions[option] !== undefined) {
      throw new Error(
        `${framework.label} relaxes the quality profile option ${option} without a declared exception`,
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
  framework: ProfiledFramework,
  { projectDir, applicationDir }: QualityProfileTarget,
): void {
  applyCompilerOptions(framework, applicationDir)
  for (const file of PROFILE_FILES) {
    cpSync(join(TEMPLATES, 'quality-profile', file), join(projectDir, file), { recursive: true })
  }
  prepareHooks(projectDir)
}
