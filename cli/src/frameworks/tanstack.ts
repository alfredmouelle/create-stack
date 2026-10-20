import { declaresDependency } from '../javascript/package-manifest.ts'
import type { JavaScriptFrameworkModule } from '../javascript/project-parts.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { assembleProject } from './project-assembly.ts'
import { assembleTanstackParts } from './tanstack-assembly.ts'
import { tanstackReference } from './tanstack-parts.ts'

export const tanstackModule: JavaScriptFrameworkModule = {
  id: 'tanstack',
  detect: (applicationDir) =>
    declaresDependency(applicationDir, ['@tanstack/react-start', '@tanstack/react-router']),
  assemble: assembleProject('tanstack'),
  assembleParts: assembleTanstackParts,
  additions: { componentRoot: 'src/routes/__root.tsx' },
  gate: packageScriptGate,
  monorepoOutputs: ['.output/**', '.nitro/**', 'dist/**'],
  packagedAssets: ['apps/tanstack-base'],
  qualityProfileExceptions: [],
  referenceApplication: tanstackReference,
}
