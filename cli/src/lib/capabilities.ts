import { readdirSync, statSync } from 'node:fs'
import { CAPABILITY_CATALOG } from '../../../packages/stack-config/src/index.ts'
import type { ModuleIntegration } from '../framework-module.ts'
import { isJsonObject, readJsonObject } from '../javascript/json.ts'
import { STACK_ROOT } from './paths.ts'
import { copy, exists, join, read, remove, write } from './util.ts'

type AdapterArg = readonly [name: string, envKey: string, required: boolean]

type PortSpec = {
  readonly label: string
  readonly dir: string
  readonly entry: string
  readonly portType: string
  readonly adapters: Readonly<
    Record<string, { readonly fn: string; readonly args: readonly AdapterArg[] }>
  >
}

type ModuleSpec = { readonly label: string; readonly dir: string }

type AdapterManifest = {
  readonly deps: readonly string[]
  readonly env: readonly string[]
  readonly files: readonly string[]
}

type PortManifest = {
  readonly kind: 'port'
  readonly defaultAdapter: string
  readonly adapters: Readonly<Record<string, AdapterManifest>>
  readonly sharedFiles: readonly string[]
  readonly sharedDeps: readonly string[]
  readonly versions: Readonly<Record<string, string>>
}

type ModuleManifest = {
  readonly kind: 'module'
  readonly deps: readonly string[]
  readonly env: readonly string[]
  readonly files: readonly string[]
  readonly versions: Readonly<Record<string, string>>
}

type CapabilityManifest = PortManifest | ModuleManifest

export type CapabilityVendoring = {
  readonly addDeps: Record<string, string>
  readonly envKeys: readonly string[]
  readonly requiredEnvKeys: readonly string[]
}

export type CapabilityChoice = {
  readonly value: string
  readonly label: string
  readonly hint: string
}

export type AdapterChoices = {
  readonly defaultAdapter: string
  readonly options: readonly { readonly value: string; readonly label: string }[]
}

const PKG = (cap: string): string => join(STACK_ROOT, 'packages', cap)

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const stringRecord = (value: unknown): Record<string, string> =>
  isJsonObject(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {}

const adapterManifest = (value: unknown): AdapterManifest => {
  const raw = isJsonObject(value) ? value : {}
  return { deps: strings(raw.deps), env: strings(raw.env), files: strings(raw.files) }
}

function parseManifest(path: string): CapabilityManifest {
  const raw = readJsonObject(path)
  const versions = stringRecord(raw.versions)
  if (raw.kind === 'module') {
    return {
      kind: 'module',
      deps: strings(raw.deps),
      env: strings(raw.env),
      files: strings(raw.files),
      versions,
    }
  }
  if (typeof raw.defaultAdapter !== 'string' || !isJsonObject(raw.adapters)) {
    throw new Error(`Invalid capability manifest: ${path}`)
  }
  return {
    kind: 'port',
    defaultAdapter: raw.defaultAdapter,
    adapters: Object.fromEntries(
      Object.entries(raw.adapters).map(([name, adapter]) => [name, adapterManifest(adapter)]),
    ),
    sharedFiles: strings(raw.sharedFiles),
    sharedDeps: strings(raw.sharedDeps),
    versions,
  }
}

const readManifest = (cap: string): CapabilityManifest =>
  parseManifest(join(PKG(cap), 'capability.json'))

function portManifest(cap: string): PortManifest {
  const manifest = readManifest(cap)
  if (manifest.kind !== 'port') throw new Error(`${cap} is not a port capability`)
  return manifest
}

function moduleManifest(cap: string): ModuleManifest {
  const manifest = readManifest(cap)
  if (manifest.kind !== 'module') throw new Error(`${cap} is not a module capability`)
  return manifest
}

const PORTS: Readonly<Record<string, PortSpec>> = {
  storage: {
    label: 'Storage',
    dir: 'src/server/storage',
    entry: 'storage',
    portType: 'StoragePort',
    adapters: {
      s3: {
        fn: 's3Adapter',
        args: [
          ['bucket', 'S3_BUCKET', true],
          ['region', 'S3_REGION', true],
          ['accessKeyId', 'AWS_ACCESS_KEY_ID', false],
          ['secretAccessKey', 'AWS_SECRET_ACCESS_KEY', false],
        ],
      },
      r2: {
        fn: 'r2Adapter',
        args: [
          ['bucket', 'R2_BUCKET', true],
          ['accountId', 'R2_ACCOUNT_ID', true],
          ['jurisdiction', 'R2_JURISDICTION', false],
          ['accessKeyId', 'R2_ACCESS_KEY_ID', false],
          ['secretAccessKey', 'R2_SECRET_ACCESS_KEY', false],
        ],
      },
      gcs: {
        fn: 'gcsAdapter',
        args: [
          ['bucket', 'GCS_BUCKET', true],
          ['projectId', 'GOOGLE_CLOUD_PROJECT', false],
        ],
      },
      local: { fn: 'localAdapter', args: [['baseDir', 'STORAGE_LOCAL_DIR', true]] },
    },
  },

  cache: {
    label: 'Cache',
    dir: 'src/server/cache',
    entry: 'cache',
    portType: 'CachePort',
    adapters: {
      redis: { fn: 'redisAdapter', args: [['url', 'REDIS_URL', false]] },
      upstash: {
        fn: 'upstashAdapter',
        args: [
          ['url', 'UPSTASH_REDIS_REST_URL', true],
          ['token', 'UPSTASH_REDIS_REST_TOKEN', true],
        ],
      },
      memory: { fn: 'memoryAdapter', args: [] },
    },
  },

  logger: {
    label: 'Logger',
    dir: 'src/server/logger',
    entry: 'logger',
    portType: 'Logger',
    adapters: {
      pino: { fn: 'pinoAdapter', args: [] },
      console: { fn: 'consoleAdapter', args: [] },
    },
  },

  analytics: {
    label: 'Analytics',
    dir: 'src/server/analytics',
    entry: 'analytics',
    portType: 'AnalyticsPort',
    adapters: {
      posthog: {
        fn: 'posthogAdapter',
        args: [
          ['apiKey', 'POSTHOG_API_KEY', true],
          ['host', 'POSTHOG_HOST', false],
        ],
      },
      plausible: {
        fn: 'plausibleAdapter',
        args: [
          ['domain', 'PLAUSIBLE_DOMAIN', true],
          ['apiHost', 'PLAUSIBLE_API_HOST', false],
        ],
      },
      noop: { fn: 'noopAdapter', args: [] },
    },
  },
}

const MODULES: Readonly<Record<string, ModuleSpec>> = {
  jobs: { label: 'Background jobs', dir: 'src/server/jobs' },
  'error-tracking': { label: 'Error tracking', dir: 'src/server/error-tracking' },
}

const SPEC: Readonly<Record<string, PortSpec | ModuleSpec>> = { ...PORTS, ...MODULES }

const capabilityFacts = (cap: string) => CAPABILITY_CATALOG.find(({ name }) => name === cap)

export const CAPABILITIES: readonly string[] = CAPABILITY_CATALOG.map(({ name }) => name)

export const canonicalCapabilityName = (cap: string): string =>
  capabilityFacts(cap)?.flags[0] ?? cap

function creationProvider(cap: string): string {
  const facts = capabilityFacts(cap)
  if (!facts) throw new Error(`Unknown capability: ${cap}`)
  return facts.recommendedProvider
}

export const hasAdapters = (cap: string): boolean => cap in PORTS

export const capabilityDir = (cap: string): string | undefined => SPEC[cap]?.dir

export const capabilityChoices = (): CapabilityChoice[] =>
  CAPABILITY_CATALOG.map(({ name, providers }) => ({
    value: name,
    label: SPEC[name]?.label ?? name,
    hint: providers.join(' / '),
  }))

export const adapterChoices = (cap: string): AdapterChoices | null => {
  const spec = PORTS[cap]
  if (!spec) return null
  return {
    defaultAdapter: portManifest(cap).defaultAdapter,
    options: Object.keys(spec.adapters).map((value) => ({ value, label: value })),
  }
}

export const creationProviderChoices = (cap: string): AdapterChoices | null => {
  const choices = adapterChoices(cap)
  return choices ? { ...choices, defaultAdapter: creationProvider(cap) } : null
}

export function resolveAdapter(cap: string, value: unknown): string | null {
  const spec = PORTS[cap]
  if (!spec) {
    const module = MODULES[cap]
    if (!module) throw new Error(`Unknown capability: ${cap}`)
    if (value && value !== true) {
      throw new Error(`${cap} has no adapter to choose: it always uses ${creationProvider(cap)}`)
    }
    return null
  }
  if (value === true || value == null || value === '') return portManifest(cap).defaultAdapter
  if (typeof value !== 'string' || !spec.adapters[value]) {
    throw new Error(
      `Unknown ${cap} adapter: ${value} (have ${Object.keys(spec.adapters).join(', ')})`,
    )
  }
  return value
}

export function resolveCreationProvider(cap: string, value: unknown): string | null {
  if (cap in PORTS) {
    if (value === true || value == null || value === '') return creationProvider(cap)
    return resolveAdapter(cap, value)
  }
  if (!MODULES[cap]) throw new Error(`Unknown capability: ${cap}`)
  const provider = creationProvider(cap)
  if (value === true || value == null || value === '' || value === provider) return provider
  throw new Error(`Unknown ${canonicalCapabilityName(cap)} provider: ${value} (have ${provider})`)
}

const ctorArgs = (args: readonly AdapterArg[]): string =>
  args.map(([name, key]) => `      ${name}: env.${key},`).join('\n')

function standardRoot({
  entry,
  portType,
  adapterKey,
  fn,
  args,
}: Pick<PortSpec, 'entry' | 'portType'> & {
  readonly adapterKey: string
  readonly fn: string
  readonly args: readonly AdapterArg[]
}): string {
  const getter = `get${entry.charAt(0).toUpperCase()}${entry.slice(1)}`
  const ctor = args.length ? `${fn}({\n${ctorArgs(args)}\n    })` : `${fn}()`
  const envImport = args.length ? "import { env } from '~/env'\n" : ''
  return `${envImport}import { ${fn} } from './adapters/${adapterKey}'
import type { ${portType} } from './port'

let instance: ${portType} | null = null
export function ${getter}(): ${portType} {
  if (!instance) {
    instance = ${ctor}
  }
  return instance
}
`
}

const slug = (name: string): string =>
  (name.split('/').pop() ?? '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'app'

const JOBS_INDEX = (projectName: string): string => `import { Inngest } from 'inngest'
import { env } from '~/env'

// Composition root. This is the real Inngest client: steps, cron, concurrency,
// fan-out and typed events are all available, nothing is hidden behind a port.
export const jobs = new Inngest({
  id: '${slug(projectName)}',
  ...(env.INNGEST_EVENT_KEY !== undefined && { eventKey: env.INNGEST_EVENT_KEY }),
  isDev: env.NODE_ENV === 'development',
})
`

const JOBS_EVENTS = `import { eventType, staticSchema } from 'inngest'

// Declare each event once; the schema is what types \`event.data\` in handlers
// and the payload in \`jobs.send()\`.
export const exampleEvent = eventType('app/example', {
  schema: staticSchema<{ id: string }>(),
})
`

const JOBS_FUNCTIONS = `import { exampleEvent } from './events'
import { jobs } from './index'

export const example = jobs.createFunction(
  { id: 'example', triggers: [{ event: exampleEvent }] },
  async ({ event, step }) => {
    // step.run makes each unit durable and independently retried.
    return step.run('handle', () => ({ handled: event.data.id }))
  },
)

// Every function to serve. Inngest syncs this list on PUT.
export const functions = [example]
`

function vendorJobs(destDir: string, projectName: string): void {
  write(join(destDir, 'index.ts'), JOBS_INDEX(projectName))
  write(join(destDir, 'events.ts'), JOBS_EVENTS)
  write(join(destDir, 'functions.ts'), JOBS_FUNCTIONS)
}

export const sentryInit = (sdk: string, extra = ''): string => `import * as Sentry from '${sdk}'
import { sentryOptions } from '~/server/error-tracking'

Sentry.init({
  ...sentryOptions({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT,
    nodeEnv: process.env.NODE_ENV,
  }),${extra}
})
`

function copyPath(cap: string, relSrc: string, destDir: string): void {
  copy(join(PKG(cap), relSrc), join(destDir, relSrc.replace(/^src\//, '')))
}

function references(dir: string, mod: string): boolean {
  for (const name of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const p = join(dir, name)
    if (statSync(p).isFile() && /\.tsx?$/.test(p) && read(p).includes(mod)) return true
  }
  return false
}

function walkTs(dir: string, fn: (path: string, source: string) => void): void {
  for (const name of readdirSync(dir, { recursive: true, encoding: 'utf8' })) {
    const p = join(dir, name)
    if (statSync(p).isFile() && /\.tsx?$/.test(p)) fn(p, read(p))
  }
}

function rewriteImports(dir: string, from: string, to: string): void {
  walkTs(dir, (p, src) => {
    if (src.includes(from)) write(p, src.split(from).join(to))
  })
}

const JS_EXT = /(from\s+['"]\.\.?\/[^'"]*?)\.js(['"])/g

export function stripJsExtensions(dir: string): void {
  walkTs(dir, (p, src) => {
    const next = src.replace(JS_EXT, '$1$2')
    if (next !== src) write(p, next)
  })
}

function vendorHttp(projectDir: string, destDir: string): void {
  if (!references(destDir, '@alfredmouelle/http')) return
  const httpDest = join(projectDir, 'src/lib/http')
  if (!exists(httpDest)) {
    copy(join(STACK_ROOT, 'packages/http/src'), httpDest)
    stripJsExtensions(httpDest)
  }
  rewriteImports(destDir, '@alfredmouelle/http', '~/lib/http')
}

const declaredVersion = (field: unknown, name: string): string | undefined => {
  const version = isJsonObject(field) ? field[name] : undefined
  return typeof version === 'string' ? version : undefined
}

function resolveDeps(
  cap: string,
  names: readonly string[],
  manifest: CapabilityManifest,
): Record<string, string> {
  const pkg = readJsonObject(join(PKG(cap), 'package.json'))
  const out: Record<string, string> = {}
  for (const d of names) {
    if (d.startsWith('@alfredmouelle/')) continue
    const version =
      manifest.versions[d] ??
      declaredVersion(pkg.dependencies, d) ??
      declaredVersion(pkg.peerDependencies, d)
    if (!version) throw new Error(`Undeclared version for ${d} in capability ${cap}`)
    out[d] = version
  }
  return out
}

function vendorModule({
  projectDir,
  destDir,
  projectName,
  cap,
  manifest,
  integration,
}: {
  readonly projectDir: string
  readonly destDir: string
  readonly projectName: string
  readonly cap: string
  readonly manifest: ModuleManifest
  readonly integration: ModuleIntegration
}): CapabilityVendoring {
  for (const f of manifest.files) copyPath(cap, f, destDir)
  stripJsExtensions(destDir)
  if (cap === 'jobs') vendorJobs(destDir, projectName)
  for (const [path, source] of Object.entries(integration.files)) {
    write(join(projectDir, path), source)
  }
  vendorHttp(projectDir, destDir)

  return {
    addDeps: { ...resolveDeps(cap, manifest.deps, manifest), ...integration.dependencies },
    envKeys: manifest.env,
    requiredEnvKeys: [],
  }
}

function vendorPort({
  projectDir,
  destDir,
  cap,
  adapter,
  spec,
  manifest,
}: {
  readonly projectDir: string
  readonly destDir: string
  readonly cap: string
  readonly adapter: string | null
  readonly spec: PortSpec
  readonly manifest: PortManifest
}): CapabilityVendoring {
  const aSpec = adapter === null ? undefined : spec.adapters[adapter]
  const adManifest = adapter === null ? undefined : manifest.adapters[adapter]
  if (adapter === null || !aSpec || !adManifest)
    throw new Error(`Unknown ${cap} adapter: ${adapter}`)

  const files = [...manifest.sharedFiles.filter((f) => f !== 'src/index.ts'), ...adManifest.files]
  for (const f of files) copyPath(cap, f, destDir)
  stripJsExtensions(destDir)

  write(
    join(destDir, 'index.ts'),
    standardRoot({ ...spec, adapterKey: adapter, fn: aSpec.fn, args: aSpec.args }),
  )
  vendorHttp(projectDir, destDir)

  return {
    addDeps: resolveDeps(cap, [...adManifest.deps, ...manifest.sharedDeps], manifest),
    envKeys: adManifest.env,
    requiredEnvKeys: aSpec.args.filter(([, , req]) => req).map(([, key]) => key),
  }
}

export function vendorCapability({
  projectDir,
  projectName,
  cap,
  adapter,
  keep,
  integration,
}: {
  readonly projectDir: string
  readonly projectName: string
  readonly cap: string
  readonly adapter: string | null
  readonly keep: boolean
  readonly integration: ModuleIntegration | undefined
}): CapabilityVendoring {
  const spec = SPEC[cap]
  if (!spec) throw new Error(`Unknown capability: ${cap}`)

  const manifest = readManifest(cap)
  const destDir = join(projectDir, spec.dir)

  if (manifest.kind === 'module') {
    if (!integration) throw new Error(`No framework integration declared for ${cap}`)
    return vendorModule({ projectDir, destDir, projectName, cap, manifest, integration })
  }

  if (!('adapters' in spec)) throw new Error(`Unknown ${cap} adapter: ${adapter}`)
  if (!keep) {
    for (const [provider, part] of Object.entries(manifest.adapters)) {
      if (provider === adapter) continue
      for (const file of part.files) remove(join(destDir, file.replace(/^src\//, '')))
    }
  }
  return vendorPort({ projectDir, destDir, cap, adapter, spec, manifest })
}

export function currentAdapter(projectDir: string, cap: string): string | null {
  const port = PORTS[cap]
  if (!port) return null
  const indexPath = join(projectDir, port.dir, 'index.ts')
  if (!exists(indexPath)) return null
  return read(indexPath).match(/\.\/adapters\/([\w-]+)['"]/)?.[1] ?? null
}

export function installedAdapters(projectDir: string, cap: string): string[] {
  const port = PORTS[cap]
  if (!port) return []
  const adaptersDir = join(projectDir, port.dir, 'adapters')
  if (!exists(adaptersDir)) return []
  return readdirSync(adaptersDir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => name.slice(0, -3))
}

export function adapterRemovableDeps(
  cap: string,
  installed: readonly string[],
  to: string | null,
): string[] {
  const manifest = portManifest(cap)
  const target = to === null ? undefined : manifest.adapters[to]
  const stay = new Set([...(target?.deps ?? []), ...manifest.sharedDeps])
  return [
    ...new Set(
      installed.flatMap((adapter) =>
        (manifest.adapters[adapter]?.deps ?? []).filter(
          (dependency) => !stay.has(dependency) && !dependency.startsWith('@alfredmouelle/'),
        ),
      ),
    ),
  ]
}

export function vendorPackageSrc(pkgName: string, destDir: string): void {
  const manifest = moduleManifest(pkgName)
  for (const f of manifest.files) copyPath(pkgName, f, destDir)
  stripJsExtensions(destDir)
}
