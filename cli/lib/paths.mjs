// Where the bundled stack assets live: cli/_stack when published (scripts/bundle.mjs), repo root in dev.

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundled = resolve(here, '..', '_stack')

// Forkable source (base apps + mailer adapters): _stack when published, monorepo root in dev.
export const STACK_ROOT = existsSync(bundled) ? bundled : resolve(here, '..', '..')

// CLI-owned templates injected into the fork (root-wiring variants, biome.jsonc,
// # Author README footer). Always shipped in the package.
export const TEMPLATES = resolve(here, '..', 'templates')
