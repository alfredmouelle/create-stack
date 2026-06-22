import type {
  Breadcrumb,
  CaptureContext,
  ErrorTrackingPort,
  ErrorUser,
  SeverityLevel,
} from '../../core/port.js'

export interface ConsoleAdapterOptions {
  /** Cap how many breadcrumbs are kept in memory (oldest dropped). Default 20. */
  maxBreadcrumbs?: number
}

/**
 * A dev/test adapter that logs to the console. User and breadcrumb state are
 * kept in-memory and included in subsequent logs (best-effort, no transport).
 */
export function consoleAdapter(options: ConsoleAdapterOptions = {}): ErrorTrackingPort {
  const maxBreadcrumbs = options.maxBreadcrumbs ?? 20
  let user: ErrorUser | null = null
  const breadcrumbs: Breadcrumb[] = []

  function state() {
    return { user, breadcrumbs }
  }

  return {
    name: 'console',
    captureException(error: unknown, context?: CaptureContext) {
      console.error('[error-tracking] exception', error, { ...context, ...state() })
    },
    captureMessage(message: string, level: SeverityLevel = 'info') {
      console.error('[error-tracking] message', { message, level, ...state() })
    },
    setUser(next: ErrorUser | null) {
      user = next
    },
    addBreadcrumb(breadcrumb: Breadcrumb) {
      breadcrumbs.push(breadcrumb)
      if (breadcrumbs.length > maxBreadcrumbs) breadcrumbs.shift()
    },
    flush() {
      return Promise.resolve(true)
    },
  }
}
