// Wrap a forked app in a Turborepo/Nx monorepo: root package.json + tool config + workspace, hoisted git hooks, root biome/gitignore.

import { TEMPLATES } from './paths.mjs'
import { NATIVE_BUILD_DEPS } from './scaffold.mjs'
import { copy, exists, join, readJSON, remove, write, writeJSON } from './util.mjs'

const VERSIONS = { turbo: '^2.10.0', nx: '^23.0.0' }

// `packageManager` needs an exact version, so these are floors, not ranges.
const PM_VERSIONS = { pnpm: '11.1.3', npm: '11.0.0', yarn: '4.6.0', bun: '1.2.0' }

// Build outputs to cache per framework (basenames; each tool prefixes them). Next's build cache is excluded.
const OUTPUTS = {
  next: ['.next/**', '!.next/cache/**'],
  tanstack: ['.output/**', '.nitro/**', 'dist/**'],
}

const SCRIPT_TARGETS = ['dev', 'build', 'typecheck', 'check', 'check:write']

const wsGlobs = ['apps/*', 'packages/*']

// pnpm reads the workspace file (and the native-build allowlist) only at the root.
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

// prepare wires the repo-root git hooks; mirrors the base app's own guard (git top-level == cwd).
const PREPARE =
  '[ "$(git rev-parse --show-toplevel 2>/dev/null)" = "$(pwd -P)" ] && git config core.hooksPath .githooks || true'

function turboConfig(rootDir, framework) {
  // turbo caches build; check:write is a codemod (rewrites source), so it must never be cached.
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
  // prefix outputs with {projectRoot}, keeping negative globs (!); check:write stays out of targetDefaults so it is uncached.
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

/** Per-tool wiring: dep to install, cache dir to ignore, root scripts, and the config file. */
const TOOLS = {
  turborepo: {
    label: 'Turborepo',
    dep: ['turbo', VERSIONS.turbo],
    cacheDir: '.turbo',
    // turbo installs a prebuilt binary via optionalDependencies, so no build script to allow.
    nativeBuilds: [],
    scripts: runScripts((t) => `turbo run ${t}`),
    writeConfig: turboConfig,
  },
  nx: {
    label: 'Nx',
    dep: ['nx', VERSIONS.nx],
    cacheDir: '.nx',
    // nx's postinstall (native bindings) is blocked by pnpm/bun unless allowed, else nx re-runs install and fails.
    nativeBuilds: ['nx'],
    // dev is one continuous task; the rest fan out via run-many (check:write's colon-name is safe under -t).
    scripts: { ...runScripts((t) => `nx run-many -t ${t}`), dev: 'nx run web:dev' },
    writeConfig: nxConfig,
  },
}

function rootReadme(name, pm, toolLabel) {
  return `# ${name}

${toolLabel} monorepo scaffolded with [create-stack](https://create-stack.alfredmouelle.com).

## Structure

- \`apps/web\`: the application.
- \`packages/\`: shared packages (empty; add your own here).

## Getting started

\`\`\`sh
${pm.name} install
${pm.devCmd}
\`\`\`

${toolLabel} orchestrates \`dev\`, \`build\`, \`typecheck\`, \`check\` and \`check:write\` across the workspace.
`
}

/**
 * @param {object} o
 * @param {string} o.rootDir  monorepo root (empty except for apps/web)
 * @param {string} o.appDir   the forked app (rootDir/apps/web)
 * @param {string} o.projectName
 * @param {'next'|'tanstack'} o.framework
 * @param {import('./package-manager.mjs').PackageManager} o.pm
 * @param {'turborepo'|'nx'} o.tool
 * @param {string[]} [o.appNativeBuilds]  build scripts the app's variant needs allowed (e.g. Prisma engines)
 */
export function wrapMonorepo({
  rootDir,
  appDir,
  projectName,
  framework,
  pm,
  tool,
  appNativeBuilds = [],
}) {
  const spec = TOOLS[tool]
  if (!spec) throw new Error(`Unknown monorepo tool: ${tool}`)
  const isPnpm = pm?.name === 'pnpm'
  // the app's native deps (base + variant, e.g. Prisma) plus any the orchestrator itself needs on install.
  const nativeBuilds = [...NATIVE_BUILD_DEPS, ...spec.nativeBuilds, ...appNativeBuilds]

  // biome is an app-only devDep, but the hoisted root hooks run it from the repo root, so pin it there too.
  const appPkg = readJSON(join(appDir, 'package.json'))
  const biomeVersion = appPkg.devDependencies?.['@biomejs/biome']

  const rootPkg = {
    name: projectName,
    version: '0.1.0',
    private: true,
    // turbo >= 2.10 refuses to resolve a workspace without it.
    packageManager: `${pm?.name ?? 'pnpm'}@${PM_VERSIONS[pm?.name] ?? PM_VERSIONS.pnpm}`,
    scripts: { ...spec.scripts, prepare: PREPARE },
    devDependencies: {
      [spec.dep[0]]: spec.dep[1],
      ...(biomeVersion ? { '@biomejs/biome': biomeVersion } : {}),
    },
  }
  // pnpm declares workspaces in pnpm-workspace.yaml; npm/yarn/bun in package.json.
  if (!isPnpm) rootPkg.workspaces = wsGlobs
  // bun installs from the root, so its native-build allowlist lives on the root package.json.
  if (pm?.name === 'bun') rootPkg.trustedDependencies = nativeBuilds
  writeJSON(join(rootDir, 'package.json'), rootPkg)

  spec.writeConfig(rootDir, framework)

  if (isPnpm) write(join(rootDir, 'pnpm-workspace.yaml'), pnpmWorkspace(nativeBuilds))

  // the app inherits this root Biome config (it has "root": true and scans the whole tree).
  copy(join(TEMPLATES, 'biome.jsonc'), join(rootDir, 'biome.jsonc'))
  write(join(rootDir, '.gitignore'), rootGitignore(spec.cacheDir))
  write(join(rootDir, 'README.md'), rootReadme(projectName, pm, spec.label))
  write(join(rootDir, 'packages/.gitkeep'), '')
  // drop stampIdentity's app README; the root one is canonical (its app-dir install/dev steps are wrong in a workspace).
  remove(join(appDir, 'README.md'))

  // hoist the app's git hooks to the git root; its own prepare guard no-ops there, root prepare wires them.
  const appHooks = join(appDir, '.githooks')
  if (exists(appHooks)) {
    copy(appHooks, join(rootDir, '.githooks'))
    remove(appHooks)
  }
}
