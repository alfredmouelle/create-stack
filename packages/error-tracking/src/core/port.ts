/** Severity of a captured event, matching common provider levels. */
export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

/** The user an event is associated with. */
export interface ErrorUser {
  id?: string
  email?: string
  username?: string
}

/** A trail of events leading up to an error, for debugging context. */
export interface Breadcrumb {
  message: string
  category?: string
  level?: SeverityLevel
  data?: Record<string, unknown>
}

/** Extra structured context attached to a single capture. */
export interface CaptureContext {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  level?: SeverityLevel
}

/**
 * The port the application depends on. Swapping providers means swapping the
 * adapter passed to the composition root; this interface never changes.
 */
export interface ErrorTrackingPort {
  readonly name: string
  /** Report an error (or any thrown value) with optional context. */
  captureException(error: unknown, context?: CaptureContext): void
  /** Report a standalone message at the given severity (default `info`). */
  captureMessage(message: string, level?: SeverityLevel): void
  /** Associate subsequent events with a user. Pass `null` to clear. */
  setUser(user: ErrorUser | null): void
  /** Record a breadcrumb attached to subsequent events. */
  addBreadcrumb(breadcrumb: Breadcrumb): void
  /** Flush buffered events. Resolves `true` if everything was sent in time. */
  flush(timeoutMs?: number): Promise<boolean>
}
