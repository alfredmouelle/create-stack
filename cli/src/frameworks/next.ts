import type { FrameworkModule } from '../framework-module.ts'
import { declaresDependency } from '../javascript/package-manifest.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { assembleWithLegacyBuild } from './legacy-assembly.ts'

export const nextModule: FrameworkModule = {
  id: 'next',
  label: 'Next.js',
  maturity: 'stable',
  detect: (applicationDir) => declaresDependency(applicationDir, ['next']),
  assemble: assembleWithLegacyBuild('next'),
  additions: { componentRoot: 'src/app/layout.tsx' },
  gate: packageScriptGate,
  monorepoOutputs: ['.next/**', '!.next/cache/**'],
  packagedAssets: ['apps/next-base'],
  qualityProfileExceptions: [],
}
