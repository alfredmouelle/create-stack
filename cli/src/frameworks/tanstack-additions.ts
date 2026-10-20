import { sentryInit } from '#lib/capabilities.mjs'
import { STACK_ROOT } from '#lib/paths.mjs'
import { join } from '#lib/util.mjs'
import { javascriptAdditions } from '../javascript/additions.ts'

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

export const tanstackAdditions = javascriptAdditions({
  componentRoot: 'src/routes/__root.tsx',
  mailerSource: join(STACK_ROOT, 'apps/tanstack-base/src/server/email'),
  modules: {
    jobs: {
      provider: 'inngest',
      files: { 'src/routes/api/inngest.ts': TANSTACK_INNGEST_ROUTE },
    },
    'error-tracking': {
      provider: 'sentry',
      dependencies: { '@sentry/tanstackstart-react': '10.76.2' },
      files: {
        'instrument.server.mjs': TANSTACK_INSTRUMENT_SERVER,
        'src/instrument.client.tsx': sentryInit(
          '@sentry/tanstackstart-react',
          '\n  integrations: [Sentry.replayIntegration()],',
        ),
      },
      manualSteps: [
        'Add `sentryTanstackStart()` as the LAST plugin in vite.config.ts.',
        'Import `./instrument.client` as the first import in src/client.tsx.',
        'Wrap the fetch handler in src/server.ts with `wrapFetchWithSentry`.',
        'Add `sentryGlobalRequestMiddleware` / `sentryGlobalFunctionMiddleware` in src/start.ts.',
        "Run the server with NODE_OPTIONS='--import ./instrument.server.mjs'.",
      ],
    },
  },
})
