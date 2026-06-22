import { inngestServeHandler } from '@stack/jobs'
import { serve } from 'inngest/edge'
// Importing this module registers the app's job definitions on the adapter.
import '../../../server/jobs.js'
import { inngestJobs } from '../../../server/services.js'

/**
 * Mounts Inngest only when `JOBS_PROVIDER=inngest`. `inngestServeHandler` returns
 * a Web-standard `Request -> Response` handler, so the SAME handler powers the
 * TanStack route — only this file's framework wrapper differs.
 */
const handler = inngestJobs
  ? inngestServeHandler(inngestJobs, serve)
  : () => new Response('Inngest disabled (set JOBS_PROVIDER=inngest)', { status: 503 })

export const GET = handler
export const POST = handler
export const PUT = handler
