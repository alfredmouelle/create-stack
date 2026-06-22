import type { FetchHandler } from '@alfredmouelle/http'
import { Inngest } from 'inngest'
import * as v from 'valibot'
import type { JobDefinition, JobEvent, JobsPort } from '../../core/port.js'
import { JobsError } from '../../core/port.js'
import { InngestConfigSchema } from './config.js'

/** An Inngest function object as returned by `createFunction`. Opaque to us. */
export type InngestFunction = unknown

/**
 * Minimal structural view of the Inngest client we depend on. The real
 * `Inngest` instance satisfies this; tests pass a mock with the same shape so
 * nothing ever hits the network.
 */
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
  /** Inject a custom/mock client. Defaults to a real `Inngest` instance. */
  client?: InngestLike
  /** Event key for sending events in production. */
  eventKey?: string
}

export interface InngestJobsAdapter extends JobsPort {
  /** Functions created via `defineJob`, ready to pass to Inngest's `serve`. */
  readonly functions: InngestFunction[]
  /** The underlying client, for advanced use (steps, cron, concurrency, …). */
  readonly client: InngestLike
}

export function inngestAdapter(options: InngestAdapterOptions): InngestJobsAdapter {
  // Validate config early so a bad id fails at construction, not at trigger().
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

/** Collect the Inngest functions to wire into `serve({ client, functions })`. */
export function inngestFunctions(adapter: InngestJobsAdapter): InngestFunction[] {
  return adapter.functions
}

/**
 * Inngest's framework-agnostic `serve` (e.g. from `inngest/edge`). Typed loosely
 * via the options param so the real `serve` — whose option types are richer than
 * our structural `InngestLike` — is accepted; the call site builds the options.
 */
// biome-ignore lint/suspicious/noExplicitAny: accepts the real serve whose options are richer than InngestLike
export type InngestServe = (options: any) => FetchHandler

/**
 * Build a {@link FetchHandler} that serves the adapter's collected functions.
 * Pass Inngest's framework-agnostic `serve` (from `inngest/edge`) as `serve`;
 * the returned handler can be mounted in Next.js or TanStack Start unchanged.
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
