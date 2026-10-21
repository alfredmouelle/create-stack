import type { FrameworkModule } from './framework-module.ts'
import { nextModule } from './frameworks/next.ts'
import { tanstackModule } from './frameworks/tanstack.ts'

export const frameworkModules: readonly FrameworkModule[] = [tanstackModule, nextModule]

export function frameworkAssetExcludes(module: FrameworkModule): string[] {
  return [
    ...module.assetExcludes,
    ...module.monorepoOutputs
      .filter((output) => !output.startsWith('!'))
      .map((output) => output.split('/')[0] ?? output),
  ]
}

export function getFrameworkModule(id: string): FrameworkModule {
  const module = frameworkModules.find((candidate) => candidate.id === id)
  if (!module) throw new Error(`Unknown framework: ${id}`)
  return module
}

export const detectFrameworkModule = (applicationDir: string): FrameworkModule | undefined =>
  frameworkModules.find((module) => module.detect(applicationDir))

export function requireFrameworkModule(applicationDir: string): FrameworkModule {
  const module = detectFrameworkModule(applicationDir)
  if (module) return module
  const frameworks = frameworkModules.map(({ label }) => label).join(', ')
  throw new Error(`Could not detect a registered framework (${frameworks}) in ${applicationDir}`)
}
