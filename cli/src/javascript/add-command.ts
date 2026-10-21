import { join } from 'node:path'
import {
  adapterChoices,
  CAPABILITIES,
  capabilityChoices,
  capabilityDir,
  currentAdapter,
  resolveAdapter,
} from '#lib/capabilities.ts'
import { appendEnv } from '#lib/env.ts'
import { pkgAddDeps, pkgRemoveDeps } from '#lib/util.ts'
import { wireCapabilityAddition } from '../additions.ts'
import { requireFrameworkModule } from '../framework-registry.ts'
import { detectAlias, rewriteAlias } from './import-alias.ts'
import { readJsonObject, writeJsonObject } from './json.ts'
import { currentMailerAdapter, MAILER_ADAPTERS } from './mailer.ts'

type RequestedProvider = string | true | null | undefined

type AdapterChoices = {
  readonly defaultAdapter: string
  readonly options: readonly { readonly value: string; readonly label: string }[]
}

const UNIQUE_PROVIDERS: Readonly<Record<string, string>> = {
  jobs: 'inngest',
  'error-tracking': 'sentry',
}
const RECOMMENDED_PROVIDERS: Readonly<Record<string, string>> = { storage: 'r2', cache: 'upstash' }

const CANONICAL_NAMES: Readonly<Record<string, string>> = {
  mailer: 'mail',
  'error-tracking': 'errors',
}
const INTERNAL_NAMES: Readonly<Record<string, string>> = {
  mail: 'mailer',
  errors: 'error-tracking',
}

const EXTRA_DIR: Readonly<Record<string, string>> = {
  mailer: 'src/server/email',
  'email-ui': 'src/emails/components',
  http: 'src/lib/http',
}
const NO_ADAPTER = new Set(['email-ui', 'http'])

const internalName = (cap: string): string => INTERNAL_NAMES[cap] ?? cap
const canonicalName = (cap: string): string => CANONICAL_NAMES[cap] ?? cap
const isUnset = (value: RequestedProvider): value is true | null | undefined | '' =>
  value === true || value == null || value === ''

export const ADDABLE: readonly string[] = [
  ...CAPABILITIES.map(canonicalName),
  'mail',
  'email-ui',
  'http',
]

export function resolveAdditionKind(kind: string): { cap: string; name: string } | null {
  const internal = internalName(kind)
  const accepted = [...CAPABILITIES, 'mailer', 'email-ui', 'http']
  return accepted.includes(internal) ? { cap: internal, name: canonicalName(internal) } : null
}

export const targetDir = (cap: string): string =>
  EXTRA_DIR[cap] ?? capabilityDir(cap) ?? `src/server/${cap}`

export const addableChoices = () => [
  ...capabilityChoices().map((choice) => ({ ...choice, value: canonicalName(choice.value) })),
  { value: 'mail', label: 'Mail', hint: MAILER_ADAPTERS.join(' / ') },
  { value: 'email-ui', label: 'Email UI', hint: 'React Email primitives' },
  { value: 'http', label: 'HTTP', hint: 'fetch + response helpers' },
]

export function adapterChoicesFor(requested: string): AdapterChoices | null {
  const cap = internalName(requested)
  if (CAPABILITIES.includes(cap)) return adapterChoices(cap)
  if (cap === 'mailer') {
    return {
      defaultAdapter: 'resend',
      options: MAILER_ADAPTERS.map((value) => ({ value, label: value })),
    }
  }
  return null
}

function resolveUniqueProvider(cap: string, value: RequestedProvider, provider: string): string {
  if (!isUnset(value) && value !== provider) {
    throw new Error(`${canonicalName(cap)} only supports ${provider}`)
  }
  return provider
}

function resolveMailProvider(value: RequestedProvider): string {
  if (isUnset(value)) return 'resend'
  if (!MAILER_ADAPTERS.some((provider) => provider === value)) {
    throw new Error(`Unknown mail provider: ${value} (have ${MAILER_ADAPTERS.join(', ')})`)
  }
  return value
}

export function resolveTargetAdapter(requested: string, value: RequestedProvider): string | null {
  const cap = internalName(requested)
  const uniqueProvider = UNIQUE_PROVIDERS[cap]
  if (uniqueProvider) return resolveUniqueProvider(cap, value, uniqueProvider)
  if (CAPABILITIES.includes(cap))
    return resolveAdapter(cap, isUnset(value) ? RECOMMENDED_PROVIDERS[cap] : value)
  if (cap === 'mailer') return resolveMailProvider(value)
  if (NO_ADAPTER.has(cap) && !isUnset(value)) throw new Error(`${cap} has no provider to choose`)
  return null
}

export const currentTargetAdapter = (projectDir: string, cap: string): string | null =>
  cap === 'mailer' ? currentMailerAdapter(projectDir) : currentAdapter(projectDir, cap)

export function addCapability({
  projectDir,
  cap,
  adapter,
  keep,
}: {
  readonly projectDir: string
  readonly cap: string
  readonly adapter: string | null
  readonly keep: boolean
}) {
  const manifestPath = join(projectDir, 'package.json')
  const manifest = readJsonObject(manifestPath)
  const module = requireFrameworkModule(projectDir)
  const projectName = typeof manifest.name === 'string' ? manifest.name : 'app'
  const alias = detectAlias(projectDir)

  const { swappedFrom, removeDeps, addDeps, envKeys, requiredEnvKeys, manualSteps } =
    wireCapabilityAddition(module, { projectDir, projectName, cap, adapter, keep })

  pkgRemoveDeps(manifest, removeDeps)
  pkgAddDeps(manifest, addDeps)
  writeJsonObject(manifestPath, manifest)
  appendEnv(projectDir, envKeys, requiredEnvKeys)
  rewriteAlias(projectDir, alias)
  return { framework: module.id, projectName, addDeps, envKeys, swappedFrom, manualSteps }
}
