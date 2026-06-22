import type { FetchHandler } from '@alfredmouelle/http'
import { Inngest } from 'inngest'
import * as v from 'valibot'
import type { JobDefinition, JobEvent, JobsPort } from '../../core/port.js'
import { JobsError } from '../../core/port.js'
import { InngestConfigSchema } from './config.js'

/** Opaque Inngest function from `createFunction`. */
export type InngestFunction = unknown

/** Structural view of the Inngest client; real `Inngest` satisfies it, tests mock it. */
export interface InngestLike {
  send(payload: { name: string; data: unknown }): Promise<unknown>
  createFunction(
    config: { id: string },
    trigger: { event: string },
    handler: (ctx: { event: { name: string; data: unknown } }) => Promise<void> | void,
  ): InngestFunction
}

export interface InngestAdapterOptions {
  /** Inngest app id (`new Inngest({ id })`). */
  id: string
  /** Inject custom/mock client. Defaults to real `Inngest`. */
  client?: InngestLike
  /** Event key for sending in production. */
  eventKey?: string
}

export interface InngestJobsAdapter extends JobsPort {
  /** Functions from `defineJob`, for Inngest's `serve`. */
  readonly functions: InngestFunction[]
  /** Underlying client for advanced use (steps, cron, concurrency, …). */
  readonly client: InngestLike
}

export function inngestAdapter(options: InngestAdapterOptions): InngestJobsAdapter {
  // Validate early: bad id fails at construction, not trigger().
  const config = v.parse(InngestConfigSchema, { id: options.id, eventKey: options.eventKey })
  const client: InngestLike =
    options.client ??
    (new Inngest({ id: config.id, eventKey: config.eventKey }) as unknown as InngestLike)

  const functions: InngestFunction[] = []

  return {
    name: 'inngest',
    functions,
    client,
    defineJob<T>(def: JobDefinition<T>): JobDefinition<T> {
      const fn = client.createFunction({ id: def.id }, { event: def.event }, ({ event }) =>
        def.handler(event as JobEvent<T>),
      )
      functions.push(fn)
      return def
    },
    async trigger<T>(event: JobEvent<T>): Promise<void> {
      try {
        await client.send({ name: event.name, data: event.data })
      } catch (cause) {
        throw new JobsError('Failed to send event to Inngest', { adapter: 'inngest', cause })
      }
    },
  }
}

/** Collect functions for `serve({ client, functions })`. */
export function inngestFunctions(adapter: InngestJobsAdapter): InngestFunction[] {
  return adapter.functions
}

/**
 * Inngest's framework-agnostic `serve` (e.g. `inngest/edge`). Loosely typed so
 * the real `serve` (richer options than our `InngestLike`) is accepted.
 */
// biome-ignore lint/suspicious/noExplicitAny: accepts the real serve whose options are richer than InngestLike
export type InngestServe = (options: any) => FetchHandler

/**
 * {@link FetchHandler} serving the adapter's functions. Pass Inngest's `serve`
 * (from `inngest/edge`); the handler mounts in Next.js or TanStack Start unchanged.
 */
export function inngestServeHandler<TServe extends InngestServe>(
  adapter: InngestJobsAdapter,
  serve: TServe,
  options: { signingKey?: string } = {},
): FetchHandler {
  return serve({
    client: adapter.client,
    functions: adapter.functions,
    signingKey: options.signingKey,
  } as Parameters<TServe>[0])
}
