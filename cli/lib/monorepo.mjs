import { renderProjectReadme } from './identity.mjs'
import { PM_VERSIONS } from './package-manager.mjs'
import { TEMPLATES } from './paths.mjs'
import { NATIVE_BUILD_DEPS } from './scaffold.mjs'
import { copy, join, readJSON, remove, write, writeJSON } from './util.mjs'

const VERSIONS = { turbo: '2.11.8', nx: '23.3.0' }

const SCRIPT_TARGETS = ['dev', 'build', 'typecheck', 'check', 'check:write', 'test']

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

function turboConfig(rootDir, outputs) {
  writeJSON(join(rootDir, 'turbo.json'), {
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

function nxConfig(rootDir, outputs) {
  writeJSON(join(rootDir, 'nx.json'), {
    $schema: './node_modules/nx/schemas/nx-schema.json',
    targetDefaults: {
      build: {
        cache: true,
        dependsOn: ['^build'],
        outputs: outputs.map((o) =>
          o.startsWith('!') ? `!{projectRoot}/${o.slice(1)}` : `{projectRoot}/${o}`,
        ),
      },
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

function rootReadme(name, pm, database, hasDatabase, hasDatabaseSchema) {
  return renderProjectReadme({
    projectName: name,
    pm,
    hasDatabase,
    hasDatabaseSchema,
    database,
    monorepo: true,
    appPath: 'apps/web',
  })
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
    scripts: { ...spec.scripts, ...databaseScripts },
    devDependencies: {
      [spec.dep[0]]: spec.dep[1],
      ...(biomeVersion ? { '@biomejs/biome': biomeVersion } : {}),
    },
    createStackMetadata: metadata,
  }
  if (!isPnpm) rootPkg.workspaces = wsGlobs
  if (pm?.name === 'bun') rootPkg.trustedDependencies = nativeBuilds
  writeJSON(join(rootDir, 'package.json'), rootPkg)

  spec.writeConfig(rootDir, outputs)

  if (isPnpm) write(join(rootDir, 'pnpm-workspace.yaml'), pnpmWorkspace(nativeBuilds))

  copy(join(TEMPLATES, 'biome.jsonc'), join(rootDir, 'biome.jsonc'))
  write(join(rootDir, '.gitignore'), rootGitignore(spec.cacheDir))
  write(
    join(rootDir, 'README.md'),
    rootReadme(projectName, pm, database, hasDatabase, hasDatabaseSchema),
  )
  write(join(rootDir, 'packages/.gitkeep'), '')
  remove(join(appDir, 'README.md'))
}
