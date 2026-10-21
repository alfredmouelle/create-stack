import type { PackageManager } from '../framework-module.ts'
import { readJsonObject, writeJsonObject } from '../javascript/json.ts'
import { TEMPLATES } from './paths.ts'
import { copy, join, write } from './util.ts'

export const NATIVE_BUILD_DEPS = [
  'esbuild',
  'sharp',
  'lightningcss',
  'protobufjs',
  '@sentry/cli',
] as const

const allowBuildsYaml = (deps: readonly string[]): string =>
  deps.map((d) => `  ${d.includes('/') ? `'${d}'` : d}: true`).join('\n')

const PNPM_WORKSPACE = `allowBuilds:
${allowBuildsYaml(NATIVE_BUILD_DEPS)}
`

export function makeStandalone(
  projectDir: string,
  projectName: string,
  pm: PackageManager,
  { monorepo = false }: { readonly monorepo?: boolean } = {},
): void {
  if (!monorepo) copy(join(TEMPLATES, 'biome.jsonc'), join(projectDir, 'biome.jsonc'))

  if (pm.name === 'pnpm' && !monorepo)
    write(join(projectDir, 'pnpm-workspace.yaml'), PNPM_WORKSPACE)

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJsonObject(pkgPath)
  pkg.name = projectName
  delete pkg.private
  pkg.private = true
  if (pm.name === 'bun' && !monorepo) pkg.trustedDependencies = [...NATIVE_BUILD_DEPS]
  writeJsonObject(pkgPath, pkg)
}
