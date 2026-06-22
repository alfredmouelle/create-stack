/** Severity levels, from most to least verbose. */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

/** Arbitrary structured context attached to a log line. */
export type LogFields = Record<string, unknown>

/**
 * App-facing port; swap adapters at the composition root, never this interface.
 * Each method takes a message + optional fields; `child` merges `bindings` into every line.
 */
export interface Logger {
  /** Adapter name (`'pino'`, `'console'`, …). */
  readonly name: string
  trace(msg: string, fields?: LogFields): void
  debug(msg: string, fields?: LogFields): void
  info(msg: string, fields?: LogFields): void
  warn(msg: string, fields?: LogFields): void
  error(msg: string, fields?: LogFields): void
  /** Derive a logger pinning `bindings` onto subsequent lines. */
  child(bindings: LogFields): Logger
}
