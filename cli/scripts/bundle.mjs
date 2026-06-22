// prepack: snapshot base apps + mailer adapters (which live outside cli/) into
// cli/_stack for a self-contained package. CLI-owned templates ship directly from cli/templates.

import { cpSync, mkdirSync, rmSync } from 'node:fs'
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

// base apps (forkable source)
for (const base of ['next-base', 'tanstack-base']) {
  copyApp(join(ROOT, 'apps', base), join(OUT, 'apps', base))
}

// mailer: adapters + manifest (provider swap reads its dep ranges)
cpSync(join(ROOT, 'packages/mailer/package.json'), join(OUT, 'packages/mailer/package.json'))
cpSync(join(ROOT, 'packages/mailer/src/adapters'), join(OUT, 'packages/mailer/src/adapters'), {
  recursive: true,
})

console.log(`bundled stack assets → ${OUT}`)
