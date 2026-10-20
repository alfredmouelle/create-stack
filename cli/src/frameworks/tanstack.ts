import type { FrameworkModule } from '../framework-module.ts'
import { declaresDependency } from '../javascript/package-manifest.ts'
import { assembleProject } from '../javascript/project-assembly.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { tanstackAdditions } from './tanstack-additions.ts'
import { tanstackReference } from './tanstack-parts.ts'

export const tanstackModule: FrameworkModule = {
  id: 'tanstack',
  detect: (applicationDir) =>
    declaresDependency(applicationDir, ['@tanstack/react-start', '@tanstack/react-router']),
  assemble: assembleProject('tanstack', tanstackReference),
  additions: tanstackAdditions,
  gate: packageScriptGate,
  monorepoOutputs: ['.output/**', '.nitro/**', 'dist/**'],
  packagedAssets: ['apps/tanstack-base'],
  assetExcludes: ['.tanstack', 'routeTree.gen.ts'],
  qualityProfileExceptions: [],
  referenceApplication: tanstackReference,
}
