// Loads the stack's pattern + capability manifests so the CLI stays
// data-driven (file lists, deps, env come from the manifests, not hardcoded).
// Only the few code "seams" (trpc/auth wiring) are hardcoded in strip.mjs.

import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJSON } from './util.mjs'

const here = dirname(fileURLToPath(import.meta.url))
// Published: assets are bundled into cli/_stack (see scripts/bundle.mjs).
// Dev (inside the monorepo): read them straight from the repo root.
const bundled = resolve(here, '..', '_stack')
export const STACK_ROOT = existsSync(bundled) ? bundled : resolve(here, '..', '..')

export const loadPatterns = () => {
  const dir = join(STACK_ROOT, 'patterns')
  const out = {}
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_') || name === 'README.md') continue
    try {
      out[name] = readJSON(join(dir, name, 'pattern.json'))
    } catch {
      // not a pattern dir
    }
  }
  return out
}

export const loadCapabilities = () => {
  const dir = join(STACK_ROOT, 'packages')
  const out = {}
  for (const name of readdirSync(dir)) {
    try {
      out[name] = readJSON(join(dir, name, 'capability.json'))
    } catch {
      // not a capability package
    }
  }
  return out
}

/**
 * Logical foundations the wizard offers, mapped to the concrete manifest name
 * per framework. The base apps always contain ALL of these — selection = keep.
 */
export const foundationManifest = (logical, framework) => {
  const next = framework === 'next'
  switch (logical) {
    case 'drizzle':
      return 'drizzle'
    case 'data-table':
      return 'data-table'
    case 'trpc':
      return next ? 'trpc-next' : 'trpc'
    case 'better-auth':
      return next ? 'better-auth-next' : 'better-auth'
    default:
      return logical
  }
}
