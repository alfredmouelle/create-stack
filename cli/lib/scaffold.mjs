import { TEMPLATES } from './paths.mjs'
import { copy, join, readJSON, write, writeJSON } from './util.mjs'

export const NATIVE_BUILD_DEPS = ['esbuild', 'sharp', 'lightningcss', 'protobufjs', '@sentry/cli']

const allowBuildsYaml = (deps) =>
  deps.map((d) => `  ${d.includes('/') ? `'${d}'` : d}: true`).join('\n')

const PNPM_WORKSPACE = `allowBuilds:
${allowBuildsYaml(NATIVE_BUILD_DEPS)}
`

export function makeStandalone(projectDir, projectName, pm, { monorepo = false } = {}) {
  if (!monorepo) copy(join(TEMPLATES, 'biome.jsonc'), join(projectDir, 'biome.jsonc'))

  if (pm?.name === 'pnpm' && !monorepo)
    write(join(projectDir, 'pnpm-workspace.yaml'), PNPM_WORKSPACE)

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  pkg.name = projectName
  delete pkg.private
  pkg.private = true
  if (pm?.name === 'bun' && !monorepo) pkg.trustedDependencies = NATIVE_BUILD_DEPS
  writeJSON(pkgPath, pkg)
}
