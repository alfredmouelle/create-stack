import { configurePrismaRuntime } from '#lib/database.mjs'
import { makeStandalone } from '#lib/scaffold.mjs'
import type {
  JavaScriptAssemblyRequest,
  JavaScriptAssemblyResult,
} from '../javascript/project-parts.ts'
import { assembleReference } from '../reference-application.ts'
import { tanstackReference } from './tanstack-parts.ts'

export function assembleTanstackParts(
  request: JavaScriptAssemblyRequest,
): JavaScriptAssemblyResult {
  const { applicationDir, projectName, monorepo, packageManager } = request
  const parts = assembleReference(tanstackReference, request, applicationDir)
  makeStandalone(applicationDir, projectName, 'tanstack', packageManager, { monorepo: !!monorepo })
  if (request.database === 'prisma') configurePrismaRuntime(applicationDir)
  return {
    envKeys: parts.flatMap((part) => part.envKeys ?? []),
    requiredEnvKeys: parts.flatMap((part) => part.requiredEnvKeys ?? []),
    envLines: parts.flatMap((part) => part.envLines ?? []),
    nativeBuilds: parts.flatMap((part) => part.nativeBuilds ?? []),
  }
}
