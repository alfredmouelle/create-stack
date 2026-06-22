export { noopAdapter } from './adapters/noop/index.js'
export { type PostHogConfig, PostHogConfigSchema } from './adapters/posthog/config.js'
export {
  type PostHogAdapterOptions,
  type PostHogLike,
  posthogAdapter,
} from './adapters/posthog/index.js'
export type {
  AnalyticsPort,
  CaptureEvent,
  IdentifyParams,
} from './core/port.js'
