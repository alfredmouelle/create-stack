/** Analytics event to capture. Fire-and-forget. */
export interface CaptureEvent {
  /** Event name, e.g. `'user_signed_up'`. */
  event: string
  /** Stable user/actor id. */
  distinctId: string
  /** Event metadata. */
  properties?: Record<string, unknown>
}

/** Set/update properties on a user/actor. Fire-and-forget. */
export interface IdentifyParams {
  /** Stable user/actor id. */
  distinctId: string
  /** Person properties to set. */
  properties?: Record<string, unknown>
}

/**
 * App-facing port; swap adapters at the composition root, never this interface.
 * `capture`/`identify` are fire-and-forget (like PostHog SDK): enqueue and return.
 * `flush` drains pending events; `shutdown` flushes + releases before exit.
 */
export interface AnalyticsPort {
  readonly name: string
  capture(event: CaptureEvent): void
  identify(params: IdentifyParams): void
  flush(): Promise<void>
  shutdown(): Promise<void>
}
