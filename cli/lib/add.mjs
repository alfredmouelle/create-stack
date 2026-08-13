// `create-stack add` — vendor a capability into an existing project, merging dep/env
// deltas incrementally (same engine as the scaffold). On a multi-provider capability a
// re-add changes the provider; keep-files retains the former provider files and deps.

import { detectAlias, rewriteAlias } from './alias.mjs'
import {
  adapterChoices,
  adapterRemovableDeps,
  CAPABILITIES,
  capabilityChoices,
  capabilityDir,
  currentAdapter,
  hasAdapters,
  installedAdapters,
  MANUAL_STEPS,
  resolveAdapter,
  vendorCapability,
  vendorPackageSrc,
} from './capabilities.mjs'
import { appendEnv } from './env.mjs'
import { vendorMailer } from './mailer.mjs'
import { exists, join, pkgAddDeps, pkgRemoveDeps, read, readJSON, writeJSON } from './util.mjs'

const MAILER_ADAPTERS = ['resend', 'brevo', 'ses']
const UNIQUE_PROVIDERS = { jobs: 'inngest', 'error-tracking': 'sentry' }
const RECOMMENDED_PROVIDERS = { storage: 'r2', cache: 'upstash' }

const CANONICAL_NAMES = { mailer: 'mail', 'error-tracking': 'errors' }
const INTERNAL_NAMES = { mail: 'mailer', errors: 'error-tracking' }

// Targets beyond the 6 port capabilities, with their vendored destination.
const EXTRA_DIR = {
  mailer: 'src/server/email',
  'email-ui': 'src/emails/components',
  http: 'src/lib/http',
}
const NO_ADAPTER = new Set(['email-ui', 'http']) // single implementation, nothing to pick

/** Everything the capability form of `add` accepts, using user-facing canonical names. */
export const ADDABLE = [
  ...CAPABILITIES.map((cap) => CANONICAL_NAMES[cap] ?? cap),
  'mail',
  'email-ui',
  'http',
]

/** Normalize accepted historical aliases while keeping package-level names internal. */
export const resolveAdditionKind = (kind) => {
  const internal = INTERNAL_NAMES[kind] ?? kind
  const canonical = CANONICAL_NAMES[internal] ?? internal
  const accepted = [...CAPABILITIES, 'mailer', 'email-ui', 'http']
  return accepted.includes(internal) ? { cap: internal, name: canonical } : null
}

/** Vendored destination dir (relative to the project) for a target. */
export const targetDir = (cap) => EXTRA_DIR[cap] ?? capabilityDir(cap) ?? `src/server/${cap}`

/** Options for the interactive `add` multi-select. */
export const addableChoices = () => [
  ...capabilityChoices().map((choice) => ({
    ...choice,
    value: CANONICAL_NAMES[choice.value] ?? choice.value,
  })),
  { value: 'mail', label: 'Mail', hint: MAILER_ADAPTERS.join(' / ') },
  { value: 'email-ui', label: 'Email UI', hint: 'React Email primitives' },
  { value: 'http', label: 'HTTP', hint: 'fetch + response helpers' },
]

/** Adapter picker (default + options) for a target, or null when it has no adapters. */
export function adapterChoicesFor(cap) {
  cap = INTERNAL_NAMES[cap] ?? cap
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
  cap = INTERNAL_NAMES[cap] ?? cap
  const uniqueProvider = UNIQUE_PROVIDERS[cap]
  if (uniqueProvider) return resolveUniqueProvider(cap, value, uniqueProvider)
  if (CAPABILITIES.includes(cap)) {
    const recommended = RECOMMENDED_PROVIDERS[cap]
    return resolveAdapter(
      cap,
      value == null || value === true || value === '' ? recommended : value,
    )
  }
  if (cap === 'mailer') return resolveMailProvider(value)
  if (NO_ADAPTER.has(cap) && value !== true && value != null && value !== '') {
    throw new Error(`${cap} has no provider to choose`)
  }
  return null
}

function resolveUniqueProvider(cap, value, provider) {
  if (value != null && value !== true && value !== '' && value !== provider) {
    throw new Error(`${CANONICAL_NAMES[cap] ?? cap} only supports ${provider}`)
  }
  return provider
}

function resolveMailProvider(value) {
  if (value === true || value == null || value === '') return 'resend'
  if (!MAILER_ADAPTERS.includes(value)) {
    throw new Error(`Unknown mail provider: ${value} (have ${MAILER_ADAPTERS.join(', ')})`)
  }
  return value
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

/** Provider currently selected by a swappable capability, or null when absent/inapplicable. */
export const currentTargetAdapter = (projectDir, cap) =>
  cap === 'mailer' ? currentMailerAdapter(projectDir) : currentAdapter(projectDir, cap)

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
    removeDeps:
      hasAdapters(cap) && !keep
        ? adapterRemovableDeps(cap, installedAdapters(projectDir, cap), adapter)
        : [],
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

  // email-ui / http: just vendor the source, no deps or env.
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
