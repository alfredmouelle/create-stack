import type { AnalyticsPort } from '../port.js'

export function noopAdapter(): AnalyticsPort {
  return {
    name: 'noop',
    capture() {},
    identify() {},
    async flush() {},
    async shutdown() {},
  }
}
