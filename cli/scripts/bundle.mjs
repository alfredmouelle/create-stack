// Snapshot the stack assets the CLI reads at runtime into cli/_stack/ so the
// published package is self-contained (the base apps, manifests, baseline and
// the mailer adapters live outside cli/ in the monorepo). Runs on `prepack`.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..', '..') // monorepo root
const OUT = resolve(here, '..', '_stack') // cli/_stack

const APP_EXCLUDES = new Set([
  'node_modules',
  '.next',
  '.output',
  '.nitro',
  '.tanstack',
  'dist',
  'routeTree.gen.ts',
])
const isEnvFile = (name) => name === '.env' || name.startsWith('.env.')

const copyApp = (from, to) =>
  cpSync(from, to, {
    recursive: true,
    filter: (src) => {
      const base = src.split('/').pop()
      return !APP_EXCLUDES.has(base) && !isEnvFile(base)
    },
  })

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

// Base apps (the forkable source).
for (const base of ['next-base', 'tanstack-base']) {
  copyApp(join(ROOT, 'apps', base), join(OUT, 'apps', base))
}

// Patterns: manifests + _baseline (small, copy wholesale).
cpSync(join(ROOT, 'patterns'), join(OUT, 'patterns'), { recursive: true })

// Capabilities: the wizard lists every capability.json; the mailer swap needs
// the mailer package's adapters + manifest for dep ranges.
for (const pkg of readdirSync(join(ROOT, 'packages'))) {
  const manifest = join(ROOT, 'packages', pkg, 'capability.json')
  if (existsSync(manifest)) {
    cpSync(manifest, join(OUT, 'packages', pkg, 'capability.json'))
  }
}
cpSync(join(ROOT, 'packages/mailer/package.json'), join(OUT, 'packages/mailer/package.json'))
cpSync(join(ROOT, 'packages/mailer/src/adapters'), join(OUT, 'packages/mailer/src/adapters'), {
  recursive: true,
})

console.log(`bundled stack assets → ${OUT}`)
