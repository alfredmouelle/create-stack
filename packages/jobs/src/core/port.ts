/**
 * An event that flows through the jobs system. `name` routes the event to the
 * jobs subscribed to it; `data` is the arbitrary, serializable payload.
 */
export interface JobEvent<T = unknown> {
  name: string
  data: T
}

/**
 * A unit of background work. A job subscribes to a single `event` name; its
 * `handler` runs whenever a matching event is triggered.
 */
export interface JobDefinition<T = unknown> {
  id: string
  event: string
  handler: (event: JobEvent<T>) => Promise<void> | void
}

/**
 * The port the application depends on. Swapping providers means swapping the
 * adapter; this interface never changes.
 *
 * Kept intentionally minimal and event-driven. Rich provider features (steps,
 * concurrency, cron, fan-out) are NOT modeled here — reach for the underlying
 * SDK directly when you need them. See the package README.
 */
export interface JobsPort {
  readonly name: string
  /** Register a job. Returns the definition so it can be collected/exported. */
  defineJob<T>(def: JobDefinition<T>): JobDefinition<T>
  /** Emit an event, triggering every job subscribed to `event.name`. */
  trigger<T>(event: JobEvent<T>): Promise<void>
}

/** Normalized error thrown by adapters so callers never catch provider types. */
export class JobsError extends Error {
  readonly adapter: string

  constructor(message: string, options: { adapter: string; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'JobsError'
    this.adapter = options.adapter
  }
}
