import type { AnalyticsPort } from '../../core/port.js'

/** No-op analytics adapter (dev/tests/disabled); call sites still depend on the port. */
export function noopAdapter(): AnalyticsPort {
  return {
    name: 'noop',
    capture() {},
    identify() {},
    async flush() {},
    async shutdown() {},
  }
}
