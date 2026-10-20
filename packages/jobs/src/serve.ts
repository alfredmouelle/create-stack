import type { Inngest, InngestFunction } from 'inngest'
import { serve } from 'inngest/edge'

export type JobsHandler = (request: Request) => Promise<Response>

export interface JobsHandlerOptions {
  client: Inngest.Like
  functions: readonly InngestFunction.Like[]
  servePath?: string | undefined
}

export function jobsHandler(options: JobsHandlerOptions): JobsHandler {
  return serve({
    client: options.client,
    functions: options.functions,
    ...(options.servePath !== undefined && { servePath: options.servePath }),
  })
}
