import { configurePrismaRuntime } from '#lib/database.mjs'
import { makeStandalone } from '#lib/scaffold.mjs'
import type { FrameworkModule, Monorepo, PackageManager } from '../framework-module.ts'
import {
  assembleReference,
  type ReferenceApplication,
  type StackSelection,
} from '../reference-application.ts'

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

export const assembleReferenceParts =
  (reference: ReferenceApplication) =>
  (request: JavaScriptAssemblyRequest): JavaScriptAssemblyResult => {
    const { applicationDir, projectName, monorepo, packageManager } = request
    const parts = assembleReference(reference, request, applicationDir)
    makeStandalone(applicationDir, projectName, packageManager, { monorepo: !!monorepo })
    if (request.database === 'prisma') configurePrismaRuntime(applicationDir)
    return {
      envKeys: parts.flatMap((part) => part.envKeys ?? []),
      requiredEnvKeys: parts.flatMap((part) => part.requiredEnvKeys ?? []),
      envLines: parts.flatMap((part) => part.envLines ?? []),
      nativeBuilds: parts.flatMap((part) => part.nativeBuilds ?? []),
    }
  }
