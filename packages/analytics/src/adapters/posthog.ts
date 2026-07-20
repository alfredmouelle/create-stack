import { PostHog } from 'posthog-node'
import type { AnalyticsPort, CaptureEvent, IdentifyParams } from '../port.js'

/** Minimal structural view of the PostHog client (eases testing). */
export interface PostHogLike {
  capture(payload: CaptureEvent): void
  identify(payload: IdentifyParams): void
  flush(): Promise<void>
  shutdown(): Promise<void>
}

export interface PostHogAdapterOptions {
  apiKey: string
  /** PostHog host (defaults to PostHog's default). */
  host?: string
  /** Inject a custom/mock client; defaults to a real `PostHog`. */
  client?: PostHogLike
}

export function posthogAdapter(options: PostHogAdapterOptions): AnalyticsPort {
  // Fail at construction, not on the first capture.
  if (!options.apiKey) throw new Error('posthogAdapter: apiKey is required')
  const client: PostHogLike =
    options.client ??
    (new PostHog(options.apiKey, { host: options.host }) as unknown as PostHogLike)

  return {
    name: 'posthog',
    capture(event: CaptureEvent) {
      client.capture({
        distinctId: event.distinctId,
        event: event.event,
        properties: event.properties,
      })
    },
    identify(params: IdentifyParams) {
      client.identify({
        distinctId: params.distinctId,
        properties: params.properties,
      })
    },
    flush() {
      return client.flush()
    },
    shutdown() {
      return client.shutdown()
    },
  }
}
