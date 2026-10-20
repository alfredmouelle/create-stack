import { declaresDependency } from '../javascript/package-manifest.ts'
import {
  assembleReferenceParts,
  type JavaScriptFrameworkModule,
} from '../javascript/project-parts.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { nextAdditions } from './next-additions.ts'
import { nextReference } from './next-parts.ts'
import { assembleProject } from './project-assembly.ts'

export const nextModule: JavaScriptFrameworkModule = {
  id: 'next',
  detect: (applicationDir) => declaresDependency(applicationDir, ['next']),
  assemble: assembleProject('next'),
  assembleParts: assembleReferenceParts(nextReference),
  additions: nextAdditions,
  gate: packageScriptGate,
  monorepoOutputs: ['.next/**', '!.next/cache/**'],
  packagedAssets: ['apps/next-base'],
  qualityProfileExceptions: [],
  referenceApplication: nextReference,
}
