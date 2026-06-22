/** Severity levels, from most to least verbose. */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error'

/** Arbitrary structured context attached to a log line. */
export type LogFields = Record<string, unknown>

/**
 * The port the application depends on. Swapping logging backends means swapping
 * the adapter built at the composition root; this interface never changes.
 *
 * Each method takes a human message plus optional structured fields. `child`
 * returns a new logger with `bindings` merged into every line it emits.
 */
export interface Logger {
  /** The adapter name (`'pino'`, `'console'`, …). */
  readonly name: string
  trace(msg: string, fields?: LogFields): void
  debug(msg: string, fields?: LogFields): void
  info(msg: string, fields?: LogFields): void
  warn(msg: string, fields?: LogFields): void
  error(msg: string, fields?: LogFields): void
  /** Derive a logger that pins `bindings` onto every subsequent line. */
  child(bindings: LogFields): Logger
}
