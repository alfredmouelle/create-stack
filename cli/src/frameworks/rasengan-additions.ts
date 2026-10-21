import { appendRawEnvLines } from '#lib/env.ts'
import { STACK_ROOT } from '#lib/paths.ts'
import { editFile, exists, join } from '#lib/util.ts'
import type { AdditionWiring } from '../framework-module.ts'
import { javascriptAdditions } from '../javascript/additions.ts'
import { readTemplate } from '../javascript/reference-parts.ts'

const additions = javascriptAdditions({
  componentRoot: 'src/template.tsx',
  mailerSource: join(STACK_ROOT, 'apps/rasengan-base/src/server/email'),
  modules: {
    jobs: {
      provider: 'inngest',
      files: {
        'src/app/_api/inngest.route.ts': `import { jobs } from '~/server/jobs'
import { functions } from '~/server/jobs/functions'
import { jobsHandler } from '~/server/jobs/serve'

const handler = jobsHandler({ client: jobs, functions })

export function GET({ request }: { readonly request: Request }): Promise<Response> {
  return handler(request)
}

export const POST = GET
export const PUT = GET
`,
      },
    },
    'error-tracking': {
      provider: 'sentry',
      dependencies: {
        '@sentry/node': '10.76.2',
        '@sentry/react': '10.76.2',
        '@sentry/vite-plugin': '11.8.0',
      },
      files: {
        'sentry.vite.ts': readTemplate('rasengan/sentry.vite.ts'),
        'instrument.server.mjs': `import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  enabled: Boolean(process.env.SENTRY_DSN),
  integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
  tracesSampleRate: 0.1,
})
`,
        'src/instrument.client.ts': `import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.RASENGAN_SENTRY_DSN,
  enabled: Boolean(import.meta.env.RASENGAN_SENTRY_DSN),
  integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
})
`,
      },
      manualSteps: [
        'Set RASENGAN_SENTRY_DSN to the public browser DSN and SENTRY_DSN to the server DSN.',
        "Start Node with NODE_OPTIONS='--import ./instrument.server.mjs' to instrument server requests before application modules load.",
        'Set SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT in the build environment to upload source maps. Generated maps are deleted after the build.',
      ],
    },
  },
})

export const rasenganAdditions: AdditionWiring = {
  ...additions,
  capabilities: Object.fromEntries(
    Object.entries(additions.capabilities).map(([name, addition]) => [
      name,
      name === 'error-tracking'
        ? {
            ...addition,
            apply: (request) => {
              const result = addition.apply(request)
              appendRawEnvLines(request.projectDir, ['RASENGAN_SENTRY_DSN='])
              const entry = join(request.projectDir, 'src/index.ts')
              if (exists(entry))
                editFile(entry, (source) =>
                  source.includes("import './instrument.client'")
                    ? source
                    : `import './instrument.client'\n${source}`,
                )
              const config = join(request.projectDir, 'rasengan.config.js')
              if (exists(config))
                editFile(config, (source) => {
                  if (source.includes('...sentryPlugins()')) return source
                  const end = '    ],\n  },\n})'
                  if (!source.includes(end)) return source
                  return `import { sentryPlugins } from './sentry.vite.ts'\n${source.replace(end, `      ...sentryPlugins(),\n${end}`)}`
                })
              return {
                ...result,
                manualSteps: [
                  ...result.manualSteps,
                  "For custom config files, import sentryPlugins from './sentry.vite.ts' and append ...sentryPlugins() last in the Vite plugins array. Enable allowImportingTsExtensions in tsconfig.json when needed.",
                ],
              }
            },
          }
        : addition,
    ]),
  ),
}
