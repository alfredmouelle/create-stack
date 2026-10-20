import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function readManifest(applicationDir: string): Record<string, unknown> | undefined {
  try {
    const manifest: unknown = JSON.parse(readFileSync(join(applicationDir, 'package.json'), 'utf8'))
    return isRecord(manifest) ? manifest : undefined
  } catch {
    return undefined
  }
}

export function declaresDependency(applicationDir: string, names: readonly string[]): boolean {
  const manifest = readManifest(applicationDir)
  if (!manifest) return false
  return [manifest.dependencies, manifest.devDependencies].some(
    (dependencies) => isRecord(dependencies) && names.some((name) => Boolean(dependencies[name])),
  )
}
