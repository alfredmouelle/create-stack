import type { FrameworkModule, Monorepo, PackageManager } from '../framework-module.ts'
import type { StackSelection } from '../reference-application.ts'

export type JavaScriptAssemblyRequest = StackSelection & {
  readonly applicationDir: string
  readonly projectName: string
  readonly monorepo: Monorepo
  readonly packageManager: PackageManager
}

export type JavaScriptAssemblyResult = {
  readonly envKeys: readonly string[]
  readonly requiredEnvKeys: readonly string[]
  readonly envLines: readonly string[]
  readonly nativeBuilds: readonly string[]
}

export type JavaScriptFrameworkModule = FrameworkModule & {
  readonly assembleParts: (request: JavaScriptAssemblyRequest) => JavaScriptAssemblyResult
}
