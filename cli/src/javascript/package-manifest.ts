import { join } from 'node:path'
import { isJsonObject, type JsonObject, readJsonObject } from './json.ts'

function readManifest(applicationDir: string): JsonObject | undefined {
  try {
    return readJsonObject(join(applicationDir, 'package.json'))
  } catch {
    return undefined
  }
}

export function declaresDependency(applicationDir: string, names: readonly string[]): boolean {
  const manifest = readManifest(applicationDir)
  if (!manifest) return false
  return [manifest.dependencies, manifest.devDependencies].some(
    (dependencies) =>
      isJsonObject(dependencies) && names.some((name) => Boolean(dependencies[name])),
  )
}
