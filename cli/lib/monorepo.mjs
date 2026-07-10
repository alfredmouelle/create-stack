// Wrap a forked standalone app in a monorepo (Turborepo or Nx): root package.json (scripts
// delegated to the chosen orchestrator), the tool's config file (build outputs per framework),
// workspace glob + native-build allowlist, root Biome/.gitignore, and the app's git hooks
// hoisted to the git root. The orchestrator sits on top of the pm workspace, like turbo/nx do.

import { TEMPLATES } from './paths.mjs'
import { NATIVE_BUILD_DEPS } from './scaffold.mjs'
import { copy, exists, join, remove, runCapture, write, writeJSON } from './util.mjs'

const VERSIONS = { turbo: '^2.10.0', nx: '^23.0.0' }

// Build artifacts to cache, per framework (basenames; each tool prefixes them as it needs).
const OUTPUTS = {
  next: ['.next/**'],
  tanstack: ['.output/**', '.nitro/**', 'dist/**'],
}

const SCRIPT_TARGETS = ['dev', 'build', 'typecheck', 'check', 'check:write']

const wsGlobs = ['apps/*', 'packages/*']

// pnpm reads the workspace file (and the native-build allowlist) only at the root.
const pnpmWorkspace = (allowBuilds) => `packages:
${wsGlobs.map((g) => `  - ${g}`).join('\n')}
allowBuilds:
${allowBuilds.map((d) => `  ${d}: true`).join('\n')}
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
  const outputs = framework === 'next' ? ['.next/**', '!.next/cache/**'] : OUTPUTS.tanstack
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
  // nx caches only what targetDefaults opt in; check:write stays uncached (mutates source).
  const outputs = (OUTPUTS[framework] ?? []).map((o) => `{projectRoot}/${o}`)
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
    // turbo installs a prebuilt binary via optionalDependencies — no build script to allow.
    nativeBuilds: [],
    scripts: runScripts((t) => `turbo run ${t}`),
    writeConfig: turboConfig,
  },
  nx: {
    label: 'Nx',
    dep: ['nx', VERSIONS.nx],
    cacheDir: '.nx',
    // nx runs a postinstall (native bindings); pnpm/bun block it unless it's allowed, and nx then
    // fails every command re-running install. Allow it alongside the app's native deps.
    nativeBuilds: ['nx'],
    // dev is a single continuous task; the rest fan out across the workspace. check:write's
    // colon-name is unambiguous under -t (avoids nx's project:target parsing).
    scripts: { ...runScripts((t) => `nx run-many -t ${t}`), dev: 'nx run web:dev' },
    writeConfig: nxConfig,
  },
}

// Corepack needs an exact version; only pin packageManager when we can read one, else let the
// orchestrator infer the manager from the lockfile after install.
function packageManagerField(pm) {
  const v = runCapture(pm.exec, ['--version'])
  return /^\d+\.\d+\.\d+/.test(v) ? `${pm.name}@${v}` : undefined
}

function rootReadme(name, pm, toolLabel) {
  return `# ${name}

${toolLabel} monorepo scaffolded with [create-stack](https://create-stack.alfredmouelle.com).

## Structure

- \`apps/web\` — the application.
- \`packages/\` — shared packages (empty; add your own here).

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
 */
export function wrapMonorepo({ rootDir, appDir, projectName, framework, pm, tool }) {
  const spec = TOOLS[tool]
  if (!spec) throw new Error(`Unknown monorepo tool: ${tool}`)
  const isPnpm = pm?.name === 'pnpm'
  // the app's native deps plus any the orchestrator itself needs to build on install.
  const nativeBuilds = [...NATIVE_BUILD_DEPS, ...spec.nativeBuilds]

  const rootPkg = {
    name: projectName,
    version: '0.1.0',
    private: true,
    scripts: { ...spec.scripts, prepare: PREPARE },
    devDependencies: { [spec.dep[0]]: spec.dep[1] },
  }
  const pmField = packageManagerField(pm)
  if (pmField) rootPkg.packageManager = pmField
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

  // hoist the app's git hooks to the git root (the app is no longer the repo root, so its own
  // `prepare` guard no-ops — the root prepare + initGitRepo wire core.hooksPath instead).
  const appHooks = join(appDir, '.githooks')
  if (exists(appHooks)) {
    copy(appHooks, join(rootDir, '.githooks'))
    remove(appHooks)
  }
}
