export { noopAdapter } from './adapters/noop.js'
export {
  type PlausibleAdapterOptions,
  plausibleAdapter,
} from './adapters/plausible.js'
export {
  type PostHogAdapterOptions,
  type PostHogLike,
  posthogAdapter,
} from './adapters/posthog.js'
export type {
  AnalyticsPort,
  CaptureEvent,
  IdentifyParams,
} from './port.js'
