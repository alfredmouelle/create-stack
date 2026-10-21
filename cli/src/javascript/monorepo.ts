import { join } from 'node:path'
import type { Database } from '@alfredmouelle/stack-config'
import { type creationMetadata, renderProjectReadme } from '#lib/identity.ts'
import { PM_VERSIONS } from '#lib/package-manager.ts'
import { TEMPLATES } from '#lib/paths.ts'
import { NATIVE_BUILD_DEPS } from '#lib/scaffold.ts'
import { copy, remove, write } from '#lib/util.ts'
import type { Monorepo, PackageManager } from '../framework-module.ts'
import { isJsonObject, type JsonObject, readJsonObject, writeJsonObject } from './json.ts'

type MonorepoTool = Exclude<Monorepo, false>

type ToolSpecification = {
  readonly dependency: readonly [name: string, version: string]
  readonly cacheDir: string
  readonly nativeBuilds: readonly string[]
  readonly scripts: Readonly<Record<string, string>>
  readonly writeConfig: (rootDir: string, outputs: readonly string[]) => void
}

export type MonorepoRequest = {
  readonly rootDir: string
  readonly appDir: string
  readonly projectName: string
  readonly outputs: readonly string[]
  readonly pm: PackageManager
  readonly tool: MonorepoTool
  readonly database: Database
  readonly metadata: ReturnType<typeof creationMetadata>
  readonly hasDatabase: boolean
  readonly hasDatabaseSchema: boolean
  readonly appNativeBuilds: readonly string[]
}

const SCRIPT_TARGETS = ['dev', 'build', 'typecheck', 'check', 'check:write', 'test']

const WORKSPACE_GLOBS = ['apps/*', 'packages/*']

const pnpmWorkspace = (allowBuilds: readonly string[]): string => `packages:
${WORKSPACE_GLOBS.map((glob) => `  - ${glob}`).join('\n')}
allowBuilds:
${allowBuilds.map((name) => `  ${name.includes('/') ? `'${name}'` : name}: true`).join('\n')}
`

const rootGitignore = (cacheDir: string): string => `node_modules
.DS_Store
${cacheDir}
dist
*.local
.env
`

function turboConfig(rootDir: string, outputs: readonly string[]): void {
  writeJsonObject(join(rootDir, 'turbo.json'), {
    $schema: 'https://turbo.build/schema.json',
    tasks: {
      build: { dependsOn: ['^build'], outputs },
      typecheck: { dependsOn: ['^build'] },
      check: {},
      'check:write': { cache: false },
      test: { cache: false },
      dev: { cache: false, persistent: true },
    },
  })
}

function nxConfig(rootDir: string, outputs: readonly string[]): void {
  writeJsonObject(join(rootDir, 'nx.json'), {
    $schema: './node_modules/nx/schemas/nx-schema.json',
    targetDefaults: {
      build: {
        cache: true,
        dependsOn: ['^build'],
        outputs: outputs.map((output) =>
          output.startsWith('!') ? `!{projectRoot}/${output.slice(1)}` : `{projectRoot}/${output}`,
        ),
      },
      typecheck: { cache: true, dependsOn: ['^build'] },
      check: { cache: true },
    },
  })
}

const runScripts = (command: (target: string) => string): Record<string, string> =>
  Object.fromEntries(SCRIPT_TARGETS.map((target) => [target, command(target)]))

const TOOLS: Readonly<Record<MonorepoTool, ToolSpecification>> = {
  turborepo: {
    dependency: ['turbo', '2.11.8'],
    cacheDir: '.turbo',
    nativeBuilds: [],
    scripts: runScripts((target) => `turbo run ${target}`),
    writeConfig: turboConfig,
  },
  nx: {
    dependency: ['nx', '23.3.0'],
    cacheDir: '.nx',
    nativeBuilds: ['nx'],
    scripts: { ...runScripts((target) => `nx run-many -t ${target}`), dev: 'nx run web:dev' },
    writeConfig: nxConfig,
  },
}

function runAppScript(pm: PackageManager, script: string): string {
  if (pm.name === 'npm') return `npm --prefix apps/web run ${script}`
  if (pm.name === 'yarn') return `yarn --cwd apps/web ${script}`
  if (pm.name === 'bun') return `bun --cwd apps/web run ${script}`
  return `${pm.name} --dir apps/web run ${script}`
}

const packageManagerVersion = (pm: PackageManager): string =>
  Object.entries(PM_VERSIONS).find(([name]) => name === pm.name)?.[1] ?? PM_VERSIONS.pnpm

function applicationManifestFields(appDir: string, pm: PackageManager) {
  const manifest = readJsonObject(join(appDir, 'package.json'))
  const devDependencies = isJsonObject(manifest.devDependencies) ? manifest.devDependencies : {}
  const biomeVersion = devDependencies['@biomejs/biome']
  const scripts = isJsonObject(manifest.scripts) ? Object.keys(manifest.scripts) : []
  return {
    biome: typeof biomeVersion === 'string' ? { '@biomejs/biome': biomeVersion } : {},
    databaseScripts: Object.fromEntries(
      scripts
        .filter((script) => script.startsWith('db:'))
        .map((script) => [script, runAppScript(pm, script)]),
    ),
  }
}

export function wrapMonorepo({
  rootDir,
  appDir,
  projectName,
  outputs,
  pm,
  tool,
  database,
  metadata,
  hasDatabase,
  hasDatabaseSchema,
  appNativeBuilds,
}: MonorepoRequest): void {
  const spec = TOOLS[tool]
  const isPnpm = pm.name === 'pnpm'
  const nativeBuilds = [...NATIVE_BUILD_DEPS, ...spec.nativeBuilds, ...appNativeBuilds]
  const { biome, databaseScripts } = applicationManifestFields(appDir, pm)

  const [dependency, version] = spec.dependency
  const rootManifest: JsonObject = {
    name: projectName,
    version: '0.1.0',
    private: true,
    packageManager: `${pm.name}@${packageManagerVersion(pm)}`,
    scripts: { ...spec.scripts, ...databaseScripts },
    devDependencies: { [dependency]: version, ...biome },
    createStackMetadata: metadata,
  }
  if (!isPnpm) rootManifest.workspaces = WORKSPACE_GLOBS
  if (pm.name === 'bun') rootManifest.trustedDependencies = nativeBuilds
  writeJsonObject(join(rootDir, 'package.json'), rootManifest)

  spec.writeConfig(rootDir, outputs)

  if (isPnpm) write(join(rootDir, 'pnpm-workspace.yaml'), pnpmWorkspace(nativeBuilds))

  copy(join(TEMPLATES, 'biome.jsonc'), join(rootDir, 'biome.jsonc'))
  write(join(rootDir, '.gitignore'), rootGitignore(spec.cacheDir))
  write(
    join(rootDir, 'README.md'),
    renderProjectReadme({
      projectName,
      pm,
      hasDatabase,
      hasDatabaseSchema,
      database,
      monorepo: true,
      appPath: 'apps/web',
    }),
  )
  write(join(rootDir, 'packages/.gitkeep'), '')
  remove(join(appDir, 'README.md'))
}
