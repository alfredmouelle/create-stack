// Fork a base app into the target dir + make it standalone
// (own Biome config, pnpm workspace + build allowlist, project name).

import { STACK_ROOT, TEMPLATES } from './paths.mjs'
import { copy, copyTree, exists, join, readJSON, run, write, writeJSON } from './util.mjs'

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
  // a fresh fork must never inherit a lockfile from the source tree
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
]

// Native deps whose install/build scripts pnpm and bun block by default.
export const NATIVE_BUILD_DEPS = ['esbuild', 'sharp', 'lightningcss', 'protobufjs']

const PNPM_WORKSPACE = `allowBuilds:
${NATIVE_BUILD_DEPS.map((d) => `  ${d}: true`).join('\n')}
`

// Generated explicitly: npm strips `.gitignore` from published tarballs, so the
// bundled base app's copy won't survive. Both keep `.env.example`.
const GITIGNORE = {
  tanstack: `node_modules
.DS_Store
dist
dist-ssr
*.local
.env
.nitro
.tanstack
.wrangler
.output
.vinxi
__unconfig*
`,
  next: `# dependencies
/node_modules
/.pnp
.pnp.*

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
.pnpm-debug.log*

# env files (keep .env.example committed)
.env
.env*.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`,
}

/** Copy base app into projectDir, minus build output & generated files. */
export function forkBase(framework, projectDir) {
  const base = join(STACK_ROOT, 'apps', framework === 'next' ? 'next-base' : 'tanstack-base')
  if (!exists(base)) throw new Error(`Base app not found: ${base}`)

  // rsync is the fast path; fall back to a filtered cpSync where it's absent (e.g. Windows).
  if (hasRsync()) {
    const args = ['-a']
    for (const ex of RSYNC_EXCLUDES) args.push('--exclude', ex)
    args.push(`${base}/.`, `${projectDir}/`)
    if (!run('rsync', args)) throw new Error('rsync failed while forking the base app')
    return
  }
  // cpSync filters by basename — unambiguous for every excluded name in the base apps
  const basenames = RSYNC_EXCLUDES.map((e) => e.slice(e.lastIndexOf('/') + 1))
  copyTree(base, projectDir, basenames)
}

let _hasRsync
/** Is rsync on PATH? Probed once. */
function hasRsync() {
  if (_hasRsync === undefined) _hasRsync = run('rsync', ['--version'], { stdio: 'ignore' })
  return _hasRsync
}

/**
 * Make the fork standalone (Biome, pnpm workspace, .gitignore, identity).
 * In a monorepo the app inherits the generated root's Biome config + workspace file,
 * and the native-build allowlist lives at the root — so those are skipped here (see monorepo.mjs).
 */
export function makeStandalone(projectDir, projectName, framework, pm, { monorepo = false } = {}) {
  // fork needs its own Biome config (base inherits the monorepo root's); in a generated
  // monorepo the app inherits the root biome.jsonc instead.
  if (!monorepo) copy(join(TEMPLATES, 'biome.jsonc'), join(projectDir, 'biome.jsonc'))

  // Biome vcs.useIgnoreFile needs a .gitignore
  write(join(projectDir, '.gitignore'), GITIGNORE[framework === 'next' ? 'next' : 'tanstack'])

  // Allow native build scripts on fresh install. pnpm blocks them (ERR_PNPM_IGNORED_BUILDS)
  // and reads an allowlist from pnpm-workspace.yaml; bun blocks them and reads
  // `trustedDependencies` from package.json. npm/yarn run them by default — nothing to do.
  // In a monorepo pnpm only reads the root workspace file and bun installs from the root,
  // so both are handled by wrapMonorepo instead.
  if (pm?.name === 'pnpm' && !monorepo)
    write(join(projectDir, 'pnpm-workspace.yaml'), PNPM_WORKSPACE)

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  pkg.name = projectName
  delete pkg.private // leaf project
  pkg.private = true
  if (pm?.name === 'bun' && !monorepo) pkg.trustedDependencies = NATIVE_BUILD_DEPS
  writeJSON(pkgPath, pkg)
}
