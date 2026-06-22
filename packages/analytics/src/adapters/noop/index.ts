import type { AnalyticsPort } from '../../core/port.js'

/**
 * An analytics adapter that does nothing. Useful in development, tests, or when
 * analytics is disabled — call sites still depend only on the port.
 */
export function noopAdapter(): AnalyticsPort {
  return {
    name: 'noop',
    capture() {},
    identify() {},
    async flush() {},
    async shutdown() {},
  }
}
