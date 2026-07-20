import type { Inngest, InngestFunction } from 'inngest'
import { serve } from 'inngest/edge'

/** Web-standard handler: mounts unchanged in a Next.js route handler or a TanStack Start route. */
export type JobsHandler = (request: Request) => Promise<Response>

export interface JobsHandlerOptions {
  client: Inngest.Like
  /** Every job function to expose. Inngest syncs this list on PUT. */
  functions: readonly InngestFunction.Like[]
  /** Path this handler is mounted at, when Inngest can't infer it. */
  servePath?: string
}

/**
 * Serve the registered jobs over HTTP, via Inngest's framework-agnostic `edge`
 * handler so the same function mounts under any framework.
 *
 * The signing key is deliberately absent: `serve` has no such option, it belongs
 * to the client (`new Inngest({ signingKey })`) or to `INNGEST_SIGNING_KEY`.
 */
export function jobsHandler(options: JobsHandlerOptions): JobsHandler {
  return serve({
    client: options.client,
    functions: options.functions,
    servePath: options.servePath,
  })
}
