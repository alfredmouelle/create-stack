import { cpSync } from 'node:fs'
import { join } from 'node:path'
import { TEMPLATES } from '#lib/paths.ts'
import type { FrameworkModule, QualityProfileRequest } from './framework-module.ts'

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

export type ProfiledFramework = Pick<
  FrameworkModule,
  'label' | 'qualityProfileExceptions' | 'applyQualityProfile'
>

const PROFILE_FILES = ['.githooks', '.vscode', '.zed']

export function applyQualityProfile(
  framework: ProfiledFramework,
  request: Omit<QualityProfileRequest, 'framework'>,
): void {
  for (const file of PROFILE_FILES) {
    cpSync(join(TEMPLATES, 'quality-profile', file), join(request.projectDir, file), {
      recursive: true,
    })
  }
  framework.applyQualityProfile({ ...request, framework })
}
