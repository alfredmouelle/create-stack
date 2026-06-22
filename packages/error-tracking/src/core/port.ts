/** Captured-event severity, matching common provider levels. */
export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

/** User an event is associated with. */
export interface ErrorUser {
  id?: string
  email?: string
  username?: string
}

/** Trail of events leading up to an error, for debugging. */
export interface Breadcrumb {
  message: string
  category?: string
  level?: SeverityLevel
  data?: Record<string, unknown>
}

/** Extra context attached to a single capture. */
export interface CaptureContext {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  level?: SeverityLevel
}

/** App-facing port; swap adapters at the composition root, never this interface. */
export interface ErrorTrackingPort {
  readonly name: string
  /** Report an error (or any thrown value) with optional context. */
  captureException(error: unknown, context?: CaptureContext): void
  /** Report a standalone message at severity (default `info`). */
  captureMessage(message: string, level?: SeverityLevel): void
  /** Associate subsequent events with a user; `null` clears. */
  setUser(user: ErrorUser | null): void
  /** Record a breadcrumb for subsequent events. */
  addBreadcrumb(breadcrumb: Breadcrumb): void
  /** Flush buffered events; resolves `true` if all sent in time. */
  flush(timeoutMs?: number): Promise<boolean>
}
