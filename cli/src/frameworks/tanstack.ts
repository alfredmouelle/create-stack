import type { FrameworkModule } from '../framework-module.ts'
import { declaresDependency } from '../javascript/package-manifest.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { assembleWithLegacyBuild } from './legacy-assembly.ts'

export const tanstackModule: FrameworkModule = {
  id: 'tanstack',
  label: 'TanStack Start',
  maturity: 'stable',
  detect: (applicationDir) =>
    declaresDependency(applicationDir, ['@tanstack/react-start', '@tanstack/react-router']),
  assemble: assembleWithLegacyBuild('tanstack'),
  additions: { componentRoot: 'src/routes/__root.tsx' },
  gate: packageScriptGate,
  monorepoOutputs: ['.output/**', '.nitro/**', 'dist/**'],
  packagedAssets: ['apps/tanstack-base'],
  qualityProfileExceptions: [],
}
