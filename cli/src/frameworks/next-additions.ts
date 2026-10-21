import { sentryInit } from '#lib/capabilities.ts'
import { STACK_ROOT } from '#lib/paths.ts'
import { join } from '#lib/util.ts'
import { javascriptAdditions } from '../javascript/additions.ts'

const NEXT_INNGEST_ROUTE = `import { jobs } from '~/server/jobs'
import { functions } from '~/server/jobs/functions'
import { jobsHandler } from '~/server/jobs/serve'

const handler = jobsHandler({ client: jobs, functions })

export { handler as GET, handler as POST, handler as PUT }
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

export const nextAdditions = javascriptAdditions({
  componentRoot: 'src/app/layout.tsx',
  mailerSource: join(STACK_ROOT, 'apps/next-base/src/server/email'),
  modules: {
    jobs: {
      provider: 'inngest',
      files: { 'src/app/api/inngest/route.ts': NEXT_INNGEST_ROUTE },
    },
    'error-tracking': {
      provider: 'sentry',
      dependencies: { '@sentry/nextjs': '10.76.2' },
      files: {
        'sentry.server.config.ts': sentryInit('@sentry/nextjs'),
        'sentry.edge.config.ts': sentryInit('@sentry/nextjs'),
        'src/instrumentation-client.ts': `${sentryInit('@sentry/nextjs')}
// Instruments client-side router navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
`,
        'src/instrumentation.ts': NEXT_INSTRUMENTATION,
        'src/app/global-error.tsx': NEXT_GLOBAL_ERROR,
      },
      manualSteps: [
        'Wrap next.config.ts with `withSentryConfig` from @sentry/nextjs (source maps).',
        'Set SENTRY_AUTH_TOKEN in CI for source-map upload.',
      ],
    },
  },
})
