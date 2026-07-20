// `create-stack add` — vendor a capability into an existing project, merging dep/env
// deltas incrementally (same engine as the scaffold). On a multi-adapter capability a
// re-add swaps the adapter; `keep` retains the previous one(s) alongside the new.

import { detectAlias, rewriteAlias } from './alias.mjs'
import {
  adapterChoices,
  adapterRemovableDeps,
  CAPABILITIES,
  capabilityChoices,
  capabilityDir,
  currentAdapter,
  hasAdapters,
  MANUAL_STEPS,
  resolveAdapter,
  vendorCapability,
  vendorPackageSrc,
} from './capabilities.mjs'
import { appendEnv } from './env.mjs'
import { vendorMailer } from './mailer.mjs'
import { exists, join, pkgAddDeps, pkgRemoveDeps, read, readJSON, writeJSON } from './util.mjs'

const MAILER_ADAPTERS = ['resend', 'brevo', 'ses']

// Targets beyond the 6 port capabilities, with their vendored destination.
const EXTRA_DIR = {
  mailer: 'src/server/email',
  'email-kit': 'src/emails/components',
  http: 'src/lib/http',
}
const NO_ADAPTER = new Set(['email-kit', 'http']) // single implementation, nothing to pick

/** Everything `add` accepts. */
export const ADDABLE = [...CAPABILITIES, 'mailer', 'email-kit', 'http']

/** Vendored destination dir (relative to the project) for a target. */
export const targetDir = (cap) => EXTRA_DIR[cap] ?? capabilityDir(cap) ?? `src/server/${cap}`

/** Options for the interactive `add` multi-select. */
export const addableChoices = () => [
  ...capabilityChoices(),
  { value: 'mailer', label: 'Mailer', hint: MAILER_ADAPTERS.join(' / ') },
  { value: 'email-kit', label: 'Email kit', hint: 'React Email primitives' },
  { value: 'http', label: 'HTTP', hint: 'fetch + response helpers' },
]

/** Adapter picker (default + options) for a target, or null when it has no adapters. */
export function adapterChoicesFor(cap) {
  if (CAPABILITIES.includes(cap)) return adapterChoices(cap)
  if (cap === 'mailer') {
    return {
      defaultAdapter: 'resend',
      options: MAILER_ADAPTERS.map((v) => ({ value: v, label: v })),
    }
  }
  return null
}

/** Resolve a flag/positional adapter value to a valid adapter (or null for single-impl targets). */
export function resolveTargetAdapter(cap, value) {
  if (CAPABILITIES.includes(cap)) return resolveAdapter(cap, value)
  if (cap === 'mailer') {
    if (value === true || value == null || value === '') return 'resend'
    if (!MAILER_ADAPTERS.includes(value)) {
      throw new Error(`Unknown mailer adapter: ${value} (have ${MAILER_ADAPTERS.join(', ')})`)
    }
    return value
  }
  return null
}

/** Infer the base framework from installed deps (next vs TanStack Start). */
export function detectFramework(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  if (deps['@tanstack/react-start'] || deps['@tanstack/react-router']) return 'tanstack'
  if (deps.next) return 'next'
  throw new Error('Could not detect framework — no `next` or `@tanstack/react-start` dependency')
}

const currentMailerAdapter = (projectDir) => {
  const idx = join(projectDir, EXTRA_DIR.mailer, 'index.ts')
  return exists(idx) ? (read(idx).match(/\.\/adapters\/([\w-]+)['"]/)?.[1] ?? null) : null
}

/**
 * Vendor the target and report what changed. The mailer predates the capability
 * manifests and keeps its own engine; everything else goes through vendorCapability.
 * @returns {{ swappedFrom: string|null, removeDeps?: string[], addDeps, envKeys, requiredEnvKeys }}
 */
function vendor({ projectDir, framework, projectName, cap, adapter, keep }) {
  if (cap === 'mailer') {
    const from = currentMailerAdapter(projectDir)
    return {
      swappedFrom: from && from !== adapter ? from : null,
      ...vendorMailer(projectDir, framework, adapter, keep),
    }
  }

  // A module has no adapter, so nothing can have been swapped away from.
  const from = hasAdapters(cap) ? currentAdapter(projectDir, cap) : null
  const swappedFrom = from && from !== adapter ? from : null
  return {
    swappedFrom,
    removeDeps: swappedFrom && !keep ? adapterRemovableDeps(cap, from, adapter) : [],
    ...vendorCapability({ projectDir, framework, projectName, cap, adapter, keep }),
  }
}

/**
 * Vendor `cap` (+ `adapter`) into the project, swapping the adapter on a re-add unless
 * `keep` is set.
 * @returns {{ framework, projectName, addDeps, envKeys, swappedFrom: string|null, manualSteps: string[] }}
 */
export function addCapability({ projectDir, cap, adapter, keep }) {
  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  const framework = detectFramework(pkg)
  const projectName = pkg.name ?? 'app'
  // vendored sources ship with '~/'; align them to whatever alias this project already uses.
  const alias = detectAlias(projectDir)

  // email-kit / http: just vendor the source, no deps or env.
  if (NO_ADAPTER.has(cap)) {
    vendorPackageSrc(cap, join(projectDir, targetDir(cap)))
    rewriteAlias(projectDir, alias)
    return { framework, projectName, addDeps: {}, envKeys: [], swappedFrom: null, manualSteps: [] }
  }

  const {
    swappedFrom,
    removeDeps = [],
    addDeps,
    envKeys,
    requiredEnvKeys,
  } = vendor({
    projectDir,
    framework,
    projectName,
    cap,
    adapter,
    keep,
  })

  pkgRemoveDeps(pkg, removeDeps)
  pkgAddDeps(pkg, addDeps)
  writeJSON(pkgPath, pkg)
  appendEnv(projectDir, envKeys, requiredEnvKeys)
  rewriteAlias(projectDir, alias)
  const manualSteps = MANUAL_STEPS[cap]?.[framework] ?? []
  return { framework, projectName, addDeps, envKeys, swappedFrom, manualSteps }
}
