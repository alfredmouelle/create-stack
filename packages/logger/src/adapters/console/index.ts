import * as v from 'valibot'
import type { LogFields, Logger, LogLevel } from '../../core/port.js'
import { ConsoleConfigSchema } from './config.js'

export interface ConsoleAdapterOptions {
  /** Min level to emit; lower-severity dropped. Defaults to `'info'`. */
  level?: LogLevel
  /** Fields pinned onto every line. */
  bindings?: LogFields
}

const ORDER: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
}

const SINK: Record<LogLevel, (...args: unknown[]) => void> = {
  // biome-ignore lint/suspicious/noConsole: console adapter
  trace: (...args) => console.debug(...args),
  // biome-ignore lint/suspicious/noConsole: console adapter
  debug: (...args) => console.debug(...args),
  // biome-ignore lint/suspicious/noConsole: console adapter
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
}

function format(level: LogLevel, msg: string, fields: LogFields): string {
  const hasFields = Object.keys(fields).length > 0
  return hasFields ? `[${level}] ${msg} ${JSON.stringify(fields)}` : `[${level}] ${msg}`
}

function build(min: number, bindings: LogFields): Logger {
  const log = (level: LogLevel, msg: string, fields: LogFields = {}) => {
    if (ORDER[level] < min) return
    const merged = { ...bindings, ...fields }
    SINK[level](format(level, msg, merged))
  }

  return {
    name: 'console',
    trace(msg, fields) {
      log('trace', msg, fields)
    },
    debug(msg, fields) {
      log('debug', msg, fields)
    },
    info(msg, fields) {
      log('info', msg, fields)
    },
    warn(msg, fields) {
      log('warn', msg, fields)
    },
    error(msg, fields) {
      log('error', msg, fields)
    },
    child(childBindings) {
      return build(min, { ...bindings, ...childBindings })
    },
  }
}

export function consoleAdapter(options: ConsoleAdapterOptions = {}): Logger {
  const config = v.parse(ConsoleConfigSchema, { level: options.level })
  return build(ORDER[config.level], options.bindings ?? {})
}
