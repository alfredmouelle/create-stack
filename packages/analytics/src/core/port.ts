/** An analytics event to capture. Fire-and-forget. */
export interface CaptureEvent {
  /** The event name, e.g. `'user_signed_up'`. */
  event: string
  /** Stable identifier for the user/actor this event belongs to. */
  distinctId: string
  /** Arbitrary event metadata. */
  properties?: Record<string, unknown>
}

/** Attach (or update) properties on a user/actor. Fire-and-forget. */
export interface IdentifyParams {
  /** Stable identifier for the user/actor. */
  distinctId: string
  /** Person properties to set. */
  properties?: Record<string, unknown>
}

/**
 * The port the application depends on. Swapping providers means swapping the
 * adapter passed to the composition root; this interface never changes.
 *
 * `capture` and `identify` are fire-and-forget (like the PostHog SDK): they
 * enqueue work and return immediately. Use `flush` to drain pending events and
 * `shutdown` to flush + release resources before the process exits.
 */
export interface AnalyticsPort {
  readonly name: string
  capture(event: CaptureEvent): void
  identify(params: IdentifyParams): void
  flush(): Promise<void>
  shutdown(): Promise<void>
}
