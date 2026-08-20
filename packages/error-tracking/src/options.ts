export interface SentryOptionsInput {
  dsn: string | undefined
  environment?: string
  nodeEnv?: string
  tracesSampleRate?: number
  enableLogs?: boolean
}

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
    enabled: Boolean(input.dsn),
    tracesSampleRate: input.tracesSampleRate ?? (isDevelopment ? 1 : 0.1),
    enableLogs: input.enableLogs ?? true,
  }
}
