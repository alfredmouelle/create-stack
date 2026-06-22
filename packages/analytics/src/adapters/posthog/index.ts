import { PostHog } from 'posthog-node'
import * as v from 'valibot'
import type { AnalyticsPort, CaptureEvent, IdentifyParams } from '../../core/port.js'
import { PostHogConfigSchema } from './config.js'

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
  // Validate early: missing key fails at construction, not at capture().
  const config = v.parse(PostHogConfigSchema, { apiKey: options.apiKey })
  const client: PostHogLike =
    options.client ?? (new PostHog(config.apiKey, { host: options.host }) as unknown as PostHogLike)

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
