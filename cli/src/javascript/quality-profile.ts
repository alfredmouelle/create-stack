import { join } from 'node:path'
import type { QualityProfileRequest } from '../framework-module.ts'
import { QUALITY_PROFILE_OPTIONS } from '../quality-profile.ts'
import { isJsonObject, type JsonObject, readJsonObject, writeJsonObject } from './json.ts'
import { applyQualityTools } from './quality-tools.ts'

type ProfiledFramework = QualityProfileRequest['framework']

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

const HOOK_PREPARATION =
  '[ "$(git rev-parse --show-toplevel 2>/dev/null)" = "$(pwd -P)" ] && git config core.hooksPath .githooks || true'

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

export function applyJavaScriptQualityProfile({
  framework,
  projectDir,
  applicationDir,
  formatter,
  linter,
  alias,
}: QualityProfileRequest): void {
  applyCompilerOptions(framework, applicationDir)
  prepareHooks(projectDir)
  applyQualityTools({ projectDir, applicationDir }, { formatter, linter, alias })
}
