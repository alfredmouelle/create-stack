import { renderProjectReadme } from './identity.mjs'
import { TEMPLATES } from './paths.mjs'
import { NATIVE_BUILD_DEPS } from './scaffold.mjs'
import { copy, exists, join, readJSON, remove, write, writeJSON } from './util.mjs'

const VERSIONS = { turbo: '^2.10.0', nx: '^23.0.0' }

const PM_VERSIONS = { pnpm: '11.1.3', npm: '11.0.0', yarn: '4.6.0', bun: '1.2.0' }

const OUTPUTS = {
  next: ['.next/**', '!.next/cache/**'],
  tanstack: ['.output/**', '.nitro/**', 'dist/**'],
}

const SCRIPT_TARGETS = ['dev', 'build', 'typecheck', 'check', 'check:write']

const wsGlobs = ['apps/*', 'packages/*']

const pnpmWorkspace = (allowBuilds) => `packages:
${wsGlobs.map((g) => `  - ${g}`).join('\n')}
allowBuilds:
${allowBuilds.map((d) => `  ${d.includes('/') ? `'${d}'` : d}: true`).join('\n')}
`

const rootGitignore = (cacheDir) => `node_modules
.DS_Store
${cacheDir}
dist
*.local
.env
`

const PREPARE =
  '[ "$(git rev-parse --show-toplevel 2>/dev/null)" = "$(pwd -P)" ] && git config core.hooksPath .githooks || true'

function turboConfig(rootDir, framework) {
  const outputs = OUTPUTS[framework] ?? []
  writeJSON(join(rootDir, 'turbo.json'), {
    $schema: 'https://turbo.build/schema.json',
    tasks: {
      build: { dependsOn: ['^build'], outputs },
      typecheck: { dependsOn: ['^build'] },
      check: {},
      'check:write': { cache: false },
      dev: { cache: false, persistent: true },
    },
  })
}

function nxConfig(rootDir, framework) {
  const outputs = (OUTPUTS[framework] ?? []).map((o) =>
    o.startsWith('!') ? `!{projectRoot}/${o.slice(1)}` : `{projectRoot}/${o}`,
  )
  writeJSON(join(rootDir, 'nx.json'), {
    $schema: './node_modules/nx/schemas/nx-schema.json',
    targetDefaults: {
      build: { cache: true, dependsOn: ['^build'], outputs },
      typecheck: { cache: true, dependsOn: ['^build'] },
      check: { cache: true },
    },
  })
}

const runScripts = (fmt) => Object.fromEntries(SCRIPT_TARGETS.map((t) => [t, fmt(t)]))

const TOOLS = {
  turborepo: {
    label: 'Turborepo',
    dep: ['turbo', VERSIONS.turbo],
    cacheDir: '.turbo',
    nativeBuilds: [],
    scripts: runScripts((t) => `turbo run ${t}`),
    writeConfig: turboConfig,
  },
  nx: {
    label: 'Nx',
    dep: ['nx', VERSIONS.nx],
    cacheDir: '.nx',
    nativeBuilds: ['nx'],
    scripts: { ...runScripts((t) => `nx run-many -t ${t}`), dev: 'nx run web:dev' },
    writeConfig: nxConfig,
  },
}

const runAppScript = (pm, script) => {
  if (pm.name === 'npm') return `npm --prefix apps/web run ${script}`
  if (pm.name === 'yarn') return `yarn --cwd apps/web ${script}`
  if (pm.name === 'bun') return `bun --cwd apps/web run ${script}`
  return `${pm.name} --dir apps/web run ${script}`
}

function rootReadme(name, pm, metadata, hasDatabase, hasDatabaseSchema) {
  return renderProjectReadme({
    projectName: name,
    pm,
    metadata,
    hasDatabase,
    hasDatabaseSchema,
    database: metadata.database,
    monorepo: true,
    appPath: 'apps/web',
  })
}

export function wrapMonorepo({
  rootDir,
  appDir,
  projectName,
  framework,
  pm,
  tool,
  metadata,
  hasDatabase = false,
  hasDatabaseSchema = false,
  appNativeBuilds = [],
}) {
  const spec = TOOLS[tool]
  if (!spec) throw new Error(`Unknown monorepo tool: ${tool}`)
  const isPnpm = pm?.name === 'pnpm'
  const nativeBuilds = [...NATIVE_BUILD_DEPS, ...spec.nativeBuilds, ...appNativeBuilds]

  const appPkg = readJSON(join(appDir, 'package.json'))
  const biomeVersion = appPkg.devDependencies?.['@biomejs/biome']
  const databaseScripts = Object.fromEntries(
    Object.keys(appPkg.scripts ?? {})
      .filter((script) => script.startsWith('db:'))
      .map((script) => [script, runAppScript(pm, script)]),
  )

  const rootPkg = {
    name: projectName,
    version: '0.1.0',
    private: true,
    packageManager: `${pm?.name ?? 'pnpm'}@${PM_VERSIONS[pm?.name] ?? PM_VERSIONS.pnpm}`,
    scripts: { ...spec.scripts, ...databaseScripts, prepare: PREPARE },
    devDependencies: {
      [spec.dep[0]]: spec.dep[1],
      ...(biomeVersion ? { '@biomejs/biome': biomeVersion } : {}),
    },
    createStackMetadata: metadata,
  }
  if (!isPnpm) rootPkg.workspaces = wsGlobs
  if (pm?.name === 'bun') rootPkg.trustedDependencies = nativeBuilds
  writeJSON(join(rootDir, 'package.json'), rootPkg)

  spec.writeConfig(rootDir, framework)

  if (isPnpm) write(join(rootDir, 'pnpm-workspace.yaml'), pnpmWorkspace(nativeBuilds))

  copy(join(TEMPLATES, 'biome.jsonc'), join(rootDir, 'biome.jsonc'))
  write(join(rootDir, '.gitignore'), rootGitignore(spec.cacheDir))
  write(
    join(rootDir, 'README.md'),
    rootReadme(projectName, pm, metadata, hasDatabase, hasDatabaseSchema),
  )
  write(join(rootDir, 'packages/.gitkeep'), '')
  remove(join(appDir, 'README.md'))

  const appHooks = join(appDir, '.githooks')
  if (exists(appHooks)) {
    copy(appHooks, join(rootDir, '.githooks'))
    remove(appHooks)
  }
}
