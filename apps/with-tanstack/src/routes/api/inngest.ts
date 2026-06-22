import { inngestServeHandler } from '@stack/jobs'
import { createFileRoute } from '@tanstack/react-router'
import { serve } from 'inngest/edge'
// Importing this module registers the app's job definitions on the adapter.
import '../../server/jobs.js'
import { inngestJobs } from '../../server/services.js'

/**
 * Mounts Inngest only when `JOBS_PROVIDER=inngest`. `inngestServeHandler` returns
 * a Web-standard `Request -> Response` handler (from `inngest/edge`), so the same
 * code mounts unchanged in Next.js — the framework shim is the only difference.
 */
const handler = inngestJobs
  ? inngestServeHandler(inngestJobs, serve)
  : () => new Response('Inngest disabled (set JOBS_PROVIDER=inngest)', { status: 503 })

export const Route = createFileRoute('/api/inngest')({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
      PUT: ({ request }) => handler(request),
    },
  },
})
