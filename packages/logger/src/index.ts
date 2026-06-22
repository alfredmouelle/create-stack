export { type ConsoleConfig, ConsoleConfigSchema } from './adapters/console/config.js'

export {
  type ConsoleAdapterOptions,
  consoleAdapter,
} from './adapters/console/index.js'
export {
  type PinoAdapterOptions,
  type PinoLike,
  pinoAdapter,
} from './adapters/pino/index.js'
export type { LogFields, Logger, LogLevel } from './core/port.js'
