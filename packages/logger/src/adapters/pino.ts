import pino from 'pino'
import type { LogFields, Logger, LogLevel } from '../port.js'

export interface PinoLike {
  trace(obj: LogFields, msg: string): void
  debug(obj: LogFields, msg: string): void
  info(obj: LogFields, msg: string): void
  warn(obj: LogFields, msg: string): void
  error(obj: LogFields, msg: string): void
  child(bindings: LogFields): PinoLike
}

export interface PinoAdapterOptions {
  level?: LogLevel
  bindings?: LogFields
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
