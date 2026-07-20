// Capabilities come in two kinds, and `kind` in capability.json is the source of truth.
//
// A PORT has several adapters and is swappable at the composition root: pick one, the
// rest of the app depends only on the interface. This registry adds what the manifest
// can't carry — the env → constructor-arg mapping used to generate that root.
//
// A MODULE has a single provider used directly, because abstracting it would cost more
// than it buys (jobs, error-tracking) or because there is no provider at all (http,
// email-kit). Modules are vendored as-is plus whatever wiring the framework needs.

import { readdirSync, statSync } from 'node:fs'
import { STACK_ROOT } from './paths.mjs'
import { copy, exists, join, read, readJSON, remove, write } from './util.mjs'

const PKG = (cap) => join(STACK_ROOT, 'packages', cap)

/**
 * Swappable capabilities. `dir` = vendored destination, `entry` = exported accessor
 * stem, `portType` = the interface returned. Each adapter maps constructor args to
 * env keys: [argName, ENV_KEY, required?]. A required arg is emitted as required in
 * env.ts, so the root reads env.X directly (guaranteed string).
 */
const PORTS = {
  storage: {
    label: 'Storage',
    dir: 'src/server/storage',
    entry: 'storage',
    portType: 'StoragePort',
    defaultAdapter: 's3',
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
    defaultAdapter: 'redis',
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
    defaultAdapter: 'pino',
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
    defaultAdapter: 'posthog',
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

/** Single-provider capabilities. No adapter to pick, so no swap prompt. */
const MODULES = {
  jobs: { label: 'Background jobs', dir: 'src/server/jobs', hint: 'inngest' },
  'error-tracking': { label: 'Error tracking', dir: 'src/server/error-tracking', hint: 'sentry' },
}

const SPEC = { ...PORTS, ...MODULES }

export const CAPABILITIES = Object.keys(SPEC)

/** True when the capability offers a provider choice. */
export const hasAdapters = (cap) => cap in PORTS

/** Vendored destination for a capability. */
export const capabilityDir = (cap) => SPEC[cap]?.dir

/** Prompt options for the capability multiselect. */
export const capabilityChoices = () =>
  CAPABILITIES.map((name) => ({
    value: name,
    label: SPEC[name].label,
    hint: SPEC[name].adapters ? Object.keys(SPEC[name].adapters).join(' / ') : SPEC[name].hint,
  }))

/** Adapter options + default for one capability, or null when it has no choice. */
export const adapterChoices = (cap) => {
  const spec = PORTS[cap]
  if (!spec) return null
  return {
    defaultAdapter: spec.defaultAdapter,
    options: Object.keys(spec.adapters).map((value) => ({ value, label: value })),
  }
}

/** Resolve a possibly-empty flag value to a valid adapter, or null for a module. */
export function resolveAdapter(cap, value) {
  if (!SPEC[cap]) throw new Error(`Unknown capability: ${cap}`)
  const spec = PORTS[cap]
  if (!spec) {
    // A module has one implementation; naming another is a mistake worth surfacing.
    if (value && value !== true) {
      throw new Error(`${cap} has no adapter to choose: it always uses ${MODULES[cap].hint}`)
    }
    return null
  }
  if (value === true || value == null || value === '') return spec.defaultAdapter
  if (!spec.adapters[value]) {
    throw new Error(
      `Unknown ${cap} adapter: ${value} (have ${Object.keys(spec.adapters).join(', ')})`,
    )
  }
  return value
}

// env.ts is the single source of truth: required adapter keys are emitted without
// v.optional there, so env.X is already a guaranteed string — no narrowing needed here.
const ctorArgs = (args) => args.map(([name, key]) => `      ${name}: env.${key},`).join('\n')

/** Lazy-singleton composition root: boots without env, constructs on first use. */
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

/** Slug usable as an Inngest app id (no slashes, lowercase). */
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

/** jobs: composition root, example event + function, and the per-framework route shim. */
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

/** error-tracking: the Sentry files that can be written standalone, per framework. */
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

/**
 * Wiring the generator deliberately doesn't apply, because it means editing files the
 * project owns. Surfaced to the user instead of silently rewriting their config.
 */
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

/** Copy a manifest path (rooted at the package) under destDir, stripping `src/`. */
function copyPath(cap, relSrc, destDir) {
  copy(join(PKG(cap), relSrc), join(destDir, relSrc.replace(/^src\//, '')))
}

/** True if any vendored .ts file under dir still imports a cross-package. */
function references(dir, mod) {
  for (const name of readdirSync(dir, { recursive: true })) {
    const p = join(dir, name)
    if (statSync(p).isFile() && /\.tsx?$/.test(p) && read(p).includes(mod)) return true
  }
  return false
}

/** Run fn(path, source) over every vendored .ts/.tsx file under dir. */
function walkTs(dir, fn) {
  for (const name of readdirSync(dir, { recursive: true })) {
    const p = join(dir, name)
    if (statSync(p).isFile() && /\.tsx?$/.test(p)) fn(p, read(p))
  }
}

/** Rewrite every `from`-module import to `to` across vendored .ts files. */
function rewriteImports(dir, from, to) {
  walkTs(dir, (p, src) => {
    if (src.includes(from)) write(p, src.split(from).join(to))
  })
}

// Package source uses NodeNext `.js` extensions on relative imports (for tsdown);
// the base app + app bundlers (Next/Vite) expect extensionless. Strip them on vendor.
const JS_EXT = /(from\s+['"]\.\.?\/[^'"]*?)\.js(['"])/g

/** Drop `.js` from relative import specifiers across vendored .ts files. */
function stripJsExtensions(dir) {
  walkTs(dir, (p, src) => {
    const next = src.replace(JS_EXT, '$1$2')
    if (next !== src) write(p, next)
  })
}

/** Vendor @alfredmouelle/http into src/lib/http (once) and point imports at it. */
function vendorHttp(projectDir, destDir) {
  if (!references(destDir, '@alfredmouelle/http')) return
  const httpDest = join(projectDir, 'src/lib/http')
  if (!exists(httpDest)) {
    copy(join(STACK_ROOT, 'packages/http/src'), httpDest)
    stripJsExtensions(httpDest)
  }
  rewriteImports(destDir, '@alfredmouelle/http', '~/lib/http')
}

/**
 * Dep ranges for a capability; skips vendored @alfredmouelle/* deps.
 *
 * Ranges normally come from the package's own package.json, so they stay in lockstep
 * with what the tests run against. A module that ships wiring it doesn't import (the
 * Sentry framework SDKs) has nowhere to declare them, so its manifest pins them via
 * `versions` rather than letting them drift to `latest`.
 */
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

/** Files a module owns in the project, beyond its vendored dir (cleaned on re-vendor). */
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

/** Per-module wiring beyond the copied files (composition root, routes, init files). */
const MODULE_WIRING = {
  jobs: ({ projectDir, destDir, framework, projectName }) =>
    vendorJobs(projectDir, destDir, framework, projectName),
  'error-tracking': ({ projectDir, framework }) => vendorErrorTracking(projectDir, framework),
}

/** Single-provider capability: copy its files, then wire it for this framework. */
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

/** Swappable capability: copy the port + chosen adapter, then generate the root. */
function vendorPort({ projectDir, destDir, cap, adapter, spec, manifest }) {
  const aSpec = spec.adapters[adapter]
  if (!aSpec) throw new Error(`Unknown ${cap} adapter: ${adapter}`)
  const adManifest = manifest.adapters[adapter]

  // port (+ shared) and the chosen adapter; the barrel index.ts is replaced below.
  const files = [...manifest.sharedFiles.filter((f) => f !== 'src/index.ts'), ...adManifest.files]
  for (const f of files) copyPath(cap, f, destDir)
  stripJsExtensions(destDir) // NodeNext `.js` specifiers → extensionless (app bundler)

  write(
    join(destDir, 'index.ts'),
    standardRoot({ ...spec, adapterKey: adapter, fn: aSpec.fn, args: aSpec.args }),
  )
  vendorHttp(projectDir, destDir)

  return {
    addDeps: resolveDeps(cap, [...adManifest.deps, ...(manifest.sharedDeps ?? [])], manifest),
    envKeys: adManifest.env,
    // a key the root reads as env.X must be required in env.ts (guaranteed string).
    requiredEnvKeys: (aSpec.args ?? []).filter(([, , req]) => req).map(([, key]) => key),
  }
}

/**
 * Vendor one capability into the fork. `keep` retains any adapter(s) already vendored
 * (additive, ports only); otherwise the dest is wiped first for a clean (re-)vendor.
 * @returns {{ addDeps: Record<string,string>, envKeys: string[], requiredEnvKeys: string[] }}
 */
export function vendorCapability({ projectDir, framework, projectName, cap, adapter, keep }) {
  const spec = SPEC[cap]
  if (!spec) throw new Error(`Unknown capability: ${cap}`)

  const manifest = readJSON(join(PKG(cap), 'capability.json'))
  const destDir = join(projectDir, spec.dir)

  if (!keep) {
    remove(destDir) // clean swap: drop the old adapter(s) + composition root
    for (const f of MODULE_EXTRA_FILES[cap] ?? []) remove(join(projectDir, f))
  }

  const args = { projectDir, destDir, framework, projectName, cap, adapter, spec, manifest }
  return manifest.kind === 'module' ? vendorModule(args) : vendorPort(args)
}

/** The adapter currently wired in a vendored capability (from its index.ts import), or null. */
export function currentAdapter(projectDir, cap) {
  if (!hasAdapters(cap)) return null
  const indexPath = join(projectDir, PORTS[cap].dir, 'index.ts')
  if (!exists(indexPath)) return null
  return read(indexPath).match(/\.\/adapters\/([\w-]+)['"]/)?.[1] ?? null
}

/** Deps unique to `from` (not shared, not used by `to`) — safe to drop on a non-keep swap. */
export function adapterRemovableDeps(cap, from, to) {
  const manifest = readJSON(join(PKG(cap), 'capability.json'))
  const stay = new Set([...(manifest.adapters[to]?.deps ?? []), ...(manifest.sharedDeps ?? [])])
  return (manifest.adapters[from]?.deps ?? []).filter(
    (d) => !stay.has(d) && !d.startsWith('@alfredmouelle/'),
  )
}

/** Vendor a whole module's files (no adapter, no env/deps) — for email-kit & http. */
export function vendorPackageSrc(pkgName, destDir) {
  remove(destDir)
  const manifest = readJSON(join(PKG(pkgName), 'capability.json'))
  for (const f of manifest.files) copyPath(pkgName, f, destDir)
  stripJsExtensions(destDir)
}
