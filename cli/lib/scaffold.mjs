// Fork a base app into the target dir + make it standalone
// (own Biome config, pnpm workspace + build allowlist, project name).

import { STACK_ROOT, TEMPLATES } from './paths.mjs'
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
  protobufjs: true
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
  const args = ['-a']
  for (const ex of RSYNC_EXCLUDES) args.push('--exclude', ex)
  args.push(`${base}/.`, `${projectDir}/`)
  if (!run('rsync', args)) throw new Error('rsync failed while forking the base app')
}

/** Make the fork standalone (Biome, pnpm workspace, .gitignore, identity). */
export function makeStandalone(projectDir, projectName, framework) {
  // fork needs its own Biome config (base inherits the monorepo root's)
  copy(join(TEMPLATES, 'biome.jsonc'), join(projectDir, 'biome.jsonc'))

  // Biome vcs.useIgnoreFile needs a .gitignore
  write(join(projectDir, '.gitignore'), GITIGNORE[framework === 'next' ? 'next' : 'tanstack'])

  // avoid ERR_PNPM_IGNORED_BUILDS on fresh install (native build scripts)
  write(join(projectDir, 'pnpm-workspace.yaml'), PNPM_WORKSPACE)

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  pkg.name = projectName
  delete pkg.private // leaf project
  pkg.private = true
  writeJSON(pkgPath, pkg)
}
