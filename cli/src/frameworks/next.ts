import type { FrameworkModule } from '../framework-module.ts'
import { declaresDependency } from '../javascript/package-manifest.ts'
import { assembleProject } from '../javascript/project-assembly.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { nextAdditions } from './next-additions.ts'
import { nextReference } from './next-parts.ts'

export const nextModule: FrameworkModule = {
  id: 'next',
  detect: (applicationDir) => declaresDependency(applicationDir, ['next']),
  assemble: assembleProject('next', nextReference),
  additions: nextAdditions,
  gate: packageScriptGate,
  monorepoOutputs: ['.next/**', '!.next/cache/**'],
  packagedAssets: ['apps/next-base'],
  assetExcludes: ['next-env.d.ts'],
  qualityProfileExceptions: [],
  referenceApplication: nextReference,
}
