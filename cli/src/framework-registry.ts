import type { FrameworkModule } from './framework-module.ts'
import { nextModule } from './frameworks/next.ts'
import { tanstackModule } from './frameworks/tanstack.ts'
import type {
  JavaScriptAssemblyRequest,
  JavaScriptAssemblyResult,
} from './javascript/project-parts.ts'

const javascriptModules = [tanstackModule, nextModule]
export const frameworkModules: readonly FrameworkModule[] = javascriptModules

export function assembleFrameworkParts(
  id: string,
  request: JavaScriptAssemblyRequest,
): JavaScriptAssemblyResult {
  const module = javascriptModules.find((candidate) => candidate.id === id)
  if (!module) throw new Error(`Unknown framework: ${id}`)
  return module.assembleParts(request)
}

export function getFrameworkModule(id: string): FrameworkModule {
  const module = frameworkModules.find((candidate) => candidate.id === id)
  if (!module) throw new Error(`Unknown framework: ${id}`)
  return module
}

export const detectFrameworkModule = (applicationDir: string): FrameworkModule | undefined =>
  frameworkModules.find((module) => module.detect(applicationDir))
