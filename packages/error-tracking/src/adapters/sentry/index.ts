import * as Sentry from '@sentry/node'
import * as v from 'valibot'
import type {
  Breadcrumb,
  CaptureContext,
  ErrorTrackingPort,
  ErrorUser,
  SeverityLevel,
} from '../../core/port.js'
import { SentryConfigSchema } from './config.js'

/** Minimal structural view of the Sentry namespace (eases testing). */
export interface SentryCaptureContext {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  level?: SeverityLevel
}

export interface SentryLike {
  init(options: { dsn: string; environment?: string }): void
  captureException(error: unknown, context?: SentryCaptureContext): void
  captureMessage(message: string, level?: SeverityLevel): void
  setUser(user: ErrorUser | null): void
  addBreadcrumb(breadcrumb: Breadcrumb): void
  flush(timeoutMs?: number): Promise<boolean>
}

export interface SentryAdapterOptions {
  dsn: string
  environment?: string
  /** Inject a custom/mock client; defaults to the real `@sentry/node`. */
  client?: SentryLike
  /** Skip the implicit `Sentry.init` (e.g. init happens elsewhere). */
  init?: boolean
}

export function sentryAdapter(options: SentryAdapterOptions): ErrorTrackingPort {
  // Validate early: missing DSN fails at construction, not at capture().
  const config = v.parse(SentryConfigSchema, {
    dsn: options.dsn,
    environment: options.environment,
  })
  const client: SentryLike = options.client ?? (Sentry as unknown as SentryLike)

  // Only init the real namespace; injected clients are assumed already wired.
  if (options.init !== false && !options.client) {
    client.init({ dsn: config.dsn, environment: config.environment })
  }

  return {
    name: 'sentry',
    captureException(error: unknown, context?: CaptureContext) {
      client.captureException(error, {
        tags: context?.tags,
        extra: context?.extra,
        level: context?.level,
      })
    },
    captureMessage(message: string, level?: SeverityLevel) {
      client.captureMessage(message, level)
    },
    setUser(user: ErrorUser | null) {
      client.setUser(user)
    },
    addBreadcrumb(breadcrumb: Breadcrumb) {
      client.addBreadcrumb(breadcrumb)
    },
    flush(timeoutMs?: number) {
      return client.flush(timeoutMs)
    },
  }
}
