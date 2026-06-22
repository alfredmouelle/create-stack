// Step A2 — fork a base app into the target dir and make it standalone
// (its own Biome config, pnpm workspace + build allowlist, project name).

import { STACK_ROOT } from './manifests.mjs'
import { copy, exists, join, readJSON, run, write, writeJSON } from './util.mjs'

const RSYNC_EXCLUDES = [
  'node_modules',
  '.next',
  '.output',
  '.nitro',
  '.tanstack',
  'dist',
  'src/routeTree.gen.ts',
  '.env',
  '.env.local',
]

const PNPM_WORKSPACE = `allowBuilds:
  esbuild: true
  sharp: true
  lightningcss: true
`

/** Copy the base app into projectDir, minus build output & generated files. */
export function forkBase(framework, projectDir) {
  const base = join(STACK_ROOT, 'apps', framework === 'next' ? 'next-base' : 'tanstack-base')
  if (!exists(base)) throw new Error(`Base app not found: ${base}`)
  const args = ['-a']
  for (const ex of RSYNC_EXCLUDES) args.push('--exclude', ex)
  args.push(`${base}/.`, `${projectDir}/`)
  if (!run('rsync', args)) throw new Error('rsync failed while forking the base app')
}

/** Make the fork standalone (Biome, pnpm workspace, package.json identity). */
export function makeStandalone(projectDir, projectName) {
  // A fork needs its own Biome config (the base inherits the monorepo root's).
  copy(join(STACK_ROOT, 'patterns/_baseline/biome.jsonc'), join(projectDir, 'biome.jsonc'))

  // Avoid ERR_PNPM_IGNORED_BUILDS on a fresh install (native build scripts).
  write(join(projectDir, 'pnpm-workspace.yaml'), PNPM_WORKSPACE)

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  pkg.name = projectName
  delete pkg.private // a leaf project; let the user decide
  pkg.private = true
  writeJSON(pkgPath, pkg)
}
