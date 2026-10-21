import { FRAMEWORK_SUPPORT } from '@alfredmouelle/stack-config'
import type { FrameworkModule } from '../framework-module.ts'
import { declaresDependency } from '../javascript/package-manifest.ts'
import { assembleProject } from '../javascript/project-assembly.ts'
import { applyJavaScriptQualityProfile } from '../javascript/quality-profile.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { nextAdditions } from './next-additions.ts'
import { nextReference } from './next-parts.ts'

const { label, maturity, monorepoOutputs } = FRAMEWORK_SUPPORT.next

export const nextModule: FrameworkModule = {
  id: 'next',
  label,
  maturity,
  detect: (applicationDir) => declaresDependency(applicationDir, ['next']),
  assemble: (request) =>
    assembleProject(request, {
      reference: nextReference,
      additions: nextAdditions,
      monorepoOutputs,
    }),
  additions: nextAdditions,
  gate: packageScriptGate,
  monorepoOutputs,
  packagedAssets: ['apps/next-base'],
  assetExcludes: ['next-env.d.ts'],
  qualityProfileExceptions: [],
  applyQualityProfile: applyJavaScriptQualityProfile,
  referenceApplication: nextReference,
}
