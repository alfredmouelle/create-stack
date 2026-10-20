import { declaresDependency } from '../javascript/package-manifest.ts'
import {
  assembleReferenceParts,
  type JavaScriptFrameworkModule,
} from '../javascript/project-parts.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { assembleProject } from './project-assembly.ts'
import { tanstackAdditions } from './tanstack-additions.ts'
import { tanstackReference } from './tanstack-parts.ts'

export const tanstackModule: JavaScriptFrameworkModule = {
  id: 'tanstack',
  detect: (applicationDir) =>
    declaresDependency(applicationDir, ['@tanstack/react-start', '@tanstack/react-router']),
  assemble: assembleProject('tanstack'),
  assembleParts: assembleReferenceParts(tanstackReference),
  additions: tanstackAdditions,
  gate: packageScriptGate,
  monorepoOutputs: ['.output/**', '.nitro/**', 'dist/**'],
  packagedAssets: ['apps/tanstack-base'],
  qualityProfileExceptions: [],
  referenceApplication: tanstackReference,
}
