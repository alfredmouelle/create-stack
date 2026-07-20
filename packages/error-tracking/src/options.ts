/**
 * Shared `Sentry.init` options.
 *
 * Sentry is initialised once per runtime (Node, edge, browser), and each of
 * those init files must agree on sampling, environment and logging. This builds
 * that common object so the runtimes can't drift apart; everything runtime
 * specific (integrations, replay) stays in the init file itself.
 */
export interface SentryOptionsInput {
  /** `SENTRY_DSN`. Absent disables Sentry rather than failing the app. */
  dsn: string | undefined
  /** Defaults to `nodeEnv`. */
  environment?: string
  /** Usually `NODE_ENV`. Drives the default sample rate. */
  nodeEnv?: string
  /** Defaults to everything in development, 10% otherwise. */
  tracesSampleRate?: number
  /** Structured logs, on by default. */
  enableLogs?: boolean
}

/**
 * Structurally compatible with `Sentry.init` across `@sentry/node`,
 * `@sentry/nextjs` and `@sentry/tanstackstart-react`; deliberately not typed
 * against any of them so the module stays framework-agnostic. Spread it into
 * the init call, which lets each runtime add its own options.
 */
export interface SentryOptions {
  dsn: string | undefined
  environment: string | undefined
  enabled: boolean
  tracesSampleRate: number
  enableLogs: boolean
}

export function sentryOptions(input: SentryOptionsInput): SentryOptions {
  const isDevelopment = input.nodeEnv === 'development'
  return {
    dsn: input.dsn,
    environment: input.environment ?? input.nodeEnv,
    // No DSN is a valid state (local dev, forks): stay off instead of throwing.
    enabled: Boolean(input.dsn),
    tracesSampleRate: input.tracesSampleRate ?? (isDevelopment ? 1 : 0.1),
    enableLogs: input.enableLogs ?? true,
  }
}
