import { mkdirSync } from 'node:fs'
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
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  'bun.lockb',
  'bun.lock',
]

export const NATIVE_BUILD_DEPS = ['esbuild', 'sharp', 'lightningcss', 'protobufjs', '@sentry/cli']

const allowBuildsYaml = (deps) =>
  deps.map((d) => `  ${d.includes('/') ? `'${d}'` : d}: true`).join('\n')

const PNPM_WORKSPACE = `allowBuilds:
${allowBuildsYaml(NATIVE_BUILD_DEPS)}
`

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

export function forkBase(framework, projectDir) {
  const base = join(STACK_ROOT, 'apps', framework === 'next' ? 'next-base' : 'tanstack-base')
  if (!exists(base)) throw new Error(`Base app not found: ${base}`)

  mkdirSync(projectDir, { recursive: true })

  if (hasRsync()) {
    const args = ['-a']
    for (const ex of RSYNC_EXCLUDES) args.push('--exclude', ex)
    args.push(`${base}/.`, `${projectDir}/`)
    if (!run('rsync', args)) throw new Error('rsync failed while forking the base app')
    return
  }
  const basenames = RSYNC_EXCLUDES.map((e) => e.slice(e.lastIndexOf('/') + 1))
  copyTree(base, projectDir, basenames)
}

let _hasRsync
function hasRsync() {
  if (_hasRsync === undefined) _hasRsync = run('rsync', ['--version'], { stdio: 'ignore' })
  return _hasRsync
}

export function makeStandalone(projectDir, projectName, framework, pm, { monorepo = false } = {}) {
  if (!monorepo) copy(join(TEMPLATES, 'biome.jsonc'), join(projectDir, 'biome.jsonc'))

  write(join(projectDir, '.gitignore'), GITIGNORE[framework === 'next' ? 'next' : 'tanstack'])

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
