import { FRAMEWORK_SUPPORT } from '../../../packages/stack-config/src/index.ts'
import type { FrameworkModule } from '../framework-module.ts'
import { declaresDependency } from '../javascript/package-manifest.ts'
import { assembleProject } from '../javascript/project-assembly.ts'
import { applyJavaScriptQualityProfile } from '../javascript/quality-profile.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { tanstackAdditions } from './tanstack-additions.ts'
import { tanstackReference } from './tanstack-parts.ts'

const monorepoOutputs = ['.output/**', '.nitro/**', 'dist/**']

const { label, maturity } = FRAMEWORK_SUPPORT.tanstack

export const tanstackModule: FrameworkModule = {
  id: 'tanstack',
  label,
  maturity,
  detect: (applicationDir) =>
    declaresDependency(applicationDir, ['@tanstack/react-start', '@tanstack/react-router']),
  assemble: (request) =>
    assembleProject(request, {
      reference: tanstackReference,
      additions: tanstackAdditions,
      monorepoOutputs,
    }),
  additions: tanstackAdditions,
  gate: packageScriptGate,
  monorepoOutputs,
  packagedAssets: ['apps/tanstack-base'],
  assetExcludes: ['.tanstack', 'routeTree.gen.ts'],
  qualityProfileExceptions: [],
  applyQualityProfile: applyJavaScriptQualityProfile,
  referenceApplication: tanstackReference,
}
