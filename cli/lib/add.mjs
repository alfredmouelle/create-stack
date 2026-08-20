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

const EXTRA_DIR = {
  mailer: 'src/server/email',
  'email-ui': 'src/emails/components',
  http: 'src/lib/http',
}
const NO_ADAPTER = new Set(['email-ui', 'http'])

export const ADDABLE = [
  ...CAPABILITIES.map((cap) => CANONICAL_NAMES[cap] ?? cap),
  'mail',
  'email-ui',
  'http',
]

export const resolveAdditionKind = (kind) => {
  const internal = INTERNAL_NAMES[kind] ?? kind
  const canonical = CANONICAL_NAMES[internal] ?? internal
  const accepted = [...CAPABILITIES, 'mailer', 'email-ui', 'http']
  return accepted.includes(internal) ? { cap: internal, name: canonical } : null
}

export const targetDir = (cap) => EXTRA_DIR[cap] ?? capabilityDir(cap) ?? `src/server/${cap}`

export const addableChoices = () => [
  ...capabilityChoices().map((choice) => ({
    ...choice,
    value: CANONICAL_NAMES[choice.value] ?? choice.value,
  })),
  { value: 'mail', label: 'Mail', hint: MAILER_ADAPTERS.join(' / ') },
  { value: 'email-ui', label: 'Email UI', hint: 'React Email primitives' },
  { value: 'http', label: 'HTTP', hint: 'fetch + response helpers' },
]

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

export const currentTargetAdapter = (projectDir, cap) =>
  cap === 'mailer' ? currentMailerAdapter(projectDir) : currentAdapter(projectDir, cap)

function vendor({ projectDir, framework, projectName, cap, adapter, keep }) {
  if (cap === 'mailer') {
    const from = currentMailerAdapter(projectDir)
    return {
      swappedFrom: from && from !== adapter ? from : null,
      ...vendorMailer(projectDir, framework, adapter, keep),
    }
  }

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

export function addCapability({ projectDir, cap, adapter, keep }) {
  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  const framework = detectFramework(pkg)
  const projectName = pkg.name ?? 'app'
  const alias = detectAlias(projectDir)

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
