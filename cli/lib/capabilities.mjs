import { readdirSync, statSync } from 'node:fs'
import { STACK_ROOT } from './paths.mjs'
import { copy, exists, join, read, readJSON, remove, write } from './util.mjs'

const PKG = (cap) => join(STACK_ROOT, 'packages', cap)

const PORTS = {
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

const MODULES = {
  jobs: { label: 'Background jobs', dir: 'src/server/jobs', provider: 'inngest' },
  'error-tracking': {
    label: 'Error tracking',
    dir: 'src/server/error-tracking',
    provider: 'sentry',
  },
}

const SPEC = { ...PORTS, ...MODULES }

export const CAPABILITIES = Object.keys(SPEC)

export const canonicalCapabilityName = (cap) => (cap === 'error-tracking' ? 'errors' : cap)

const capabilityManifest = (cap) => readJSON(join(PKG(cap), 'capability.json'))

const creationProvider = (cap) => {
  if (cap in MODULES) return MODULES[cap].provider
  const manifest = capabilityManifest(cap)
  return manifest.creationRecommendedProvider ?? manifest.defaultAdapter
}

export const hasAdapters = (cap) => cap in PORTS

export const capabilityDir = (cap) => SPEC[cap]?.dir

export const capabilityChoices = () =>
  CAPABILITIES.map((name) => ({
    value: name,
    label: SPEC[name].label,
    hint: SPEC[name].adapters ? Object.keys(SPEC[name].adapters).join(' / ') : SPEC[name].provider,
  }))

export const adapterChoices = (cap) => {
  const spec = PORTS[cap]
  if (!spec) return null
  return {
    defaultAdapter: capabilityManifest(cap).defaultAdapter,
    options: Object.keys(spec.adapters).map((value) => ({ value, label: value })),
  }
}

export const creationProviderChoices = (cap) => {
  const choices = adapterChoices(cap)
  return choices ? { ...choices, defaultAdapter: creationProvider(cap) } : null
}

export function resolveAdapter(cap, value) {
  if (!SPEC[cap]) throw new Error(`Unknown capability: ${cap}`)
  const spec = PORTS[cap]
  if (!spec) {
    if (value && value !== true) {
      throw new Error(`${cap} has no adapter to choose: it always uses ${MODULES[cap].provider}`)
    }
    return null
  }
  if (value === true || value == null || value === '') return capabilityManifest(cap).defaultAdapter
  if (!spec.adapters[value]) {
    throw new Error(
      `Unknown ${cap} adapter: ${value} (have ${Object.keys(spec.adapters).join(', ')})`,
    )
  }
  return value
}

export function resolveCreationProvider(cap, value) {
  if (cap in PORTS) {
    if (value === true || value == null || value === '') return creationProvider(cap)
    return resolveAdapter(cap, value)
  }
  if (!MODULES[cap]) throw new Error(`Unknown capability: ${cap}`)
  const provider = creationProvider(cap)
  if (value === true || value == null || value === '' || value === provider) return provider
  throw new Error(`Unknown ${canonicalCapabilityName(cap)} provider: ${value} (have ${provider})`)
}

const ctorArgs = (args) => args.map(([name, key]) => `      ${name}: env.${key},`).join('\n')

function standardRoot({ entry, portType, adapterKey, fn, args }) {
  const getter = `get${entry[0].toUpperCase()}${entry.slice(1)}`
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

const slug = (name) =>
  name
    .split('/')
    .pop()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'app'

const JOBS_INDEX = (projectName) => `import { Inngest } from 'inngest'
import { env } from '~/env'

// Composition root. This is the real Inngest client: steps, cron, concurrency,
// fan-out and typed events are all available, nothing is hidden behind a port.
export const jobs = new Inngest({
  id: '${slug(projectName)}',
  eventKey: env.INNGEST_EVENT_KEY,
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

const NEXT_INNGEST_ROUTE = `import { jobs } from '~/server/jobs'
import { functions } from '~/server/jobs/functions'
import { jobsHandler } from '~/server/jobs/serve'

const handler = jobsHandler({ client: jobs, functions })

export { handler as GET, handler as POST, handler as PUT }
`

const TANSTACK_INNGEST_ROUTE = `import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { jobs } from '~/server/jobs'
import { functions } from '~/server/jobs/functions'
import { jobsHandler } from '~/server/jobs/serve'

const handler = jobsHandler({ client: jobs, functions })

export const Route = createFileRoute('/api/inngest')({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
      PUT: ({ request }) => handler(request),
    },
  },
})
`

const JOBS_ROUTE_FILES = ['src/app/api/inngest/route.ts', 'src/routes/api/inngest.ts']

function vendorJobs(projectDir, destDir, framework, projectName) {
  write(join(destDir, 'index.ts'), JOBS_INDEX(projectName))
  write(join(destDir, 'events.ts'), JOBS_EVENTS)
  write(join(destDir, 'functions.ts'), JOBS_FUNCTIONS)
  const [next, tanstack] = JOBS_ROUTE_FILES
  write(
    join(projectDir, framework === 'next' ? next : tanstack),
    framework === 'next' ? NEXT_INNGEST_ROUTE : TANSTACK_INNGEST_ROUTE,
  )
}

const SENTRY_SDK = { next: '@sentry/nextjs', tanstack: '@sentry/tanstackstart-react' }

const sentryInit = (sdk, extra = '') => `import * as Sentry from '${sdk}'
import { sentryOptions } from '~/server/error-tracking'

Sentry.init({
  ...sentryOptions({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT,
    nodeEnv: process.env.NODE_ENV,
  }),${extra}
})
`

const NEXT_INSTRUMENTATION = `import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') await import('../sentry.server.config')
  if (process.env.NEXT_RUNTIME === 'edge') await import('../sentry.edge.config')
}

// Server Components, middleware and proxies: Next swallows these, so nothing but
// this hook ever sees them.
export const onRequestError = Sentry.captureRequestError
`

const NEXT_GLOBAL_ERROR = `'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

// Last resort for render errors that escape every other boundary.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <h1>Something went wrong</h1>
      </body>
    </html>
  )
}
`

const TANSTACK_INSTRUMENT_SERVER = `import * as Sentry from '@sentry/tanstackstart-react'

// Loaded via NODE_OPTIONS='--import ./instrument.server.mjs' so it runs before the
// app, which is what makes auto-instrumentation work.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1 : 0.1,
  enableLogs: true,
})
`

function vendorErrorTracking(projectDir, framework) {
  const sdk = SENTRY_SDK[framework]
  if (framework === 'next') {
    write(join(projectDir, 'sentry.server.config.ts'), sentryInit(sdk))
    write(join(projectDir, 'sentry.edge.config.ts'), sentryInit(sdk))
    write(
      join(projectDir, 'src/instrumentation-client.ts'),
      `${sentryInit(sdk)}
// Instruments client-side router navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
`,
    )
    write(join(projectDir, 'src/instrumentation.ts'), NEXT_INSTRUMENTATION)
    write(join(projectDir, 'src/app/global-error.tsx'), NEXT_GLOBAL_ERROR)
    return
  }
  write(join(projectDir, 'instrument.server.mjs'), TANSTACK_INSTRUMENT_SERVER)
  write(
    join(projectDir, 'src/instrument.client.tsx'),
    sentryInit(sdk, '\n  integrations: [Sentry.replayIntegration()],'),
  )
}

export const MANUAL_STEPS = {
  'error-tracking': {
    next: [
      'Wrap next.config.ts with `withSentryConfig` from @sentry/nextjs (source maps).',
      'Set SENTRY_AUTH_TOKEN in CI for source-map upload.',
    ],
    tanstack: [
      'Add `sentryTanstackStart()` as the LAST plugin in vite.config.ts.',
      'Import `./instrument.client` as the first import in src/client.tsx.',
      'Wrap the fetch handler in src/server.ts with `wrapFetchWithSentry`.',
      'Add `sentryGlobalRequestMiddleware` / `sentryGlobalFunctionMiddleware` in src/start.ts.',
      "Run the server with NODE_OPTIONS='--import ./instrument.server.mjs'.",
    ],
  },
}

function copyPath(cap, relSrc, destDir) {
  copy(join(PKG(cap), relSrc), join(destDir, relSrc.replace(/^src\//, '')))
}

function references(dir, mod) {
  for (const name of readdirSync(dir, { recursive: true })) {
    const p = join(dir, name)
    if (statSync(p).isFile() && /\.tsx?$/.test(p) && read(p).includes(mod)) return true
  }
  return false
}

function walkTs(dir, fn) {
  for (const name of readdirSync(dir, { recursive: true })) {
    const p = join(dir, name)
    if (statSync(p).isFile() && /\.tsx?$/.test(p)) fn(p, read(p))
  }
}

function rewriteImports(dir, from, to) {
  walkTs(dir, (p, src) => {
    if (src.includes(from)) write(p, src.split(from).join(to))
  })
}

const JS_EXT = /(from\s+['"]\.\.?\/[^'"]*?)\.js(['"])/g

function stripJsExtensions(dir) {
  walkTs(dir, (p, src) => {
    const next = src.replace(JS_EXT, '$1$2')
    if (next !== src) write(p, next)
  })
}

function vendorHttp(projectDir, destDir) {
  if (!references(destDir, '@alfredmouelle/http')) return
  const httpDest = join(projectDir, 'src/lib/http')
  if (!exists(httpDest)) {
    copy(join(STACK_ROOT, 'packages/http/src'), httpDest)
    stripJsExtensions(httpDest)
  }
  rewriteImports(destDir, '@alfredmouelle/http', '~/lib/http')
}

function resolveDeps(cap, names, manifest) {
  const pkg = readJSON(join(PKG(cap), 'package.json'))
  const out = {}
  for (const d of names) {
    if (d.startsWith('@alfredmouelle/')) continue
    out[d] =
      manifest?.versions?.[d] ?? pkg.dependencies?.[d] ?? pkg.peerDependencies?.[d] ?? 'latest'
  }
  return out
}

const MODULE_EXTRA_FILES = {
  jobs: JOBS_ROUTE_FILES,
  'error-tracking': [
    'sentry.server.config.ts',
    'sentry.edge.config.ts',
    'src/instrumentation.ts',
    'src/instrumentation-client.ts',
    'src/app/global-error.tsx',
    'instrument.server.mjs',
    'src/instrument.client.tsx',
  ],
}

const MODULE_WIRING = {
  jobs: ({ projectDir, destDir, framework, projectName }) =>
    vendorJobs(projectDir, destDir, framework, projectName),
  'error-tracking': ({ projectDir, framework }) => vendorErrorTracking(projectDir, framework),
}

function vendorModule({ projectDir, destDir, framework, projectName, cap, manifest }) {
  for (const f of manifest.files) copyPath(cap, f, destDir)
  stripJsExtensions(destDir)
  MODULE_WIRING[cap]?.({ projectDir, destDir, framework, projectName })
  vendorHttp(projectDir, destDir)

  const perFramework = manifest.frameworks?.[framework] ?? {}
  return {
    addDeps: resolveDeps(cap, [...(manifest.deps ?? []), ...(perFramework.deps ?? [])], manifest),
    envKeys: [...(manifest.env ?? []), ...(perFramework.env ?? [])],
    requiredEnvKeys: [],
  }
}

function vendorPort({ projectDir, destDir, cap, adapter, spec, manifest }) {
  const aSpec = spec.adapters[adapter]
  if (!aSpec) throw new Error(`Unknown ${cap} adapter: ${adapter}`)
  const adManifest = manifest.adapters[adapter]

  const files = [...manifest.sharedFiles.filter((f) => f !== 'src/index.ts'), ...adManifest.files]
  for (const f of files) copyPath(cap, f, destDir)
  stripJsExtensions(destDir)

  write(
    join(destDir, 'index.ts'),
    standardRoot({ ...spec, adapterKey: adapter, fn: aSpec.fn, args: aSpec.args }),
  )
  vendorHttp(projectDir, destDir)

  return {
    addDeps: resolveDeps(cap, [...adManifest.deps, ...(manifest.sharedDeps ?? [])], manifest),
    envKeys: adManifest.env,
    requiredEnvKeys: (aSpec.args ?? []).filter(([, , req]) => req).map(([, key]) => key),
  }
}

export function vendorCapability({ projectDir, framework, projectName, cap, adapter, keep }) {
  const spec = SPEC[cap]
  if (!spec) throw new Error(`Unknown capability: ${cap}`)

  const manifest = readJSON(join(PKG(cap), 'capability.json'))
  const destDir = join(projectDir, spec.dir)

  if (!keep) {
    remove(destDir)
    for (const f of MODULE_EXTRA_FILES[cap] ?? []) remove(join(projectDir, f))
  }

  const args = { projectDir, destDir, framework, projectName, cap, adapter, spec, manifest }
  return manifest.kind === 'module' ? vendorModule(args) : vendorPort(args)
}

export function currentAdapter(projectDir, cap) {
  if (!hasAdapters(cap)) return null
  const indexPath = join(projectDir, PORTS[cap].dir, 'index.ts')
  if (!exists(indexPath)) return null
  return read(indexPath).match(/\.\/adapters\/([\w-]+)['"]/)?.[1] ?? null
}

export function installedAdapters(projectDir, cap) {
  if (!hasAdapters(cap)) return []
  const adaptersDir = join(projectDir, PORTS[cap].dir, 'adapters')
  if (!exists(adaptersDir)) return []
  return readdirSync(adaptersDir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => name.slice(0, -3))
}

export function adapterRemovableDeps(cap, installed, to) {
  const manifest = readJSON(join(PKG(cap), 'capability.json'))
  const stay = new Set([...(manifest.adapters[to]?.deps ?? []), ...(manifest.sharedDeps ?? [])])
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

export function vendorPackageSrc(pkgName, destDir) {
  remove(destDir)
  const manifest = readJSON(join(PKG(pkgName), 'capability.json'))
  for (const f of manifest.files) copyPath(pkgName, f, destDir)
  stripJsExtensions(destDir)
}
