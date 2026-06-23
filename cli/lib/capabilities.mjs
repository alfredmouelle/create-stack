// Swappable capabilities (storage, cache, jobs, logger, analytics, error-tracking).
// Generalizes mailer.mjs: vendor a capability's core + chosen adapter into the fork,
// generate a composition root reading typed env, and return dep/env deltas.
// Manifest (capability.json) is the source of truth for files/deps/env; this registry
// adds only what a manifest can't carry — the env → constructor-arg mapping.

import { readdirSync, statSync } from 'node:fs'
import { STACK_ROOT } from './paths.mjs'
import { copy, exists, join, read, readJSON, remove, write } from './util.mjs'

const PKG = (cap) => join(STACK_ROOT, 'packages', cap)

/**
 * Per-capability wiring. `dir` = vendored destination, `entry` = exported accessor
 * stem, `portType` = the interface returned. Each adapter maps constructor args to
 * env keys: [argName, ENV_KEY, required?]. A required arg is emitted as required in
 * env.ts, so the root reads env.X directly (guaranteed string).
 */
const CAPS = {
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

  'error-tracking': {
    label: 'Error tracking',
    dir: 'src/server/error-tracking',
    entry: 'errorTracking',
    portType: 'ErrorTrackingPort',
    defaultAdapter: 'sentry',
    adapters: {
      sentry: {
        fn: 'sentryAdapter',
        args: [
          ['dsn', 'SENTRY_DSN', true],
          ['environment', 'SENTRY_ENVIRONMENT', false],
        ],
      },
      console: { fn: 'consoleAdapter', args: [] },
    },
  },

  jobs: {
    label: 'Background jobs',
    dir: 'src/server/jobs',
    entry: 'jobs',
    kind: 'jobs', // bespoke: concrete adapter (serving) + HTTP surface
    defaultAdapter: 'inngest',
    adapters: {
      inngest: { fn: 'inngestAdapter' },
      trigger: { fn: 'triggerDevAdapter' },
      memory: { fn: 'memoryAdapter' },
    },
  },
}

export const CAPABILITIES = Object.keys(CAPS)

/** Prompt options for the capability multiselect. */
export const capabilityChoices = () =>
  CAPABILITIES.map((name) => ({
    value: name,
    label: CAPS[name].label,
    hint: Object.keys(CAPS[name].adapters).join(' / '),
  }))

/** Adapter options + default for one capability (drives the per-capability select). */
export const adapterChoices = (cap) => ({
  defaultAdapter: CAPS[cap].defaultAdapter,
  options: Object.keys(CAPS[cap].adapters).map((value) => ({ value, label: value })),
})

/** Resolve a possibly-empty flag value to a valid adapter, or throw. */
export function resolveAdapter(cap, value) {
  const spec = CAPS[cap]
  if (!spec) throw new Error(`Unknown capability: ${cap}`)
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
  return `${envImport}import { ${fn} } from './adapters/${adapterKey}/index'
import type { ${portType} } from './core/port'

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

/** Jobs needs the concrete adapter object (for serving), so it exports an eager const. */
function jobsRoot(adapterKey, projectName) {
  if (adapterKey === 'inngest') {
    return `import { env } from '~/env'
import { inngestAdapter } from './adapters/inngest/index'

// Composition root — register jobs with jobs.defineJob(), trigger with jobs.trigger().
export const jobs = inngestAdapter({
  id: '${slug(projectName)}',
  eventKey: env.INNGEST_EVENT_KEY,
})
`
  }
  if (adapterKey === 'trigger') {
    return `import { env } from '~/env'
import { triggerDevAdapter } from './adapters/trigger/index'

// Composition root — register jobs with jobs.defineJob(), trigger with jobs.trigger().
export const jobs = triggerDevAdapter({
  secretKey: env.TRIGGER_SECRET_KEY,
})
`
  }
  return `import { memoryAdapter } from './adapters/memory/index'

// In-process composition root (dev/tests) — runs handlers inline on trigger().
export const jobs = memoryAdapter()
`
}

const JOBS_SERVE = `import { serve } from 'inngest/edge'
import { env } from '~/env'
import { inngestServeHandler } from './adapters/inngest/index'
import { jobs } from './index'

// Web-standard FetchHandler serving the registered functions; mounted by the route shim.
export const handler = inngestServeHandler(jobs, serve, {
  signingKey: env.INNGEST_SIGNING_KEY,
})
`

const NEXT_INNGEST_ROUTE = `import { handler } from '~/server/jobs/serve'

export { handler as GET, handler as POST, handler as PUT }
`

const TANSTACK_INNGEST_ROUTE = `import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { handler } from '~/server/jobs/serve'

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

/** Dep ranges from the capability's manifest; skips vendored @alfredmouelle/* deps. */
function resolveDeps(cap, names) {
  const pkg = readJSON(join(PKG(cap), 'package.json'))
  const out = {}
  for (const d of names) {
    if (d.startsWith('@alfredmouelle/')) continue
    out[d] = pkg.dependencies?.[d] ?? 'latest'
  }
  return out
}

const JOBS_ROUTE_FILES = ['src/app/api/inngest/route.ts', 'src/routes/api/inngest.ts']

/** jobs/inngest HTTP surface: serve handler + the per-framework route shim. */
function mountInngest(projectDir, destDir, framework) {
  write(join(destDir, 'serve.ts'), JOBS_SERVE)
  const [next, tanstack] = JOBS_ROUTE_FILES
  write(
    join(projectDir, framework === 'next' ? next : tanstack),
    framework === 'next' ? NEXT_INNGEST_ROUTE : TANSTACK_INNGEST_ROUTE,
  )
}

/**
 * Vendor one capability into the fork. `keep` retains any adapter(s) already vendored
 * (additive); otherwise the dest is wiped first for a clean (re-)vendor / swap.
 * @returns {{ addDeps: Record<string,string>, envKeys: string[], requiredEnvKeys: string[] }}
 */
export function vendorCapability({ projectDir, framework, projectName, cap, adapter, keep }) {
  const spec = CAPS[cap]
  if (!spec) throw new Error(`Unknown capability: ${cap}`)
  const aSpec = spec.adapters[adapter]
  if (!aSpec) throw new Error(`Unknown ${cap} adapter: ${adapter}`)
  const isJobs = spec.kind === 'jobs'

  const manifest = readJSON(join(PKG(cap), 'capability.json'))
  const adManifest = manifest.adapters[adapter]
  const destDir = join(projectDir, spec.dir)

  if (!keep) {
    remove(destDir) // clean swap: drop the old adapter(s) + composition root
    if (isJobs) for (const r of JOBS_ROUTE_FILES) remove(join(projectDir, r))
  }

  // core (+ shared) and the chosen adapter; the barrel index.ts is replaced below.
  const files = [...manifest.sharedFiles.filter((f) => f !== 'src/index.ts'), ...adManifest.files]
  for (const f of files) copyPath(cap, f, destDir)
  stripJsExtensions(destDir) // NodeNext `.js` specifiers → extensionless (app bundler)

  write(
    join(destDir, 'index.ts'),
    isJobs
      ? jobsRoot(adapter, projectName)
      : standardRoot({ ...spec, adapterKey: adapter, fn: aSpec.fn, args: aSpec.args }),
  )
  if (isJobs && adapter === 'inngest') mountInngest(projectDir, destDir, framework)
  vendorHttp(projectDir, destDir)

  return {
    addDeps: resolveDeps(cap, [...adManifest.deps, ...(manifest.sharedDeps ?? [])]),
    envKeys: adManifest.env,
    // a key the root reads as env.X must be required in env.ts (guaranteed string).
    requiredEnvKeys: (aSpec.args ?? []).filter(([, , req]) => req).map(([, key]) => key),
  }
}

/** The adapter currently wired in a vendored capability (from its index.ts import), or null. */
export function currentAdapter(projectDir, cap) {
  const indexPath = join(projectDir, CAPS[cap].dir, 'index.ts')
  if (!exists(indexPath)) return null
  return read(indexPath).match(/\.\/adapters\/([\w-]+)\/index/)?.[1] ?? null
}

/** Deps unique to `from` (not shared, not used by `to`) — safe to drop on a non-keep swap. */
export function adapterRemovableDeps(cap, from, to) {
  const manifest = readJSON(join(PKG(cap), 'capability.json'))
  const stay = new Set([...(manifest.adapters[to]?.deps ?? []), ...(manifest.sharedDeps ?? [])])
  return (manifest.adapters[from]?.deps ?? []).filter(
    (d) => !stay.has(d) && !d.startsWith('@alfredmouelle/'),
  )
}

/** Vendor a whole package's src/ (no manifest, no env/deps) — for email-kit & http. */
export function vendorPackageSrc(pkgName, destDir) {
  remove(destDir)
  copy(join(PKG(pkgName), 'src'), destDir)
  stripJsExtensions(destDir)
}
