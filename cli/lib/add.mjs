import { detectAlias, rewriteAlias } from './alias.mjs'
import {
  adapterChoices,
  CAPABILITIES,
  capabilityChoices,
  capabilityDir,
  currentAdapter,
  resolveAdapter,
} from './capabilities.mjs'
import { detectFrameworkModule, frameworkModules, wireCapabilityAddition } from './engine.mjs'
import { appendEnv } from './env.mjs'
import { currentMailerAdapter, MAILER_ADAPTERS } from './mailer.mjs'
import { FRAMEWORK_SUPPORT } from './stack-config.mjs'
import { join, pkgAddDeps, pkgRemoveDeps, readJSON, writeJSON } from './util.mjs'

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

export function requireFrameworkModule(projectDir) {
  const module = detectFrameworkModule(projectDir)
  if (module) return module
  const frameworks = frameworkModules.map(({ id }) => FRAMEWORK_SUPPORT[id].label).join(', ')
  throw new Error(`Could not detect a registered framework (${frameworks}) in ${projectDir}`)
}

export const currentTargetAdapter = (projectDir, cap) =>
  cap === 'mailer' ? currentMailerAdapter(projectDir) : currentAdapter(projectDir, cap)

export function addCapability({ projectDir, cap, adapter, keep }) {
  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  const module = requireFrameworkModule(projectDir)
  const framework = module.id
  const projectName = pkg.name ?? 'app'
  const alias = detectAlias(projectDir)

  const {
    swappedFrom,
    removeDeps = [],
    addDeps,
    envKeys,
    requiredEnvKeys,
    manualSteps,
  } = wireCapabilityAddition(module, {
    projectDir,
    projectName,
    cap,
    adapter,
    keep: !!keep,
  })

  pkgRemoveDeps(pkg, removeDeps)
  pkgAddDeps(pkg, addDeps)
  writeJSON(pkgPath, pkg)
  appendEnv(projectDir, envKeys, requiredEnvKeys)
  rewriteAlias(projectDir, alias)
  return { framework, projectName, addDeps, envKeys, swappedFrom, manualSteps }
}
