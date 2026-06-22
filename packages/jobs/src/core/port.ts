/** Event through the jobs system. `name` routes to subscribed jobs; `data` is the serializable payload. */
export interface JobEvent<T = unknown> {
  name: string
  data: T
}

/** Background work unit. Subscribes to one `event` name; `handler` runs on a matching event. */
export interface JobDefinition<T = unknown> {
  id: string
  event: string
  handler: (event: JobEvent<T>) => Promise<void> | void
}

/**
 * The port the app depends on. Swap provider = swap adapter; this never changes.
 *
 * Minimal and event-driven. Rich provider features (steps, concurrency, cron,
 * fan-out) are NOT modeled — use the underlying SDK directly. See the README.
 */
export interface JobsPort {
  readonly name: string
  /** Register a job. Returns the definition for collection/export. */
  defineJob<T>(def: JobDefinition<T>): JobDefinition<T>
  /** Emit an event, triggering every job subscribed to `event.name`. */
  trigger<T>(event: JobEvent<T>): Promise<void>
}

/** Normalized adapter error so callers never catch provider types. */
export class JobsError extends Error {
  readonly adapter: string

  constructor(message: string, options: { adapter: string; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'JobsError'
    this.adapter = options.adapter
  }
}
