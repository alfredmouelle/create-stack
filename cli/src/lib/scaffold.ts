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

const pnpmWorkspace = (nativeBuilds: readonly string[]): string => `allowBuilds:
${allowBuildsYaml(nativeBuilds)}
`

export function makeStandalone(
  projectDir: string,
  projectName: string,
  pm: PackageManager,
  {
    monorepo = false,
    nativeBuilds = [],
  }: { readonly monorepo?: boolean; readonly nativeBuilds?: readonly string[] } = {},
): void {
  const allowedBuilds = [...new Set([...NATIVE_BUILD_DEPS, ...nativeBuilds])]
  if (!monorepo) copy(join(TEMPLATES, 'biome.jsonc'), join(projectDir, 'biome.jsonc'))

  if (pm.name === 'pnpm' && !monorepo)
    write(join(projectDir, 'pnpm-workspace.yaml'), pnpmWorkspace(allowedBuilds))

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJsonObject(pkgPath)
  pkg.name = projectName
  delete pkg.private
  pkg.private = true
  if (pm.name === 'bun' && !monorepo) pkg.trustedDependencies = allowedBuilds
  writeJsonObject(pkgPath, pkg)
}
