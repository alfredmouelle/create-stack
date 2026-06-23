// `create-stack add` — vendor a capability into an existing project, merging dep/env
// deltas incrementally (same engine as the scaffold) so nothing existing is lost.

import { vendorCapability } from './capabilities.mjs'
import { appendEnv } from './env.mjs'
import { join, pkgAddDeps, readJSON, writeJSON } from './util.mjs'

/** Infer the base framework from installed deps (next vs TanStack Start). */
export function detectFramework(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  if (deps['@tanstack/react-start'] || deps['@tanstack/react-router']) return 'tanstack'
  if (deps.next) return 'next'
  throw new Error('Could not detect framework — no `next` or `@tanstack/react-start` dependency')
}

/** All capabilities vendor to src/server/<cap>; this is where a collision would be. */
export const capabilityDir = (cap) => `src/server/${cap}`

/**
 * Vendor `cap`/`adapter` into the project at projectDir.
 * @returns {{ framework: 'next'|'tanstack', projectName: string, addDeps: Record<string,string>, envKeys: string[] }}
 */
export function addCapability({ projectDir, cap, adapter }) {
  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  const framework = detectFramework(pkg)
  const projectName = pkg.name ?? 'app'

  const { addDeps, envKeys, requiredEnvKeys } = vendorCapability({
    projectDir,
    framework,
    projectName,
    cap,
    adapter,
  })

  pkgAddDeps(pkg, addDeps)
  writeJSON(pkgPath, pkg)
  appendEnv(projectDir, envKeys, requiredEnvKeys)

  return { framework, projectName, addDeps, envKeys }
}
