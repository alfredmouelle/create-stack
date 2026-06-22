import pino from 'pino'
import type { LogFields, Logger, LogLevel } from '../../core/port.js'

/**
 * Minimal structural view of a pino logger (eases testing).
 * Level methods follow pino's `(mergingObject, message)` convention.
 */
export interface PinoLike {
  trace(obj: LogFields, msg: string): void
  debug(obj: LogFields, msg: string): void
  info(obj: LogFields, msg: string): void
  warn(obj: LogFields, msg: string): void
  error(obj: LogFields, msg: string): void
  child(bindings: LogFields): PinoLike
}

export interface PinoAdapterOptions {
  /** Min level to emit; defaults to `'info'`. */
  level?: LogLevel
  /** Fields pinned onto every line. */
  bindings?: LogFields
  /** Inject a custom/mock pino; defaults to a real `pino()`. */
  client?: PinoLike
}

function wrap(client: PinoLike): Logger {
  return {
    name: 'pino',
    trace(msg, fields = {}) {
      client.trace(fields, msg)
    },
    debug(msg, fields = {}) {
      client.debug(fields, msg)
    },
    info(msg, fields = {}) {
      client.info(fields, msg)
    },
    warn(msg, fields = {}) {
      client.warn(fields, msg)
    },
    error(msg, fields = {}) {
      client.error(fields, msg)
    },
    child(bindings) {
      return wrap(client.child(bindings))
    },
  }
}

export function pinoAdapter(options: PinoAdapterOptions = {}): Logger {
  const base = options.client ?? (pino({ level: options.level ?? 'info' }) as unknown as PinoLike)
  const client = options.bindings ? base.child(options.bindings) : base
  return wrap(client)
}
