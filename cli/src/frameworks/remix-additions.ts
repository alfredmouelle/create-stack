import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { COMPONENTS } from '@alfredmouelle/stack-config'
import { appendRawEnvLines } from '#lib/env.ts'
import { STACK_ROOT } from '#lib/paths.ts'
import { copy, editFile, exists, write } from '#lib/util.ts'
import type {
  AdditionWiring,
  CapabilityAddition,
  ComponentAdditionResult,
} from '../framework-module.ts'
import { javascriptAdditions } from '../javascript/additions.ts'
import { readTemplate } from '../javascript/reference-parts.ts'

const componentRoot = 'src/components/document.tsx'
const referenceRoot = join(STACK_ROOT, 'apps/remix-base')
const emailDependencies = {
  react: '19.3.0',
  'react-dom': '19.3.0',
  'react-email': '6.11.1',
  '@types/react': '19.3.0',
  '@types/react-dom': '19.3.0',
}

function addRouterIntegration(projectDir: string, importLine: string, code: string): boolean {
  const path = join(projectDir, 'src/router.tsx')
  if (!exists(path)) return false
  const source = readFileSync(path, 'utf8')
  if (source.includes(code)) return true
  if (!source.includes('const router = createRouter()')) return false
  write(
    path,
    `${source.includes(importLine) ? '' : `${importLine}\n`}${source.replace('const router = createRouter()', `const router = createRouter()\n${code}`)}`,
  )
  return true
}

const additions = javascriptAdditions({
  componentRoot,
  mailerSource: join(referenceRoot, 'src/server/email'),
  modules: {
    jobs: {
      provider: 'inngest',
      files: {
        'src/server/jobs/routes.ts': `import type { Router } from 'remix/router'
import { jobs } from './index'
import { functions } from './functions'
import { jobsHandler } from './serve'

export function installJobRoutes(router: Router): void {
  const handler = jobsHandler({ client: jobs, functions, servePath: '/api/inngest' })
  router.route('ANY', '/api/inngest', ({ request }) => handler(request))
}
`,
      },
    },
    'error-tracking': {
      provider: 'sentry',
      dependencies: { '@sentry/node': '10.76.2', '@sentry/browser': '10.76.2' },
      files: {
        'src/server/error-tracking/routes.ts': `import type { Router } from 'remix/router'

export function installObservabilityRoutes(router: Router): void {
  router.get('/api/client-config', () => Response.json({ sentryDsn: process.env.REMIX_SENTRY_DSN ?? '' }, { headers: { 'cache-control': 'no-store' } }))
}
`,
        'instrument.server.mjs': `import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0.1,
})
`,
        'src/server/observability.ts': `import * as Sentry from '@sentry/node'

export function captureServerError(error: unknown): void {
  Sentry.captureException(error)
}
`,
        'src/client/observability.ts': `import * as Sentry from '@sentry/browser'

const pending: unknown[] = []
let initialized = false
fetch('/api/client-config', { cache: 'no-store' }).then(async (response) => {
  const config: unknown = await response.json()
  const dsn = typeof config === 'object' && config !== null && 'sentryDsn' in config && typeof config.sentryDsn === 'string' ? config.sentryDsn : ''
  Sentry.init({ dsn, enabled: Boolean(dsn), integrations: [Sentry.browserTracingIntegration()], tracesSampleRate: 0.1 })
  initialized = true
  for (const error of pending.splice(0)) Sentry.captureException(error)
}).catch(() => { pending.length = 0 })

export function captureClientError(error: unknown): void {
  if (initialized) Sentry.captureException(error)
  else if (pending.length < 20) pending.push(error)
}
`,
      },
      manualSteps: [
        'Set REMIX_SENTRY_DSN to the public browser DSN and SENTRY_DSN to the private server DSN.',
        'Use the generated Node preload in dev and start scripts to instrument HTTP before application imports.',
        'Runtime assets have no build output. Configure source-map upload for your deployment if required.',
      ],
    },
  },
})

function copyEmailUi(projectDir: string): void {
  for (const path of ['components.tsx', 'context.tsx', 'index.ts', 'theme.ts']) {
    const destination = join(projectDir, 'src/emails/components', path)
    if (!exists(destination)) copy(join(referenceRoot, 'src/emails/components', path), destination)
  }
}

const capabilities = Object.fromEntries(
  Object.entries(additions.capabilities).map(([name, addition]) => [
    name,
    {
      ...addition,
      apply: (request) => {
        if (name === 'email-ui') {
          copyEmailUi(request.projectDir)
          return {
            addDeps: emailDependencies,
            removeDeps: [],
            envKeys: [],
            requiredEnvKeys: [],
            swappedFrom: null,
            manualSteps: [],
          }
        }
        const result = addition.apply(request)
        if (name === 'mailer')
          return { ...result, addDeps: { ...result.addDeps, ...emailDependencies } }
        if (name === 'jobs') {
          const mounted = addRouterIntegration(
            request.projectDir,
            "import { installJobRoutes } from './server/jobs/routes'",
            'installJobRoutes(router)',
          )
          if (!mounted)
            return {
              ...result,
              manualSteps: [
                ...result.manualSteps,
                "Import installJobRoutes from './server/jobs/routes' and call installJobRoutes(router) in your router factory.",
              ],
            }
        }
        if (name === 'error-tracking') {
          appendRawEnvLines(request.projectDir, ['REMIX_SENTRY_DSN='])
          const mounted = addRouterIntegration(
            request.projectDir,
            "import { installObservabilityRoutes } from './server/error-tracking/routes'",
            'installObservabilityRoutes(router)',
          )
          editFile(join(request.projectDir, 'src/assets.ts'), (source) =>
            source.includes("'@sentry/browser'")
              ? source
              : source.replace(/allowPackages: \[/, "allowPackages: ['@sentry/browser', "),
          )
          editFile(join(request.projectDir, 'package.json'), (source) =>
            source.includes('--import ./instrument.server.mjs')
              ? source
              : source.replaceAll(
                  '--import ./scripts/aliases.ts',
                  '--import ./instrument.server.mjs --import ./scripts/aliases.ts',
                ),
          )
          if (!mounted)
            return {
              ...result,
              manualSteps: [
                ...result.manualSteps,
                "Import installObservabilityRoutes from './server/error-tracking/routes' and call installObservabilityRoutes(router) in your router factory.",
              ],
            }
        }
        return result
      },
    } satisfies CapabilityAddition,
  ]),
)

const callableNames: Readonly<Record<string, string>> = {
  confirm: 'Confirm',
  alert: 'Alert',
  prompt: 'Prompt',
  choice: 'Choice',
  'confirm-passphrase': 'ConfirmPassphrase',
  'confirm-otp': 'ConfirmOtp',
}

function componentFiles(name: string): readonly string[] {
  if (name === 'date-picker') return ['date-picker', 'date-range-picker']
  if (name === 'data-table') return ['data-table', 'infinite-data-table']
  return [name]
}

function installComponentHelpers(projectDir: string): void {
  const helpers = ['dialog.tsx', 'dialog-view.tsx', 'dialog-options.ts']
  for (const file of helpers) {
    const destination = join(projectDir, 'src/client/ui', file)
    if (!exists(destination))
      write(destination, readTemplate(`remix/components/src/client/ui/${file}`))
  }
  if (!exists(join(projectDir, 'src/client/ui-styles.ts')))
    copy(
      join(referenceRoot, 'src/client/ui-styles.ts'),
      join(projectDir, 'src/client/ui-styles.ts'),
    )
}

function mountComponent(projectDir: string, name: string) {
  const rootName = callableNames[name] ?? null
  const rootPath = join(projectDir, componentRoot)
  let mounted: boolean | null = rootName ? false : null
  const importLine = `import { ${rootName} } from '../client/ui/${name}.tsx'`
  if (rootName && existsSync(rootPath)) {
    const source = readFileSync(rootPath, 'utf8')
    const jsx = `<${rootName} />`
    if (source.includes(jsx)) mounted = true
    else if (source.includes('</body>')) {
      write(rootPath, `${importLine}\n${source.replace('</body>', `  ${jsx}\n        </body>`)}`)
      mounted = true
    }
  }
  return { rootName, mounted, importLine }
}

function copyComponent(projectDir: string, name: string, force: boolean) {
  const copied: string[] = []
  const skipped: string[] = []
  for (const file of componentFiles(name)) {
    const table = file === 'data-table' || file === 'infinite-data-table'
    const sources = new Map([
      [`src/client/ui/${file}.tsx`, readTemplate(`remix/components/src/client/ui/${file}.tsx`)],
      [
        `src/components/${table ? '' : 'ui/'}${file}.tsx`,
        `export * from '${table ? '../' : '../../'}client/ui/${file}.tsx'\n`,
      ],
    ])
    for (const [path, source] of sources) {
      if (!force && exists(join(projectDir, path))) skipped.push(path)
      else {
        write(join(projectDir, path), source)
        copied.push(path)
      }
    }
  }
  return { copied, skipped }
}

function installComponents({
  projectDir,
  names,
  force,
}: {
  projectDir: string
  names: readonly string[]
  force: boolean
}): ReadonlyMap<string, ComponentAdditionResult> {
  const results = new Map<string, ComponentAdditionResult>()
  for (const name of names)
    if (!COMPONENTS.some((entry) => entry === name))
      throw new Error(`Unknown native component: ${name}`)
  installComponentHelpers(projectDir)
  for (const name of names) {
    const { copied, skipped } = copyComponent(projectDir, name, force)
    const { rootName, mounted, importLine } = mountComponent(projectDir, name)
    results.set(name, {
      copied,
      skipped,
      addDeps: {},
      mounted,
      rootName,
      manualSteps: rootName && !mounted ? [importLine, `<${rootName} />`] : [],
    })
  }
  return results
}

export const remixAdditions: AdditionWiring = {
  componentRoot,
  components: { kind: 'native', names: COMPONENTS, install: installComponents },
  capabilities,
}
